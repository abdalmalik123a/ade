/**
 * النمط الذهبي الفاخر.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { decoCorners, foil, n, starPoints, sunburst } from '../ornaments';

// ── ذهبي فاخر ────────────────────────────────────────────────────────

const GOLD = '#d4b264';
const GOLD_LIGHT = '#f1e2b3';

export const luxury: Style = {
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
