/**
 * الرسم والمقارنة في صفحة Chromium (G30) — `tools/pdfImage/main.mjs` يناديها، و`tools/pdfImage.mjs` يقرأ نتيجتها.
 *
 * كلّ صفحةٍ تُرسم بـpdf.js على canvas بالدقّة المطلوبة، ثم تُحوَّل رمادية (`0.299R + 0.587G + 0.114B`) — فاللون والتنعيم الملوّن
 * لا يحرّكان الفرق — وتعود PNG. **والمقارنة هنا أيضًا** فلا يُفكّ PNG في Node: المرجع يُرسم على canvas ويُطرح بكسلًا بكسلًا،
 * و«المختلف» ما زاد فرقه على العتبة؛ فيعود عدده ونسبته وأكبر فرق، وصورة فرقٍ (المختلف أحمر على الأصل باهتًا).
 */
import * as pdfjs from '../../node_modules/pdfjs-dist/build/pdf.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

function bytesOf(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function canvas2d(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) };
}

/** درجة الرمادي لكلّ بكسل، ويُكتب الرماديّ في البكسلات نفسها (والمعتم كلّه: لا شفافية في الورق). */
function toGray(image) {
  const d = image.data;
  const gray = new Uint8Array(image.width * image.height);
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    gray[p] = g;
    d[i] = d[i + 1] = d[i + 2] = g;
    d[i + 3] = 255;
  }
  return gray;
}

/** المرجع بدرجاته — كما كُتب، بلا تحويل ألوانٍ يغيّر قيمه. */
async function refGray(base64) {
  const bitmap = await createImageBitmap(new Blob([bytesOf(base64)], { type: 'image/png' }), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none'
  });
  const { ctx } = canvas2d(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { w: bitmap.width, h: bitmap.height, gray: toGray(image) };
}

function compare(gray, ref, w, h, threshold) {
  const { canvas, ctx } = canvas2d(w, h);
  const out = ctx.createImageData(w, h);
  let count = 0;
  let max = 0;
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    const diff = Math.abs(gray[p] - ref.gray[p]);
    if (diff > max) max = diff;
    const differs = diff > threshold;
    if (differs) count++;
    // الأصل باهتًا (ربع حبره) والمختلف أحمر — فيُرى أين وقع الفرق من الورقة.
    const faded = Math.round(255 - (255 - gray[p]) * 0.25);
    out.data[i] = differs ? 255 : faded;
    out.data[i + 1] = differs ? 0 : faded;
    out.data[i + 2] = differs ? 0 : faded;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return { count, ratio: count / gray.length, max, png: canvas.toDataURL('image/png') };
}

async function run({ pdf, refs, dpi, threshold, probe }) {
  const task = pdfjs.getDocument({ data: bytesOf(pdf), verbosity: 0 });
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const started = performance.now();
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: dpi / 72 });
    const w = Math.round(viewport.width);
    const h = Math.round(viewport.height);
    const { canvas, ctx } = canvas2d(w, h);
    await page.render({ canvas, canvasContext: ctx, viewport, background: 'white' }).promise;
    const image = ctx.getImageData(0, 0, w, h);
    const gray = toGray(image);
    ctx.putImageData(image, 0, 0);
    const png = canvas.toDataURL('image/png');
    const ms = Math.round(performance.now() - started);
    // نقاطٌ بالملّيمتر من أعلى يسار الصفحة — درجتها كما رُسمت (لفحص الأداة نفسها).
    const values = probe.map(({ x, y }) => gray[Math.round((y / 25.4) * dpi) * w + Math.round((x / 25.4) * dpi)] ?? null);
    let diff = null;
    if (refs[n - 1]) {
      const ref = await refGray(refs[n - 1]);
      diff = ref.w === w && ref.h === h ? { refW: ref.w, refH: ref.h, ...compare(gray, ref, w, h, threshold) } : { refW: ref.w, refH: ref.h };
    }
    pages.push({ w, h, png, ms, probe: values, diff });
    page.cleanup();
  }
  await task.destroy();
  return { pages };
}

window.pdfImageResolve({
  run: (input) => run(input).catch((e) => ({ error: e?.message ?? String(e) }))
});
