/**
 * صفحاتٌ في ورقة (S27، D178): الشبكة التي تكبّر الصفحة أكثر، والترتيب من اليمين ثمّ إلى أسفل، والصفحة المُدارة كما تُرى — حسابًا خالصًا،
 * ثم على ملفٍّ مبنيٍّ حقًّا يُقرأ بـpdf.js: أين يقع نصّ كلّ صفحةٍ في الورقة. والفارغة (S28) في `pdfEdit.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { A4, placeInCell, sheetLayout, sheetsCount } from '../src/shared/pdfSheets';
import { buildPdf, type PdfSource } from '../src/main/services/pdfEdit';
import { toSheets } from '../src/main/services/pdfSheets';
import type { PdfPlan } from '../src/shared/pdfEdit';

const PAGE = { w: A4.w, h: A4.h };

/** ملفٌّ بصفحاتٍ في كلٍّ منها «TL<اسمها>» أعلاها يسارًا. */
async function samplePdf(names: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const name of names) doc.addPage([PAGE.w, PAGE.h]).drawText(`TL${name}`, { x: 30, y: PAGE.h - 40, size: 14, font });
  return doc.save();
}

/** نصوص كلّ ورقةٍ بمواضعها كما تُرى (٠..١ من أعلاها يسارًا)، ومقاسها. */
async function shown(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false, verbosity: 0 }).promise;
  const out: { w: number; h: number; at: Record<string, { x: number; y: number }> }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const at: Record<string, { x: number; y: number }> = {};
    for (const it of (await page.getTextContent()).items as { str?: string; transform?: number[] }[]) {
      if (!it.str?.trim() || !it.transform) continue;
      const [x, y] = vp.convertToViewportPoint(it.transform[4]!, it.transform[5]!);
      at[it.str] = { x: x / vp.width, y: y / vp.height };
    }
    out.push({ w: vp.width, h: vp.height, at });
  }
  return out;
}

const build = async (names: string[], rotate: 0 | 90 = 0) => {
  const sources = new Map<string, PdfSource>([['a', { kind: 'pdf', name: 'a.pdf', bytes: await samplePdf(names) }]]);
  const plan: PdfPlan = { pages: names.map((_, i) => ({ id: `p${i}`, source: 'a', index: i, rotate })), overlays: [] };
  return buildPdf(plan, sources, null);
};

describe('صفحاتٌ في ورقة: التخطيط', () => {
  it('صفحات A4 عموديّة: الشبكة التي تكبّر الصفحة أكثر', () => {
    const grid = (n: number) => {
      const l = sheetLayout(n, PAGE);
      return `${l.sheet.w > l.sheet.h ? 'أفقيّة' : 'عموديّة'} ${l.cols}×${l.rows}`;
    };
    expect([2, 4, 6, 8, 9, 12, 16].map(grid)).toEqual(['أفقيّة 2×1', 'عموديّة 2×2', 'أفقيّة 3×2', 'أفقيّة 4×2', 'عموديّة 3×3', 'عموديّة 3×4', 'عموديّة 4×4']);
    // وصفحاتٌ أفقيّة على ٢: ورقةٌ عموديّة إحداهما فوق الأخرى.
    expect(sheetLayout(2, { w: PAGE.h, h: PAGE.w })).toMatchObject({ cols: 1, rows: 2, sheet: { w: A4.w, h: A4.h } });
  });

  it('الترتيب من اليمين ثمّ إلى أسفل، والخانات داخل الورقة', () => {
    const l = sheetLayout(4, PAGE);
    const [a, b, c] = l.cells as [(typeof l.cells)[0], (typeof l.cells)[0], (typeof l.cells)[0]];
    expect(a.x).toBeGreaterThan(b.x); // الثانية يسار الأولى
    expect(a.y).toBe(b.y);
    expect(c.y).toBeLessThan(a.y); // الثالثة تحتهما (الأصل أسفل الورقة)
    expect(c.x).toBe(a.x);
    for (const cell of l.cells) {
      expect(cell.x).toBeGreaterThan(0);
      expect(cell.y).toBeGreaterThan(0);
      expect(cell.x + cell.w).toBeLessThanOrEqual(l.sheet.w);
      expect(cell.y + cell.h).toBeLessThanOrEqual(l.sheet.h);
    }
    expect(sheetsCount(7, 4)).toBe(2);
    expect(sheetsCount(8, 4)).toBe(2);
  });

  it('الصفحة المُدارة ٩٠° تُرسم قائمةً كما تُرى: صندوق رسمها عريضٌ وداخل خانتها', () => {
    const cell = sheetLayout(2, { w: PAGE.h, h: PAGE.w }).cells[0]!;
    const p = placeInCell(cell, PAGE, 90);
    // زوايا الصفحة بعد التحجيم والدوران (عكس عقارب الساعة بـrotate درجة حول نقطة الرسم).
    const t = (p.rotate * Math.PI) / 180;
    const corners = [[0, 0], [PAGE.w, 0], [0, PAGE.h], [PAGE.w, PAGE.h]].map(([u, v]) => ({
      x: p.x + p.scale * (u! * Math.cos(t) - v! * Math.sin(t)),
      y: p.y + p.scale * (u! * Math.sin(t) + v! * Math.cos(t))
    }));
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(cell.x - 0.01);
    expect(Math.max(...xs)).toBeLessThanOrEqual(cell.x + cell.w + 0.01);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(cell.y - 0.01);
    expect(Math.max(...ys)).toBeLessThanOrEqual(cell.y + cell.h + 0.01);
  });
});

describe('صفحاتٌ في ورقة: الملفّ المبنيّ', { timeout: 30_000 }, () => {
  it('سبع صفحاتٍ على ٤: ورقتا A4، الأولى أعلى اليمين ثمّ يسارها ثمّ تحتهما، والأخيرة ناقصة', async () => {
    const out = await shown(await toSheets(await build(['1', '2', '3', '4', '5', '6', '7']), 4));
    expect(out).toHaveLength(2);
    expect(out[0]!.w).toBeCloseTo(A4.w, 0);
    expect(out[0]!.h).toBeCloseTo(A4.h, 0);
    const p = out[0]!.at;
    expect(p['TL1']!.x > 0.5 && p['TL1']!.y < 0.5).toBe(true);
    expect(p['TL2']!.x < 0.5 && p['TL2']!.y < 0.5).toBe(true);
    expect(p['TL3']!.x > 0.5 && p['TL3']!.y > 0.5).toBe(true);
    expect(p['TL4']!.x < 0.5 && p['TL4']!.y > 0.5).toBe(true);
    expect(Object.keys(out[1]!.at).sort()).toEqual(['TL5', 'TL6', 'TL7']);
  });

  it('والمُدارة ٩٠° كما تُرى: «أعلى يسارها» يصير أعلى يمين خانتها', async () => {
    const out = await shown(await toSheets(await build(['1', '2'], 90), 2));
    expect(out).toHaveLength(1);
    // صفحتان عريضتان (بعد الدوران) على ورقةٍ عموديّة: الأولى فوق.
    expect(out[0]!.h).toBeGreaterThan(out[0]!.w);
    const tl = out[0]!.at['TL1']!;
    expect(tl.x).toBeGreaterThan(0.8);
    expect(tl.y).toBeLessThan(0.15);
  });

  it('وصفحةٌ في ورقة: الملفّ كما بُني', async () => {
    const bytes = await build(['1']);
    expect(await toSheets(bytes, 1)).toBe(bytes);
  });
});
