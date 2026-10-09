/**
 * ألوان التصاميم — لوحاتٌ مختارة، ولوحةٌ تُشتقّ من شعار الجهة.
 *
 * المدرسة تريد هويّتها بلونها لا بلوننا. فيُقرأ اللون الغالب من شعارها
 * (`dominantColor`) وتُبنى منه لوحةٌ كاملة (`paletteFrom`): عميقٌ للأشرطة،
 * وفاتحٌ للخلفيات، وذهبيٌّ يرافقه ما لم يكن الشعار نفسه ذهبيًّا.
 */

export type Palette = {
  key: string;
  name: string;
  /** اللون الرئيس: العنوان والأشرطة. */
  primary: string;
  /** أعمقه: الخلفيات الداكنة والنصّ فوق الفاتح. */
  deep: string;
  /** المرافق: الذهبي في الرسمي، والنقطة الحارّة في الحديث. */
  accent: string;
  /** الورق: أبيضُ مائلٌ إلى اللون، لا أبيضُ مجرّد. */
  paper: string;
  /** الحبر: أسودُ مائلٌ إلى اللون. */
  ink: string;
  /** ألوانٌ مرحة — للأطفال وحدهم. */
  bright: string[];
};

const BRIGHT = ['#ff6b57', '#ffc23d', '#3fa9f5', '#52c07a', '#8e6cf0'];

export const PALETTES: Palette[] = [
  { key: 'royal', name: 'ملكي', primary: '#1f3a8a', deep: '#0f1e4d', accent: '#b8923a', paper: '#fbf9f4', ink: '#141a2e', bright: BRIGHT },
  { key: 'emerald', name: 'زمرّدي', primary: '#0f6b50', deep: '#073d2e', accent: '#c29b45', paper: '#f8f8f2', ink: '#10231c', bright: BRIGHT },
  { key: 'maroon', name: 'عنّابي', primary: '#7a1e2c', deep: '#4a0f19', accent: '#c9a45c', paper: '#fbf7f1', ink: '#22110f', bright: BRIGHT },
  { key: 'navy', name: 'كحلي وفضّي', primary: '#22364d', deep: '#0e1a28', accent: '#8d9db0', paper: '#f7f8f9', ink: '#0f161d', bright: BRIGHT },
  { key: 'teal', name: 'فيروزي', primary: '#0e7c86', deep: '#064b52', accent: '#e0a13a', paper: '#f6fafa', ink: '#0c2426', bright: BRIGHT },
  { key: 'violet', name: 'بنفسجي', primary: '#5b2a86', deep: '#341650', accent: '#d4a24c', paper: '#faf8fc', ink: '#1d1028', bright: BRIGHT }
];

// ── الحساب ───────────────────────────────────────────────────────────

type Hsl = { h: number; s: number; l: number };

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function toHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function fromHsl({ h, s, l }: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** يمزج لونين بنسبة — للدرجات الفاتحة في الخلفيات. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** وضوح النصّ فوق لون — لاختيار الأبيض أو الحبر فوق الأشرطة. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** ذهبيٌّ؟ — الشعار الذهبي لا يُرافَق بذهبيٍّ آخر. */
const isGoldish = (h: Hsl) => h.h >= 30 && h.h <= 60 && h.s > 0.35;

/**
 * لوحةٌ كاملة من لونٍ واحد.
 *
 * الرئيس يُضبط إلى إضاءةٍ مقروءة (لا باهتًا ولا حالكًا) لأنه يحمل العنوان،
 * والعميق أغمق منه بثلثه، والورق مسحةٌ منه على الأبيض.
 */
export function paletteFrom(hex: string, name = 'من الشعار'): Palette {
  const base = toHsl(hex);
  const s = Math.max(0.35, Math.min(0.85, base.s));
  const primary = fromHsl({ h: base.h, s, l: Math.max(0.22, Math.min(0.42, base.l)) });
  const deep = fromHsl({ h: base.h, s: Math.min(0.9, s + 0.05), l: 0.14 });
  const accent = isGoldish(base) ? fromHsl({ h: (base.h + 180) % 360, s: 0.45, l: 0.35 }) : '#b8923a';
  return {
    key: 'brand',
    name,
    primary,
    deep,
    accent,
    paper: mix('#ffffff', primary, 0.035),
    ink: mix('#101418', deep, 0.35),
    bright: BRIGHT
  };
}

/**
 * اللون الغالب في صورة شعار — من بكسلاتها (RGBA).
 *
 * يُحسب مدرّجُ الأطياف مرجَّحًا بالتشبّع، ويُهمل الأبيض والأسود والرمادي: فالشعار
 * على ورقٍ أبيض بخطٍّ أسود لونُه ما بينهما لا هما. ويعود `null` لشعارٍ بلا لون.
 */
export function dominantColor(data: ArrayLike<number>): string | null {
  const bins = new Array<number>(36).fill(0);
  const sums = Array.from({ length: 36 }, () => [0, 0, 0]);
  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 128) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 510;
    const d = (max - min) / 255;
    if (d < 0.18 || l > 0.92 || l < 0.08) continue;
    const hsl = toHsl(rgbToHex(r, g, b));
    const bin = Math.floor(hsl.h / 10) % 36;
    bins[bin]! += d;
    sums[bin]![0]! += r * d;
    sums[bin]![1]! += g * d;
    sums[bin]![2]! += b * d;
  }
  let best = -1;
  let weight = 0;
  bins.forEach((w, i) => {
    // الجاران معه: الأزرق بين بِنَّين لا يُقسم فيخسر أمام أخضر صغير.
    const around = w + (bins[(i + 35) % 36] ?? 0) * 0.5 + (bins[(i + 1) % 36] ?? 0) * 0.5;
    if (around > weight) {
      weight = around;
      best = i;
    }
  });
  if (best < 0 || bins[best]! <= 0) return null;
  const [r, g, b] = sums[best]!.map((v) => v / bins[best]!) as [number, number, number];
  return rgbToHex(r, g, b);
}
