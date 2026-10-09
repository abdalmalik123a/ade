/**
 * نمط الزخرفة الإسلامية.
 */
import { ARABIC_ORDINAL, FONT, box, medalBase, medalNumber, photoFrame, ruleLine, type Style } from './helpers';
import { mix } from '../color';
import { khatamPattern, n, starPoints } from '../ornaments';

// ── زخرفة إسلامية ────────────────────────────────────────────────────

export const islamic: Style = {
  key: 'islamic',
  name: 'زخرفة',
  hint: 'النجمة الثمانية والرقعة — للمناسبات والشهادات',
  variant: 'centered',
  paper: (p) => mix(p.paper, p.accent, 0.07),
  type: (role, p, family) => {
    switch (role) {
      case 'headline':
        return { font: FONT.ruqaa, bold: true, color: p.primary, scale: 1.12 };
      case 'org':
        return { font: FONT.kufiText, bold: true, color: mix(p.accent, p.ink, 0.35) };
      case 'name':
        return { font: family === 'sheet' ? FONT.ruqaa : FONT.naskh, bold: true, color: p.deep };
      case 'intro':
      case 'body':
        return { font: FONT.naskh, bold: false, color: p.ink, scale: family === 'card' ? 1.08 : 1 };
      case 'meta':
        return { font: FONT.naskh, bold: true, color: p.ink, scale: 1.05 };
      case 'label':
        return { font: FONT.naskh, bold: false, color: mix(p.ink, p.paper, 0.4) };
      case 'accent':
        return { font: FONT.ruqaa, bold: false, color: mix(p.accent, p.ink, 0.3), scale: 1.1 };
      case 'big':
        return { font: FONT.kufi, bold: true, color: p.deep, wordSpacing: 0.18 };
      case 'onBand':
        return { font: FONT.naskh, bold: true, color: mix('#ffffff', p.accent, 0.25), scale: 1.08 };
      case 'onBandSmall':
        return { font: FONT.naskh, bold: false, color: mix('#ffffff', p.accent, 0.5), scale: 1.08 };
    }
  },
  frame: (c) => {
    const s = c.M * (c.family === 'card' ? 0.16 : 0.07);
    const defs = khatamPattern('kh', s, c.p.accent, c.M * 0.0022) + khatamPattern('khf', s * 1.4, c.p.primary, c.M * 0.0016);
    if (c.family === 'card') return { defs, body: `<rect width="${n(c.W)}" height="${n(c.H)}" fill="url(#khf)" opacity="0.07"/>` };
    const inset = c.M * 0.03;
    const band = c.M * 0.075;
    const x0 = inset;
    const y0 = inset;
    const w = c.W - 2 * inset;
    const h = c.H - 2 * inset;
    const sw = c.M * 0.003;
    // الإطار: شريطٌ عميق بنقش النجمة، يحدّه خطٌّ ذهبيٌّ مزدوج من الداخل والخارج.
    const frameBand =
      `<path d="M${n(x0)},${n(y0)} h${n(w)} v${n(h)} h${n(-w)} Z M${n(x0 + band)},${n(y0 + band)} v${n(h - 2 * band)} h${n(w - 2 * band)} v${n(-(h - 2 * band))} Z" fill="${c.p.deep}" fill-rule="evenodd"/>` +
      `<path d="M${n(x0)},${n(y0)} h${n(w)} v${n(h)} h${n(-w)} Z M${n(x0 + band)},${n(y0 + band)} v${n(h - 2 * band)} h${n(w - 2 * band)} v${n(-(h - 2 * band))} Z" fill="url(#kh)" fill-rule="evenodd" opacity="0.8"/>`;
    const lines = [0, 1]
      .map((k) => {
        const o = k * sw * 3;
        return (
          `<rect x="${n(x0 - o)}" y="${n(y0 - o)}" width="${n(w + 2 * o)}" height="${n(h + 2 * o)}" fill="none" stroke="${c.p.accent}" stroke-width="${n(sw)}"/>` +
          `<rect x="${n(x0 + band + o)}" y="${n(y0 + band + o)}" width="${n(w - 2 * band - 2 * o)}" height="${n(h - 2 * band - 2 * o)}" fill="none" stroke="${c.p.accent}" stroke-width="${n(sw)}"/>`
        );
      })
      .join('');
    const cornerStars = [
      [x0 + band, y0 + band],
      [x0 + w - band, y0 + band],
      [x0 + band, y0 + h - band],
      [x0 + w - band, y0 + h - band]
    ]
      .map(
        ([x, y]) =>
          `<polygon points="${starPoints(x!, y!, band * 0.55, Math.PI / 8)}" fill="${c.p.accent}"/>` +
          `<polygon points="${starPoints(x!, y!, band * 0.3, 0)}" fill="${c.p.deep}"/>`
      )
      .join('');
    return { defs, body: `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" fill="url(#khf)" opacity="0.045"/>` + frameBand + lines + cornerStars };
  },
  decor: (d, c) => {
    const { p } = c;
    switch (d.t) {
      case 'band': {
        const b = box(c, d.at);
        const edgeY = d.edge === 'top' ? b.y : b.y + b.h;
        return {
          body:
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${p.deep}"/>` +
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="url(#kh)" opacity="0.45"/>` +
            `<rect x="${n(b.x)}" y="${n(edgeY - c.M * 0.006)}" width="${n(b.w)}" height="${n(c.M * 0.012)}" fill="${p.accent}"/>`
        };
      }
      case 'rule':
        return { body: ruleLine(c, d, p.accent, c.M * 0.0035) };
      case 'divider': {
        const cx = d.cx * c.W;
        const y = d.y * c.H;
        const half = (d.w * c.W) / 2;
        const r = c.M * 0.022;
        const sw = c.M * 0.003;
        return {
          body:
            `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx - r * 1.4)}" y2="${n(y)}" stroke="${p.accent}" stroke-width="${n(sw)}"/>` +
            `<line x1="${n(cx + r * 1.4)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}" stroke="${p.accent}" stroke-width="${n(sw)}"/>` +
            `<polygon points="${starPoints(cx, y, r, Math.PI / 8)}" fill="none" stroke="${p.accent}" stroke-width="${n(sw)}"/>` +
            `<polygon points="${starPoints(cx, y, r * 0.5, 0)}" fill="${p.primary}"/>` +
            [-1, 1].map((s) => `<circle cx="${n(cx + s * (half + r * 0.4))}" cy="${n(y)}" r="${n(r * 0.18)}" fill="${p.accent}"/>`).join('')
        };
      }
      case 'photo':
        return { body: photoFrame(c, d.at, mix(p.paper, p.accent, 0.12), p.accent, c.M * 0.009, c.M * 0.015) };
      case 'panel': {
        const b = box(c, d.at);
        return {
          body:
            `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(c.M * 0.012)}" fill="${mix(p.paper, p.accent, 0.18)}" stroke="${p.accent}" stroke-width="${n(c.M * 0.005)}"/>`
        };
      }
      case 'seal': {
        const R = d.r * c.M;
        const cx = d.cx * c.W;
        const cy = d.cy * c.H;
        if (d.faint)
          return {
            body: `<g opacity="0.1"><polygon points="${starPoints(cx, cy, R, Math.PI / 8)}" fill="none" stroke="${p.primary}" stroke-width="${n(c.M * 0.006)}"/><polygon points="${starPoints(cx, cy, R * 0.7, 0)}" fill="none" stroke="${p.primary}" stroke-width="${n(c.M * 0.004)}"/></g>`
          };
        return {
          body:
            `<polygon points="${starPoints(cx, cy, R, Math.PI / 8)}" fill="${p.paper}" stroke="${p.accent}" stroke-width="${n(c.M * 0.004)}"/>` +
            `<polygon points="${starPoints(cx, cy, R * 0.9, Math.PI / 8)}" fill="none" stroke="${p.accent}" stroke-width="${n(c.M * 0.002)}"/>` +
            `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.72)}" fill="none" stroke="${p.primary}" stroke-width="${n(c.M * 0.002)}"/>` +
            // بلا شعار لا يبقى الختم دائرةً فارغة: نجمةٌ داخل نجمة، وهو ختمٌ بنفسه.
            `<g opacity="0.9"><polygon points="${starPoints(cx, cy, R * 0.55, 0)}" fill="none" stroke="${p.accent}" stroke-width="${n(c.M * 0.0025)}"/>` +
            `<polygon points="${starPoints(cx, cy, R * 0.3, Math.PI / 8)}" fill="${p.primary}" opacity="0.85"/></g>`
        };
      }
      case 'medal': {
        const m = medalBase(c, d);
        return {
          body:
            `<polygon points="${starPoints(m.cx, m.cy, m.r, Math.PI / 8)}" fill="${p.accent}"/>` +
            `<circle cx="${n(m.cx)}" cy="${n(m.cy)}" r="${n(m.r * 0.6)}" fill="${p.deep}"/>` +
            medalNumber(m.cx, m.cy, m.r * 0.6, mix('#ffffff', p.accent, 0.3), FONT.kufi) + `${ARABIC_ORDINAL[d.rank - 1]}</text>`
        };
      }
    }
  }
};
