/**
 * ملفّ PDF المشفَّر (هـ٢): أيطلب كلمة مرورٍ لفتحه، أم هو مقيَّدٌ بصلاحيات ناشره ويُفتح في أيّ قارئ؟
 *
 * pdf-lib يرفض كلّ ملفٍّ فيه `/Encrypt` ولا يفكّ تشفيرًا — فكان كلّ ملفٍّ حكومي «مقيَّد» يُقال عنه «محميٌّ بكلمة
 * مرور» وهو يُفتح في كلّ قارئ. والتمييز بفحص كلمة المستخدم الفارغة كما يفعل القارئ: معالج الأمان القياسي في
 * مواصفة PDF (الخوارزميات ٢ و٤ و٥ للمراجعات ٢–٤، والتجزئة ٢.ب للمراجعة ٦). لا يُفكّ شيءٌ من الملفّ هنا — يُعرف
 * نوع القفل وحده لتُقال الرسالة الصحيحة. وما لا يُعرف (معالجٌ غير قياسي أو قاموسٌ ناقص) يعود `null`.
 */
import { createCipheriv, createHash } from 'node:crypto';
import { PDFArray, PDFBool, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib';

export type PdfLock = 'password' | 'restricted';

/** حشوة كلمة المرور في المواصفة (الخوارزمية ٢) — وهي كلمة المستخدم الفارغة نفسها. */
const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex');

const md5 = (...parts: Uint8Array[]) => {
  const h = createHash('md5');
  for (const p of parts) h.update(p);
  return h.digest();
};

function rc4(key: Uint8Array, data: Uint8Array): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 255;
    [s[i], s[j]] = [s[j]!, s[i]!];
  }
  const out = Buffer.alloc(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]!) & 255;
    [s[i], s[j]] = [s[j]!, s[i]!];
    out[k] = data[k]! ^ s[(s[i]! + s[j]!) & 255]!;
  }
  return out;
}

/** تجزئة المراجعة ٦ (الخوارزمية ٢.ب) — كما يحسبها القارئ. */
function hash2B(password: Buffer, salt: Uint8Array, udata: Uint8Array): Buffer {
  let k = createHash('sha256').update(Buffer.concat([password, salt, udata])).digest();
  let e = Buffer.alloc(0);
  for (let i = 0; i < 64 || e[e.length - 1]! > i - 32; i++) {
    const block = Buffer.concat([password, k, udata]);
    const cipher = createCipheriv('aes-128-cbc', k.subarray(0, 16), k.subarray(16, 32));
    cipher.setAutoPadding(false);
    e = Buffer.concat([cipher.update(Buffer.concat(Array.from({ length: 64 }, () => block))), cipher.final()]);
    // باقي القسمة على ٣ لأوّل ١٦ بايتًا عددًا واحدًا = باقي مجموعها (٢٥٦ ≡ ١).
    let sum = 0;
    for (let b = 0; b < 16; b++) sum += e[b]!;
    k = createHash(['sha256', 'sha384', 'sha512'][sum % 3]!).update(e).digest();
  }
  return k.subarray(0, 32);
}

function bytesOf(o: unknown): Buffer | null {
  return o instanceof PDFHexString || o instanceof PDFString ? Buffer.from(o.asBytes()) : null;
}

/** أيُفتح بكلمة مستخدمٍ فارغة؟ — `null` إن لم يُعرف. */
function opensBlank(enc: PDFDict, id0: Buffer | null): boolean | null {
  const get = (k: string) => enc.get(PDFName.of(k));
  if (get('Filter')?.toString() !== '/Standard') return null;
  const r = get('R');
  const rev = r instanceof PDFNumber ? r.asNumber() : NaN;
  const o = bytesOf(get('O'));
  const u = bytesOf(get('U'));
  if (!o || !u || u.length < 32) return null;

  if (rev === 5) return createHash('sha256').update(u.subarray(32, 40)).digest().equals(u.subarray(0, 32));
  if (rev === 6) return hash2B(Buffer.alloc(0), u.subarray(32, 40), Buffer.alloc(0)).equals(u.subarray(0, 32));
  if (rev < 2 || rev > 4 || !id0) return null;

  const pv = get('P');
  if (!(pv instanceof PDFNumber)) return null;
  const p = Buffer.alloc(4);
  p.writeUInt32LE(pv.asNumber() >>> 0);
  const len = get('Length');
  const n = rev === 2 ? 5 : (len instanceof PDFNumber ? len.asNumber() : 40) / 8;
  const meta = get('EncryptMetadata');
  const skipMeta = rev >= 4 && meta instanceof PDFBool && !meta.asBoolean();
  let h = md5(PAD, o.subarray(0, 32), p, id0, skipMeta ? Buffer.from([255, 255, 255, 255]) : Buffer.alloc(0));
  if (rev >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, n));
  const key = h.subarray(0, n);
  if (rev === 2) return rc4(key, PAD).equals(u.subarray(0, 32));
  let x = rc4(key, md5(PAD, id0));
  for (let i = 1; i <= 19; i++) x = rc4(key.map((b) => b ^ i), x);
  return x.equals(u.subarray(0, 16));
}

/** نوع قفل الملفّ المشفَّر — أو `null` إن لم يُعرف (أو لم يكن مشفَّرًا). */
export async function pdfLock(bytes: Uint8Array): Promise<PdfLock | null> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const t = doc.context.trailerInfo;
    if (!t.Encrypt) return null;
    const enc = doc.context.lookup(t.Encrypt, PDFDict);
    const ids = t.ID ? doc.context.lookup(t.ID, PDFArray) : null;
    const blank = opensBlank(enc, ids ? bytesOf(ids.get(0)) : null);
    return blank === null ? null : blank ? 'restricted' : 'password';
  } catch {
    return null;
  }
}

/** الرسالة بلغة المكتب وبما يُفعل — والطريق واحد للنوعين: يُطبع PDF جديدًا من قارئٍ يفتحه. */
export function lockedMessage(lock: PdfLock | null): string {
  if (lock === 'password') {
    return 'الملف محميٌّ بكلمة مرور تُطلب لفتحه — افتحه بكلمته في قارئ PDF، واطبعه PDF جديدًا (طابعة «Microsoft Print to PDF»)، ثم افتح الجديد هنا';
  }
  if (lock === 'restricted') {
    return 'هذا الملف مقيَّدٌ بصلاحيات ناشره — يُفتح في أيّ قارئ بلا كلمة مرور، لكنّ ديوان لا يعدّل الملف المقيَّد بعدُ. افتحه في قارئ PDF، واطبعه PDF جديدًا (طابعة «Microsoft Print to PDF»)، ثم افتح الجديد هنا';
  }
  return 'هذا الملف مقيَّدٌ أو محميّ — وديوان لا يعدّل الملف المقيَّد بعدُ. افتحه في قارئ PDF (بكلمة مروره إن طلبها)، واطبعه PDF جديدًا (طابعة «Microsoft Print to PDF»)، ثم افتح الجديد هنا';
}
