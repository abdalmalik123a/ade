/**
 * ملفّ الخطّ يُفحص قبل قبوله (DESIGNS.md ٣٫٨ و٠٫٧): TTF وOTF وWOFF — رأسُه وجدولُ جداوله وحدودُ كلّ جدولٍ داخل الملفّ،
 * والجداول التي لا يُرسم خطٌّ بدونها؛ ومنه اسم العائلة ووزن الوجه وميله، وأيكتب العربية.
 *
 * بلا مكتبةٍ خارجية: الجداول المطلوبة ثلاثة (`name` و`OS/2` و`head`) وقراءتها بضعة أسطر. والقراءة بمواضعها لا الملفّ
 * كلّه (`FontReader`) — فقائمة خطوط Windows (مئات الملفّات، بعضها عشرات الميغا) تُقرأ في لحظة.
 *
 * وما بعد الفحص يحرسه Chromium نفسه: الخطّ يمرّ بمعقّمه (OTS) قبل أن يُرسم، فملفٌّ عبر هذا الفحص وفسد بعده لا يُرسم ولا يُسقط.
 */
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export type FontFormat = 'ttf' | 'otf' | 'woff';

export type FontInfo = {
  format: FontFormat;
  family: string;
  subfamily: string;
  weight: number;
  italic: boolean;
  /** يكتب العربية (OS/2: نطاق ٠٦٠٠–٠٦FF). */
  arabic: boolean;
};

/** يقرأ من الملفّ بموضعه وطوله — من ذاكرةٍ أو من قرص. */
export type FontReader = { size: number; read: (offset: number, length: number) => Buffer };

/** أكبر خطٍّ يُقبل — الخطوط العربية بمئات الكيلوبايتات، وأكبر خطوط Windows (الصينية) دون هذا. */
export const FONT_MAX = 40 * 1024 * 1024;

const tag = (b: Buffer, at: number) => b.toString('latin1', at, at + 4);

export function bufferReader(buf: Buffer): FontReader {
  return { size: buf.length, read: (offset, length) => buf.subarray(offset, offset + length) };
}

/** يفتح الملفّ ويقرأ منه بمواضعه، ثم يُغلقه — أيًّا كانت النتيجة. */
export function withFileReader<T>(path: string, work: (reader: FontReader) => T): T {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    return work({
      size,
      read: (offset, length) => {
        const out = Buffer.alloc(Math.max(0, Math.min(length, size - offset)));
        if (out.length) readSync(fd, out, 0, out.length, offset);
        return out;
      }
    });
  } finally {
    closeSync(fd);
  }
}

type Table = { offset: number; length: number; compLength: number };

function directory(r: FontReader): { format: FontFormat; tables: Map<string, Table> } {
  if (r.size < 12) throw new Error('ليس ملفّ خطّ — أقصر من رأسه');
  if (r.size > FONT_MAX) throw new Error('ملفّ الخطّ أكبر من ٤٠ ميغابايت');
  const head = r.read(0, 12);
  const sig = tag(head, 0);
  if (sig === 'ttcf') throw new Error('مجموعة خطوط (TTC) — استورد كلّ خطٍّ بملفّه TTF أو OTF');
  if (sig === 'wOF2') throw new Error('صيغة WOFF2 لا تُستورد بعد — استعمل TTF أو OTF أو WOFF');

  const woff = sig === 'wOFF';
  const flavor = woff ? tag(r.read(4, 4), 0) : sig;
  const sfnt = head.readUInt32BE(woff ? 4 : 0);
  if (!(sfnt === 0x00010000 || flavor === 'OTTO' || flavor === 'true')) throw new Error('ليس ملفّ خطّ يُعرف (TTF أو OTF أو WOFF)');

  const numTables = r.read(woff ? 12 : 4, 2).readUInt16BE(0);
  if (numTables < 3 || numTables > 100) throw new Error('ملفّ الخطّ تالف — عدد جداوله غير معقول');
  const start = woff ? 44 : 12;
  const size = woff ? 20 : 16;
  const dir = r.read(start, numTables * size);
  if (dir.length < numTables * size) throw new Error('ملفّ الخطّ مقطوع');

  const tables = new Map<string, Table>();
  for (let i = 0; i < numTables; i++) {
    const at = i * size;
    const name = tag(dir, at);
    const table = woff
      ? { offset: dir.readUInt32BE(at + 4), compLength: dir.readUInt32BE(at + 8), length: dir.readUInt32BE(at + 12) }
      : { offset: dir.readUInt32BE(at + 8), length: dir.readUInt32BE(at + 12), compLength: dir.readUInt32BE(at + 12) };
    if (table.offset + table.compLength > r.size || table.compLength > table.length) {
      throw new Error(`ملفّ الخطّ تالف — الجدول «${name.trim()}» خارج حدود الملفّ`);
    }
    tables.set(name, table);
  }
  for (const need of ['cmap', 'name', 'head']) if (!tables.has(need)) throw new Error(`ملفّ الخطّ ناقص — لا جدول «${need}»`);
  if (!tables.has('glyf') && !tables.has('CFF ') && !tables.has('CFF2')) throw new Error('ملفّ الخطّ بلا رسوم حروف');
  return { format: woff ? 'woff' : flavor === 'OTTO' ? 'otf' : 'ttf', tables };
}

function tableBytes(r: FontReader, t: Table | undefined): Buffer | null {
  if (!t) return null;
  const raw = r.read(t.offset, t.compLength);
  if (t.compLength === t.length) return raw;
  try {
    const out = inflateSync(raw);
    return out.length === t.length ? out : null;
  } catch {
    return null;
  }
}

/** الأسماء: Windows بالإنكليزية أوّلًا (بها تكتب Word اسم الخطّ)، ثم أيّ Windows، ثم Unicode، ثم Mac. */
function nameOf(name: Buffer, id: number): string {
  if (name.length < 6) return '';
  const count = name.readUInt16BE(2);
  const strings = name.readUInt16BE(4);
  const found: { rank: number; text: string }[] = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12;
    if (at + 12 > name.length) break;
    const platform = name.readUInt16BE(at);
    const lang = name.readUInt16BE(at + 4);
    if (name.readUInt16BE(at + 6) !== id) continue;
    const length = name.readUInt16BE(at + 8);
    const offset = strings + name.readUInt16BE(at + 10);
    if (offset + length > name.length) continue;
    const bytes = name.subarray(offset, offset + length);
    let text = '';
    if (platform === 3 || platform === 0) {
      const swapped = Buffer.from(bytes);
      swapped.swap16();
      text = swapped.toString('utf16le');
    } else if (platform === 1) {
      text = bytes.toString('latin1');
    } else continue;
    const rank = platform === 3 && lang === 0x0409 ? 0 : platform === 3 ? 1 : platform === 0 ? 2 : 3;
    found.push({ rank, text: text.replace(/\0/g, '').trim() });
  }
  return found.filter((f) => f.text).sort((a, b) => a.rank - b.rank)[0]?.text ?? '';
}

/** يفحص الخطّ ويقرأ منه ما يلزم — أو يرمي بالسبب بالعربية. */
export function readFontInfo(r: FontReader): FontInfo {
  const { format, tables } = directory(r);
  const name = tableBytes(r, tables.get('name'));
  if (!name) throw new Error('ملفّ الخطّ تالف — جدول الأسماء لا يُقرأ');
  const family = nameOf(name, 1) || nameOf(name, 16);
  if (!family) throw new Error('ملفّ الخطّ بلا اسم عائلة');
  const subfamily = nameOf(name, 2) || nameOf(name, 17);

  const os2 = tableBytes(r, tables.get('OS/2'));
  const head = tableBytes(r, tables.get('head'));
  const macStyle = head && head.length >= 46 ? head.readUInt16BE(44) : 0;
  let weight = os2 && os2.length >= 6 ? os2.readUInt16BE(4) : 0;
  if (weight >= 1 && weight <= 9) weight *= 100; // سلّمٌ قديم: ١..٩
  if (weight < 100 || weight > 900) weight = macStyle & 1 ? 700 : 400;
  const fsSelection = os2 && os2.length >= 64 ? os2.readUInt16BE(62) : 0;
  const italic = Boolean(fsSelection & 1) || Boolean(macStyle & 2);
  const arabic = os2 && os2.length >= 46 ? Boolean(os2.readUInt32BE(42) & (1 << 13)) : false;

  return { format, family, subfamily, weight: Math.round(weight / 100) * 100, italic, arabic };
}
