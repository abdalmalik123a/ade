/**
 * نمط الأطفال.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { cloud, confetti, n, scallops, star5 } from '../ornaments';

// ── أطفال ────────────────────────────────────────────────────────────

export const kids: Style = {
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
