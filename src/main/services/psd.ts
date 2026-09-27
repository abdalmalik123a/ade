/**
 * قراءة Photoshop — الترويسة والدقّة والصورة المسطَّحة.
 *
 * وملفُّ PSD يحمل **صورةً مسطَّحة جاهزة** في آخره (يكتبها Photoshop لتوافُق
 * البرامج الأخرى)، وهي الخلفية: بمؤثّراتها وظلالها التي لا نرسمها. وما صار
 * منها عنصرًا يُحرَّر يُمحى من مواضعه في `psdLayers.ts`.
 *
 * وجُرِّبت `@webtoon/psd` فأعادت صورةً رماديةً من ملفٍ بلا طبقات: كرّرت القناة
 * الأولى في الثلاث. فأُسقطت، وقُرئت الصورة المسطَّحة هنا — ستّون سطرًا، وبلا
 * تبعيّة، وبالألوان الصحيحة. وهذا يوافق قيدنا الثابت: كل تبعيّةٍ تُراجَع مع كل
 * ترقية، فلا تُؤخذ إلا لما لا يُكتب.
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

/** صيغُ الضغط في بيانات الصورة. */
const RAW = 0;
const RLE = 1;

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

/**
 * يقرأ ملف PSD: مقاسَه ودقّتَه وصورتَه المسطَّحة.
 *
 * وما تعذّر منها لا يُخمَّن: تُرجَع `rgba: null` مع سببٍ، ويُمضى بالمقاس وحده.
 */
export function readPsd(bytes: Uint8Array): PsdImage | null {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length < 26 || buf.toString('ascii', 0, 4) !== '8BPS') return null;

  const channels = buf.readUInt16BE(12);
  const height = buf.readUInt32BE(14);
  const width = buf.readUInt32BE(18);
  const depth = buf.readUInt16BE(22);
  const colorMode = buf.readUInt16BE(24);
  const warnings: string[] = [];

  let at = 26;
  at += 4 + buf.readUInt32BE(at); // بيانات الصيغة اللونية

  // ── الموارد: الدقّة في المورد ١٠٠٥ ───────────────────────────────
  let dpi: number | null = null;
  const resourcesEnd = at + 4 + buf.readUInt32BE(at);
  let res = at + 4;
  while (res + 12 <= Math.min(resourcesEnd, buf.length)) {
    if (buf.toString('ascii', res, res + 4) !== '8BIM') break;
    const id = buf.readUInt16BE(res + 4);
    res += 6;
    const nameLength = buf.readUInt8(res);
    res += nameLength % 2 === 0 ? nameLength + 2 : nameLength + 1;
    const size = buf.readUInt32BE(res);
    res += 4;
    // ١٦٫١٦ ثابتُ الفاصلة: الجزء الصحيح في أعلى ستّ عشرة بتًّا.
    if (id === 1005 && res + 4 <= buf.length) dpi = Math.round((buf.readUInt32BE(res) / 65536) * 100) / 100;
    res += size + (size % 2);
  }
  at = resourcesEnd;

  // ── الطبقات تُتخطّى: الصورة المسطَّحة بعدها ──────────────────────
  if (at + 4 > buf.length) return { width, height, dpi, rgba: null, warnings: ['الملف مبتور'] };
  at += 4 + buf.readUInt32BE(at);

  const supportedModes = [1, 3, 4]; // Grayscale, RGB, CMYK
  if (depth !== 8) warnings.push(`عمقُ الملف ${depth} بتًّا — تُقرأ ثمانيةٌ وحدها`);
  if (!supportedModes.includes(colorMode)) {
    warnings.push(`نمط ألوان الملف (${colorMode}) غير مدعوم — يُدعم RGB و CMYK و Grayscale`);
  }
  if (at + 2 > buf.length || depth !== 8 || !supportedModes.includes(colorMode)) {
    return { width, height, dpi, rgba: null, warnings: [...warnings, 'تعذّرت قراءة الصورة المسطَّحة'] };
  }

  const compression = buf.readUInt16BE(at);
  at += 2;
  const pixels = width * height;
  const channelPlanes: Uint8Array[] = [];

  if (compression === RAW) {
    for (let c = 0; c < channels; c++) {
      const plane = new Uint8Array(pixels);
      const from = at + c * pixels;
      if (from + pixels <= buf.length) {
        plane.set(buf.subarray(from, from + pixels));
      }
      channelPlanes.push(plane);
    }
  } else if (compression === RLE) {
    // جدولُ أطوال الصفوف أولًا: لكل قناةٍ صفوفُها، طولُ كلٍّ منها u16.
    const rows = height * channels;
    const lengths: number[] = [];
    for (let r = 0; r < rows && at + 2 <= buf.length; r++) {
      lengths.push(buf.readUInt16BE(at));
      at += 2;
    }
    for (let c = 0; c < channels; c++) {
      const plane = new Uint8Array(pixels);
      let write = 0;
      for (let y = 0; y < height; y++) {
        const length = lengths[c * height + y] ?? 0;
        if (at + length > buf.length) break;
        write = unpackBits(buf, at, length, plane, write);
        at += length;
      }
      channelPlanes.push(plane);
    }
  } else {
    return {
      width,
      height,
      dpi,
      rgba: null,
      warnings: [...warnings, 'صورةُ الملف مضغوطةٌ بصيغةٍ لا تُقرأ (ZIP)']
    };
  }

  const rgba = new Uint8Array(pixels * 4);
  rgba.fill(255);

  if (colorMode === 3) {
    // RGB
    const rPlane = channelPlanes[0];
    const gPlane = channelPlanes[1];
    const bPlane = channelPlanes[2];
    const aPlane = channelPlanes[3];
    for (let i = 0; i < pixels; i++) {
      if (rPlane) rgba[i * 4 + 0] = rPlane[i]!;
      if (gPlane) rgba[i * 4 + 1] = gPlane[i]!;
      if (bPlane) rgba[i * 4 + 2] = bPlane[i]!;
      if (aPlane) rgba[i * 4 + 3] = aPlane[i]!;
    }
  } else if (colorMode === 4) {
    // CMYK: أربع قنوات وقناةٌ شفافة محتملة. وPhotoshop يخزّن الحبر **مقلوبًا**:
    // ٢٥٥ ورقٌ بلا حبر و٠ حبرٌ كامل — فمن قرأها حبرًا أخرج الصورة سالبةً.
    // فالمخزَّن هو «ما يبقى من الضوء» نفسه: R = C × K / ٢٥٥.
    const cPlane = channelPlanes[0];
    const mPlane = channelPlanes[1];
    const yPlane = channelPlanes[2];
    const kPlane = channelPlanes[3];
    const aPlane = channelPlanes[4];
    for (let i = 0; i < pixels; i++) {
      const c = cPlane ? cPlane[i]! : 255;
      const m = mPlane ? mPlane[i]! : 255;
      const y = yPlane ? yPlane[i]! : 255;
      const k = kPlane ? kPlane[i]! : 255;
      rgba[i * 4 + 0] = Math.round((c * k) / 255);
      rgba[i * 4 + 1] = Math.round((m * k) / 255);
      rgba[i * 4 + 2] = Math.round((y * k) / 255);
      if (aPlane) rgba[i * 4 + 3] = aPlane[i]!;
    }
  } else if (colorMode === 1) {
    // Grayscale
    const gPlane = channelPlanes[0];
    const aPlane = channelPlanes[1];
    for (let i = 0; i < pixels; i++) {
      const g = gPlane ? gPlane[i]! : 0;
      rgba[i * 4 + 0] = g;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = g;
      if (aPlane) rgba[i * 4 + 3] = aPlane[i]!;
    }
  }

  const colors = colorMode === 4 ? 4 : colorMode === 1 ? 1 : 3;
  return { width, height, dpi, rgba, planes: channelPlanes.slice(0, colors), warnings };
}

/** المقاس والدقّة وحدهما — بلا فكّ الصورة. */
export function psdMeta(bytes: Uint8Array): { w: number; h: number; dpi: number | null } | null {
  const read = readPsd(bytes);
  return read ? { w: read.width, h: read.height, dpi: read.dpi } : null;
}
