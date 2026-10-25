/**
 * سيناريو: التصميم صورةً (DESIGNS.md ١٫٨) — الشهادة ستوريًا تُحفظ PNG بـ١٠٨٠ × ١٩٢٠ تمامًا، وPNG شفّافةً (ركنها بلا لون)،
 * وبمقاسها المطبوع JPG بـ٣٠٠ نقطة/إنش.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const OUT = join(process.env.TEMP ?? '.', `diwan-image-${Date.now()}`);

export function prepare() {
  mkdirSync(OUT, { recursive: true });
  return { DIWAN_TEST_SAVE_DIR: OUT };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** أبعاد PNG ونوع ألوانه وأوّل بكسلٍ فيه (بقناته الشفّافة إن كانت). */
function png(buf) {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const type = buf[25];
  const parts = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    if (buf.toString('latin1', at + 4, at + 8) === 'IDAT') parts.push(buf.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts));
  // أوّل بكسلٍ في الصفّ الأوّل خامٌ أيًّا كان مرشّحه (لا صفّ قبله ولا بكسل).
  return { w, h, type, first: [...raw.subarray(1, type === 6 ? 5 : 4)] };
}

/**
 * الملفّ مكتمل: ينتهي بخاتمة صيغته (PNG بمقطع `IEND`، وJPG بـ`FFD9`). يظهر في المجلّد قبل أن تكتمل كتابته، فقراءته حين يظهر
 * تقطع رأسه ومقاطعه (`ERR_BUFFER_OUT_OF_BOUNDS` في الفحص الشامل ١٢ ت١ — G04).
 */
const complete = (buf) =>
  buf.length > 12 && (buf.toString('latin1', buf.length - 8, buf.length - 4) === 'IEND' || (buf[buf.length - 2] === 0xff && buf[buf.length - 1] === 0xd9));

/** أبعاد JPG من مقطع SOF، ودقّته من مقطع APP0/JFIF (S42): بالإنش وحدها، وإلا `null`. */
function jpg(buf) {
  let dpi = null;
  for (let at = 2; at < buf.length; ) {
    const marker = buf[at + 1];
    const len = buf.readUInt16BE(at + 2);
    if (marker === 0xe0 && buf.toString('latin1', at + 4, at + 9) === 'JFIF\0' && buf[at + 11] === 1) dpi = buf.readUInt16BE(at + 12);
    if (marker >= 0xc0 && marker <= 0xc2) return { h: buf.readUInt16BE(at + 5), w: buf.readUInt16BE(at + 7), dpi };
    at += 2 + len;
  }
  return null;
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const choose = (value) =>
    page.eval(`
      const s = document.querySelector('select[data-preset]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)});
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return true;`);
  /** يحفظ بالصيغة ويعيد الملفّ الجديد — حين يكتمل وثبت حجمه قراءتين. */
  const save = async (format) => {
    for (const f of readdirSync(OUT)) rmSync(join(OUT, f));
    await click('[data-act="save-image"]');
    await wait(200);
    await click(`[data-image-format="${format}"]`);
    let size = -1;
    for (let i = 0; i < 40; i++) {
      await wait(500);
      const f = readdirSync(OUT)[0];
      if (!f) continue;
      const buf = readFileSync(join(OUT, f));
      if (complete(buf) && buf.length === size) return buf;
      size = complete(buf) ? buf.length : -1;
    }
    return null;
  };

  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-kind="thanks"]');
  await wait(1200);
  await choose('story');
  await wait(600);

  const a = await save('png');
  const pa = a ? png(a) : null;
  ok(`«احفظ صورة» PNG بمقاس الستوري تمامًا (${pa?.w} × ${pa?.h})`, pa?.w === 1080 && pa?.h === 1920);
  ok('ولونها في ركنها (لا شفافية)', Boolean(pa) && (pa.type !== 6 || pa.first[3] === 255));

  const b = await save('png-transparent');
  const pb = b ? png(b) : null;
  ok(`وPNG شفّافة: بقناة شفافية، وركنها بلا لون (${pb?.first.join(',')})`, pb?.type === 6 && pb.first[3] === 0);

  await click('[data-undo]');
  await wait(400);
  const c = await save('jpg');
  const pc = c ? jpg(c) : null;
  ok(`وبمقاسها المطبوع JPG بـ٣٠٠ نقطة (${pc?.w} × ${pc?.h})`, c?.[0] === 0xff && c?.[1] === 0xd8 && pc?.w === 3508 && pc?.h === 2480);
  // والدقّة في الملفّ نفسه (S42): فيُطبع من أيّ برنامجٍ بمقاسه لا أكبر من A4 (L03).
  ok(`ودقّته ٣٠٠ مكتوبةٌ فيه (JFIF: ${pc?.dpi ?? 'بلا وحدة'})`, pc?.dpi === 300);
  return steps.join('\n');
}
