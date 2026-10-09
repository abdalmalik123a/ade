/**
 * النمط الحديث.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { dotsPattern, n } from '../ornaments';

// ── حديث ─────────────────────────────────────────────────────────────

export const modern: Style = {
  key: 'modern',
  name: 'معاصر',
  hint: 'كتلٌ لونية وكوفيٌّ حديث — للشركات والدورات',
  variant: 'asym',
  paper: () => '#ffffff',
  type: (role, p) => {
    switch (role) {
      case 'headline':
        return { font: FONT.kufiText, bold: true, color: p.deep };
      case 'org':
        return { font: FONT.kufiText, bold: true, color: p.primary };
      case 'name':
        return { font: FONT.kufiText, bold: true, color: p.primary };
      case 'intro':
      case 'body':
        return { font: FONT.plex, bold: false, color: mix(p.ink, '#ffffff', 0.15) };
      case 'meta':
        return { font: FONT.kufiText, bold: true, color: p.ink };
      case 'label':
        return { font: FONT.plex, bold: false, color: mix(p.ink, '#ffffff', 0.45) };
      case 'accent':
        return { font: FONT.kufiText, bold: true, color: p.accent };
      case 'big':
        return { font: FONT.kufiText, bold: true, color: p.deep };
      case 'onBand':
        return { font: FONT.kufiText, bold: true, color: '#ffffff' };
      case 'onBandSmall':
        return { font: FONT.plex, bold: false, color: mix('#ffffff', p.primary, 0.25) };
    }
  },
  frame: (c) => {
    const defs = dotsPattern('dt', c.M * 0.035, c.M * 0.0045, c.p.primary);
    if (c.family === 'card') {
      return {
        defs,
        body:
          // بلا نقاط على البطاقة: مساحتها ضيّقة، وكلّ نقشٍ فيها يقع تحت نصّ.
          `<path d="M${n(c.W * 0.62)},${n(c.H + c.B)} L${n(c.W + c.B)},${n(c.H * 0.42)} L${n(c.W + c.B)},${n(c.H + c.B)} Z" fill="${mix('#ffffff', c.p.primary, 0.08)}"/>`
      };
    }
    if (c.W > c.H) {
      // الكتلة يسارًا بحافّةٍ مائلة، وخطٌّ رفيعٌ بلون المرافق يتبعها.
      const top = c.W * 0.34;
      const bottom = c.W * 0.26;
      return {
        defs,
        body:
          `<path d="M${n(-c.B)},${n(-c.B)} L${n(top)},${n(-c.B)} L${n(bottom)},${n(c.H + c.B)} L${n(-c.B)},${n(c.H + c.B)} Z" fill="${c.p.deep}"/>` +
          `<path d="M${n(-c.B)},${n(-c.B)} L${n(top * 0.82)},${n(-c.B)} L${n(bottom * 0.72)},${n(c.H + c.B)} L${n(-c.B)},${n(c.H + c.B)} Z" fill="${c.p.primary}"/>` +
          `<line x1="${n(top + c.M * 0.02)}" y1="${n(-c.B)}" x2="${n(bottom + c.M * 0.02)}" y2="${n(c.H + c.B)}" stroke="${c.p.accent}" stroke-width="${n(c.M * 0.006)}"/>` +
          `<rect x="${n(c.W * 0.8)}" y="${n(c.H * 0.9)}" width="${n(c.W * 0.17)}" height="${n(c.H * 0.08)}" fill="url(#dt)" opacity="0.35"/>` +
          `<rect x="${n(c.W - c.M * 0.035)}" y="${n(c.H * 0.3)}" width="${n(c.M * 0.012)}" height="${n(c.H * 0.4)}" fill="${c.p.accent}"/>`
      };
    }
    return {
      defs,
      body:
        `<path d="M${n(-c.B)},${n(-c.B)} L${n(c.W + c.B)},${n(-c.B)} L${n(c.W + c.B)},${n(c.H * 0.035)} L${n(-c.B)},${n(c.H * 0.075)} Z" fill="${c.p.primary}"/>` +
        `<path d="M${n(-c.B)},${n(c.H + c.B)} L${n(c.W + c.B)},${n(c.H + c.B)} L${n(c.W + c.B)},${n(c.H * 0.94)} L${n(-c.B)},${n(c.H * 0.97)} Z" fill="${c.p.deep}"/>` +
        `<rect x="${n(c.W * 0.04)}" y="${n(c.H * 0.1)}" width="${n(c.W * 0.22)}" height="${n(c.H * 0.14)}" fill="url(#dt)" opacity="0.3"/>`
    };
  },
  decor: (d, c) => {
    const { p } = c;
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        const cut = c.M * 0.12;
        const shape =
          d.edge === 'top'
            ? `M${n(b.x)},${n(b.y + b.h)} L${n(b.x + b.w)},${n(b.y + b.h)} L${n(b.x + b.w)},${n(b.y)} L${n(b.x + cut)},${n(b.y)} Z`
            : `M${n(b.x)},${n(b.y)} L${n(b.x + b.w)},${n(b.y)} L${n(b.x + b.w)},${n(b.y + b.h)} L${n(b.x + cut)},${n(b.y + b.h)} Z`;
        return {
          body:
            `<path d="${shape}" fill="${p.primary}"/>` +
            (d.edge === 'top' ? '' : `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(c.M * 0.05)}" height="${n(b.h)}" fill="${p.accent}"/>`)
        };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(p.ink, '#ffffff', 0.55), c.M * 0.003) };
      case 'divider': {
        const w = Math.min(d.w * c.W, c.M * 0.12);
        const x = d.cx * c.W + (d.w * c.W) / 2 - w;
        return { body: `<rect x="${n(x)}" y="${n(d.y * c.H - c.M * 0.006)}" width="${n(w)}" height="${n(c.M * 0.012)}" fill="${p.accent}"/>` };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, mix('#ffffff', p.primary, 0.08), mix('#ffffff', p.primary, 0.45), c.M * 0.002, c.M * 0.025) };
      case 'panel': {
        const b = box(c, d.at);
        return {
          body:
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.02)}" fill="${mix('#ffffff', p.primary, 0.1)}"/>` +
            `<rect x="${n(b.x + b.w - c.M * 0.012)}" y="${n(b.y)}" width="${n(c.M * 0.012)}" height="${n(b.h)}" fill="${p.accent}"/>`
        };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint) return { body: `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="url(#dt)" opacity="0.18"/>` };
        if (!c.logo)
          // بلا شعار: حلقاتٌ متراكزة — بيضاء على الكتلة اللونية، وبلون الجهة على الورق.
          return {
            body:
              [1, 0.78, 0.56, 0.34]
                .map((k, i) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * k)}" fill="none" stroke="${c.family === 'sheet' && c.W > c.H ? '#ffffff' : p.primary}" stroke-width="${n(c.M * (i === 0 ? 0.004 : 0.0025))}" opacity="${0.5 - i * 0.08}"/>`)
                .join('') + `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.12)}" fill="${p.accent}"/>`
          };
        return {
          body:
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.8)}" fill="#ffffff"/>` +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.88)}" fill="none" stroke="${p.accent}" stroke-width="${n(c.M * 0.004)}"/>`
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body:
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.7)}" fill="${d.rank === 1 ? p.primary : mix(p.primary, '#ffffff', 0.3 * (d.rank - 1))}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.7, '#ffffff', FONT.kufiText) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
