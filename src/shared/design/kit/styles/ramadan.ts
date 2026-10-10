/**
 * ليالي رمضان (DESIGNS.md ٣٫١ — الإمساكية وتهاني العيد): ليلٌ أزرقُ عميق بتدرّجٍ نحو الأسفل، وهلالٌ ونجومٌ متناثرة، وفوانيسُ
 * معلّقة في الأعلى بخيوطها، وذهبٌ للعناوين — والأرقام والجداول بخطٍّ واضحٍ على الليل.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { n, seeded, star5, starPoints } from '../ornaments';
import { crescent, lantern } from '../motifs';

const NIGHT = '#0f1b3d';
const DUSK = '#243a73';
const GOLD = '#e8c26a';
const CREAM = '#f3ead6';

export const ramadan: Style = {
  key: 'ramadan',
  name: 'ليالي رمضان',
  hint: 'ليلٌ وهلالٌ وفوانيس — للإمساكية وتهاني رمضان والعيد',
  variant: 'centered',
  paper: () => NIGHT,
  type: (role, _p, family) => {
    switch (role) {
      case 'headline':
        return { font: FONT.ruqaa, bold: true, color: GOLD, scale: 1.08 };
      case 'org':
        return { font: FONT.messiri, bold: true, color: CREAM };
      case 'name':
        return { font: family === 'sheet' ? FONT.ruqaa : FONT.messiri, bold: true, color: GOLD };
      case 'intro':
      case 'body':
        return { font: FONT.messiri, bold: false, color: CREAM };
      case 'meta':
        return { font: FONT.cairo, bold: true, color: CREAM };
      case 'label':
        return { font: FONT.cairo, bold: false, color: '#b5bfd8' };
      case 'accent':
      case 'big':
        return { font: FONT.messiri, bold: true, color: GOLD };
      case 'onBand':
        return { font: FONT.messiri, bold: true, color: NIGHT };
      case 'onBandSmall':
        return { font: FONT.cairo, bold: true, color: NIGHT };
    }
  },
  frame: (c, keepRects) => {
    const sky = `<linearGradient id="rm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NIGHT}"/><stop offset="1" stop-color="${DUSK}"/></linearGradient>`;
    const keep = keepRects.map((r) => ({ x: r[0] * c.W, y: r[1] * c.H, w: r[2] * c.W, h: r[3] * c.H }));
    const rnd = seeded(c.seed + 17);
    let stars = '';
    for (let i = 0, tries = 0; i < (c.family === 'card' ? 14 : 34) && tries < 400; tries++) {
      const x = rnd() * c.W;
      const y = rnd() * c.H * 0.85;
      if (keep.some((k) => x > k.x - c.M * 0.02 && x < k.x + k.w + c.M * 0.02 && y > k.y - c.M * 0.02 && y < k.y + k.h + c.M * 0.02)) continue;
      const r = c.M * (0.003 + rnd() * 0.006);
      stars += i % 4 ? `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${CREAM}" opacity="${n(0.4 + rnd() * 0.5)}"/>` : star5(x, y, r * 2.2, GOLD);
      i++;
    }
    const B = c.B;
    const lanterns =
      c.family === 'sheet'
        ? lantern(c.W * 0.1, -B, c.M * 0.16, GOLD, mix(GOLD, '#fff6d8', 0.5), c.M * 0.1 + B) +
          lantern(c.W * 0.2, -B, c.M * 0.12, GOLD, mix(GOLD, '#fff6d8', 0.5), c.M * 0.05 + B) +
          lantern(c.W * 0.9, -B, c.M * 0.16, GOLD, mix(GOLD, '#fff6d8', 0.5), c.M * 0.12 + B)
        : lantern(c.W * 0.1, -B, c.M * 0.26, GOLD, mix(GOLD, '#fff6d8', 0.5), c.M * 0.06 + B);
    return {
      defs: sky,
      body:
        `<rect x="${n(-B)}" y="${n(-B)}" width="${n(c.W + 2 * B)}" height="${n(c.H + 2 * B)}" fill="url(#rm-sky)"/>` +
        stars +
        crescent(c.W * 0.82, c.H * (c.family === 'card' ? 0.2 : 0.17), c.M * (c.family === 'card' ? 0.1 : 0.075), GOLD, -1) +
        lanterns
    };
  },
  decor: (d, c) => {
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${GOLD}"/>` };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(GOLD, NIGHT, 0.3), c.M * 0.0025, `stroke-dasharray="${n(c.M * 0.008)} ${n(c.M * 0.008)}"`) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        return {
          body:
            `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}" stroke="${GOLD}" stroke-width="${n(c.M * 0.0025)}" opacity="0.7"/>` +
            `<rect x="${n(cx - c.M * 0.03)}" y="${n(y - c.M * 0.012)}" width="${n(c.M * 0.06)}" height="${n(c.M * 0.024)}" fill="${NIGHT}"/>` +
            crescent(cx, y, c.M * 0.012, GOLD, -1) +
            star5(cx + c.M * 0.022, y, c.M * 0.006, GOLD)
        };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, DUSK, GOLD, c.M * 0.006, c.M * 0.03) };
      case 'panel': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.02)}" fill="${NIGHT}" fill-opacity="0.65" stroke="${GOLD}" stroke-width="${n(c.M * 0.003)}"/>` };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: crescent(cx, cy, R, GOLD, -1).replace('/>', ' opacity="0.12"/>') };
        // قوسُ بابٍ ذهبيّ حول الشعار، أو هلالٌ ونجمة بلاه.
        const arch = `<path d="M${n(cx - R * 0.8)},${n(cy + R * 0.9)} L${n(cx - R * 0.8)},${n(cy - R * 0.1)} Q${n(cx - R * 0.8)},${n(cy - R * 0.95)} ${n(cx)},${n(cy - R * 1.15)} Q${n(cx + R * 0.8)},${n(cy - R * 0.95)} ${n(cx + R * 0.8)},${n(cy - R * 0.1)} L${n(cx + R * 0.8)},${n(cy + R * 0.9)}" fill="none" stroke="${GOLD}" stroke-width="${n(c.M * 0.004)}"/>`;
        return { body: arch + (c.logo ? '' : crescent(cx, cy, R * 0.45, GOLD, -1) + `<polygon points="${starPoints(cx + R * 0.32, cy - R * 0.1, R * 0.14, 0)}" fill="${GOLD}"/>`) };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body: star5(m.cx, m.cy, m.r * 1.05, [GOLD, '#c8ccd2', '#c08a55'][d.rank - 1] ?? GOLD) + medalNumber(m.cx, m.cy + m.r * 0.06, m.r * 0.5, NIGHT, FONT.messiri) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
