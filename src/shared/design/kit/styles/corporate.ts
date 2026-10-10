/**
 * أخضر للشركات (DESIGNS.md ٣٫١ — مثال «هوية موظف»): ورقٌ أبيض، وشرائحُ مائلةٌ خضراءُ متدرّجة على جانبٍ واحد كأشكال الهويّات
 * الحديثة، ونقطةٌ بلون الجهة المرافق، وخطٌّ كوفيٌّ للعناوين — أخضرُ ثابت مهما كانت لوحة الجهة، فهو هويّة النمط.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { dotsPattern, n } from '../ornaments';

const GREEN = '#0b7a4b';
const DEEP = '#064a2e';
const LIME = '#5cc489';
const INK = '#16231c';

export const corporate: Style = {
  key: 'corporate',
  name: 'أخضر للشركات',
  hint: 'شرائحُ مائلة خضراء وخطوطٌ حادّة — للشركات والهويّات والبطاقات المهنية',
  variant: 'asym',
  paper: () => '#ffffff',
  type: (role, p) => {
    switch (role) {
      case 'headline':
        return { font: FONT.kufi, bold: true, color: DEEP, scale: 1.02 };
      case 'org':
        return { font: FONT.kufiText, bold: true, color: GREEN };
      case 'name':
        return { font: FONT.kufiText, bold: true, color: INK };
      case 'intro':
      case 'body':
        return { font: FONT.plex, bold: false, color: mix(INK, '#ffffff', 0.12) };
      case 'meta':
        return { font: FONT.plex, bold: true, color: INK };
      case 'label':
        return { font: FONT.plex, bold: false, color: mix(INK, '#ffffff', 0.45) };
      case 'accent':
        return { font: FONT.kufiText, bold: true, color: p.accent };
      case 'big':
        return { font: FONT.kufi, bold: true, color: GREEN };
      case 'onBand':
        return { font: FONT.kufiText, bold: true, color: '#ffffff' };
      case 'onBandSmall':
        return { font: FONT.plex, bold: false, color: '#ffffff' };
    }
  },
  frame: (c, keepRects) => {
    const B = c.B;
    const card = c.family === 'card';
    // شرائح مائلة على الحافّة اليسرى: أعمق فأفتح — ولا تبلغ منطقة النصّ (`keep`)، فالدعوة الوسطيّة شرائحها أنحف.
    // الأولى منطقة النصّ الرئيسية (`calm`) — والشعار في الشرائح نفسها لا يحسب.
    const calmLeft = (keepRects[0]?.[0] ?? 1) * c.W;
    const w = Math.min(card ? c.W * 0.34 : c.W * 0.22, Math.max(c.W * 0.05, (calmLeft - c.M * 0.03) / 1.25));
    const slant = card ? c.H * 0.35 : c.H * 0.3;
    const strip = (k: number, fill: string, op = 1) =>
      `<polygon points="${n(-B)},${n(-B)} ${n(w * k + B * 0)},${n(-B)} ${n(w * k - slant * 0.3)},${n(c.H + B)} ${n(-B)},${n(c.H + B)}" fill="${fill}" opacity="${op}"/>`;
    return {
      defs: dotsPattern('cp-dots', c.M * 0.02, c.M * 0.0025, mix(GREEN, '#ffffff', 0.55)),
      body:
        strip(1.25, mix(LIME, '#ffffff', 0.55)) +
        strip(1.08, LIME) +
        strip(0.92, GREEN) +
        strip(0.62, DEEP) +
        `<rect x="${n(c.W * 0.78)}" y="${n(c.H * 0.06)}" width="${n(c.W * 0.18)}" height="${n(c.H * 0.14)}" fill="url(#cp-dots)"/>` +
        `<rect x="${n(c.W - c.M * 0.012)}" y="${n(-B)}" width="${n(c.M * 0.012 + B)}" height="${n(c.H + 2 * B)}" fill="${c.p.accent}"/>`
    };
  },
  decor: (d, c) => {
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${GREEN}"/>` };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(INK, '#ffffff', 0.55), c.M * 0.0025) };
      case 'divider': {
        const x = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        return {
          body:
            `<rect x="${n(x - half)}" y="${n(y - c.M * 0.003)}" width="${n(half * 0.6)}" height="${n(c.M * 0.006)}" fill="${GREEN}"/>` +
            `<rect x="${n(x - half + half * 0.66)}" y="${n(y - c.M * 0.003)}" width="${n(half * 0.25)}" height="${n(c.M * 0.006)}" fill="${LIME}"/>`
        };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, '#eef6f1', GREEN, c.M * 0.008, c.M * 0.012) };
      case 'panel': {
        const b = box(c, d.at);
        return { body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="#f2f8f4" stroke="${mix(GREEN, '#ffffff', 0.5)}" stroke-width="${n(c.M * 0.0025)}"/>` };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="${GREEN}" opacity="0.05"/>` };
        // معيّنٌ مائل بطبقتين — علامةٌ هندسية بلا شعار.
        const dia = (r: number, fill: string) => `<polygon points="${n(cx)},${n(cy - r)} ${n(cx + r)},${n(cy)} ${n(cx)},${n(cy + r)} ${n(cx - r)},${n(cy)}" fill="${fill}"/>`;
        return { body: c.logo ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.92)}" fill="#ffffff" stroke="${GREEN}" stroke-width="${n(c.M * 0.005)}"/>` : dia(R, GREEN) + dia(R * 0.62, LIME) + dia(R * 0.28, '#ffffff') };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body: `<rect x="${n(m.cx - m.r * 0.7)}" y="${n(m.cy - m.r * 0.7)}" width="${n(m.r * 1.4)}" height="${n(m.r * 1.4)}" rx="${n(m.r * 0.2)}" fill="${[GREEN, LIME, mix(GREEN, '#ffffff', 0.5)][d.rank - 1] ?? GREEN}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.7, '#ffffff', FONT.kufiText) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
