/**
 * معرض التصاميم العشرة — مولَّدةً من توكنات، لا مأخوذةً من مكان.
 *
 * **الترخيص قيدٌ لا تفصيلة**: لا تُحزَم تصاميم من Canva أو Pngtree أو Freepik —
 * تراخيصها تمنع إعادة التوزيع داخل منتجٍ يُباع. فالأصل أن تُولَّد **متجهةً**:
 * إطارٌ وزاويةٌ ووردةٌ وشريط، كلُّها رياضياتٌ وألوانٌ من التوكنات. وسابقتُها في
 * المستودع `tools/make-icon.mjs`، يولّد أيقونة التطبيق من التوكنات نفسها.
 *
 * وفي المتجه ثلاثُ فوائد عمليّة: اللون يتبدّل بضغطة، والمقاس يتبدّل بلا تشوّه،
 * والحجم كيلوبايتاتٌ لا ميغابايتات.
 *
 * **وتُقترح ولا تُزرع**: هذه قائمةٌ تُعرض ويُختار منها، والقاعدة تبقى فارغةً حتى
 * يختار المكتب — فحينها تُحفظ نسخةً ملكَه. كما يفعل كتالوج الحقول في
 * `letterFields.ts`. وهذا هو مبدأ «يبدأ فارغًا من كل ما يخصّ الجهة» (§٢).
 */
import {
  BLEED_MM,
  barcodeElement,
  emptyCanvas,
  imageElement,
  textElement,
  type Canvas,
  type CanvasElement,
  type CanvasSize
} from './canvas';
import { tokenInlines } from './doc';
/** ألوانُ التوكنات — هي ألوان التطبيق نفسها، لا لوحةٌ ثانية. */
export const INK = '#131b2e';
export const BLUE = '#0058be';
export const GOLD = '#a8812a';
export const CREAM = '#fbf7ee';
export const PAPER = '#ffffff';
/** SVG يصير خلفيةً: عنوانٌ بيانات، فلا ملفَّ يُخزَّن ولا مسارَ يُكسر. */
const svgUrl = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
// ── لبناتُ الزخرفة ───────────────────────────────────────────────────
/** إطارٌ مزدوج: خطٌّ غليظ وآخر رفيع داخله — وهو أكثر ما يُرى في الشهادات. */
function doubleFrame(w: number, h: number, color: string, pad = 6): string {
  return (
    `<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" ` +
    `fill="none" stroke="${color}" stroke-width="1.6"/>` +
    `<rect x="${pad + 3}" y="${pad + 3}" width="${w - (pad + 3) * 2}" height="${h - (pad + 3) * 2}" ` +
    `fill="none" stroke="${color}" stroke-width="0.5"/>`
  );
}
/** زاويةٌ مورّقة: قوسان وثلاثُ نقاط — تتكرّر في الأركان الأربعة بالانعكاس. */
function corners(w: number, h: number, color: string, size = 16): string {
  const one =
    `<path d="M0,${size} Q0,0 ${size},0" fill="none" stroke="${color}" stroke-width="1"/>` +
    `<path d="M0,${size * 0.6} Q0,0 ${size * 0.6},0" fill="none" stroke="${color}" stroke-width="0.6"/>` +
    `<circle cx="${size * 0.28}" cy="${size * 0.28}" r="0.9" fill="${color}"/>`;
  const at = (x: number, y: number, sx: number, sy: number) =>
    `<g transform="translate(${x},${y}) scale(${sx},${sy})">${one}</g>`;
  const m = 10;
  return at(m, m, 1, 1) + at(w - m, m, -1, 1) + at(m, h - m, 1, -1) + at(w - m, h - m, -1, -1);
}
/**
 * وردةٌ هندسية (guilloche) — ختمٌ زخرفيّ يُرسم بالرياضيات.
 *
 * وهي منحنى وردةٍ قطبيّ `r = a·cos(kθ)`، ولذلك لا تتكرّر صورتها ولا تُشبه
 * زخرفةَ أحد: ليست مأخوذةً، هي محسوبة.
 */
function rosette(cx: number, cy: number, radius: number, petals: number, color: string): string {
  const points: string[] = [];
  const steps = 360;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = radius * (0.62 + 0.38 * Math.cos(petals * t));
    points.push(`${(cx + r * Math.cos(t)).toFixed(2)},${(cy + r * Math.sin(t)).toFixed(2)}`);
  }
  return (
    `<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="0.7" opacity="0.85"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${radius * 0.28}" fill="none" stroke="${color}" stroke-width="0.7"/>`
  );
}
/** شريطٌ يحمل عنوانًا — مستطيلٌ بطرفين مشقوقين. */
function ribbon(cx: number, y: number, w: number, h: number, color: string): string {
  const half = w / 2;
  return (
    `<path d="M${cx - half},${y} L${cx + half},${y} L${cx + half - h * 0.5},${y + h / 2} ` +
    `L${cx + half},${y + h} L${cx - half},${y + h} L${cx - half + h * 0.5},${y + h / 2} Z" ` +
    `fill="${color}"/>`
  );
}
/** شريطٌ مائلٌ في زاويةٍ سفلى — يُرى، بخلاف ما يُرسم تحت ترويسةٍ مصمتة. */
function cornerBand(w: number, h: number, color: string, side = 90): string {
  return `<path d="M0,${h} L0,${h - side} L${side},${h} Z" fill="${color}" opacity="0.14"/>`;
}
function svg(w: number, h: number, body: string, bg = PAPER): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`
  );
}
// ── بناءُ التصميم ────────────────────────────────────────────────────
type TextSpec = {
  text: string;
  box: { x: number; y: number; w: number; h: number };
  size: number;
  color?: string;
  bold?: boolean;
  dir?: 'rtl' | 'ltr';
};
function build(
  size: CanvasSize,
  bleed: number,
  background: string,
  texts: TextSpec[],
  extras: CanvasElement[] = []
): Canvas {
  const canvas = emptyCanvas(size, bleed);
  canvas.background = { kind: 'image', src: svgUrl(background) };
  canvas.elements = [
    ...texts.map((t, i) =>
      textElement({
        box: t.box,
        inlines: tokenInlines(t.text),
        size: t.size,
        color: t.color ?? INK,
        bold: t.bold ?? false,
        dir: t.dir ?? 'rtl',
        z: i + 1
      })
    ),
    ...extras.map((el, i) => ({ ...el, z: texts.length + i + 1 }))
  ];
  return canvas;
}
export type GalleryDesign = {
  key: string;
  title: string;
  size: CanvasSize;
  /** ما يُطبع ثم يُقصّ يأخذ نزفًا. */
  bleed: number;
  build: () => Canvas;
};
const A4_LAND: CanvasSize = { w: 297, h: 210 };
const A4_PORT: CanvasSize = { w: 210, h: 297 };
const A5: CanvasSize = { w: 148, h: 210 };
const A3: CanvasSize = { w: 297, h: 420 };
const CARD: CanvasSize = { w: 85.6, h: 54 };
/** شهادةٌ أفقية: إطارٌ وزوايا ووردةٌ في الأعلى — والفرق بينها في نصّها. */
function certificate(headline: string, body: string, accent: string): Canvas {
  const bg = svg(
    1188,
    840,
    doubleFrame(1188, 840, accent, 26) +
      corners(1188, 840, accent, 64) +
      rosette(594, 150, 74, 12, accent) +
      ribbon(594, 690, 420, 26, accent) +
      `<line x1="360" y1="640" x2="828" y2="640" stroke="${accent}" stroke-width="0.8"/>`,
    CREAM
  );
  return build(A4_LAND, 0, bg, [
    {
      text: headline,
      box: { x: 0.22, y: 0.26, w: 0.56, h: 0.11 },
      size: 34,
      bold: true,
      color: accent
    },
    { text: body, box: { x: 0.14, y: 0.4, w: 0.72, h: 0.08 }, size: 16 },
    { text: '{الاسم}', box: { x: 0.25, y: 0.49, w: 0.5, h: 0.1 }, size: 30, bold: true },
    { text: '{السبب}', box: { x: 0.16, y: 0.61, w: 0.68, h: 0.09 }, size: 14 },
    {
      text: 'التاريخ: {التاريخ}',
      box: { x: 0.06, y: 0.86, w: 0.26, h: 0.06 },
      size: 12
    },
    {
      text: '{التوقيع}',
      box: { x: 0.68, y: 0.86, w: 0.26, h: 0.06 },
      size: 12
    }
  ]);
}
/** هويةٌ CR80: شريطُ زاويةٍ وصورةٌ وباركود — والوجه الواحد يكفي المكتب. */
function idCard(title: string, role: string, accent: string): Canvas {
  const bg = svg(
    1011,
    638,
    `<rect width="1011" height="118" fill="${accent}"/>` +
      `<rect y="118" width="1011" height="5" fill="${GOLD}"/>` +
      cornerBand(1011, 638, accent, 150) +
      rosette(878, 300, 66, 10, accent) +
      `<rect x="330" y="156" width="600" height="1" fill="${accent}" opacity="0.35"/>` +
      // مكانُ الصورة مرسومٌ في الخلفية، فيُرى فارغًا قبل أن تُملأ.
      `<rect x="34" y="150" width="252" height="330" rx="10" fill="none" ` +
      `stroke="${accent}" stroke-width="1.5" opacity="0.5"/>`
  );
  return build(
    CARD,
    BLEED_MM,
    bg,
    [
      {
        text: title,
        box: { x: 0.06, y: 0.03, w: 0.88, h: 0.12 },
        size: 11,
        bold: true,
        color: PAPER
      },
      { text: '{الاسم}', box: { x: 0.33, y: 0.24, w: 0.6, h: 0.13 }, size: 11, bold: true },
      { text: `${role}: {الصف}`, box: { x: 0.33, y: 0.39, w: 0.6, h: 0.1 }, size: 8 },
      { text: 'الرقم: {الرقم}', box: { x: 0.33, y: 0.5, w: 0.6, h: 0.1 }, size: 8 },
      { text: 'صالحة حتى {الصلاحية}', box: { x: 0.06, y: 0.89, w: 0.5, h: 0.08 }, size: 7 }
    ],
    [
      imageElement({
        box: { x: 0.04, y: 0.22, w: 0.25, h: 0.52 },
        ref: 'الصورة',
        fit: 'cover',
        z: 0
      }),
      barcodeElement({ box: { x: 0.35, y: 0.63, w: 0.58, h: 0.2 }, ref: 'الرقم', z: 0 })
    ]
  );
}
/**
 * العشرة.
 *
 * وليست عشرةَ صورٍ، بل عشرةُ **دوالّ** — فالمقاس يتبدّل واللون يتبدّل، وحجمُها
 * كلِّها في المستودع بضعةُ كيلوبايتات.
 */
export const GALLERY: GalleryDesign[] = [
  {
    key: 'thanks',
    title: 'كتاب شكر وتقدير',
    size: A4_LAND,
    bleed: 0,
    build: () => certificate('شكر وتقدير', 'تتقدّم إدارة {الجهة} بالشكر والتقدير إلى', GOLD)
  },
  {
    key: 'excellence',
    title: 'شهادة امتياز',
    size: A4_LAND,
    bleed: 0,
    build: () => certificate('شهادة امتياز', 'تشهد {الجهة} بأن الطالب', BLUE)
  },
  {
    key: 'participation',
    title: 'شهادة مشاركة',
    size: A4_LAND,
    bleed: 0,
    build: () => certificate('شهادة مشاركة', 'تشهد {الجهة} بمشاركة', INK)
  },
  {
    key: 'graduation',
    title: 'شهادة تخرّج',
    size: A4_LAND,
    bleed: 0,
    build: () => certificate('شهادة تخرّج', 'تشهد {الجهة} بتخرّج', GOLD)
  },
  {
    key: 'student-id',
    title: 'هوية طالب',
    size: CARD,
    bleed: BLEED_MM,
    build: () => idCard('{المدرسة}', 'الصف', INK)
  },
  {
    key: 'staff-id',
    title: 'هوية موظف',
    size: CARD,
    bleed: BLEED_MM,
    build: () => idCard('{الدائرة}', 'العنوان الوظيفي', BLUE)
  },
  {
    key: 'invitation',
    title: 'بطاقة دعوة',
    size: A5,
    bleed: BLEED_MM,
    build: () =>
      build(
        A5,
        BLEED_MM,
        svg(
          592,
          840,
          doubleFrame(592, 840, GOLD, 22) +
            corners(592, 840, GOLD, 48) +
            rosette(296, 170, 62, 8, GOLD) +
            ribbon(296, 690, 300, 22, GOLD),
          CREAM
        ),
        [
          {
            text: 'دعوة',
            box: { x: 0.28, y: 0.3, w: 0.44, h: 0.08 },
            size: 28,
            bold: true,
            color: GOLD
          },
          { text: 'يسرّ {الجهة} دعوتكم لحضور', box: { x: 0.1, y: 0.4, w: 0.8, h: 0.07 }, size: 13 },
          { text: '{المناسبة}', box: { x: 0.14, y: 0.48, w: 0.72, h: 0.09 }, size: 20, bold: true },
          { text: '{التاريخ} — {الزمن}', box: { x: 0.14, y: 0.6, w: 0.72, h: 0.07 }, size: 13 },
          { text: '{المكان}', box: { x: 0.14, y: 0.68, w: 0.72, h: 0.07 }, size: 12 }
        ]
      )
  },
  {
    key: 'poster',
    title: 'ملصق إعلان',
    size: A4_PORT,
    bleed: 0,
    build: () =>
      build(
        A4_PORT,
        0,
        svg(
          840,
          1188,
          `<rect width="840" height="210" fill="${INK}"/>` +
            `<rect y="210" width="840" height="10" fill="${GOLD}"/>` +
            corners(840, 1188, INK, 56) +
            `<rect x="60" y="1060" width="720" height="1.2" fill="${INK}"/>`
        ),
        [
          {
            text: '{الجهة}',
            box: { x: 0.08, y: 0.04, w: 0.84, h: 0.08 },
            size: 20,
            bold: true,
            color: PAPER
          },
          { text: 'إعلان', box: { x: 0.34, y: 0.12, w: 0.32, h: 0.05 }, size: 14, color: PAPER },
          { text: '{العنوان}', box: { x: 0.08, y: 0.26, w: 0.84, h: 0.12 }, size: 34, bold: true },
          { text: '{التفاصيل}', box: { x: 0.08, y: 0.42, w: 0.84, h: 0.3 }, size: 15 },
          { text: 'التاريخ: {التاريخ}', box: { x: 0.08, y: 0.9, w: 0.5, h: 0.05 }, size: 12 }
        ]
      )
  },
  {
    key: 'notebook',
    title: 'غلاف دفتر',
    size: A4_PORT,
    bleed: BLEED_MM,
    build: () =>
      build(
        A4_PORT,
        BLEED_MM,
        svg(
          840,
          1188,
          `<rect width="840" height="1188" fill="${CREAM}"/>` +
            `<rect x="0" y="0" width="90" height="1188" fill="${BLUE}"/>` +
            doubleFrame(840, 1188, BLUE, 120) +
            rosette(465, 300, 78, 10, BLUE),
          CREAM
        ),
        [
          {
            text: '{المادة}',
            box: { x: 0.2, y: 0.42, w: 0.62, h: 0.1 },
            size: 32,
            bold: true,
            color: BLUE
          },
          { text: 'الاسم: {الاسم}', box: { x: 0.2, y: 0.56, w: 0.62, h: 0.06 }, size: 15 },
          { text: 'الصف: {الصف}', box: { x: 0.2, y: 0.63, w: 0.62, h: 0.06 }, size: 15 },
          { text: 'المدرسة: {المدرسة}', box: { x: 0.2, y: 0.7, w: 0.62, h: 0.06 }, size: 15 },
          {
            text: 'العام الدراسي {العام الدراسي}',
            box: { x: 0.2, y: 0.82, w: 0.62, h: 0.06 },
            size: 13
          }
        ]
      )
  },
  {
    key: 'honour',
    title: 'لوحة شرف',
    size: A3,
    bleed: 0,
    build: () =>
      build(
        A3,
        0,
        svg(
          1188,
          1680,
          doubleFrame(1188, 1680, GOLD, 30) +
            corners(1188, 1680, GOLD, 80) +
            rosette(594, 230, 104, 14, GOLD) +
            ribbon(594, 380, 640, 32, GOLD) +
            [0, 1, 2, 3, 4]
              .map(
                (i) =>
                  `<line x1="160" y1="${620 + i * 190}" x2="1028" y2="${620 + i * 190}" stroke="${GOLD}" stroke-width="0.6"/>`
              )
              .join(''),
          CREAM
        ),
        [
          {
            text: 'لوحة الشرف',
            box: { x: 0.2, y: 0.2, w: 0.6, h: 0.05 },
            size: 30,
            bold: true,
            color: GOLD
          },
          { text: '{الجهة}', box: { x: 0.15, y: 0.26, w: 0.7, h: 0.04 }, size: 18 },
          { text: '{الأول}', box: { x: 0.15, y: 0.34, w: 0.7, h: 0.05 }, size: 20, bold: true },
          { text: '{الثاني}', box: { x: 0.15, y: 0.45, w: 0.7, h: 0.05 }, size: 20, bold: true },
          { text: '{الثالث}', box: { x: 0.15, y: 0.56, w: 0.7, h: 0.05 }, size: 20, bold: true },
          {
            text: 'العام الدراسي {العام الدراسي}',
            box: { x: 0.25, y: 0.88, w: 0.5, h: 0.04 },
            size: 14
          }
        ]
      )
  }
];
export const galleryDesign = (key: string): GalleryDesign | undefined =>
  GALLERY.find((d) => d.key === key);
/** لمحةٌ صغيرة تُعرض في المعرض — الخلفية وحدها بلا حقول. */
export function galleryPreview(design: GalleryDesign): string {
  const canvas = design.build();
  return canvas.background.kind === 'image' ? canvas.background.src : '';
}
