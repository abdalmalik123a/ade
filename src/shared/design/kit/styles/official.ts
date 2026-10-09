/**
 * النمط الرسمي.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { guillocheFrame, guillochePattern, n, rosetteSymbol, useAt } from '../ornaments';

// ── رسمي ─────────────────────────────────────────────────────────────

export const official: Style = {
  key: 'official',
  name: 'رسمي',
  hint: 'غيلوشٌ كورقةٍ نقدية — للدوائر والمدارس',
  variant: 'centered',
  paper: (p) => p.paper,
  type: (role, p, family) => {
    switch (role) {
      case 'headline':
        return { font: FONT.kufi, bold: true, color: p.primary, wordSpacing: 0.18 };
      case 'org':
        return { font: FONT.kufiText, bold: true, color: p.deep };
      case 'name':
        return { font: family === 'sheet' ? FONT.naskh : FONT.kufiText, bold: true, color: p.deep };
      case 'intro':
      case 'body':
        return { font: family === 'sheet' ? FONT.naskh : FONT.kufiText, bold: false, color: p.ink };
      case 'meta':
        return { font: FONT.kufiText, bold: true, color: p.ink };
      case 'label':
        return { font: FONT.kufiText, bold: false, color: mix(p.ink, p.paper, 0.4) };
      case 'accent':
        return { font: FONT.kufiText, bold: true, color: mix(p.accent, p.ink, 0.25) };
      case 'big':
        return { font: FONT.kufi, bold: true, color: p.primary, wordSpacing: 0.18 };
      case 'onBand':
        return { font: FONT.kufiText, bold: true, color: '#ffffff' };
      case 'onBandSmall':
        return { font: FONT.kufiText, bold: false, color: mix('#ffffff', p.accent, 0.35) };
    }
  },
  frame: (c) => {
    if (c.family === 'card') {
      return { defs: rosetteSymbol('wm', c.M * 0.5, c.p.primary, c.M * 0.004, 20, 3), body: '' };
    }
    const f = guillocheFrame(c, c.M * 0.045, c.M * 0.028, c.p.primary, c.p.primary, c.p.accent);
    return {
      defs: f.defs + rosetteSymbol('wm', c.M * 0.5, c.p.primary, c.M * 0.0018, 24, 3),
      body: useAt('wm', c.W / 2, c.H * 0.52, c.M * 0.36, 'opacity="0.06"') + f.body
    };
  },
  decor: (d, c) => {
    const { p } = c;
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        const edgeY = d.edge === 'top' ? b.y : b.y + b.h;
        return {
          defs: guillochePattern('bq', c.M * 0.12, b.h, '#ffffff', c.M * 0.0025, 4),
          body:
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${p.primary}"/>` +
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="url(#bq)" opacity="0.22"/>` +
            `<rect x="${n(b.x)}" y="${n(edgeY - c.M * 0.008)}" width="${n(b.w)}" height="${n(c.M * 0.016)}" fill="${p.accent}"/>`
        };
      }
      case 'rule':
        return { body: ruleLine(c, d, mix(p.ink, p.paper, 0.35), c.M * 0.0028) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        const r = c.M * 0.018;
        return {
          defs: rosetteSymbol('dv', r, p.accent, c.M * 0.0018, 10, 2),
          body:
            `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx - r * 1.6)}" y2="${n(y)}" stroke="${p.accent}" stroke-width="${n(c.M * 0.0028)}"/>` +
            `<line x1="${n(cx + r * 1.6)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}" stroke="${p.accent}" stroke-width="${n(c.M * 0.0028)}"/>` +
            useAt('dv', cx, y, r)
        };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, mix(p.paper, p.primary, 0.08), p.primary, c.M * 0.008, c.M * 0.02) };
      case 'panel': {
        const b = box(c, d.at);
        return {
          body: `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.02)}" fill="${mix(p.paper, p.primary, 0.1)}" stroke="${p.primary}" stroke-width="${n(c.M * 0.005)}"/>`
        };
      }
      case 'seal': {
        const R = d.r * c.M;
        if (d.faint) return { body: useAt('wm', d.cx * c.W, d.cy * c.H, R, 'opacity="0.08"') };
        return {
          defs: rosetteSymbol('sl', R, p.accent, c.M * 0.0022, 22, 3),
          body: `<circle cx="${n(d.cx * c.W)}" cy="${n(d.cy * c.H)}" r="${n(R * 0.72)}" fill="${p.paper}"/>` + useAt('sl', d.cx * c.W, d.cy * c.H, R)
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          defs: rosetteSymbol('md', m.r, p.accent, c.M * 0.002, 16, 2),
          body:
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.66)}" fill="${p.primary}"/>` +
            useAt('md', m.cx, m.cy, m.r) +
            medalNumber(m.cx, m.cy, m.r * 0.66, '#ffffff', FONT.kufi) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
