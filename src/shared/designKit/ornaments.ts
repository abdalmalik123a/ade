/**
 * لبنات الزخرفة — كلّها محسوبة، لا مأخوذة.
 *
 * كل دالّة تعيد علامات SVG بوحدات الرسم (١ ملم = ١٠ وحدات). والمتكرّر يُعرَّف
 * مرّةً في `<defs>` ويُستعمل بـ`<use>` أو نقشًا (`<pattern>`): فإطار الشهادة
 * بخطوطه المتشابكة بضعة كيلوبايتات لا مئات — والتصميم يُحفظ داخل الوثيقة.
 *
 * - **الغيلوش** (guilloche): خطوطٌ جيبية متشابكة بأطوارٍ متعاقبة — نقش الأوراق
 *   النقدية والشهادات الرسمية.
 * - **الخاتم** (النجمة الثمانية): مربّعان متعامدان — أصل الزخرفة الهندسية
 *   الإسلامية، ويتكرّر نقشًا.
 * - **المروحة والشعاع**: لغة «آرت ديكو» في الذهبي.
 * - **الأسنان والنجوم والقصاصات**: لغة الأطفال.
 */

export const U = 10;

/** رقمٌ مختصر: جزءٌ عشريٌّ واحد يكفي لعُشر ملّم. */
export const n = (v: number): number => Math.round(v * 10) / 10;

export type Ctx = {
  /** عرض الرسم وارتفاعه بالوحدات. */
  W: number;
  H: number;
  /** الأصغر منهما — مرجع الأحجام التي لا تتبع اتجاه الورقة. */
  M: number;
};

export function ctxOf(wMm: number, hMm: number): Ctx {
  const W = wMm * U;
  const H = hMm * U;
  return { W, H, M: Math.min(W, H) };
}

// ── الغيلوش ──────────────────────────────────────────────────────────

/**
 * نقشُ شريط غيلوش أفقي: `lines` منحنياتٍ جيبية بأطوارٍ متعاقبة، وأخرى بنصف
 * سعتها معكوسة — فيتشابك النسيج كما في الورقة النقدية.
 */
export function guillochePattern(id: string, period: number, band: number, color: string, sw: number, lines = 5): string {
  const steps = 36;
  const path = (amp: number, phase: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * period;
      const y = band / 2 + amp * Math.sin((2 * Math.PI * x) / period + phase);
      pts.push(`${n(x)},${n(y)}`);
    }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${n(sw)}"/>`;
  };
  const out: string[] = [];
  for (let k = 0; k < lines; k++) out.push(path(band / 2 - sw, (k * Math.PI) / lines));
  for (let k = 0; k < lines; k++) out.push(path(band / 4, Math.PI + (k * Math.PI) / lines));
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${n(period)}" height="${n(band)}">${out.join('')}</pattern>` +
    `<pattern id="${id}v" patternUnits="userSpaceOnUse" width="${n(period)}" height="${n(band)}" patternTransform="rotate(90)">${out.join('')}</pattern>`
  );
}

/**
 * وردة غيلوش: منحنياتُ وردٍ قطبية `r = R(0.7 + 0.3 cos kθ)` مكرّرةً بإزاحة —
 * حلقةٌ منسوجة تُعرَّف رمزًا مرّة وتُستعمل في الأركان وخلف الشعار.
 */
export function rosetteSymbol(id: string, R: number, color: string, sw: number, petals = 18, copies = 3): string {
  const rings: string[] = [];
  const steps = petals * 14;
  for (let c = 0; c < copies; c++) {
    const phase = (c * 2 * Math.PI) / (petals * copies);
    for (const [inner, depth] of [
      [0.66, 0.34],
      [0.42, 0.2]
    ] as const) {
      const pts: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const r = R * (inner + depth * Math.cos(petals * t + phase));
        pts.push(`${n(r * Math.cos(t))},${n(r * Math.sin(t))}`);
      }
      rings.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${n(sw)}"/>`);
    }
  }
  rings.push(`<circle r="${n(R * 0.2)}" fill="none" stroke="${color}" stroke-width="${n(sw)}"/>`);
  rings.push(`<circle r="${n(R)}" fill="none" stroke="${color}" stroke-width="${n(sw * 0.8)}"/>`);
  return `<symbol id="${id}" viewBox="${n(-R)} ${n(-R)} ${n(2 * R)} ${n(2 * R)}" overflow="visible">${rings.join('')}</symbol>`;
}

export const useAt = (id: string, cx: number, cy: number, R: number, extra = ''): string =>
  `<use href="#${id}" x="${n(cx - R)}" y="${n(cy - R)}" width="${n(2 * R)}" height="${n(2 * R)}" ${extra}/>`;

/**
 * إطار غيلوش كامل: أربعة أشرطة بالنقش، وخطّان يحدّانها، ووردةٌ في كل ركن —
 * هيئة الشهادة الرسمية والورقة المالية.
 */
export function guillocheFrame(
  c: Ctx,
  inset: number,
  band: number,
  color: string,
  edge: string,
  corner: string
): { defs: string; body: string } {
  const period = band * 1.6;
  const sw = Math.max(1.2, band / 26);
  const defs = guillochePattern('gq', period, band, color, sw) + rosetteSymbol('gr', band * 1.25, corner, sw * 1.1, 14, 2);
  const x0 = inset;
  const y0 = inset;
  const x1 = c.W - inset;
  const y1 = c.H - inset;
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${fill})"/>`;
  const body = [
    rect(x0, y0, x1 - x0, band, 'gq'),
    rect(x0, y1 - band, x1 - x0, band, 'gq'),
    rect(x0, y0, band, y1 - y0, 'gqv'),
    rect(x1 - band, y0, band, y1 - y0, 'gqv'),
    `<rect x="${n(x0)}" y="${n(y0)}" width="${n(x1 - x0)}" height="${n(y1 - y0)}" fill="none" stroke="${edge}" stroke-width="${n(sw * 1.6)}"/>`,
    `<rect x="${n(x0 + band)}" y="${n(y0 + band)}" width="${n(x1 - x0 - 2 * band)}" height="${n(y1 - y0 - 2 * band)}" fill="none" stroke="${edge}" stroke-width="${n(sw * 1.6)}"/>`,
    `<rect x="${n(x0 + band + sw * 6)}" y="${n(y0 + band + sw * 6)}" width="${n(x1 - x0 - 2 * band - sw * 12)}" height="${n(y1 - y0 - 2 * band - sw * 12)}" fill="none" stroke="${edge}" stroke-width="${n(sw * 0.7)}" opacity="0.7"/>`,
    ...[
      [x0 + band / 2, y0 + band / 2],
      [x1 - band / 2, y0 + band / 2],
      [x0 + band / 2, y1 - band / 2],
      [x1 - band / 2, y1 - band / 2]
    ].map(([cx, cy]) =>
      `<circle cx="${n(cx!)}" cy="${n(cy!)}" r="${n(band * 1.25)}" fill="#fff" opacity="0.9"/>` + useAt('gr', cx!, cy!, band * 1.25)
    )
  ].join('');
  return { defs, body };
}

// ── الخاتم: النجمة الثمانية ──────────────────────────────────────────

/** رؤوس النجمة الثمانية {٨/٢}: ستة عشر رأسًا بين قطرين — مربّعان متعامدان. */
export function starPoints(cx: number, cy: number, R: number, rot = 0): string {
  const inner = R * (Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8));
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = rot + (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 === 0 ? R : inner;
    pts.push(`${n(cx + r * Math.cos(a))},${n(cy + r * Math.sin(a))}`);
  }
  return pts.join(' ');
}

/**
 * نقش النجمة والصليب: نجمةٌ ثمانية في كل خليّة، رؤوسها تلامس رؤوس جاراتها
 * فتنشأ بينها الصلبان — أشهر شبكات الزخرفة الإسلامية.
 */
export function khatamPattern(id: string, s: number, color: string, sw: number): string {
  const c = s / 2;
  const star = (R: number, w: number, op = 1) =>
    `<polygon points="${starPoints(c, c, R, Math.PI / 8)}" fill="none" stroke="${color}" stroke-width="${n(w)}" opacity="${op}"/>`;
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${n(s)}" height="${n(s)}">` +
    star(s * 0.5, sw) +
    star(s * 0.41, sw * 0.6, 0.8) +
    `<polygon points="${starPoints(c, c, s * 0.18, 0)}" fill="${color}" opacity="0.55"/>` +
    // أنصاف النجوم في الأركان تكمل النقش عبر حدود الخليّة.
    [0, s]
      .flatMap((x) => [0, s].map((y) => `<polygon points="${starPoints(x, y, s * 0.18, 0)}" fill="${color}" opacity="0.55"/>`))
      .join('') +
    `</pattern>`
  );
}

// ── الذهبي: المروحة والشعاع ─────────────────────────────────────────

/** تدرّجٌ يحاكي رقائق الذهب — يُطبع لونًا متدرّجًا لا لونًا واحدًا باهتًا. */
export function foil(id: string, angle = 35): string {
  return (
    `<linearGradient id="${id}" gradientUnits="objectBoundingBox" gradientTransform="rotate(${angle} .5 .5)">` +
    `<stop offset="0" stop-color="#8a6a28"/><stop offset=".22" stop-color="#e9d08a"/>` +
    `<stop offset=".45" stop-color="#b8923a"/><stop offset=".68" stop-color="#f4e4ab"/>` +
    `<stop offset="1" stop-color="#9a7832"/></linearGradient>`
  );
}

/** شعاعٌ من نقطة: أشعّةٌ متناوبة العرض داخل نصف دائرة. */
export function sunburst(cx: number, cy: number, R: number, rays: number, fill: string, op = 0.35): string {
  const out: string[] = [];
  for (let i = 0; i < rays; i++) {
    const a0 = Math.PI + (i / rays) * Math.PI;
    const a1 = a0 + (Math.PI / rays) * (i % 2 ? 0.35 : 0.6);
    out.push(
      `<path d="M${n(cx)},${n(cy)} L${n(cx + R * Math.cos(a0))},${n(cy + R * Math.sin(a0))} L${n(cx + R * Math.cos(a1))},${n(cy + R * Math.sin(a1))} Z"/>`
    );
  }
  return `<g fill="${fill}" opacity="${op}">${out.join('')}</g>`;
}

/** ركن «آرت ديكو»: أقواسٌ متراكزة وخطّان متدرّجان — يُعكس للأركان الأربعة. */
export function decoCorners(c: Ctx, inset: number, size: number, stroke: string, sw: number): string {
  const one =
    [0.35, 0.55, 0.75, 1]
      .map((k) => `<path d="M0,${n(size * k)} A${n(size * k)},${n(size * k)} 0 0 1 ${n(size * k)},0" fill="none"/>`)
      .join('') +
    `<path d="M0,${n(size * 1.35)} L${n(size * 0.12)},${n(size * 1.35)} L${n(size * 0.12)},${n(size * 0.12)} L${n(size * 1.35)},${n(size * 0.12)} L${n(size * 1.35)},0" fill="none"/>`;
  const at = (x: number, y: number, sx: number, sy: number) =>
    `<g transform="translate(${n(x)},${n(y)}) scale(${sx},${sy})">${one}</g>`;
  return (
    `<g stroke="${stroke}" stroke-width="${n(sw)}">` +
    at(inset, inset, 1, 1) +
    at(c.W - inset, inset, -1, 1) +
    at(inset, c.H - inset, 1, -1) +
    at(c.W - inset, c.H - inset, -1, -1) +
    `</g>`
  );
}

// ── الأطفال ─────────────────────────────────────────────────────────

/** مولّدٌ عشوائيٌّ ثابت البذرة — فالتصميم يُبنى مرّتين فيتطابق. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function star5(cx: number, cy: number, R: number, fill: string, rot = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? R : R * 0.45;
    pts.push(`${n(cx + r * Math.cos(a))},${n(cy + r * Math.sin(a))}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke-linejoin="round"/>`;
}

/** إطارٌ مسنّن: دوائرُ متلاصقة على الحواف بألوانٍ متعاقبة. */
export function scallops(c: Ctx, inset: number, r: number, colors: string[]): string {
  const out: string[] = [];
  let k = 0;
  const run = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const count = Math.max(2, Math.round(len / (r * 1.8)));
    for (let i = 0; i < count; i++) {
      const t = i / count;
      out.push(`<circle cx="${n(x0 + (x1 - x0) * t)}" cy="${n(y0 + (y1 - y0) * t)}" r="${n(r)}" fill="${colors[k++ % colors.length]}"/>`);
    }
  };
  const x0 = inset;
  const y0 = inset;
  const x1 = c.W - inset;
  const y1 = c.H - inset;
  run(x0, y0, x1, y0);
  run(x1, y0, x1, y1);
  run(x1, y1, x0, y1);
  run(x0, y1, x0, y0);
  return out.join('');
}

/** قصاصاتٌ ونجومٌ متناثرة — خارج صندوق النصّ، فلا تقع زخرفةٌ تحت اسم طفل. */
export function confetti(
  c: Ctx,
  count: number,
  colors: string[],
  seed: number,
  keepOut: { x: number; y: number; w: number; h: number }
): string {
  const rnd = seeded(seed);
  const out: string[] = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 20) {
    const x = rnd() * c.W;
    const y = rnd() * c.H;
    if (x > keepOut.x && x < keepOut.x + keepOut.w && y > keepOut.y && y < keepOut.y + keepOut.h) continue;
    const color = colors[Math.floor(rnd() * colors.length)]!;
    const s = c.M * (0.008 + rnd() * 0.012);
    const kind = rnd();
    if (kind < 0.35) out.push(star5(x, y, s * 1.4, color, rnd()));
    else if (kind < 0.7) out.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 0.6)}" fill="${color}"/>`);
    else
      out.push(
        `<rect x="${n(x)}" y="${n(y)}" width="${n(s * 1.6)}" height="${n(s * 0.6)}" rx="${n(s * 0.3)}" fill="${color}" transform="rotate(${Math.round(rnd() * 180)} ${n(x)} ${n(y)})"/>`
      );
  }
  return out.join('');
}

export function cloud(cx: number, cy: number, w: number, fill: string, op = 1): string {
  const r = w / 4;
  return (
    `<g fill="${fill}" opacity="${op}">` +
    `<circle cx="${n(cx - r * 1.2)}" cy="${n(cy)}" r="${n(r)}"/><circle cx="${n(cx)}" cy="${n(cy - r * 0.5)}" r="${n(r * 1.3)}"/>` +
    `<circle cx="${n(cx + r * 1.2)}" cy="${n(cy)}" r="${n(r)}"/><rect x="${n(cx - r * 1.2)}" y="${n(cy)}" width="${n(r * 2.4)}" height="${n(r)}"/></g>`
  );
}

/** شبكةُ نقاط — لمسة الحديث. */
export function dotsPattern(id: string, s: number, r: number, color: string): string {
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${n(s)}" height="${n(s)}"><circle cx="${n(s / 2)}" cy="${n(s / 2)}" r="${n(r)}" fill="${color}"/></pattern>`;
}

/**
 * ظلّ رأسٍ وكتفين — مكان الصورة قبل أن تُختار.
 *
 * فاللمحة في المعرض تبدو هويةً حقيقية، والصورة حين تأتي تغطّيه.
 */
export function silhouette(x: number, y: number, w: number, h: number, fill: string): string {
  const cx = x + w / 2;
  const head = Math.min(w, h) * 0.22;
  return (
    `<g fill="${fill}"><circle cx="${n(cx)}" cy="${n(y + h * 0.38)}" r="${n(head)}"/>` +
    `<path d="M${n(x + w * 0.14)},${n(y + h)} C${n(x + w * 0.14)},${n(y + h * 0.66)} ${n(x + w * 0.86)},${n(y + h * 0.66)} ${n(x + w * 0.86)},${n(y + h)} Z"/></g>`
  );
}
