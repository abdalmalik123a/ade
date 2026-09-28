/**
 * محرّر PDF — المرحلة الأولى: الخطّة والبناء.
 *
 * ملفّاتٌ تُبنى بنصوصٍ في مواضع معروفة («TL» أعلى الصفحة يسارًا)، ثم تمرّ بالخطّة: ترتيبٌ
 * ودورانٌ وقصٌّ وصورةٌ صفحةً وطبقةٌ تُختم — ويُقرأ الناتج بـpdf.js كما يعرضه القارئ: أين يقع
 * كلّ نصٍّ في الصفحة **كما تُرى**. فالحساب يُقاس بما يراه الموظف لا بالمصفوفات.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  cropToUser,
  imagePage,
  layerHtml,
  parseRanges,
  shownToUser,
  stampPlacement,
  watermarkText,
  type PdfPlan
} from '../src/shared/pdfEdit';
import { buildPdf, inspectPdf, type PdfSource } from '../src/main/services/pdfEdit';
import { writePng } from '../src/main/services/png';

const A4 = { width: 595.28, height: 841.89 };

/** ملفٌّ بصفحاتٍ في كلٍّ منها «TL» أعلاها يسارًا و«BR» أسفلها يمينًا، واسم الصفحة وسطها. */
async function samplePdf(names: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const name of names) {
    const p = doc.addPage([A4.width, A4.height]);
    p.drawText(`TL${name}`, { x: 30, y: A4.height - 40, size: 14, font });
    p.drawText(`BR${name}`, { x: A4.width - 90, y: 30, size: 14, font });
  }
  return doc.save();
}

/** طبقةٌ بديلة (بلا Chromium): «STAMP» أعلى الطبقة يسارًا — والحساب يُقاس بموضعها. */
let layerCalls = 0;
async function fakeLayer(_html: string, mm: { w: number; h: number }): Promise<Uint8Array> {
  layerCalls++;
  const doc = await PDFDocument.create();
  const w = (mm.w / 25.4) * 72;
  const h = (mm.h / 25.4) * 72;
  const p = doc.addPage([w, h]);
  p.drawText('STAMP', { x: 12, y: h - 30, size: 12, font: await doc.embedFont(StandardFonts.Helvetica) });
  return doc.save();
}

type Found = { text: string; x: number; y: number };
/** النصوص بمواضعها كما تُرى — نسبةً من عرض الصفحة المعروضة وارتفاعها (٠..١، من أعلاها يسارًا). */
async function shownTexts(bytes: Uint8Array): Promise<{ w: number; h: number; items: Found[] }[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false, verbosity: 0 }).promise;
  const out: { w: number; h: number; items: Found[] }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((it): it is typeof it & { str: string; transform: number[] } => 'str' in it && Boolean((it as { str: string }).str.trim()))
      .map((it) => {
        const [x, y] = vp.convertToViewportPoint(it.transform[4]!, it.transform[5]!);
        return { text: it.str, x: x / vp.width, y: y / vp.height };
      });
    out.push({ w: vp.width, h: vp.height, items });
  }
  return out;
}
const at = (page: { items: Found[] }, text: string) => page.items.find((i) => i.text === text);

describe('نطاقات الصفحات كما يكتبها الموظف', () => {
  it('أرقامٌ ومدىً وفواصل عربية، بلا تكرار، وما خرج يُترك', () => {
    expect(parseRanges('1-3، 5', 6)).toEqual([0, 1, 2, 4]);
    expect(parseRanges('٢-', 5)).toEqual([1, 2, 3, 4]);
    expect(parseRanges('-2', 5)).toEqual([0, 1]);
    expect(parseRanges('3-1', 5)).toEqual([2, 1, 0]);
    expect(parseRanges('9, 2, 2', 4)).toEqual([1]);
    expect(parseRanges('كلام', 4)).toEqual([]);
  });
});

describe('من الصفحة كما تُرى إلى فضاء الملف', () => {
  const box = { x: 0, y: 0, width: 600, height: 800 };
  it('أعلى الصفحة يسارًا في كلّ دوران', () => {
    expect(shownToUser(box, 0, 0, 0)).toEqual({ x: 0, y: 800 });
    // مع عقارب الساعة: أسفلها الأيسر صار أعلاها الأيسر.
    expect(shownToUser(box, 90, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(shownToUser(box, 180, 0, 0)).toEqual({ x: 600, y: 0 });
    expect(shownToUser(box, 270, 0, 0)).toEqual({ x: 600, y: 800 });
  });

  it('قصّ النصف الأعلى كما يُرى', () => {
    expect(cropToUser(box, 0, { x: 0, y: 0, w: 1, h: 0.5 })).toEqual({ x: 0, y: 400, width: 600, height: 400 });
    // مدارةً ٩٠: أعلى ما يُرى هو يسار الملف.
    expect(cropToUser(box, 90, { x: 0, y: 0, w: 1, h: 0.5 })).toEqual({ x: 0, y: 0, width: 300, height: 800 });
  });

  it('وموضع الختم لكلّ دوران', () => {
    expect(stampPlacement(box, 0)).toEqual({ x: 0, y: 0, rotate: 0 });
    expect(stampPlacement(box, 90)).toEqual({ x: 600, y: 0, rotate: 90 });
    expect(stampPlacement(box, 180)).toEqual({ x: 600, y: 800, rotate: 180 });
    expect(stampPlacement(box, 270)).toEqual({ x: 0, y: 800, rotate: 270 });
  });

  it('والصورة صفحةً: A4 باتجاهها، في وسطها بهامش، لا تُمطّ', () => {
    const tall = imagePage({ width: 1000, height: 2000 });
    expect(tall.page.height).toBeGreaterThan(tall.page.width);
    expect(tall.draw.height / tall.draw.width).toBeCloseTo(2);
    const wide = imagePage({ width: 3000, height: 1000 });
    expect(wide.page.width).toBeGreaterThan(wide.page.height);
    expect(wide.draw.x).toBeCloseTo((wide.page.width - wide.draw.width) / 2);
  });
});

describe('البناء كما يُرى', () => {
  it('الدوران في الاتجاهات الأربعة، والختم أعلى الصفحة يسارًا في كلٍّ منها', async () => {
    const sources = new Map<string, PdfSource>([['a', { kind: 'pdf', name: 'a.pdf', bytes: await samplePdf(['1']) }]]);
    const plan: PdfPlan = {
      pages: ([0, 90, 180, 270] as const).map((r) => ({ id: `p${r}`, source: 'a', index: 0, rotate: r })),
      overlays: [{ ...watermarkText('w', 'x'), id: 's', box: { x: 0, y: 0, w: 0.3, h: 0.1 }, angle: 0 }]
    };
    const pages = await shownTexts(await buildPdf(plan, sources, fakeLayer));
    expect(pages).toHaveLength(4);
    for (const p of pages) {
      const stamp = at(p, 'STAMP')!;
      expect(stamp.x, JSON.stringify(p)).toBeLessThan(0.15);
      expect(stamp.y, JSON.stringify(p)).toBeLessThan(0.15);
    }
    // والأصل يدور معه: «TL» أعلى يسار ← أعلى يمين (٩٠) ← أسفل يمين (١٨٠) ← أسفل يسار (٢٧٠).
    const tl = pages.map((p) => at(p, 'TL1')!);
    expect(tl[0]!.x < 0.2 && tl[0]!.y < 0.2).toBe(true);
    expect(tl[1]!.x > 0.8 && tl[1]!.y < 0.2).toBe(true);
    expect(tl[2]!.x > 0.8 && tl[2]!.y > 0.8).toBe(true);
    expect(tl[3]!.x < 0.2 && tl[3]!.y > 0.8).toBe(true);
    // وما يُرى عرضًا يُرى عرضًا.
    expect(pages[1]!.w).toBeGreaterThan(pages[1]!.h);
  });

  it('الترتيب والدمج والحذف: ما في الخطّة وحده، بترتيبها', async () => {
    const sources = new Map<string, PdfSource>([
      ['a', { kind: 'pdf', name: 'a.pdf', bytes: await samplePdf(['A1', 'A2', 'A3']) }],
      ['b', { kind: 'pdf', name: 'b.pdf', bytes: await samplePdf(['B1']) }]
    ]);
    const plan: PdfPlan = {
      pages: [
        { id: '1', source: 'b', index: 0, rotate: 0 },
        { id: '2', source: 'a', index: 2, rotate: 0 },
        { id: '3', source: 'a', index: 0, rotate: 0 }
      ],
      overlays: []
    };
    const pages = await shownTexts(await buildPdf(plan, sources, null));
    expect(pages.map((p) => p.items.find((i) => i.text.startsWith('TL'))?.text)).toEqual(['TLB1', 'TLA3', 'TLA1']);
  });

  it('القصّ: ما خارج القصّ لا يُرى، والصفحة بمقاسه', async () => {
    const sources = new Map<string, PdfSource>([['a', { kind: 'pdf', name: 'a.pdf', bytes: await samplePdf(['1']) }]]);
    const plan: PdfPlan = {
      pages: [{ id: 'c', source: 'a', index: 0, rotate: 0, crop: { x: 0, y: 0, w: 1, h: 0.5 } }],
      overlays: [{ ...watermarkText('w', 'x'), id: 's', box: { x: 0, y: 0, w: 0.3, h: 0.1 }, angle: 0 }]
    };
    const out = await buildPdf(plan, sources, fakeLayer);
    const [page] = await shownTexts(out);
    expect(page!.h).toBeCloseTo(A4.height / 2, 0);
    expect(at(page!, 'TL1')!.y).toBeLessThan(0.2);
    // «BR» في النصف الأسفل: خارج الصفحة المقصوصة.
    const br = at(page!, 'BR1');
    expect(!br || br.y > 1).toBe(true);
    // والختم أعلى الصفحة المقصوصة لا أعلى الأصل.
    expect(at(page!, 'STAMP')!.y).toBeLessThan(0.2);
  });

  it('الصورة صفحةً A4 والطبقة نفسها تُرسم مرّةً للصفحات المتماثلة', async () => {
    const rgba = new Uint8Array(40 * 80 * 4).fill(200);
    const sources = new Map<string, PdfSource>([
      ['img', { kind: 'image', name: 'id.png', bytes: writePng(rgba, 40, 80, 300), width: 40, height: 80 }]
    ]);
    const plan: PdfPlan = {
      pages: [0, 1, 2].map((i) => ({ id: `i${i}`, source: 'img', index: 0, rotate: 0 as const })),
      overlays: [{ ...watermarkText('w', 'x'), id: 'wm' }]
    };
    layerCalls = 0;
    const out = await buildPdf(plan, sources, fakeLayer);
    expect(layerCalls).toBe(1);
    const info = await inspectPdf(out);
    expect(info).toHaveLength(3);
    expect(info[0]!.height).toBeGreaterThan(info[0]!.width);
    expect(Math.round(info[0]!.width)).toBe(595);
  });

  it('وما لا يُفتح يُقال بسببه', async () => {
    await expect(inspectPdf(new TextEncoder().encode('ليس PDF'))).rejects.toThrow('ليس PDF صالحًا');
    const encrypted = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n' +
        'trailer << /Root 1 0 R /Encrypt << /Filter /Standard /V 1 /R 2 >> >>\n%%EOF'
    );
    await expect(inspectPdf(encrypted)).rejects.toThrow('محميٌّ بكلمة مرور');
  });
});

describe('طبقة النصّ ورقةً تُرسم', () => {
  it('النصّ باتجاهه، والموضع والميل والشفافية بالملّم، ولا حقن', () => {
    const html = layerHtml(
      [{ ...watermarkText('w', 'مكتب النور <b>'), box: { x: 0.1, y: 0.2, w: 0.5, h: 0.1 } }],
      { w: 210, h: 297 }
    );
    expect(html).toContain('dir="auto"');
    expect(html).toContain('left:21.00mm;top:59.40mm');
    expect(html).toContain('rotate(-30deg)');
    expect(html).toContain('opacity:0.16');
    expect(html).toContain('مكتب النور &lt;b&gt;');
  });
});
