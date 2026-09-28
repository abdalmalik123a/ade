/**
 * محرّر PDF — البناء: من الخطّة (`@shared/pdfEdit`) إلى ملفٍّ جديد.
 *
 * الصفحات تُنسخ من مصادرها بترتيب الخطّة، فتُدار وتُقصّ، ثم تُختم فوقها طبقاتها. والطبقة
 * ترسمها `renderLayer` (محرّك الطباعة في التطبيق: النصّ العربي موصولٌ مرتّب ويبقى نصًّا)
 * — وتُمرَّر من الخارج ليُختبر البناء بلا Electron. والطبقة الواحدة لصفحاتٍ كثيرة (العلامة
 * المائية على الكلّ) تُرسم مرّةً وتُختم على كلّها.
 */
import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFRawStream, degrees, type PDFEmbeddedPage, type PDFPage } from 'pdf-lib';
import {
  cropToUser,
  imagePage,
  layerHtml,
  overlaysFor,
  pageTokens,
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
  /** و`dpi` لما جاء من الماسح: صفحةٌ بمقاسه الحقيقي (`imagePage`). */
  | { kind: 'image'; name: string; bytes: Uint8Array; width: number; height: number; dpi?: number };

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
  const total = plan.pages.length;

  for (const [position, ref] of plan.pages.entries()) {
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
      const { page: size, draw } = imagePage({ width: src.width, height: src.height, dpi: src.dpi });
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

    // الترقيم يُحلّ لكلّ صفحة؛ وما لا ترقيم فيه يبقى طبقةً واحدةً للصفحات المتماثلة.
    const overlays = overlaysFor(plan, ref.id).map((o) => (o.kind === 'text' ? { ...o, text: pageTokens(o.text, position + 1, total) } : o));
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

/**
 * يعيد ترميز صورة JPEG أصغر: بنسبةٍ من أبعادها وبجودة — ويعود بها وبأبعادها، أو بعدمٍ إن
 * لم تُقرأ. يُمرَّر من الخارج (nativeImage في التطبيق) فتُختبر الخدمة بلا Electron.
 */
export type JpegShrink = (jpeg: Uint8Array, scale: number, quality: number) => { jpeg: Uint8Array; width: number; height: number } | null;

const NAME = {
  subtype: PDFName.of('Subtype'),
  image: PDFName.of('Image'),
  filter: PDFName.of('Filter'),
  dct: PDFName.of('DCTDecode'),
  colorSpace: PDFName.of('ColorSpace'),
  width: PDFName.of('Width'),
  height: PDFName.of('Height'),
  bpc: PDFName.of('BitsPerComponent'),
  decode: PDFName.of('Decode'),
  decodeParms: PDFName.of('DecodeParms'),
  rgb: PDFName.of('DeviceRGB'),
  gray: PDFName.of('DeviceGray'),
  icc: PDFName.of('ICCBased')
};

/**
 * صور الملف أصغر **ونصّه باقٍ** (قبل أن تصير الصفحات صورًا لتبلغ الحدّ).
 *
 * تُصغَّر صور JPEG وحدها (وهي صور المستمسكات والهاتف في الملفّات): الملوّنة والرمادية.
 * وما سواها كما هو — CMYK، والمفهرسة، وصور الماسحات بالأبيض والأسود (JBIG2/CCITT) —
 * فإعادة ترميزها تفسد ألوانها أو تكبرها. والصغيرة (دون `minBytes`) تُترك: لا تُغني.
 */
export async function shrinkPdfImages(
  bytes: Uint8Array,
  step: { scale: number; quality: number },
  shrink: JpegShrink,
  minBytes = 20_000
): Promise<{ bytes: Uint8Array; images: number }> {
  const doc = await loadPdf(bytes);
  const ctx = doc.context;
  let images = 0;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || obj.contents.length < minBytes) continue;
    const d = obj.dict;
    if (d.get(NAME.subtype) !== NAME.image) continue;
    const filter = d.get(NAME.filter);
    const dct = filter === NAME.dct || (filter instanceof PDFArray && filter.size() === 1 && filter.get(0) === NAME.dct);
    if (!dct) continue;
    const cs = ctx.lookup(d.get(NAME.colorSpace));
    const iccChannels = () => {
      if (!(cs instanceof PDFArray) || cs.get(0) !== NAME.icc) return 0;
      const profile = ctx.lookup(cs.get(1));
      const n = profile instanceof PDFRawStream ? profile.dict.get(PDFName.of('N')) : undefined;
      return n instanceof PDFNumber ? n.asNumber() : 0;
    };
    if (!(cs === NAME.rgb || cs === NAME.gray || [1, 3].includes(iccChannels()))) continue;
    const w = (ctx.lookup(d.get(NAME.width)) as PDFNumber | undefined)?.asNumber() ?? 0;
    const h = (ctx.lookup(d.get(NAME.height)) as PDFNumber | undefined)?.asNumber() ?? 0;
    if (!w || !h) continue;
    const scale = Math.min(1, Math.max(step.scale, 500 / Math.min(w, h)));
    const out = shrink(obj.contents, scale, step.quality);
    if (!out || out.jpeg.length >= obj.contents.length) continue;
    // الترميز الجديد ثلاثيّ القنوات دائمًا — فالرمادية تُعلَن ملوّنة، وما كان يقلب ألوانها يُحذف.
    d.set(NAME.width, PDFNumber.of(out.width));
    d.set(NAME.height, PDFNumber.of(out.height));
    d.set(NAME.colorSpace, NAME.rgb);
    d.set(NAME.bpc, PDFNumber.of(8));
    d.set(NAME.filter, NAME.dct);
    d.delete(NAME.decode);
    d.delete(NAME.decodeParms);
    ctx.assign(ref, PDFRawStream.of(d, out.jpeg));
    images++;
  }
  return { bytes: images ? await doc.save() : bytes, images };
}

/**
 * الملف صورًا (تصغيره لحدّ خانة الرفع): كلّ صورة JPEG صفحةٌ بمقاس الصفحة كما كانت تُرى
 * — بالنقاط — تملؤها كلّها.
 */
export async function imagesToPdf(pages: { jpeg: Uint8Array; width: number; height: number }[]): Promise<Uint8Array> {
  if (!pages.length) throw new Error('لا صفحات في الملف');
  const out = await PDFDocument.create();
  out.setProducer('ديوان');
  out.setCreator('ديوان — محرّر PDF');
  for (const p of pages) {
    if (!isJpg(p.jpeg)) throw new Error('صورة الصفحة ليست JPEG');
    const image = await out.embedJpg(p.jpeg);
    out.addPage([p.width, p.height]).drawImage(image, { x: 0, y: 0, width: p.width, height: p.height });
  }
  // بلا «مجاري الكائنات» (PDF 1.5): يقرؤه كلّ قارئٍ ومدقّقٍ قديم في المواقع، والفرق في
  // الحجم زهيدٌ أمام الصور.
  return out.save({ useObjectStreams: false });
}
