/**
 * أطفالٌ بألوانٍ هادئة (DESIGNS.md ٣٫١ — مثال «هوية طالب باستيل»): كـ«براعم» للصغار، لكن بألوانٍ مطفأة (خوخيّ وسماويّ ونعناعيّ
 * ولافندر) بدل الصارخة، وغيومٌ وزهراتٌ ونجومٌ قليلة، والصورة بإطارٍ مستدير بحلقتين — هدوءٌ يناسب الهويّات والشهادات.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { cloud, confetti, n, star5 } from '../ornaments';
import { blossom } from '../motifs';

const PEACH = '#f4b9a0';
const SKY = '#a9cfe8';
const MINT = '#a8d8bf';
const LAVENDER = '#c5b7e6';
const BUTTER = '#f5dc95';
const SOFT = [PEACH, SKY, MINT, LAVENDER, BUTTER];
const INK = '#4b4a63';

export const pastel: Style = {
  key: 'pastel',
  name: 'براعم هادئة',
  hint: 'باستيلٌ مطفأ وغيومٌ وزهرات — لهويّات الصغار وشهاداتهم بهدوء',
  variant: 'centered',
  paper: () => '#fffaf5',
  type: (role) => {
    switch (role) {
      case 'headline':
        return { font: FONT.kids, bold: false, color: mix(PEACH, '#7a4a4a', 0.45), scale: 1.05 };
      case 'org':
        return { font: FONT.cairo, bold: true, color: mix(SKY, '#2c4a66', 0.6) };
      case 'name':
        return { font: FONT.kids, bold: false, color: INK };
      case 'intro':
      case 'body':
        return { font: FONT.cairo, bold: true, color: mix(INK, '#ffffff', 0.1) };
      case 'meta':
        return { font: FONT.cairo, bold: true, color: INK };
      case 'label':
        return { font: FONT.cairo, bold: false, color: mix(INK, '#ffffff', 0.4) };
      case 'accent':
        return { font: FONT.kids, bold: false, color: mix(MINT, '#2f5d48', 0.55) };
      case 'big':
        return { font: FONT.kids, bold: false, color: mix(LAVENDER, '#4a3d73', 0.5) };
      case 'onBand':
        return { font: FONT.kids, bold: false, color: INK };
      case 'onBandSmall':
        return { font: FONT.cairo, bold: true, color: INK };
    }
  },
  frame: (c, keepRects) => {
    const keep = keepRects.map((r) => ({ x: r[0] * c.W, y: r[1] * c.H, w: r[2] * c.W, h: r[3] * c.H }));
    if (c.family === 'card') {
      return {
        defs: '',
        body:
          cloud(c.W * 0.86, c.H * 0.16, c.M * 0.32, mix(SKY, '#ffffff', 0.45)) +
          blossom(c.W * 0.06, c.H * 0.9, c.M * 0.07, mix(PEACH, '#ffffff', 0.3), BUTTER) +
          confetti(c, 6, SOFT, c.seed, keep)
      };
    }
    const r = c.M * 0.03;
    return {
      defs: '',
      body:
        `<rect x="${n(r)}" y="${n(r)}" width="${n(c.W - 2 * r)}" height="${n(c.H - 2 * r)}" rx="${n(r * 1.6)}" fill="none" stroke="${mix(SKY, '#ffffff', 0.2)}" stroke-width="${n(c.M * 0.008)}"/>` +
        cloud(c.W * 0.12, c.H * 0.14, c.M * 0.2, mix(SKY, '#ffffff', 0.5)) +
        cloud(c.W * 0.88, c.H * 0.17, c.M * 0.16, mix(LAVENDER, '#ffffff', 0.55)) +
        blossom(c.W * 0.08, c.H * 0.86, c.M * 0.05, mix(PEACH, '#ffffff', 0.25), BUTTER, 0.4) +
        blossom(c.W * 0.92, c.H * 0.84, c.M * 0.04, mix(MINT, '#ffffff', 0.2), BUTTER, 1) +
        confetti(c, 14, SOFT, c.seed, keep)
    };
  },
  decor: (d, c) => {
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(b.h * 0.18)}" fill="${mix(SKY, '#ffffff', 0.25)}"/>` };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(LAVENDER, '#ffffff', 0.2), c.M * 0.004, `stroke-dasharray="${n(c.M * 0.008)} ${n(c.M * 0.01)}" stroke-linecap="round"`) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const r = c.M * 0.012;
        return { body: [-2, -1, 0, 1, 2].map((k, i) => (i === 2 ? blossom(cx, y, r * 1.6, PEACH, BUTTER) : star5(cx + k * r * 3, y, r * 0.8, SOFT[i]!))).join('') };
      }
      case 'photo': {
        const b = box(c, d.at);
        // حلقتان باستيل حول الصورة.
        return {
          body:
            photoFrame(c, d.at, mix(SKY, '#ffffff', 0.65), mix(PEACH, '#ffffff', 0.1), c.M * 0.012, c.M * 0.045) +
            `<rect x="${n(b.x - c.M * 0.012)}" y="${n(b.y - c.M * 0.012)}" width="${n(b.w + c.M * 0.024)}" height="${n(b.h + c.M * 0.024)}" rx="${n(c.M * 0.055)}" fill="none" stroke="${MINT}" stroke-width="${n(c.M * 0.005)}"/>`
        };
      }
      case 'panel': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(Math.min(b.h / 2, c.M * 0.05))}" fill="${mix(BUTTER, '#ffffff', 0.6)}" stroke="${BUTTER}" stroke-width="${n(c.M * 0.005)}"/>` };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: blossom(cx, cy, R, mix(PEACH, '#ffffff', 0.88), mix(BUTTER, '#ffffff', 0.8)) };
        return {
          body:
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.95)}" fill="${mix(SKY, '#ffffff', 0.55)}" stroke="${SKY}" stroke-width="${n(c.M * 0.006)}" stroke-dasharray="${n(c.M * 0.014)} ${n(c.M * 0.01)}" stroke-linecap="round"/>` +
            (c.logo ? '' : blossom(cx, cy, R * 0.6, PEACH, BUTTER))
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body: star5(m.cx, m.cy, m.r * 1.05, [BUTTER, SKY, PEACH][d.rank - 1] ?? BUTTER) + medalNumber(m.cx, m.cy + m.r * 0.08, m.r * 0.55, INK, FONT.kids) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
