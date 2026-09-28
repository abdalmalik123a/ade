/**
 * محرّر PDF — المرحلة الأولى: الخطّة والبناء.
 *
 * ملفّاتٌ تُبنى بنصوصٍ في مواضع معروفة («TL» أعلى الصفحة يسارًا)، ثم تمرّ بالخطّة: ترتيبٌ
 * ودورانٌ وقصٌّ وصورةٌ صفحةً وطبقةٌ تُختم — ويُقرأ الناتج بـpdf.js كما يعرضه القارئ: أين يقع
 * كلّ نصٍّ في الصفحة **كما تُرى**. فالحساب يُقاس بما يراه الموظف لا بالمصفوفات.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  cropToUser,
  fitSearch,
  imagePage,
  layerHtml,
  numberingText,
  pageTokens,
  parseRanges,
  RASTER_STEPS,
  shownToUser,
  SIZE_LIMITS,
  sizeText,
  stampPlacement,
  watermarkText,
  type PdfPlan
} from '../src/shared/pdfEdit';
import { buildPdf, formFields, imagesToPdf, inspectPdf, shrinkPdfImages, type PdfSource } from '../src/main/services/pdfEdit';
import { fieldBox, userToShown } from '../src/shared/pdfEdit';
import { PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
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

  it('وما جاء من الماسح بدقّته صفحةٌ بمقاسه الحقيقي كاملةً: A4 ممسوحة تبقى A4', () => {
    // A4 بـ٢٠٠ نقطة: ١٦٥٤ × ٢٣٣٩ بكسل.
    const scan = imagePage({ width: 1654, height: 2339, dpi: 200 });
    expect(scan.page.width).toBeCloseTo(A4.width, 0);
    expect(scan.page.height).toBeCloseTo(A4.height, 0);
    expect(scan.draw).toEqual({ x: 0, y: 0, width: scan.page.width, height: scan.page.height });
  });
});

describe('ترقيم الصفحات', () => {
  it('{رقم} و{عدد} بالعربية، و{n} و{N} باللاتينية، في كلّ موضع', () => {
    expect(pageTokens('صفحة {رقم} من {عدد}', 3, 12)).toBe('صفحة ٣ من ١٢');
    expect(pageTokens('P{n}/{N} — {n}', 2, 4)).toBe('P2/4 — 2');
    expect(pageTokens('بلا ترقيم', 1, 1)).toBe('بلا ترقيم');
    expect(numberingText('n').pages).toBe('all');
  });

  it('والطبقة المرقَّمة تُرسم لكلّ صفحةٍ برقمها — وغير المرقَّمة مرّةً للكلّ', async () => {
    const sources = new Map<string, PdfSource>([['a', { kind: 'pdf', name: 'a.pdf', bytes: await samplePdf(['1', '2', '3']) }]]);
    const htmls: string[] = [];
    const record = (html: string, mm: { w: number; h: number }) => {
      htmls.push(html);
      return fakeLayer(html, mm);
    };
    const pages = [0, 1, 2].map((i) => ({ id: `p${i}`, source: 'a', index: i, rotate: 0 as const }));
    await buildPdf({ pages, overlays: [{ ...numberingText('n'), text: 'صفحة {رقم} من {عدد}' }] }, sources, record);
    expect(htmls).toHaveLength(3);
    expect(htmls[0]).toContain('صفحة ١ من ٣');
    expect(htmls[2]).toContain('صفحة ٣ من ٣');
    htmls.length = 0;
    await buildPdf({ pages, overlays: [watermarkText('w', 'نسخة')] }, sources, record);
    expect(htmls).toHaveLength(1);
  });
});

describe('الحجم للرفع', () => {
  it('الحدود بالعشري (الأصغر)، ومنها ما تطلبه خانات أور: ٥ و٣ و٢ و١ ميغا و١٠٠ ك.ب', () => {
    const bytes = SIZE_LIMITS.map((l) => l.bytes);
    expect(bytes).toContain(5_000_000);
    expect(bytes).toContain(1_000_000);
    expect(bytes).toContain(100_000);
    expect(bytes[0]).toBe(0);
  });

  it('الحجم كما يقرؤه الموظف', () => {
    expect(sizeText(840_000)).toBe('٨٤٠ ك.ب');
    expect(sizeText(1_234_567)).toBe('١٫٢ ميغا');
    expect(sizeText(5_000_000)).toBe('٥ ميغا');
    expect(sizeText(12)).toBe('١ ك.ب');
  });

  it('البحث يقف عند أوّل درجةٍ تبلغ الحدّ — وما لم يُبنَ لا يُقبل', async () => {
    // حجمٌ يتناسب مع مربّع الدقّة والجودة؛ والتقدير فوق الحدّ لا يُبنى.
    const size = (s: { dpi: number; quality: number }) => Math.round(s.dpi * s.dpi * s.quality * 10);
    const tried: number[] = [];
    const fit = await fitSearch(100_000, RASTER_STEPS, async (s) => {
      tried.push(s.dpi);
      const n = size(s);
      return { size: n, value: n <= 100_000 ? `ملف ${n}` : null };
    });
    expect('value' in fit && fit.size).toBeLessThanOrEqual(100_000);
    expect('step' in fit && fit.step).toEqual(RASTER_STEPS.find((s) => size(s) <= 100_000));
    expect(tried.length).toBe(RASTER_STEPS.findIndex((s) => size(s) <= 100_000) + 1);
  });

  it('وإن لم تبلغه درجةٌ عاد بأصغر ما بلغ؛ وبلا حدٍّ تكفي الأولى', async () => {
    const none = await fitSearch(10, RASTER_STEPS, async (s) => ({ size: s.dpi * 100, value: 'x' }));
    expect(none).toEqual({ smallest: 5000 });
    const free = await fitSearch(0, RASTER_STEPS, async () => ({ size: 9_000_000, value: 'x' }));
    expect('step' in free && free.step).toEqual(RASTER_STEPS[0]);
  });

  it('صور الملف أصغر ونصّه باقٍ: JPEG وحده يُعاد ترميزه، والرمادية تُعلَن ملوّنة، وCMYK وPNG كما هما', async () => {
    const jpeg = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'tiny.jpg')));
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([A4.width, A4.height]);
    page.drawText('KEEP-TEXT', { x: 40, y: 780, size: 14, font });
    const rgb = await doc.embedJpg(jpeg);
    const gray = await doc.embedJpg(jpeg);
    const cmyk = await doc.embedJpg(jpeg);
    const png = await doc.embedPng(writePng(new Uint8Array(4 * 4 * 4).fill(90), 4, 4, 72));
    for (const [i, img] of [rgb, gray, cmyk, png].entries()) page.drawImage(img, { x: 40 + i * 120, y: 500, width: 100, height: 75 });
    const bytes = await doc.save();
    // ألوان الصور تُضبط في الملف المحفوظ نفسه — كما تأتي من ماسحٍ أو برنامجٍ آخر.
    const edit = await PDFDocument.load(bytes);
    const imgs = edit.context.enumerateIndirectObjects().filter(([, o]) => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
    (imgs[1]![1] as PDFRawStream).dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
    (imgs[2]![1] as PDFRawStream).dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceCMYK'));
    const prepared = await edit.save();

    const calls: number[] = [];
    const out = await shrinkPdfImages(
      prepared,
      { scale: 0.5, quality: 0.6 },
      (_j, scale) => {
        calls.push(scale);
        return { jpeg: new Uint8Array(200), width: 10, height: 8 };
      },
      0
    );
    expect(out.images).toBe(2);
    // صورةٌ ضلعها ٤٨ بكسل لا تُصغَّر أبعادها: لا تُصغَّر صورةٌ دون ٥٠٠ بكسل.
    expect(calls).toEqual([1, 1]);
    const back = await PDFDocument.load(out.bytes);
    const dicts = back.context
      .enumerateIndirectObjects()
      .filter(([, o]) => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'))
      .map(([, o]) => (o as PDFRawStream).dict);
    const widths = dicts.map((d) => (d.get(PDFName.of('Width')) as PDFNumber).asNumber()).sort((a, b) => a - b);
    // PNG الشفّاف صورتان (هو وقناعه) كما هما، وCMYK كما هو (٦٤)، والملوّنة والرمادية صُغّرتا.
    expect(widths).toEqual([4, 4, 10, 10, 64]);
    // الرمادية JPEG صارت ملوّنة (الترميز الجديد ثلاثيّ القنوات) — وقناع PNG الرماديّ كما هو.
    const jpegs = dicts.filter((d) => d.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'));
    expect(jpegs.filter((d) => d.get(PDFName.of('ColorSpace')) === PDFName.of('DeviceGray'))).toHaveLength(0);
    expect(dicts.filter((d) => d.get(PDFName.of('ColorSpace')) === PDFName.of('DeviceCMYK'))).toHaveLength(1);
    const [shown] = await shownTexts(out.bytes);
    expect(at(shown!, 'KEEP-TEXT')).toBeTruthy();
    // وما أكبره الترميز لا يُكتب، وملفٌّ بلا صورٍ تُصغَّر يعود كما هو.
    const same = await shrinkPdfImages(prepared, { scale: 1, quality: 0.9 }, (j) => ({ jpeg: new Uint8Array(j.length + 10), width: 64, height: 48 }), 0);
    expect(same).toEqual({ bytes: prepared, images: 0 });
  });

  it('صور JPEG ملفًّا: كلّ صورةٍ صفحةٌ بمقاسها، والحجم قرابة مجموع الصور', async () => {
    const jpeg = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'tiny.jpg')));
    const out = await imagesToPdf([
      { jpeg, width: A4.width, height: A4.height },
      { jpeg, width: 842, height: 595 }
    ]);
    const info = await inspectPdf(out);
    expect(info.map((p) => [Math.round(p.width), Math.round(p.height)])).toEqual([
      [595, 842],
      [842, 595]
    ]);
    // الصورة نفسها مرّتين بلا إعادة ضغط — والغلاف دون ما يقدّره `pdfOverhead`.
    expect(out.length).toBeLessThan(2 * jpeg.length + 1200 + 450 * 2);
    await expect(imagesToPdf([{ jpeg: writePng(new Uint8Array(4 * 4 * 4), 4, 4, 72), width: 10, height: 10 }])).rejects.toThrow('ليست JPEG');
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

describe('الاستمارة القابلة للتعبئة (تعميق الموجود ٧)', () => {
  async function formPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const p1 = doc.addPage([A4.width, A4.height]);
    const p2 = doc.addPage([A4.width, A4.height]);
    const form = doc.getForm();
    form.createTextField('full_name').addToPage(p1, { x: 100, y: 700, width: 200, height: 20 });
    const office = form.createTextField('Office');
    office.setText('VALUE-1');
    office.addToPage(p1, { x: 100, y: 650, width: 200, height: 20 });
    const sex = form.createDropdown('Sex');
    sex.addOptions(['M', 'F']);
    sex.addToPage(p1, { x: 100, y: 600, width: 80, height: 18 });
    form.createCheckBox('agree').addToPage(p2, { x: 60, y: 100, width: 12, height: 12 });
    return doc.save();
  }

  it('من فضاء الصفحة إلى ما يُرى وعودًا — في الدورانات الأربعة', () => {
    const box = { x: 10, y: 20, width: 600, height: 800 };
    for (const r of [0, 90, 180, 270] as const) {
      const p = shownToUser(box, r, 0.25, 0.75);
      const back = userToShown(box, r, p.x, p.y);
      expect(back.u).toBeCloseTo(0.25);
      expect(back.v).toBeCloseTo(0.75);
    }
    // حقلٌ أعلى الصفحة يسارًا صندوقٌ أعلاها يسارًا كما يُرى.
    const b = fieldBox(box, 0, { x: 10, y: 760, width: 300, height: 60 });
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(0);
    expect(b.w).toBeCloseTo(0.5);
    expect(b.h).toBeCloseTo(0.075);
  });

  it('الحقول بأنواعها ومواضعها وصفحاتها وقيمها', async () => {
    const fields = formFields(await PDFDocument.load(await formPdf()));
    const by = Object.fromEntries(fields.map((f) => [f.name, f]));
    expect(by['full_name']).toMatchObject({ kind: 'text', page: 0, value: '' });
    // الصندوق بحدوده: المكتبة تكتبه أوسع بنصف سُمك الإطار من كلّ جهة.
    const r = by['full_name']!.rect;
    expect([r.x, r.y, r.width, r.height].map((v) => Math.round(v))).toEqual([100, 700, 201, 21]);
    expect(by['Office']).toMatchObject({ kind: 'text', value: 'VALUE-1' });
    expect(by['Sex']).toMatchObject({ kind: 'choice', page: 0 });
    expect(by['agree']).toMatchObject({ kind: 'check', page: 1, value: '' });
    expect(formFields(await PDFDocument.load(await samplePdf(['1'])))).toEqual([]);
  });

  it('والبناء: الفارغ يُحذف، وما فيه قيمةٌ يبقى مرسومًا — ولا استمارة في الناتج', async () => {
    const sources = new Map<string, PdfSource>([['f', { kind: 'pdf', name: 'f.pdf', bytes: await formPdf() }]]);
    const plan: PdfPlan = {
      pages: [
        { id: 'a', source: 'f', index: 0, rotate: 0 },
        { id: 'b', source: 'f', index: 1, rotate: 0 }
      ],
      overlays: []
    };
    const out = await buildPdf(plan, sources, null);
    const [first] = await shownTexts(out);
    expect(first!.items.some((i) => i.text.includes('VALUE-1'))).toBe(true);
    expect(formFields(await PDFDocument.load(out))).toEqual([]);
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
