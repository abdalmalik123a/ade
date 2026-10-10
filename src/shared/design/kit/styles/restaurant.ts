/**
 * مطعمٌ داكن (DESIGNS.md ٣٫١ — مثال «منيو مطعم»): ورقٌ فحميٌّ بنقشٍ خفيفٍ من خطوطٍ مائلة كالحجر، وإطارٌ مزدوجٌ نحاسيّ،
 * وفاصلٌ بشوكةٍ وسكّين، والعناوين نحاسية والأصناف بيضاء — يُقرأ على الطاولة في الضوء الخافت.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { n } from '../ornaments';

const COAL = '#1c1a19';
const COPPER = '#d08a4b';
const CREAM = '#efe6da';

/** شوكةٌ وسكّين متقاطعان حول `(cx, cy)` بطول `h`. */
function cutlery(cx: number, cy: number, h: number, color: string): string {
  const w = h * 0.07;
  const fork = `<g transform="rotate(-35 ${n(cx)} ${n(cy)})"><rect x="${n(cx - w / 2)}" y="${n(cy - h * 0.15)}" width="${n(w)}" height="${n(h * 0.65)}" rx="${n(w / 2)}" fill="${color}"/>${[-1, 0, 1]
    .map((k) => `<rect x="${n(cx + k * w * 1.3 - w * 0.3)}" y="${n(cy - h * 0.5)}" width="${n(w * 0.6)}" height="${n(h * 0.3)}" fill="${color}"/>`)
    .join('')}<rect x="${n(cx - w * 1.6)}" y="${n(cy - h * 0.22)}" width="${n(w * 3.2)}" height="${n(w)}" fill="${color}"/></g>`;
  const knife = `<g transform="rotate(35 ${n(cx)} ${n(cy)})"><rect x="${n(cx - w / 2)}" y="${n(cy - h * 0.05)}" width="${n(w)}" height="${n(h * 0.55)}" rx="${n(w / 2)}" fill="${color}"/><path d="M${n(cx - w / 2)},${n(cy - h * 0.05)} L${n(cx - w / 2)},${n(cy - h * 0.5)} Q${n(cx + w * 1.6)},${n(cy - h * 0.3)} ${n(cx + w / 2)},${n(cy - h * 0.05)} Z" fill="${color}"/></g>`;
  return fork + knife;
}

export const restaurant: Style = {
  key: 'restaurant',
  name: 'مطعم داكن',
  hint: 'فحميٌّ ونحاس — للمنيو وبطاقات المطاعم والمقاهي',
  variant: 'centered',
  paper: () => COAL,
  type: (role) => {
    switch (role) {
      case 'headline':
        return { font: FONT.messiri, bold: true, color: COPPER, scale: 1.06 };
      case 'org':
        return { font: FONT.kufi, bold: true, color: CREAM };
      case 'name':
        return { font: FONT.messiri, bold: true, color: CREAM };
      case 'intro':
      case 'body':
        return { font: FONT.messiri, bold: false, color: CREAM };
      case 'meta':
        return { font: FONT.cairo, bold: true, color: CREAM };
      case 'label':
        return { font: FONT.cairo, bold: false, color: '#a59c90' };
      case 'accent':
      case 'big':
        return { font: FONT.messiri, bold: true, color: COPPER };
      case 'onBand':
        return { font: FONT.messiri, bold: true, color: COAL };
      case 'onBandSmall':
        return { font: FONT.cairo, bold: true, color: COAL };
    }
  },
  frame: (c) => {
    const s = c.M * 0.03;
    const hatch = `<pattern id="rs-stone" width="${n(s)}" height="${n(s)}" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="${n(s)}" stroke="#ffffff" stroke-width="${n(c.M * 0.0012)}" opacity="0.05"/></pattern>`;
    const inset = c.M * 0.035;
    const gap = c.M * 0.01;
    const rect = (k: number, w: number) => `<rect x="${n(inset + k)}" y="${n(inset + k)}" width="${n(c.W - 2 * (inset + k))}" height="${n(c.H - 2 * (inset + k))}" fill="none" stroke="${COPPER}" stroke-width="${n(w)}"/>`;
    return {
      defs: hatch,
      body:
        `<rect x="${n(-c.B)}" y="${n(-c.B)}" width="${n(c.W + 2 * c.B)}" height="${n(c.H + 2 * c.B)}" fill="url(#rs-stone)"/>` +
        (c.family === 'sheet' ? rect(0, c.M * 0.003) + rect(gap, c.M * 0.0012) : rect(0, c.M * 0.004))
    };
  },
  decor: (d, c) => {
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${COPPER}"/>` };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(CREAM, COAL, 0.6), c.M * 0.002, `stroke-dasharray="${n(c.M * 0.004)} ${n(c.M * 0.006)}"`) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        const gapW = c.M * 0.035;
        return {
          body:
            `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx - gapW)}" y2="${n(y)}" stroke="${COPPER}" stroke-width="${n(c.M * 0.0022)}"/>` +
            `<line x1="${n(cx + gapW)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}" stroke="${COPPER}" stroke-width="${n(c.M * 0.0022)}"/>` +
            cutlery(cx, y, c.M * 0.045, COPPER)
        };
      }
      case 'photo': {
        const b = box(c, d.at);
        const r = Math.min(b.w, b.h) / 2;
        // صور الأطباق في دوائر بحلقةٍ نحاسية.
        return { body: `<circle cx="${n(b.x + b.w / 2)}" cy="${n(b.y + b.h / 2)}" r="${n(r)}" fill="#2b2826" stroke="${COPPER}" stroke-width="${n(c.M * 0.006)}"/>` };
      }
      case 'panel': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="#ffffff" fill-opacity="0.04" stroke="${mix(COPPER, COAL, 0.35)}" stroke-width="${n(c.M * 0.0022)}"/>` };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="none" stroke="${COPPER}" stroke-width="${n(c.M * 0.003)}" opacity="0.12"/>` };
        return {
          body:
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.9)}" fill="none" stroke="${COPPER}" stroke-width="${n(c.M * 0.004)}"/>` +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.78)}" fill="none" stroke="${COPPER}" stroke-width="${n(c.M * 0.0015)}"/>` +
            (c.logo ? '' : cutlery(cx, cy, R * 1.1, COPPER))
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body: `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.72)}" fill="${[COPPER, '#b9b2a8', '#8d6a4f'][d.rank - 1] ?? COPPER}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.72, COAL, FONT.messiri) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
