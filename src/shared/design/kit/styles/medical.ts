/**
 * طبّي (DESIGNS.md ٣٫١ — مثال «فلاير طبّي»): ورقٌ أبيض، وموجتان بلون الجهة وفيروزيٍّ فاتح في الأعلى والأسفل، ودوائرُ شفيفة
 * متداخلة، ونبضةُ قلبٍ فاصلًا، والصورة في دائرةٍ بحلقتين — بخطٍّ عريضٍ واضح.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { n, silhouette } from '../ornaments';
import { pulse, wave } from '../motifs';

const AQUA = '#36b3c4';

export const medical: Style = {
  key: 'medical',
  name: 'طبّي',
  hint: 'موجاتٌ وحلقات بألوانٍ نظيفة — للعيادات والمختبرات والصيدليات',
  variant: 'centered',
  paper: () => '#ffffff',
  type: (role, p) => {
    switch (role) {
      case 'headline':
        return { font: FONT.cairo, bold: true, color: p.primary, scale: 1.04 };
      case 'org':
        return { font: FONT.cairo, bold: true, color: p.deep };
      case 'name':
        return { font: FONT.cairo, bold: true, color: p.deep };
      case 'intro':
      case 'body':
        return { font: FONT.plex, bold: false, color: mix(p.ink, '#ffffff', 0.1) };
      case 'meta':
        return { font: FONT.plex, bold: true, color: p.ink };
      case 'label':
        return { font: FONT.plex, bold: false, color: mix(p.ink, '#ffffff', 0.45) };
      case 'accent':
        return { font: FONT.cairo, bold: true, color: AQUA };
      case 'big':
        return { font: FONT.cairo, bold: true, color: p.primary };
      case 'onBand':
        return { font: FONT.cairo, bold: true, color: '#ffffff' };
      case 'onBandSmall':
        return { font: FONT.plex, bold: false, color: '#ffffff' };
    }
  },
  frame: (c) => {
    const { p } = c;
    const B = c.B;
    const amp = c.M * 0.02;
    // على الورقة الكاملة قريبتان من الحافّة: رأس الاستمارة والشهادة يبدأ عند ٥٪.
    const top = c.family === 'card' ? c.H * 0.12 : c.H * 0.035;
    const bottom = c.family === 'card' ? c.H * 0.9 : c.H * 0.955;
    const ring = (cx: number, cy: number, r: number, color: string, op: number) =>
      `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${color}" stroke-width="${n(c.M * 0.02)}" opacity="${op}"/>`;
    return {
      defs: '',
      body:
        ring(c.W * 0.95, c.H * 0.3, c.M * 0.14, AQUA, 0.12) +
        ring(c.W * 0.04, c.H * 0.72, c.M * 0.1, p.primary, 0.08) +
        wave(c.W, top, amp, mix(AQUA, '#ffffff', 0.55), true, 0.4, B) +
        wave(c.W, top - amp * 1.2, amp, p.primary, true, 1.6, B) +
        wave(c.W, bottom, amp, mix(AQUA, '#ffffff', 0.55), false, 2.2, B) +
        wave(c.W, bottom + amp * 1.3, amp, p.primary, false, 0.8, B)
    };
  },
  decor: (d, c) => {
    const { p } = c;
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${p.primary}"/>` };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(p.ink, '#ffffff', 0.55), c.M * 0.0025) };
      case 'divider': {
        const cx = d.cx * c.W;
        return { body: pulse(cx, d.y * c.H, (d.w * c.W) / 2, AQUA, c.M * 0.0035) };
      }
      case 'photo': {
        const b = box(c, d.at);
        const r = Math.min(b.w, b.h) / 2;
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        // الصورة في دائرةٍ بحلقتين: لون الجهة ثم الفيروزيّ.
        return {
          body:
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="#eef7f8"/>` +
            silhouette(cx - r * 0.7, cy - r * 0.62, r * 1.4, r * 1.55, mix(AQUA, '#ffffff', 0.55)) +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${p.primary}" stroke-width="${n(c.M * 0.01)}"/>` +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + c.M * 0.014)}" fill="none" stroke="${AQUA}" stroke-width="${n(c.M * 0.004)}"/>`
        };
      }
      case 'panel': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.02)}" fill="${mix(AQUA, '#ffffff', 0.9)}" stroke="${mix(AQUA, '#ffffff', 0.4)}" stroke-width="${n(c.M * 0.003)}"/>` };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="${AQUA}" opacity="0.06"/>` };
        // بلا شعار: صليبٌ طبّيٌّ مستدير الأطراف في دائرة.
        const arm = R * 0.42;
        const t = R * 0.16;
        const cross = `<path d="M${n(cx - t)},${n(cy - arm)} h${n(2 * t)} v${n(arm - t)} h${n(arm - t)} v${n(2 * t)} h${n(-(arm - t))} v${n(arm - t)} h${n(-2 * t)} v${n(-(arm - t))} h${n(-(arm - t))} v${n(-2 * t)} h${n(arm - t)} Z" fill="#ffffff"/>`;
        return {
          body:
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.9)}" fill="${c.logo ? '#ffffff' : p.primary}" stroke="${AQUA}" stroke-width="${n(c.M * 0.005)}"/>` +
            (c.logo ? '' : cross)
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body: `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.72)}" fill="${[p.primary, AQUA, mix(AQUA, '#ffffff', 0.4)][d.rank - 1] ?? AQUA}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.72, '#ffffff', FONT.cairo) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
