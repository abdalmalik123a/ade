/**
 * Code128 — الباركود الذي يُطبع على الهويات والملصقات.
 *
 * ولماذا Code128 لا غيره: يرمز كل حروف ASCII، وله وضعُ C الذي يضغط الأرقام
 * زوجًا في رمز — فرقمٌ من اثني عشر خانة يخرج نصف عرضه. وهذا ما يجعله يسع على
 * هويةٍ عرضها ٨٥٫٦ ملم.
 *
 * ولا مكتبة: الترميز مئةُ سطرٍ وجدول، والمكتبة تبعيّةٌ تُراجَع مع كل ترقية.
 * وQR مبنيٌّ عندنا أصلًا في `shared/qr.ts`.
 */

/**
 * عروض القضبان: كل رمز ستّ خاناتٍ تتناوب أسودَ فأبيضَ ابتداءً بالأسود.
 *
 * الفهرس هو قيمة الرمز، والسلسلة أعراضُ الشرائط الستّة. وهذا الجدول هو
 * المعيار نفسه (ISO/IEC 15417) منقولًا كما هو.
 *
 * **ويحرسه حسابان**: مجموعُ عروض كل رمزٍ أحدَ عشرة (والإيقافُ وحده ثلاثةَ عشر)،
 * وعددُ الرموز مئةٌ وسبعة. وسطرٌ زائدٌ أو ناقصٌ يزيح البدءَ والإيقافَ عن
 * موضعهما فيخرج باركودٌ لا يقرؤه ماسح — ولا يُرى ذلك بالعين. والاختبار يفحصهما.
 */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112'
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;

/** قضيبٌ واحد: عرضُه بالوحدات، وأسودُ أم أبيض. */
export type Bar = { width: number; dark: boolean };

const digits = (s: string, at: number, count: number): boolean =>
  /^\d+$/.test(s.slice(at, at + count)) && s.slice(at, at + count).length === count;

/**
 * نصُّ الرمز كما يُرمَّز: الأرقام الهندية (٠–٩) والفارسية (۰–۹) أرقامٌ لاتينية.
 *
 * قوائم الهويات تُكتب بها أحيانًا، وCode128 لا يرمزها — فكانت البطاقة تخرج بلا باركودٍ
 * صامتةً. والرقم هو الرقم: الهاتف يقرؤه لاتينيًّا، والنصّ المطبوع بجانبه يبقى كما كُتب.
 */
export function code128Text(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    return String(code - (code >= 0x6f0 ? 0x6f0 : 0x660));
  });
}

/** أيحمله Code128؟ — حروف ASCII المطبوعة وحدها بعد تحويل الأرقام؛ والحروف العربية لا. */
export function encodes128(text: string): boolean {
  return [...code128Text(text)].every((ch) => {
    const code = ch.charCodeAt(0);
    return code >= 32 && code <= 126;
  });
}

/** ما يُقال حين لا يُرمَّز — في المحرّر وفي فاحص ما قبل الطباعة معًا. */
export const NOT_128 = 'الباركود لا يحمل الحروف العربية — صحّح القيمة، أو اجعله رمز QR إن كان فيه نصّ';

/**
 * يرمّز نصًّا رموزَ Code128، مبدّلًا بين الوضعين B وC.
 *
 * والتبديل إلى C لا يكون إلا لأربعة أرقامٍ فأكثر (أو ستّة في وسط النصّ): فدونها
 * يكلّف رمزَ تبديلٍ أكثر ممّا يوفّر.
 */
export function encode128(raw: string): number[] {
  const text = code128Text(raw);
  const out: number[] = [];
  let mode: 'B' | 'C' | null = null;
  let at = 0;

  while (at < text.length) {
    const left = text.length - at;
    const run = countDigits(text, at);
    const wantC = mode === 'C' ? run >= 2 : run >= (at === 0 ? 4 : 6) || (at === 0 && run === left && run % 2 === 0);

    if (wantC && run >= 2) {
      if (mode === null) out.push(START_C);
      else if (mode !== 'C') out.push(CODE_C);
      mode = 'C';
      const pairs = Math.floor(run / 2);
      for (let i = 0; i < pairs; i++) {
        out.push(Number(text.slice(at, at + 2)));
        at += 2;
      }
      continue;
    }

    if (mode === null) out.push(START_B);
    else if (mode !== 'B') out.push(CODE_B);
    mode = 'B';

    // في الوضع B قيمةُ الرمز هي الحرف ناقص ٣٢ — لكل ASCII المطبوع.
    const code = text.charCodeAt(at);
    if (code < 32 || code > 126) throw new Error(NOT_128);
    out.push(code - 32);
    at++;
  }

  if (!out.length) out.push(START_B);
  return out;
}

function countDigits(text: string, at: number): number {
  let n = 0;
  while (digits(text, at + n, 1)) n++;
  return n;
}

/** خانةُ التحقّق: مجموعٌ موزون بمواضع الرموز، والباقي من ١٠٣. */
export function checksum128(codes: number[]): number {
  return codes.reduce((sum, code, i) => sum + code * (i === 0 ? 1 : i), 0) % 103;
}

/**
 * قضبانُ الباركود كاملةً: البدء، فالبيانات، فالتحقّق، فالإيقاف.
 *
 * ولا هدوءَ (quiet zone) هنا — تضيفه الشاشة هامشًا حول الرسم، لأن مقداره
 * يُقاس بعرض الوحدة وهو يختلف باختلاف الصندوق.
 */
export function bars128(text: string): Bar[] {
  const codes = encode128(text);
  const all = [...codes, checksum128(codes), STOP];
  const out: Bar[] = [];
  for (const code of all) {
    const pattern = PATTERNS[code];
    if (!pattern) throw new Error(`رمزٌ خارج الجدول: ${code}`);
    for (let i = 0; i < pattern.length; i++) {
      out.push({ width: Number(pattern[i]), dark: i % 2 === 0 });
    }
  }
  return out;
}

/** مجموعُ الوحدات — وبه يُحسب عرض الوحدة داخل صندوقٍ معلوم. */
export const units128 = (bars: Bar[]): number => bars.reduce((sum, b) => sum + b.width, 0);

/**
 * يرسم الباركود SVG يملأ صندوقه.
 *
 * و`viewBox` بالوحدات لا بالبكسل: فالرسم يتمدّد بلا تشوّه، ويُطبع بدقّة
 * الطابعة لا بدقّة الشاشة — وهذا شرطُ أن يُقرأ بالماسح.
 */
/**
 * الهامش الصامت: عشرُ وحداتٍ بيضاء قبل الرمز وبعده (ISO/IEC 15417). بلاه لا يجد
 * قارئ الهاتف أول الرمز — وأكثر ما يقع ذلك على بطاقةٍ خلفيتها ملوّنة أو منقوشة
 * تلامس الخطّ الأول، فيبدو الرمز سليمًا ولا يُقرأ.
 */
export const QUIET_128 = 10;

export function barcodeSvg(text: string, opts: { height?: number; color?: string } = {}): string {
  const bars = bars128(text);
  const total = units128(bars) + QUIET_128 * 2;
  const height = opts.height ?? 40;
  const color = opts.color ?? '#000';

  let at = QUIET_128;
  const rects: string[] = [];
  for (const bar of bars) {
    if (bar.dark) {
      rects.push(`<rect x="${at}" y="0" width="${bar.width}" height="${height}" fill="${color}"/>`);
    }
    at += bar.width;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" ` +
    `preserveAspectRatio="none" width="100%" height="100%" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${height}" fill="#fff"/>${rects.join('')}</svg>`
  );
}
