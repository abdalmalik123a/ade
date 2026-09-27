/**
 * نقشُ أمانٍ فريد لكل بطاقة — وردةُ غيلوش بذرتُها اسم صاحبها ورقمه.
 *
 * النقش في الشهادات المزوّرة يُنسخ من شهادةٍ صحيحة كما هو. فإن كان لكلّ طالبٍ
 * نقشُه — عدد بتلاته وطوراها وعمق تموّجها محسوبةٌ من اسمه ورقمه — لم يصلح
 * نقشُ «زينب» لشهادة «أحمد»، ويُكشف التزوير بمقارنة الرمز المطبوع تحت الوردة
 * برمز صاحبها (يُعاد حسابه من اسمه ورقمه في أي وقت).
 *
 * والحساب حتميّ خالص: الاسم نفسه يعطي النقش نفسه في كل طباعة وعلى كل جهاز.
 */
import { n, seeded } from './designKit/ornaments';

/** FNV-1a — بصمةٌ صغيرة ثابتة للنصّ، بذرةً للنقش. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const ch of text.normalize('NFC')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** رمزٌ من ستّة حروف يُطبع تحت النقش — يُقرأ بالعين ويُقارن بالأرشيف. */
export function sealCode(text: string): string {
  return hash(`diwan-seal|${text.trim()}`).toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

/**
 * النقش SVG بمربّعٍ يملأ صندوقه. وبلا نصٍّ لا نقش — فالبطاقة التي لم يُكتب
 * صاحبها لا تحمل نقشًا مزيّفًا.
 */
export function sealSvg(text: string, color = '#1b3a5c'): string {
  const key = text.trim();
  if (!key) return '';
  const rnd = seeded(hash(key));
  const R = 46;
  const petals = 11 + Math.floor(rnd() * 14);
  const copies = 2 + Math.floor(rnd() * 3);
  const rings: string[] = [];
  const layers: [number, number, number][] = [
    [0.62 + rnd() * 0.1, 0.22 + rnd() * 0.14, petals],
    [0.36 + rnd() * 0.08, 0.14 + rnd() * 0.1, petals + 3 + Math.floor(rnd() * 6)]
  ];
  for (let c = 0; c < copies; c++) {
    const phase = (c * 2 * Math.PI) / (petals * copies) + rnd() * 0.3;
    for (const [inner, depth, k] of layers) {
      const pts: string[] = [];
      const steps = k * 16;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const r = R * (inner + depth * Math.cos(k * t + phase));
        pts.push(`${n(r * Math.cos(t))},${n(r * Math.sin(t))}`);
      }
      rings.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="0.45"/>`);
    }
  }
  rings.push(`<circle r="${R}" fill="none" stroke="${color}" stroke-width="0.6"/>`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 112" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">` +
    rings.join('') +
    `<text x="0" y="60" text-anchor="middle" font-family="monospace" font-size="9" letter-spacing="1.5" fill="${color}">${sealCode(key)}</text>` +
    `</svg>`
  );
}
