/**
 * أسود وذهبي (DESIGNS.md ٣٫١ — مثال «شهادة شكر»): ورقٌ فحميّ، وزوايا مائلةٌ متدرّجة الذهب في ركنين متقابلين، وخطٌّ ذهبيّ
 * رفيع حول الورقة، وميداليةٌ بشريطين بدل الختم. وغير «ذهبي» (`luxury`): ذاك بلون الجهة الداكن ورقائق فاخرة، وهذا أسودُ صريح.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { foil, n, starPoints } from '../ornaments';

const INK = '#141414';
const GOLD = '#d6b25e';
const PALE = '#f3e6c4';
const CREAM = '#ece7dc';

/** زاويةٌ مائلة: مثلّثٌ ذهبيّ وشريطٌ أسود داخله وشريطٌ ذهبيّ رفيع — في الركن (`sx`، `sy`: ±١). */
function corner(W: number, H: number, size: number, sx: number, sy: number, B: number): string {
  const x0 = sx > 0 ? W + B : -B;
  const y0 = sy > 0 ? H + B : -B;
  const tri = (k: number) => `${n(x0)},${n(y0)} ${n(x0 - sx * (size * k + B))},${n(y0)} ${n(x0)},${n(y0 - sy * (size * k * 0.62 + B))}`;
  return `<polygon points="${tri(1)}" fill="url(#bg-au)"/><polygon points="${tri(0.8)}" fill="${INK}"/><polygon points="${tri(0.7)}" fill="url(#bg-au2)"/>`;
}

export const blackGold: Style = {
  key: 'blackGold',
  name: 'أسود وذهبي',
  hint: 'فحميٌّ بزوايا ذهبية مائلة — للشكر والتقدير والتخرّج',
  variant: 'centered',
  paper: () => INK,
  type: (role, _p, family) => {
    switch (role) {
      case 'headline':
        return { font: FONT.messiri, bold: true, color: GOLD, scale: 1.05 };
      case 'org':
        return { font: FONT.kufiText, bold: true, color: PALE };
      case 'name':
        return { font: family === 'sheet' ? FONT.ruqaa : FONT.messiri, bold: true, color: GOLD };
      case 'intro':
      case 'body':
        return { font: family === 'sheet' ? FONT.naskh : FONT.cairo, bold: false, color: CREAM };
      case 'meta':
        return { font: FONT.cairo, bold: true, color: PALE };
      case 'label':
        return { font: FONT.cairo, bold: false, color: '#a9a294' };
      case 'accent':
      case 'big':
        return { font: FONT.messiri, bold: true, color: GOLD };
      case 'onBand':
        return { font: FONT.messiri, bold: true, color: INK };
      case 'onBandSmall':
        return { font: FONT.cairo, bold: true, color: INK };
    }
  },
  frame: (c) => {
    const defs = foil('bg-au', 35) + foil('bg-au2', 120);
    const size = c.M * (c.family === 'card' ? 0.42 : 0.36);
    const inset = c.M * 0.03;
    return {
      defs,
      body:
        corner(c.W, c.H, size, -1, -1, c.B) +
        corner(c.W, c.H, size, 1, 1, c.B) +
        (c.family === 'sheet'
          ? `<rect x="${n(inset)}" y="${n(inset)}" width="${n(c.W - 2 * inset)}" height="${n(c.H - 2 * inset)}" fill="none" stroke="${GOLD}" stroke-width="${n(c.M * 0.0025)}" opacity="0.8"/>`
          : '')
    };
  },
  decor: (d, c) => {
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="url(#bg-au)"/>` };
      }
      case 'rule':
        return { body: ruleLine(c, d, GOLD, c.M * 0.0025) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        return {
          body:
            `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx - c.M * 0.03)}" y2="${n(y)}" stroke="${GOLD}" stroke-width="${n(c.M * 0.003)}"/>` +
            `<line x1="${n(cx + c.M * 0.03)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}" stroke="${GOLD}" stroke-width="${n(c.M * 0.003)}"/>` +
            `<polygon points="${starPoints(cx, y, c.M * 0.018, 0)}" fill="url(#bg-au)"/>`
        };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, '#262626', GOLD, c.M * 0.008, c.M * 0.012) };
      case 'panel': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.012)}" fill="#1e1e1e" stroke="${GOLD}" stroke-width="${n(c.M * 0.003)}"/>` };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="none" stroke="${GOLD}" stroke-width="${n(c.M * 0.003)}" opacity="0.18"/>` };
        // ميداليةٌ بشريطين متدلّيين — والشعار في وسطها إن وُجد.
        const ribbon = (dir: number) =>
          `<polygon points="${n(cx + dir * R * 0.15)},${n(cy + R * 0.6)} ${n(cx + dir * R * 0.65)},${n(cy + R * 1.55)} ${n(cx + dir * R * 0.42)},${n(cy + R * 1.42)} ${n(cx + dir * R * 0.3)},${n(cy + R * 1.68)} ${n(cx - dir * R * 0.15)},${n(cy + R * 0.7)}" fill="${dir > 0 ? '#9c7a2e' : GOLD}"/>`;
        return {
          body:
            ribbon(1) +
            ribbon(-1) +
            `<polygon points="${starPoints(cx, cy, R * 1.02, Math.PI / 8)}" fill="url(#bg-au)"/>` +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.74)}" fill="${INK}" stroke="url(#bg-au2)" stroke-width="${n(c.M * 0.004)}"/>` +
            (c.logo ? '' : `<polygon points="${starPoints(cx, cy, R * 0.38, 0)}" fill="url(#bg-au)"/>`)
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        const color = ['url(#bg-au)', '#c8ccd2', '#c08a55'][d.rank - 1] ?? GOLD;
        return {
          body:
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.72)}" fill="${color}"/>` +
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.86)}" fill="none" stroke="${GOLD}" stroke-width="${n(c.M * 0.002)}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.72, INK, FONT.messiri) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
