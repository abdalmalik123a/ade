import { PDFDocument } from 'pdf-lib';
import type { SheetStyle } from '@shared/api';
import type { PageMm } from './render';

export const CHUNK_PAGE_SIZE = 8;

const PAGE_START_RE = /<div\s+[^>]*break-inside:\s*avoid[^>]*>\s*<div\s+[^>]*class="print-page"|<div\s+[^>]*class="print-page"/gi;

/** يقسم علامات الورقة إلى أوراقٍ منفصلة إن كانت تحوي أكثر من ورقة (`print-page`). */
export function splitPagesHtml(sheetHtml: string): string[] {
  PAGE_START_RE.lastIndex = 0;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = PAGE_START_RE.exec(sheetHtml)) !== null) {
    indices.push(m.index);
  }
  if (indices.length <= 1) return [sheetHtml];

  const parts: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = i === 0 ? 0 : indices[i]!;
    const end = i + 1 < indices.length ? indices[i + 1]! : sheetHtml.length;
    parts.push(sheetHtml.slice(start, end));
  }
  return parts;
}

export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length <= 1) return buffers[0] ?? Buffer.alloc(0);
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  return Buffer.from(await merged.save());
}

/** يُزيل فواصل الصفحات من آخر ورقة في الجزء حتى لا يُنتج Chromium صفحة بيضاء في نهاية الجزء */
export function stripTrailingPageBreak(html: string): string {
  return html.replace(/page-break-after:\s*always;?/gi, '').replace(/break-after:\s*page;?/gi, '');
}

/** يُخرج أجزاء PDF في الدفعات الكبيرة لخفض ذروة الذاكرة، مكرّرًا أنماط البداية ومانعًا الصفحات البيضاء */
export async function renderChunkedPdf(
  pages: string[],
  page: PageMm,
  style: SheetStyle | null,
  renderSingle: (html: string, page: PageMm, style: SheetStyle | null) => Promise<Buffer>
): Promise<Buffer> {
  // استخراج ما قبل أوّل ورقة (أنماط إن وُجدت) لتكرارها في كل جزء
  PAGE_START_RE.lastIndex = 0;
  const match = PAGE_START_RE.exec(pages[0] ?? '');
  const prefix = match && match.index > 0 ? pages[0]!.slice(0, match.index) : '';

  const chunks: Buffer[] = [];
  for (let i = 0; i < pages.length; i += CHUNK_PAGE_SIZE) {
    const slice = pages.slice(i, i + CHUNK_PAGE_SIZE);
    const lastIdx = slice.length - 1;
    const chunkParts = slice.map((p, idx) => (idx === lastIdx ? stripTrailingPageBreak(p) : p));
    const chunkHtml = (i === 0 ? '' : prefix) + chunkParts.join('');
    chunks.push(await renderSingle(chunkHtml, page, style));
    if (global.gc) {
      try {
        global.gc();
      } catch {
        /* ignore */
      }
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  return mergePdfBuffers(chunks);
}
