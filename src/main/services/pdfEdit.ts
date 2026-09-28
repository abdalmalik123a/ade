/**
 * محرّر PDF — البناء: من الخطّة (`@shared/pdfEdit`) إلى ملفٍّ جديد.
 *
 * الصفحات تُنسخ من مصادرها بترتيب الخطّة، فتُدار وتُقصّ، ثم تُختم فوقها طبقاتها. والطبقة
 * ترسمها `renderLayer` (محرّك الطباعة في التطبيق: النصّ العربي موصولٌ مرتّب ويبقى نصًّا)
 * — وتُمرَّر من الخارج ليُختبر البناء بلا Electron. والطبقة الواحدة لصفحاتٍ كثيرة (العلامة
 * المائية على الكلّ) تُرسم مرّةً وتُختم على كلّها.
 */
import { PDFDocument, degrees, type PDFEmbeddedPage, type PDFPage } from 'pdf-lib';
import {
  cropToUser,
  imagePage,
  layerHtml,
  overlaysFor,
  ptToMm,
  shownSize,
  stampPlacement,
  totalRotation,
  type PdfPlan,
  type PtBox,
  type Rotation
} from '@shared/pdfEdit';

export type PdfSource =
  | { kind: 'pdf'; name: string; bytes: Uint8Array }
  | { kind: 'image'; name: string; bytes: Uint8Array; width: number; height: number };

export type LayerRenderer = (html: string, pageMm: { w: number; h: number }) => Promise<Uint8Array>;

export type PageInfo = { width: number; height: number; rotation: Rotation };

/** رسالةٌ يفهمها الموظف لملفٍّ لا يُفتح — محميٌّ أو تالف. */
function openError(e: unknown): Error {
  const name = e instanceof Error ? e.constructor.name : '';
  const text = e instanceof Error ? e.message : String(e);
  if (name === 'EncryptedPDFError' || /encrypt/i.test(text)) {
    return new Error('الملف محميٌّ بكلمة مرور — لا يُفتح بدونها');
  }
  return new Error('تعذّر فتح الملف — ليس PDF صالحًا، أو هو تالفٌ أو مقطوع');
}

export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    throw openError(e);
  }
}

/** صفحات الملف بمقاسها (صندوق القصّ) ودورانها — لتُعرض قبل أيّ تعديل. */
export async function inspectPdf(bytes: Uint8Array): Promise<PageInfo[]> {
  const doc = await loadPdf(bytes);
  if (!doc.getPageCount()) throw new Error('الملف بلا صفحات');
  return doc.getPages().map((p) => {
    const box = p.getCropBox();
    return { width: box.width, height: box.height, rotation: totalRotation(p.getRotation().angle, 0) };
  });
}

const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50;
const isJpg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8;

export async function buildPdf(plan: PdfPlan, sources: Map<string, PdfSource>, renderLayer: LayerRenderer | null): Promise<Uint8Array> {
  if (!plan.pages.length) throw new Error('لا صفحات في الملف');
  const out = await PDFDocument.create();
  out.setProducer('ديوان');
  out.setCreator('ديوان — محرّر PDF');

  const loaded = new Map<string, PDFDocument>();
  const layers = new Map<string, PDFEmbeddedPage>();

  for (const ref of plan.pages) {
    const src = sources.get(ref.source);
    if (!src) throw new Error('مصدر صفحةٍ غير موجود — أعد فتح الملف');

    let page: PDFPage;
    let base: number;
    if (src.kind === 'pdf') {
      let doc = loaded.get(ref.source);
      if (!doc) {
        doc = await loadPdf(src.bytes);
        loaded.set(ref.source, doc);
      }
      if (ref.index < 0 || ref.index >= doc.getPageCount()) throw new Error('صفحةٌ خارج الملف');
      const [copied] = await out.copyPages(doc, [ref.index]);
      page = out.addPage(copied!);
      base = page.getRotation().angle;
    } else {
      if (!isPng(src.bytes) && !isJpg(src.bytes)) throw new Error('الصورة ليست PNG ولا JPEG');
      const image = isPng(src.bytes) ? await out.embedPng(src.bytes) : await out.embedJpg(src.bytes);
      const { page: size, draw } = imagePage({ width: src.width, height: src.height });
      page = out.addPage([size.width, size.height]);
      page.drawImage(image, draw);
      base = 0;
    }

    const rotation = totalRotation(base, ref.rotate);
    page.setRotation(degrees(rotation));
    const c = page.getCropBox();
    let box: PtBox = { x: c.x, y: c.y, width: c.width, height: c.height };
    if (ref.crop) {
      box = cropToUser(box, rotation, ref.crop);
      // الصندوقان معًا: القصّ يُرى ويُطبع في كلّ قارئ، لا في بعضها.
      page.setMediaBox(box.x, box.y, box.width, box.height);
      page.setCropBox(box.x, box.y, box.width, box.height);
    }

    const overlays = overlaysFor(plan, ref.id);
    if (overlays.length && renderLayer) {
      const shown = shownSize(box, rotation);
      const mm = { w: Math.round(ptToMm(shown.w) * 100) / 100, h: Math.round(ptToMm(shown.h) * 100) / 100 };
      const key = JSON.stringify([mm, overlays.map((o) => ({ ...o, id: '', pages: '' }))]);
      let layer = layers.get(key);
      if (!layer) {
        const bytes = await renderLayer(layerHtml(overlays, mm), mm);
        [layer] = await out.embedPdf(bytes, [0]);
        layers.set(key, layer!);
      }
      const at = stampPlacement(box, rotation);
      page.drawPage(layer!, { x: at.x, y: at.y, width: shown.w, height: shown.h, rotate: degrees(at.rotate) });
    }
  }
  return out.save();
}
