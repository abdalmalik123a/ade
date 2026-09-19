/**
 * قراءة Photoshop — الترويسة والدقّة والصورة المسطَّحة.
 *
 * وملفُّ PSD يحمل **صورةً مسطَّحة جاهزة** في آخره (يكتبها Photoshop لتوافُق
 * البرامج الأخرى)، وهي بالضبط ما نريد: خلفيةٌ واحدة تُرسم تحت الحقول. فلا حاجة
 * إلى إعادة تركيب الطبقات.
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
function unpackBits(src: Buffer, at: number, length: number, out: Uint8Array, to: number): number {
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

  if (depth !== 8) warnings.push(`عمقُ الملف ${depth} بتًّا — تُقرأ ثمانيةٌ وحدها`);
  if (colorMode !== 3) warnings.push('الملف ليس RGB — قد تختلف ألوانه');
  if (at + 2 > buf.length || depth !== 8 || colorMode !== 3) {
    return { width, height, dpi, rgba: null, warnings: [...warnings, 'تعذّرت قراءة الصورة المسطَّحة'] };
  }

  const compression = buf.readUInt16BE(at);
  at += 2;
  const pixels = width * height;
  const planes = Math.min(channels, 4);
  const plane = new Uint8Array(pixels);
  const rgba = new Uint8Array(pixels * 4);
  rgba.fill(255);

  if (compression === RAW) {
    for (let c = 0; c < planes; c++) {
      const from = at + c * pixels;
      if (from + pixels > buf.length) break;
      plane.set(buf.subarray(from, from + pixels));
      for (let i = 0; i < pixels; i++) rgba[i * 4 + c] = plane[i]!;
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
      let write = 0;
      for (let y = 0; y < height; y++) {
        const length = lengths[c * height + y] ?? 0;
        if (at + length > buf.length) break;
        write = unpackBits(buf, at, length, plane, write);
        at += length;
      }
      if (c < planes) for (let i = 0; i < pixels; i++) rgba[i * 4 + c] = plane[i]!;
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

  return { width, height, dpi, rgba, warnings };
}

/** المقاس والدقّة وحدهما — بلا فكّ الصورة. */
export function psdMeta(bytes: Uint8Array): { w: number; h: number; dpi: number | null } | null {
  const read = readPsd(bytes);
  return read ? { w: read.width, h: read.height, dpi: read.dpi } : null;
}
