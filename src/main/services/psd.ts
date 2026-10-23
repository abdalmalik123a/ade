/**
 * قراءة Photoshop — الترويسة والدقّة والصورة المسطَّحة.
 *
 * وملفُّ PSD يحمل **صورةً مسطَّحة جاهزة** في آخره (يكتبها Photoshop لتوافُق
 * البرامج الأخرى)، وهي الخلفية: بمؤثّراتها وظلالها التي لا نرسمها. وما صار
 * منها عنصرًا يُحرَّر يُمحى من مواضعه في `psdLayers.ts`.
 *
 * وجُرِّبت `@webtoon/psd` فأعادت صورةً رماديةً من ملفٍ بلا طبقات: كرّرت القناة
 * الأولى في الثلاث. فأُسقطت، وقُرئت الصورة المسطَّحة عندنا بلا تبعيّة وبالألوان الصحيحة.
 *
 * والقراءة **بمحرّك Rust وحده** (`native/diwan-psd`، A20 A21): يضعه العامل عند إقلاعه بـ`setNativePsdReader`،
 * وقارئ TS القديم في `legacy/src/main/services/psd.ts` (D147)، ومرجعه الثابت `tests/fixtures/psdGolden.json`.
 *
 * والبنية (Adobe Photoshop File Formats):
 * ترويسةٌ (٢٦ بايت) · بيانات الصيغة اللونية · موارد الصورة · الطبقات والأقنعة ·
 * ثم **بيانات الصورة**: ضغطٌ (u16) ثم مستوياتُ القنوات واحدًا بعد آخر.
 */

export type PsdImage = {
  width: number;
  height: number;
  dpi: number | null;
  /** RGBA — أو `null` إن لم تُقرأ الصورة المسطَّحة. */
  rgba: Uint8Array | null;
  /** قنوات اللون بصيغة الملف (CMYK مقلوبًا كما خُزّن) — لمن يمزج بها. */
  planes?: Uint8Array[];
  warnings: string[];
};

/** بلا محرّك Rust لا تُقرأ ملفّات Photoshop (A21، D147) — والصور وWord وPDF كما هي. */
export const PSD_ENGINE_MISSING = 'قراءة ملفّات Photoshop تحتاج محرّك ديوان — أعد تشغيل البرنامج، وإن تكرّر فأعد تثبيته';

/**
 * يفكّ PackBits — وهو ضغطُ صفوف PSD وTIFF.
 *
 * بايتُ العدّاد: ٠..١٢٧ يعني «انسخ ما بعده حرفيًّا ن+١»، و١٢٩..٢٥٥ يعني «كرّر
 * التالي ٢٥٧−ن»، و١٢٨ لا شيء.
 */
export function unpackBits(src: Buffer, at: number, length: number, out: Uint8Array, to: number): number {
  const end = at + length;
  let write = to;
  while (at < end && write < out.length) {
    const n = src.readInt8(at++);
    if (n >= 0) {
      const count = n + 1;
      for (let i = 0; i < count && at < end && write < out.length; i++) out[write++] = src[at++]!;
    } else if (n !== -128) {
      const count = 1 - n;
      const value = src[at++]!;
      for (let i = 0; i < count && write < out.length; i++) out[write++] = value;
    }
  }
  return write;
}

let nativeReader: ((bytes: Uint8Array) => PsdImage | null) | null = null;

/**
 * يضع قارئًا أصليًّا (A20، D104) — يضعه العامل وحده عند إقلاعه من nativePsd.ts.
 */
export function setNativePsdReader(fn: ((bytes: Uint8Array) => PsdImage | null) | null): void {
  nativeReader = fn;
}

/**
 * يقرأ ملف PSD: مقاسَه ودقّتَه وصورتَه المسطَّحة — بالقارئ الأصليّ وحده (A21، D147).
 *
 * بلا قارئٍ يرمي `PSD_ENGINE_MISSING`؛ ورميُ القارئ نفسه ملفٌّ لا يُقرأ فيُعاد `null` (ويقول `psdDesign` رسالته).
 * وما تعذّر من الصورة لا يُخمَّن: تُرجَع `rgba: null` مع سببٍ، ويُمضى بالمقاس وحده.
 */
export function readPsd(bytes: Uint8Array): PsdImage | null {
  if (!nativeReader) throw new Error(PSD_ENGINE_MISSING);
  try {
    return nativeReader(bytes);
  } catch {
    return null;
  }
}

/** المقاس والدقّة وحدهما — بلا فكّ الصورة. */
export function psdMeta(bytes: Uint8Array): { w: number; h: number; dpi: number | null } | null {
  const read = readPsd(bytes);
  return read ? { w: read.width, h: read.height, dpi: read.dpi } : null;
}
