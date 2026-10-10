/**
 * زهريٌّ مائي (DESIGNS.md ٣٫١ — مثال «دعوة زفاف مائية»): ورقٌ عاجيّ، وبقعٌ مائيةٌ زهرية وخضراء شفيفة في ركنين متقابلين،
 * وأغصانٌ وزهورٌ صغيرة فوقها، والأسماء بخطٍّ مكتوب. والبقع تدرّجاتٌ متّجهة لا مرشّحات — فتُطبع كما تُرى.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { n } from '../ornaments';
import { blossom, sprig, wash, washGradient } from '../motifs';

const BLUSH = '#e7a3ae';
const ROSE = '#c76b7e';
const SAGE = '#9fbf98';
const LEAF = '#6f9a74';
const INK = '#4a3b40';

/** باقةٌ في ركنٍ (`sx`، `sy`: ±١): بقعتان وغصنان وثلاث زهرات. */
function bouquet(W: number, H: number, M: number, sx: number, sy: number, seed: number): string {
  const x = sx > 0 ? W : 0;
  const y = sy > 0 ? H : 0;
  const r = M * 0.26;
  const ang = Math.atan2(-sy, -sx);
  return (
    wash(x - sx * r * 0.2, y - sy * r * 0.15, r, 'wc-rose', seed) +
    wash(x - sx * r * 0.75, y - sy * r * 0.1, r * 0.55, 'wc-sage', seed + 7, 4) +
    sprig(x - sx * M * 0.02, y - sy * M * 0.04, M * 0.42, ang + 0.35 * sx * sy, LEAF, M * 0.0035, 7, 0.22, mix(SAGE, '#ffffff', 0.35)) +
    sprig(x - sx * M * 0.05, y - sy * M * 0.01, M * 0.3, ang - 0.5 * sx * sy, LEAF, M * 0.003, 5, -0.2, mix(SAGE, '#ffffff', 0.5)) +
    blossom(x - sx * M * 0.1, y - sy * M * 0.1, M * 0.045, BLUSH, ROSE, 0.3) +
    blossom(x - sx * M * 0.19, y - sy * M * 0.06, M * 0.032, mix(BLUSH, '#ffffff', 0.3), ROSE, 1.1) +
    blossom(x - sx * M * 0.06, y - sy * M * 0.2, M * 0.028, mix(BLUSH, '#ffffff', 0.2), ROSE, 2)
  );
}

export const watercolor: Style = {
  key: 'watercolor',
  name: 'زهري مائي',
  hint: 'بقعٌ مائية وزهور — للأعراس والخطوبة والمواليد',
  variant: 'centered',
  paper: () => '#fdf9f5',
  type: (role, _p, family) => {
    switch (role) {
      case 'headline':
        return { font: FONT.ruqaa, bold: false, color: ROSE, scale: 1.1 };
      case 'org':
        return { font: FONT.messiri, bold: false, color: mix(INK, '#ffffff', 0.15) };
      case 'name':
        return { font: FONT.ruqaa, bold: true, color: ROSE };
      case 'intro':
      case 'body':
        return { font: family === 'sheet' ? FONT.naskh : FONT.messiri, bold: false, color: INK };
      case 'meta':
        return { font: FONT.messiri, bold: true, color: INK };
      case 'label':
        return { font: FONT.messiri, bold: false, color: mix(INK, '#ffffff', 0.4) };
      case 'accent':
        return { font: FONT.ruqaa, bold: false, color: LEAF };
      case 'big':
        return { font: FONT.messiri, bold: true, color: ROSE };
      case 'onBand':
        return { font: FONT.messiri, bold: true, color: '#ffffff' };
      case 'onBandSmall':
        return { font: FONT.messiri, bold: false, color: '#ffffff' };
    }
  },
  frame: (c) => ({
    defs: washGradient('wc-rose', BLUSH, 0.5) + washGradient('wc-sage', SAGE, 0.45),
    body: bouquet(c.W, c.H, c.M, -1, -1, c.seed) + bouquet(c.W, c.H, c.M, 1, 1, c.seed + 3)
  }),
  decor: (d, c) => {
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${BLUSH}" opacity="0.85"/>` };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(ROSE, '#ffffff', 0.35), c.M * 0.0025, `stroke-dasharray="${n(c.M * 0.006)} ${n(c.M * 0.008)}" stroke-linecap="round"`) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        return {
          body:
            sprig(cx - c.M * 0.025, y, half * 0.9, Math.PI, LEAF, c.M * 0.0025, 4, 0.12) +
            sprig(cx + c.M * 0.025, y, half * 0.9, 0, LEAF, c.M * 0.0025, 4, -0.12) +
            blossom(cx, y, c.M * 0.022, BLUSH, ROSE)
        };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, mix(BLUSH, '#ffffff', 0.7), ROSE, c.M * 0.006, c.M * 0.04) };
      case 'panel': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.03)}" fill="#ffffff" fill-opacity="0.7" stroke="${mix(ROSE, '#ffffff', 0.4)}" stroke-width="${n(c.M * 0.003)}"/>` };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        // العلامة المائية تحت أسطر الاستمارة: باهتةٌ جدًّا فلا تزاحم الكتابة.
        if (d.faint) return { body: blossom(cx, cy, R, mix(BLUSH, '#ffffff', 0.9), mix(ROSE, '#ffffff', 0.85)) };
        // إكليلٌ من غصنين حول الختم.
        return {
          body:
            wash(cx, cy, R * 1.1, 'wc-rose', c.seed + 11, 4) +
            sprig(cx - R * 0.15, cy + R * 0.95, R * 1.7, -Math.PI * 0.62, LEAF, c.M * 0.003, 6, 0.35) +
            sprig(cx + R * 0.15, cy + R * 0.95, R * 1.7, -Math.PI * 0.38, LEAF, c.M * 0.003, 6, -0.35) +
            (c.logo ? '' : blossom(cx, cy, R * 0.55, BLUSH, ROSE))
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body: blossom(m.cx, m.cy, m.r * 1.1, [BLUSH, mix(BLUSH, '#ffffff', 0.4), SAGE][d.rank - 1] ?? BLUSH, ROSE) +
            medalNumber(m.cx, m.cy, m.r * 0.5, '#ffffff', FONT.messiri) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
