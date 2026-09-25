/**
 * الأنماط الخمسة — لغاتٌ بصرية لا ألوان.
 *
 * النمط يقرّر ثلاثة: **الخطّ** لكل دور (عنوانٌ بالرقعة أو بالكوفي)، و**اللون**
 * لكل دور من لوحة الجهة، و**الزخرفة**: إطار الورقة وكيف يُرسم الشريط وخطّ
 * التوقيع والفاصل والختم الزخرفي خلف الشعار. والتخطيط نفسه لا يتغيّر — فالنوع
 * الواحد بخمسة أنماط وستّ لوحات ثلاثون تصميمًا متّسقًا، لا ثلاثون صورة.
 */
import { luminance, mix, type Palette } from './color';
import type { Decor, Family, Rect, Role, Variant } from './kinds';
import {
  cloud,
  confetti,
  decoCorners,
  dotsPattern,
  foil,
  guillocheFrame,
  guillochePattern,
  khatamPattern,
  n,
  rosetteSymbol,
  scallops,
  silhouette,
  star5,
  starPoints,
  sunburst,
  useAt,
  type Ctx
} from './ornaments';

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

const box = (c: Ctx, at: Rect) => ({ x: at[0] * c.W, y: at[1] * c.H, w: at[2] * c.W, h: at[3] * c.H });
const onColor = (bg: string) => (luminance(bg) > 0.45 ? '#141414' : '#ffffff');

function ruleLine(c: StyleCtx, d: Extract<Decor, { t: 'rule' }>, color: string, w: number, dash = ''): string {
  return `<line x1="${n(d.x1 * c.W)}" y1="${n(d.y * c.H)}" x2="${n(d.x2 * c.W)}" y2="${n(d.y * c.H)}" stroke="${color}" stroke-width="${n(w)}" ${dash}/>`;
}

function photoFrame(c: StyleCtx, at: Rect, fill: string, stroke: string, sw: number, r: number): string {
  const b = box(c, at);
  return (
    `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(r)}" fill="${fill}"/>` +
    silhouette(b.x + b.w * 0.1, b.y + b.h * 0.12, b.w * 0.8, b.h * 0.88, mix(fill, stroke, 0.35)) +
    `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(r)}" fill="none" stroke="${stroke}" stroke-width="${n(sw)}"/>`
  );
}

function medalBase(c: StyleCtx, d: Extract<Decor, { t: 'medal' }>) {
  return { cx: d.cx * c.W, cy: d.cy * c.H, r: d.r * c.M };
}

const ARABIC_ORDINAL = ['١', '٢', '٣', '٤', '٥'];

function medalNumber(cx: number, cy: number, r: number, color: string, font: string): string {
  return `<text x="${n(cx)}" y="${n(cy + r * 0.36)}" text-anchor="middle" font-family="${font.replace(/"/g, "'")}" font-weight="700" font-size="${n(r * 1.05)}" fill="${color}">`;
}

// ── رسمي ─────────────────────────────────────────────────────────────

const official: Style = {
  key: 'official',
  name: 'رسمي',
  hint: 'غيلوشٌ كورقةٍ نقدية — للدوائر والمدارس',
  variant: 'centered',
  paper: (p) => p.paper,
  type: (role, p, family) => {
    switch (role) {
      case 'headline':
        return { font: FONT.kufi, bold: true, color: p.primary, wordSpacing: 0.18 };
      case 'org':
        return { font: FONT.kufiText, bold: true, color: p.deep };
      case 'name':
        return { font: family === 'sheet' ? FONT.naskh : FONT.kufiText, bold: true, color: p.deep };
      case 'intro':
      case 'body':
        return { font: family === 'sheet' ? FONT.naskh : FONT.kufiText, bold: false, color: p.ink };
      case 'meta':
        return { font: FONT.kufiText, bold: true, color: p.ink };
      case 'label':
        return { font: FONT.kufiText, bold: false, color: mix(p.ink, p.paper, 0.4) };
      case 'accent':
        return { font: FONT.kufiText, bold: true, color: mix(p.accent, p.ink, 0.25) };
      case 'big':
        return { font: FONT.kufi, bold: true, color: p.primary, wordSpacing: 0.18 };
      case 'onBand':
        return { font: FONT.kufiText, bold: true, color: '#ffffff' };
      case 'onBandSmall':
        return { font: FONT.kufiText, bold: false, color: mix('#ffffff', p.accent, 0.35) };
    }
  },
  frame: (c) => {
    if (c.family === 'card') {
      return { defs: rosetteSymbol('wm', c.M * 0.5, c.p.primary, c.M * 0.004, 20, 3), body: '' };
    }
    const f = guillocheFrame(c, c.M * 0.045, c.M * 0.028, c.p.primary, c.p.primary, c.p.accent);
    return {
      defs: f.defs + rosetteSymbol('wm', c.M * 0.5, c.p.primary, c.M * 0.0018, 24, 3),
      body: useAt('wm', c.W / 2, c.H * 0.52, c.M * 0.36, 'opacity="0.06"') + f.body
    };
  },
  decor: (d, c) => {
    const { p } = c;
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        const edgeY = d.edge === 'top' ? b.y : b.y + b.h;
        return {
          defs: guillochePattern('bq', c.M * 0.12, b.h, '#ffffff', c.M * 0.0025, 4),
          body:
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${p.primary}"/>` +
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="url(#bq)" opacity="0.22"/>` +
            `<rect x="${n(b.x)}" y="${n(edgeY - c.M * 0.008)}" width="${n(b.w)}" height="${n(c.M * 0.016)}" fill="${p.accent}"/>`
        };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(p.ink, p.paper, 0.35), c.M * 0.0028) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        const r = c.M * 0.018;
        return {
          defs: rosetteSymbol('dv', r, p.accent, c.M * 0.0018, 10, 2),
          body:
            `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx - r * 1.6)}" y2="${n(y)}" stroke="${p.accent}" stroke-width="${n(c.M * 0.0028)}"/>` +
            `<line x1="${n(cx + r * 1.6)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}" stroke="${p.accent}" stroke-width="${n(c.M * 0.0028)}"/>` +
            useAt('dv', cx, y, r)
        };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, mix(p.paper, p.primary, 0.08), p.primary, c.M * 0.008, c.M * 0.02) };
      case 'panel': {
        const b = box(c, d.at);
        return {
          body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.02)}" fill="${mix(p.paper, p.primary, 0.1)}" stroke="${p.primary}" stroke-width="${n(c.M * 0.005)}"/>`
        };
      }
      case 'seal': {
        const R = d.r * c.M;
        if (d.faint) return { body: useAt('wm', d.cx * c.W, d.cy * c.H, R, 'opacity="0.08"') };
        return {
          defs: rosetteSymbol('sl', R, p.accent, c.M * 0.0022, 22, 3),
          body: `<circle cx="${n(d.cx * c.W)}" cy="${n(d.cy * c.H)}" r="${n(R * 0.72)}" fill="${p.paper}"/>` + useAt('sl', d.cx * c.W, d.cy * c.H, R)
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          defs: rosetteSymbol('md', m.r, p.accent, c.M * 0.002, 16, 2),
          body:
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.66)}" fill="${p.primary}"/>` +
            useAt('md', m.cx, m.cy, m.r) +
            medalNumber(m.cx, m.cy, m.r * 0.66, '#ffffff', FONT.kufi) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};

// ── زخرفة إسلامية ────────────────────────────────────────────────────

const islamic: Style = {
  key: 'islamic',
  name: 'زخرفة',
  hint: 'النجمة الثمانية والرقعة — للمناسبات والشهادات',
  variant: 'centered',
  paper: (p) => mix(p.paper, p.accent, 0.07),
  type: (role, p, family) => {
    switch (role) {
      case 'headline':
        return { font: FONT.ruqaa, bold: true, color: p.primary, scale: 1.12 };
      case 'org':
        return { font: FONT.kufiText, bold: true, color: mix(p.accent, p.ink, 0.35) };
      case 'name':
        return { font: family === 'sheet' ? FONT.ruqaa : FONT.naskh, bold: true, color: p.deep };
      case 'intro':
      case 'body':
        return { font: FONT.naskh, bold: false, color: p.ink, scale: family === 'card' ? 1.08 : 1 };
      case 'meta':
        return { font: FONT.naskh, bold: true, color: p.ink, scale: 1.05 };
      case 'label':
        return { font: FONT.naskh, bold: false, color: mix(p.ink, p.paper, 0.4) };
      case 'accent':
        return { font: FONT.ruqaa, bold: false, color: mix(p.accent, p.ink, 0.3), scale: 1.1 };
      case 'big':
        return { font: FONT.kufi, bold: true, color: p.deep, wordSpacing: 0.18 };
      case 'onBand':
        return { font: FONT.naskh, bold: true, color: mix('#ffffff', p.accent, 0.25), scale: 1.08 };
      case 'onBandSmall':
        return { font: FONT.naskh, bold: false, color: mix('#ffffff', p.accent, 0.5), scale: 1.08 };
    }
  },
  frame: (c) => {
    const s = c.M * (c.family === 'card' ? 0.16 : 0.07);
    const defs = khatamPattern('kh', s, c.p.accent, c.M * 0.0022) + khatamPattern('khf', s * 1.4, c.p.primary, c.M * 0.0016);
    if (c.family === 'card') return { defs, body: `<rect width="${n(c.W)}" height="${n(c.H)}" fill="url(#khf)" opacity="0.07"/>` };
    const inset = c.M * 0.03;
    const band = c.M * 0.075;
    const x0 = inset;
    const y0 = inset;
    const w = c.W - 2 * inset;
    const h = c.H - 2 * inset;
    const sw = c.M * 0.003;
    // الإطار: شريطٌ عميق بنقش النجمة، يحدّه خطٌّ ذهبيٌّ مزدوج من الداخل والخارج.
    const frameBand =
      `<path d="M${n(x0)},${n(y0)} h${n(w)} v${n(h)} h${n(-w)} Z M${n(x0 + band)},${n(y0 + band)} v${n(h - 2 * band)} h${n(w - 2 * band)} v${n(-(h - 2 * band))} Z" fill="${c.p.deep}" fill-rule="evenodd"/>` +
      `<path d="M${n(x0)},${n(y0)} h${n(w)} v${n(h)} h${n(-w)} Z M${n(x0 + band)},${n(y0 + band)} v${n(h - 2 * band)} h${n(w - 2 * band)} v${n(-(h - 2 * band))} Z" fill="url(#kh)" fill-rule="evenodd" opacity="0.8"/>`;
    const lines = [0, 1]
      .map((k) => {
        const o = k * sw * 3;
        return (
          `<rect x="${n(x0 - o)}" y="${n(y0 - o)}" width="${n(w + 2 * o)}" height="${n(h + 2 * o)}" fill="none" stroke="${c.p.accent}" stroke-width="${n(sw)}"/>` +
          `<rect x="${n(x0 + band + o)}" y="${n(y0 + band + o)}" width="${n(w - 2 * band - 2 * o)}" height="${n(h - 2 * band - 2 * o)}" fill="none" stroke="${c.p.accent}" stroke-width="${n(sw)}"/>`
        );
      })
      .join('');
    const cornerStars = [
      [x0 + band, y0 + band],
      [x0 + w - band, y0 + band],
      [x0 + band, y0 + h - band],
      [x0 + w - band, y0 + h - band]
    ]
      .map(
        ([x, y]) =>
          `<polygon points="${starPoints(x!, y!, band * 0.55, Math.PI / 8)}" fill="${c.p.accent}"/>` +
          `<polygon points="${starPoints(x!, y!, band * 0.3, 0)}" fill="${c.p.deep}"/>`
      )
      .join('');
    return { defs, body: `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" fill="url(#khf)" opacity="0.045"/>` + frameBand + lines + cornerStars };
  },
  decor: (d, c) => {
    const { p } = c;
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        const edgeY = d.edge === 'top' ? b.y : b.y + b.h;
        return {
          body:
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${p.deep}"/>` +
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="url(#kh)" opacity="0.45"/>` +
            `<rect x="${n(b.x)}" y="${n(edgeY - c.M * 0.006)}" width="${n(b.w)}" height="${n(c.M * 0.012)}" fill="${p.accent}"/>`
        };
      }
      case 'rule':
        return { body: ruleLine(c, d, p.accent, c.M * 0.0035) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        const r = c.M * 0.022;
        const sw = c.M * 0.003;
        return {
          body:
            `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx - r * 1.4)}" y2="${n(y)}" stroke="${p.accent}" stroke-width="${n(sw)}"/>` +
            `<line x1="${n(cx + r * 1.4)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}" stroke="${p.accent}" stroke-width="${n(sw)}"/>` +
            `<polygon points="${starPoints(cx, y, r, Math.PI / 8)}" fill="none" stroke="${p.accent}" stroke-width="${n(sw)}"/>` +
            `<polygon points="${starPoints(cx, y, r * 0.5, 0)}" fill="${p.primary}"/>` +
            [-1, 1].map((s) => `<circle cx="${n(cx + s * (half + r * 0.4))}" cy="${n(y)}" r="${n(r * 0.18)}" fill="${p.accent}"/>`).join('')
        };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, mix(p.paper, p.accent, 0.12), p.accent, c.M * 0.009, c.M * 0.015) };
      case 'panel': {
        const b = box(c, d.at);
        return {
          body:
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.012)}" fill="${mix(p.paper, p.accent, 0.18)}" stroke="${p.accent}" stroke-width="${n(c.M * 0.005)}"/>`
        };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint)
          return {
            body: `<g opacity="0.1"><polygon points="${starPoints(cx, cy, R, Math.PI / 8)}" fill="none" stroke="${p.primary}" stroke-width="${n(c.M * 0.006)}"/><polygon points="${starPoints(cx, cy, R * 0.7, 0)}" fill="none" stroke="${p.primary}" stroke-width="${n(c.M * 0.004)}"/></g>`
          };
        return {
          body:
            `<polygon points="${starPoints(cx, cy, R, Math.PI / 8)}" fill="${p.paper}" stroke="${p.accent}" stroke-width="${n(c.M * 0.004)}"/>` +
            `<polygon points="${starPoints(cx, cy, R * 0.9, Math.PI / 8)}" fill="none" stroke="${p.accent}" stroke-width="${n(c.M * 0.002)}"/>` +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.72)}" fill="none" stroke="${p.primary}" stroke-width="${n(c.M * 0.002)}"/>` +
            // بلا شعار لا يبقى الختم دائرةً فارغة: نجمةٌ داخل نجمة، وهو ختمٌ بنفسه.
            `<g opacity="0.9"><polygon points="${starPoints(cx, cy, R * 0.55, 0)}" fill="none" stroke="${p.accent}" stroke-width="${n(c.M * 0.0025)}"/>` +
            `<polygon points="${starPoints(cx, cy, R * 0.3, Math.PI / 8)}" fill="${p.primary}" opacity="0.85"/></g>`
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body:
            `<polygon points="${starPoints(m.cx, m.cy, m.r, Math.PI / 8)}" fill="${p.accent}"/>` +
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.6)}" fill="${p.deep}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.6, mix('#ffffff', p.accent, 0.3), FONT.kufi) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};

// ── حديث ─────────────────────────────────────────────────────────────

const modern: Style = {
  key: 'modern',
  name: 'معاصر',
  hint: 'كتلٌ لونية وكوفيٌّ حديث — للشركات والدورات',
  variant: 'asym',
  paper: () => '#ffffff',
  type: (role, p) => {
    switch (role) {
      case 'headline':
        return { font: FONT.kufiText, bold: true, color: p.deep };
      case 'org':
        return { font: FONT.kufiText, bold: true, color: p.primary };
      case 'name':
        return { font: FONT.kufiText, bold: true, color: p.primary };
      case 'intro':
      case 'body':
        return { font: FONT.plex, bold: false, color: mix(p.ink, '#ffffff', 0.15) };
      case 'meta':
        return { font: FONT.kufiText, bold: true, color: p.ink };
      case 'label':
        return { font: FONT.plex, bold: false, color: mix(p.ink, '#ffffff', 0.45) };
      case 'accent':
        return { font: FONT.kufiText, bold: true, color: p.accent };
      case 'big':
        return { font: FONT.kufiText, bold: true, color: p.deep };
      case 'onBand':
        return { font: FONT.kufiText, bold: true, color: '#ffffff' };
      case 'onBandSmall':
        return { font: FONT.plex, bold: false, color: mix('#ffffff', p.primary, 0.25) };
    }
  },
  frame: (c) => {
    const defs = dotsPattern('dt', c.M * 0.035, c.M * 0.0045, c.p.primary);
    if (c.family === 'card') {
      return {
        defs,
        body:
          // بلا نقاط على البطاقة: مساحتها ضيّقة، وكلّ نقشٍ فيها يقع تحت نصّ.
          `<path d="M${n(c.W * 0.62)},${n(c.H + c.B)} L${n(c.W + c.B)},${n(c.H * 0.42)} L${n(c.W + c.B)},${n(c.H + c.B)} Z" fill="${mix('#ffffff', c.p.primary, 0.08)}"/>`
      };
    }
    if (c.W > c.H) {
      // الكتلة يسارًا بحافّةٍ مائلة، وخطٌّ رفيعٌ بلون المرافق يتبعها.
      const top = c.W * 0.34;
      const bottom = c.W * 0.26;
      return {
        defs,
        body:
          `<path d="M${n(-c.B)},${n(-c.B)} L${n(top)},${n(-c.B)} L${n(bottom)},${n(c.H + c.B)} L${n(-c.B)},${n(c.H + c.B)} Z" fill="${c.p.deep}"/>` +
          `<path d="M${n(-c.B)},${n(-c.B)} L${n(top * 0.82)},${n(-c.B)} L${n(bottom * 0.72)},${n(c.H + c.B)} L${n(-c.B)},${n(c.H + c.B)} Z" fill="${c.p.primary}"/>` +
          `<line x1="${n(top + c.M * 0.02)}" y1="${n(-c.B)}" x2="${n(bottom + c.M * 0.02)}" y2="${n(c.H + c.B)}" stroke="${c.p.accent}" stroke-width="${n(c.M * 0.006)}"/>` +
          `<rect x="${n(c.W * 0.8)}" y="${n(c.H * 0.9)}" width="${n(c.W * 0.17)}" height="${n(c.H * 0.08)}" fill="url(#dt)" opacity="0.35"/>` +
          `<rect x="${n(c.W - c.M * 0.035)}" y="${n(c.H * 0.3)}" width="${n(c.M * 0.012)}" height="${n(c.H * 0.4)}" fill="${c.p.accent}"/>`
      };
    }
    return {
      defs,
      body:
        `<path d="M${n(-c.B)},${n(-c.B)} L${n(c.W + c.B)},${n(-c.B)} L${n(c.W + c.B)},${n(c.H * 0.035)} L${n(-c.B)},${n(c.H * 0.075)} Z" fill="${c.p.primary}"/>` +
        `<path d="M${n(-c.B)},${n(c.H + c.B)} L${n(c.W + c.B)},${n(c.H + c.B)} L${n(c.W + c.B)},${n(c.H * 0.94)} L${n(-c.B)},${n(c.H * 0.97)} Z" fill="${c.p.deep}"/>` +
        `<rect x="${n(c.W * 0.04)}" y="${n(c.H * 0.1)}" width="${n(c.W * 0.22)}" height="${n(c.H * 0.14)}" fill="url(#dt)" opacity="0.3"/>`
    };
  },
  decor: (d, c) => {
    const { p } = c;
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        const cut = c.M * 0.12;
        const shape =
          d.edge === 'top'
            ? `M${n(b.x)},${n(b.y + b.h)} L${n(b.x + b.w)},${n(b.y + b.h)} L${n(b.x + b.w)},${n(b.y)} L${n(b.x + cut)},${n(b.y)} Z`
            : `M${n(b.x)},${n(b.y)} L${n(b.x + b.w)},${n(b.y)} L${n(b.x + b.w)},${n(b.y + b.h)} L${n(b.x + cut)},${n(b.y + b.h)} Z`;
        return {
          body:
            `<path d="${shape}" fill="${p.primary}"/>` +
            (d.edge === 'top' ? '' : `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(c.M * 0.05)}" height="${n(b.h)}" fill="${p.accent}"/>`)
        };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(p.ink, '#ffffff', 0.55), c.M * 0.003) };
      case 'divider': {
        const w = Math.min(d.w * c.W, c.M * 0.12);
        const x = d.cx * c.W + (d.w * c.W) / 2 - w;
        return { body: `<rect x="${n(x)}" y="${n(d.y * c.H - c.M * 0.006)}" width="${n(w)}" height="${n(c.M * 0.012)}" fill="${p.accent}"/>` };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, mix('#ffffff', p.primary, 0.08), mix('#ffffff', p.primary, 0.45), c.M * 0.002, c.M * 0.025) };
      case 'panel': {
        const b = box(c, d.at);
        return {
          body:
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.02)}" fill="${mix('#ffffff', p.primary, 0.1)}"/>` +
            `<rect x="${n(b.x + b.w - c.M * 0.012)}" y="${n(b.y)}" width="${n(c.M * 0.012)}" height="${n(b.h)}" fill="${p.accent}"/>`
        };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="url(#dt)" opacity="0.18"/>` };
        if (!c.logo)
          // بلا شعار: حلقاتٌ متراكزة — بيضاء على الكتلة اللونية، وبلون الجهة على الورق.
          return {
            body:
              [1, 0.78, 0.56, 0.34]
                .map((k, i) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * k)}" fill="none" stroke="${c.family === 'sheet' && c.W > c.H ? '#ffffff' : p.primary}" stroke-width="${n(c.M * (i === 0 ? 0.004 : 0.0025))}" opacity="${0.5 - i * 0.08}"/>`)
                .join('') + `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.12)}" fill="${p.accent}"/>`
          };
        return {
          body:
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.8)}" fill="#ffffff"/>` +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.88)}" fill="none" stroke="${p.accent}" stroke-width="${n(c.M * 0.004)}"/>`
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body:
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.7)}" fill="${d.rank === 1 ? p.primary : mix(p.primary, '#ffffff', 0.3 * (d.rank - 1))}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.7, '#ffffff', FONT.kufiText) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};

// ── ذهبي فاخر ────────────────────────────────────────────────────────

const GOLD = '#d4b264';
const GOLD_LIGHT = '#f1e2b3';

const luxury: Style = {
  key: 'luxury',
  name: 'ذهبي',
  hint: 'خلفيةٌ داكنة ورقائق ذهب — للتخرّج والدعوات',
  variant: 'centered',
  paper: (p) => mix(p.deep, '#000000', 0.25),
  type: (role, p, family) => {
    const cream = '#efe8d8';
    switch (role) {
      case 'headline':
        return { font: FONT.messiri, bold: true, color: GOLD, scale: 1.02 };
      case 'org':
        return { font: FONT.kufiText, bold: true, color: GOLD };
      case 'name':
        return { font: family === 'sheet' ? FONT.ruqaa : FONT.messiri, bold: true, color: GOLD_LIGHT };
      case 'intro':
      case 'body':
        return { font: family === 'sheet' ? FONT.naskh : FONT.messiri, bold: false, color: cream };
      case 'meta':
        return { font: FONT.messiri, bold: true, color: cream };
      case 'label':
        return { font: FONT.messiri, bold: false, color: mix(cream, p.deep, 0.35) };
      case 'accent':
        return { font: FONT.messiri, bold: true, color: GOLD };
      case 'big':
        return { font: FONT.messiri, bold: true, color: GOLD_LIGHT };
      case 'onBand':
        return { font: FONT.messiri, bold: true, color: GOLD_LIGHT };
      case 'onBandSmall':
        return { font: FONT.messiri, bold: false, color: GOLD };
    }
  },
  frame: (c) => {
    const defs = foil('au') + foil('au2', 125);
    const glow = `<radialGradient id="gl"><stop offset="0" stop-color="${mix(c.p.primary, '#ffffff', 0.08)}" stop-opacity="0.9"/><stop offset="1" stop-color="${c.p.deep}" stop-opacity="0"/></radialGradient>`;
    // البطاقة: أشرطتها الذهبية الحافّة تكفيها — وإطارٌ فوقها يشقّ اسم الجهة.
    if (c.family === 'card')
      return {
        defs: defs + glow,
        body: `<ellipse cx="${n(c.W / 2)}" cy="${n(c.H * 0.55)}" rx="${n(c.W * 0.7)}" ry="${n(c.H * 0.7)}" fill="url(#gl)"/>`
      };
    const inset = c.M * 0.04;
    const sw = c.M * 0.004;
    const gap = c.M * 0.012;
    const frame =
      `<rect x="${n(inset)}" y="${n(inset)}" width="${n(c.W - 2 * inset)}" height="${n(c.H - 2 * inset)}" fill="none" stroke="url(#au)" stroke-width="${n(sw * 1.8)}"/>` +
      `<rect x="${n(inset + gap)}" y="${n(inset + gap)}" width="${n(c.W - 2 * (inset + gap))}" height="${n(c.H - 2 * (inset + gap))}" fill="none" stroke="url(#au2)" stroke-width="${n(sw * 0.7)}"/>`;
    return {
      defs: defs + glow,
      body:
        `<ellipse cx="${n(c.W / 2)}" cy="${n(c.H * 0.42)}" rx="${n(c.W * 0.6)}" ry="${n(c.H * 0.6)}" fill="url(#gl)"/>` +
        frame +
        decoCorners(c, inset + gap * 2.2, c.M * 0.075, 'url(#au)', sw * 0.9)
    };
  },
  decor: (d, c) => {
    const { p } = c;
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        const edgeY = d.edge === 'top' ? b.y : b.y + b.h;
        return {
          body:
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${mix(p.deep, '#000000', 0.45)}"/>` +
            `<rect x="${n(b.x)}" y="${n(edgeY - c.M * 0.005)}" width="${n(b.w)}" height="${n(c.M * 0.01)}" fill="url(#au)"/>`
        };
      }
      case 'rule':
        return { body: ruleLine(c, d, GOLD, c.M * 0.003) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        const r = c.M * 0.014;
        return {
          body:
            // لونٌ مصمت لا تدرّج: التدرّج على خطٍّ أفقي بلا ارتفاع لا يُرسم أصلًا.
            `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}" stroke="${GOLD}" stroke-width="${n(c.M * 0.003)}"/>` +
            `<path d="M${n(cx)},${n(y - r)} L${n(cx + r)},${n(y)} L${n(cx)},${n(y + r)} L${n(cx - r)},${n(y)} Z" fill="url(#au)"/>`
        };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, mix(p.deep, '#ffffff', 0.08), GOLD, c.M * 0.008, c.M * 0.015) };
      case 'panel': {
        const b = box(c, d.at);
        return {
          body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.015)}" fill="${mix(p.deep, '#000000', 0.3)}" stroke="url(#au)" stroke-width="${n(c.M * 0.005)}"/>`
        };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="none" stroke="${GOLD}" stroke-width="${n(c.M * 0.003)}" opacity="0.15"/>` };
        return {
          body:
            sunburst(cx, cy + R * 0.2, R * 2.2, 36, GOLD, 0.16) +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.82)}" fill="${mix(p.deep, '#000000', 0.2)}" stroke="url(#au)" stroke-width="${n(c.M * 0.004)}"/>` +
            (c.logo
              ? ''
              : `<polygon points="${starPoints(cx, cy, R * 0.5, Math.PI / 8)}" fill="url(#au)"/>` +
                `<polygon points="${starPoints(cx, cy, R * 0.26, 0)}" fill="${mix(p.deep, '#000000', 0.2)}"/>`)
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body:
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.7)}" fill="url(#au)"/>` +
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.84)}" fill="none" stroke="${GOLD}" stroke-width="${n(c.M * 0.002)}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.7, p.deep, FONT.messiri) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};

// ── أطفال ────────────────────────────────────────────────────────────

const kids: Style = {
  key: 'kids',
  name: 'براعم',
  hint: 'ألوانٌ مرحة ونجوم — لرياض الأطفال والابتدائية',
  variant: 'centered',
  paper: () => '#fffdf6',
  type: (role, p) => {
    const b = p.bright;
    switch (role) {
      case 'headline':
        return { font: FONT.kids, bold: false, color: b[0]!, scale: 1.08 };
      case 'org':
        return { font: FONT.kids, bold: false, color: b[2]! };
      case 'name':
        return { font: FONT.kids, bold: false, color: '#2d2a64' };
      case 'intro':
      case 'body':
        return { font: FONT.cairo, bold: true, color: '#3a3552' };
      case 'meta':
        return { font: FONT.cairo, bold: true, color: '#3a3552' };
      case 'label':
        return { font: FONT.cairo, bold: false, color: '#7a7590' };
      case 'accent':
        return { font: FONT.kids, bold: false, color: b[4]! };
      case 'big':
        return { font: FONT.kids, bold: false, color: b[0]! };
      case 'onBand':
        return { font: FONT.kids, bold: false, color: '#ffffff' };
      case 'onBandSmall':
        return { font: FONT.cairo, bold: true, color: '#ffffff' };
    }
  },
  frame: (c, keepRects) => {
    const b = c.p.bright;
    const keep = keepRects.map((r) => ({ x: r[0] * c.W, y: r[1] * c.H, w: r[2] * c.W, h: r[3] * c.H }));
    if (c.family === 'card') {
      return { defs: '', body: confetti(c, 10, b, c.seed, keep) };
    }
    const r = c.M * 0.022;
    return {
      defs: '',
      body:
        `<rect x="${n(r * 2.2)}" y="${n(r * 2.2)}" width="${n(c.W - r * 4.4)}" height="${n(c.H - r * 4.4)}" rx="${n(r * 2)}" fill="none" stroke="${b[2]}" stroke-width="${n(c.M * 0.006)}" stroke-dasharray="${n(c.M * 0.02)} ${n(c.M * 0.014)}" stroke-linecap="round"/>` +
        scallops(c, r * 0.9, r, b) +
        cloud(c.W * 0.13, c.H * 0.17, c.M * 0.18, mix('#ffffff', b[2]!, 0.18)) +
        cloud(c.W * 0.86, c.H * 0.2, c.M * 0.14, mix('#ffffff', b[3]!, 0.18)) +
        confetti(c, 26, b, c.seed, keep)
    };
  },
  decor: (d, c) => {
    const b = c.p.bright;
    switch (d.t) {
      case 'band': {
        const bx = box(c, d.at);
        const r = bx.h * 0.18;
        const edgeY = d.edge === 'top' ? bx.y : bx.y + bx.h;
        const count = Math.ceil(bx.w / (r * 1.8));
        const bumps = Array.from({ length: count + 1 }, (_, i) => `<circle cx="${n(bx.x + i * r * 1.8)}" cy="${n(edgeY)}" r="${n(r)}" fill="${b[2]}"/>`).join('');
        return {
          body: `<rect x="${n(bx.x)}" y="${n(bx.y)}" width="${n(bx.w)}" height="${n(bx.h)}" fill="${b[2]}"/>` + bumps
        };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix('#ffffff', b[2]!, 0.55), c.M * 0.005, `stroke-dasharray="${n(c.M * 0.012)} ${n(c.M * 0.012)}" stroke-linecap="round"`) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const r = c.M * 0.014;
        return { body: [-2, -1, 0, 1, 2].map((k, i) => star5(cx + k * r * 3, y, i === 2 ? r * 1.4 : r, b[i % b.length]!)).join('') };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, mix('#ffffff', b[1]!, 0.25), b[0]!, c.M * 0.012, c.M * 0.04) };
      case 'panel': {
        const bx = box(c, d.at);
        return {
          body: `<rect x="${n(bx.x)}" y="${n(bx.y)}" width="${n(bx.w)}" height="${n(bx.h)}" rx="${n(bx.h / 2)}" fill="${mix('#ffffff', b[1]!, 0.35)}" stroke="${b[1]}" stroke-width="${n(c.M * 0.008)}"/>`
        };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: star5(cx, cy, R, mix('#ffffff', b[1]!, 0.25)) };
        // بلا شعار: الدائرة شمسٌ بأشعّتها.
        const rays = c.logo
          ? ''
          : Array.from({ length: 12 }, (_, i) => {
              const a = (i * Math.PI) / 6;
              return `<line x1="${n(cx + Math.cos(a) * R * 1.12)}" y1="${n(cy + Math.sin(a) * R * 1.12)}" x2="${n(cx + Math.cos(a) * R * 1.38)}" y2="${n(cy + Math.sin(a) * R * 1.38)}" stroke="${b[1]}" stroke-width="${n(c.M * 0.012)}" stroke-linecap="round"/>`;
            }).join('') + `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.7)}" fill="${b[1]}"/>`;
        return {
          body:
            rays +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.95)}" fill="${mix('#ffffff', b[1]!, 0.3)}" ${c.logo ? '' : 'opacity="0"'}/>` +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.95)}" fill="none" stroke="${b[1]}" stroke-width="${n(c.M * 0.008)}" stroke-dasharray="${n(c.M * 0.018)} ${n(c.M * 0.012)}" stroke-linecap="round"/>`
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        const color = [b[1], '#b9c3cf', '#e0975a'][d.rank - 1] ?? b[1];
        return {
          body: star5(m.cx, m.cy, m.r * 1.05, color!) + medalNumber(m.cx, m.cy + m.r * 0.08, m.r * 0.55, '#ffffff', FONT.kids) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};

export const STYLES: Style[] = [official, islamic, modern, luxury, kids];

export const styleOf = (key: string): Style => STYLES.find((s) => s.key === key) ?? official;

export { onColor };
