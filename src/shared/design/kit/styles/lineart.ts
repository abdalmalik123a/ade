/**
 * خطّيٌّ بسيط (DESIGNS.md ٣٫١ — مثال «دعوة زفاف خطّية»): ورقٌ أبيض، وإطارٌ رفيع بزاويتين مقطوعتين، وأغصانٌ مرسومةٌ بخطٍّ
 * واحدٍ رفيع في ركنين — بلونٍ واحد من لوحة الجهة. لا ملء ولا تدرّج: يُطبع حادًّا على أيّ طابعة.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { n } from '../ornaments';
import { blossom, sprig } from '../motifs';

export const lineart: Style = {
  key: 'lineart',
  name: 'خطّي بسيط',
  hint: 'خطوطٌ رفيعة وأغصانٌ مرسومة — للدعوات الهادئة والبطاقات',
  variant: 'centered',
  paper: () => '#ffffff',
  type: (role, p, family) => {
    const ink = mix(p.ink, '#ffffff', 0.08);
    switch (role) {
      case 'headline':
        return { font: FONT.naskh, bold: false, color: p.primary, scale: 1.05 };
      case 'org':
        return { font: FONT.plex, bold: false, color: mix(ink, '#ffffff', 0.25), wordSpacing: 0.1 };
      case 'name':
        return { font: family === 'sheet' ? FONT.ruqaa : FONT.naskh, bold: false, color: p.primary };
      case 'intro':
      case 'body':
        return { font: FONT.naskh, bold: false, color: ink };
      case 'meta':
        return { font: FONT.plex, bold: true, color: ink };
      case 'label':
        return { font: FONT.plex, bold: false, color: mix(ink, '#ffffff', 0.45) };
      case 'accent':
        return { font: FONT.naskh, bold: true, color: p.primary };
      case 'big':
        return { font: FONT.naskh, bold: true, color: p.primary };
      case 'onBand':
        return { font: FONT.plex, bold: true, color: '#ffffff' };
      case 'onBandSmall':
        return { font: FONT.plex, bold: false, color: '#ffffff' };
    }
  },
  frame: (c) => {
    const line = c.p.primary;
    const sw = c.M * 0.0022;
    const inset = c.M * 0.045;
    const cut = c.M * 0.05;
    const [x0, y0, x1, y1] = [inset, inset, c.W - inset, c.H - inset];
    // إطارٌ بزوايا مقطوعة: ثماني الأضلاع الرفيع.
    const frame = `<polygon points="${n(x0 + cut)},${n(y0)} ${n(x1 - cut)},${n(y0)} ${n(x1)},${n(y0 + cut)} ${n(x1)},${n(y1 - cut)} ${n(x1 - cut)},${n(y1)} ${n(x0 + cut)},${n(y1)} ${n(x0)},${n(y1 - cut)} ${n(x0)},${n(y0 + cut)}" fill="none" stroke="${line}" stroke-width="${n(sw)}"/>`;
    const branches =
      sprig(x0 + c.M * 0.01, y0 + c.M * 0.16, c.M * 0.3, -Math.PI * 0.32, line, sw, 7, 0.28) +
      sprig(x0 + c.M * 0.14, y0 + c.M * 0.012, c.M * 0.22, Math.PI * 0.06, line, sw, 5, -0.25) +
      blossom(x0 + c.M * 0.1, y0 + c.M * 0.08, c.M * 0.022, 'none', line, 0, { color: line, width: sw }) +
      sprig(x1 - c.M * 0.01, y1 - c.M * 0.16, c.M * 0.3, Math.PI * 0.68, line, sw, 7, 0.28) +
      sprig(x1 - c.M * 0.14, y1 - c.M * 0.012, c.M * 0.22, Math.PI * 1.06, line, sw, 5, -0.25);
    return { defs: '', body: (c.family === 'sheet' ? frame : '') + branches };
  },
  decor: (d, c) => {
    const { p } = c;
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${p.primary}"/>` };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(p.ink, '#ffffff', 0.5), c.M * 0.0018) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        const r = c.M * 0.007;
        return {
          body:
            `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx - r * 3)}" y2="${n(y)}" stroke="${p.primary}" stroke-width="${n(c.M * 0.0018)}"/>` +
            `<line x1="${n(cx + r * 3)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}" stroke="${p.primary}" stroke-width="${n(c.M * 0.0018)}"/>` +
            `<circle cx="${n(cx)}" cy="${n(y)}" r="${n(r)}" fill="none" stroke="${p.primary}" stroke-width="${n(c.M * 0.0018)}"/>`
        };
      }
      case 'photo': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.01)}" fill="#f6f6f6" stroke="${p.primary}" stroke-width="${n(c.M * 0.003)}"/>` };
      }
      case 'panel': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="none" stroke="${mix(p.primary, '#ffffff', 0.3)}" stroke-width="${n(c.M * 0.0018)}"/>` };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        const sw = c.M * 0.002;
        if (d.faint) return { body: `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="none" stroke="${p.primary}" stroke-width="${n(sw)}" opacity="0.2"/>` };
        return {
          body:
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.85)}" fill="none" stroke="${p.primary}" stroke-width="${n(sw)}"/>` +
            sprig(cx - R * 0.1, cy + R * 0.9, R * 1.5, -Math.PI * 0.65, p.primary, sw, 5, 0.3) +
            sprig(cx + R * 0.1, cy + R * 0.9, R * 1.5, -Math.PI * 0.35, p.primary, sw, 5, -0.3) +
            (c.logo ? '' : blossom(cx, cy, R * 0.32, 'none', p.primary, 0, { color: p.primary, width: sw }))
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body:
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.7)}" fill="none" stroke="${p.primary}" stroke-width="${n(c.M * 0.003)}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.7, p.primary, FONT.naskh) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
