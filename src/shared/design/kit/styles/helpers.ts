/**
 * ما تشترك فيه الأنماط: الخطوط، وأنواع النمط وسياقه، ورسم الخطّ وإطار الصورة والميدالية.
 *
 * النمط يقرّر ثلاثة: **الخطّ** لكل دور، و**اللون** لكل دور من لوحة الجهة، و**الزخرفة**. والتخطيط نفسه لا يتغيّر —
 * فالنوع الواحد بخمسة أنماط وستّ لوحات ثلاثون تصميمًا متّسقًا، لا ثلاثون صورة.
 */
import { luminance, mix, type Palette } from '../color';
import type { Decor, Family, Rect, Role, Variant } from '../types';
import { n, silhouette, type Ctx } from '../ornaments';

export const FONT = {
  ruqaa: "'Aref Ruqaa', 'Amiri', serif",
  kufi: "'Reem Kufi', 'Cairo', sans-serif",
  kufiText: "'Noto Kufi Arabic', 'Cairo', sans-serif",
  naskh: "'Amiri', 'Noto Naskh Arabic', serif",
  messiri: "'El Messiri', 'Cairo', sans-serif",
  kids: "'Lalezar', 'Cairo', sans-serif",
  cairo: "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
  plex: "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif"
} as const;

export type Type = { font: string; bold: boolean; color: string; scale?: number; wordSpacing?: number };

/** `B` النزف بالوحدات: ما يلامس حافّة الورقة يمتدّ فيه، فلا يظهر خيطٌ أبيض بعد القصّ. */
export type StyleCtx = Ctx & {
  p: Palette;
  family: Family;
  seed: number;
  B: number;
  /** للجهة شعار؟ — بغيره يصير الختم الزخرفي تامًّا بنفسه لا دائرةً تنتظر صورة. */
  logo: boolean;
};

export type Style = {
  key: string;
  name: string;
  /** وصفٌ بسطر: متى يُختار. */
  hint: string;
  variant: Variant;
  paper: (p: Palette) => string;
  type: (role: Role, p: Palette, family: Family) => Type;
  /** إطار الورقة وزخرفتها العامّة — تحت كل شيء. */
  /** `keep`: صناديق النصّ — الزخرفة المتناثرة لا تقع عليها. */
  frame: (c: StyleCtx, keep: Rect[]) => { defs: string; body: string };
  /** كيف تُرسم كل قطعة من التخطيط بلغة هذا النمط. */
  decor: (d: Decor, c: StyleCtx) => { defs?: string; body: string };
};

// ── مساعدات ─────────────────────────────────────────────────────────

export const box = (c: Ctx, at: Rect) => ({ x: at[0] * c.W, y: at[1] * c.H, w: at[2] * c.W, h: at[3] * c.H });
export const onColor = (bg: string) => (luminance(bg) > 0.45 ? '#141414' : '#ffffff');

export function ruleLine(c: StyleCtx, d: Extract<Decor, { t: 'rule' }>, color: string, w: number, dash = ''): string {
  return `<line x1="${n(d.x1 * c.W)}" y1="${n(d.y * c.H)}" x2="${n(d.x2 * c.W)}" y2="${n(d.y * c.H)}" stroke="${color}" stroke-width="${n(w)}" ${dash}/>`;
}

export function photoFrame(c: StyleCtx, at: Rect, fill: string, stroke: string, sw: number, r: number): string {
  const b = box(c, at);
  return (
    `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(r)}" fill="${fill}"/>` +
    silhouette(b.x + b.w * 0.1, b.y + b.h * 0.12, b.w * 0.8, b.h * 0.88, mix(fill, stroke, 0.35)) +
    `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(r)}" fill="none" stroke="${stroke}" stroke-width="${n(sw)}"/>`
  );
}

export function medalBase(c: StyleCtx, d: Extract<Decor, { t: 'medal' }>) {
  return { cx: d.cx * c.W, cy: d.cy * c.H, r: d.r * c.M };
}

export const ARABIC_ORDINAL = ['١', '٢', '٣', '٤', '٥'];

export function medalNumber(cx: number, cy: number, r: number, color: string, font: string): string {
  return `<text x="${n(cx)}" y="${n(cy + r * 0.36)}" text-anchor="middle" font-family="${font.replace(/"/g, "'")}" font-weight="700" font-size="${n(r * 1.05)}" fill="${color}">`;
}
