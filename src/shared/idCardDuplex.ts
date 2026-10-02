/**
 * صانع هويات الوجه والظهر (ID Duplex 1:1 Layout & Print).
 *
 * استنساخ وطباعة الهويات والمستمسكات (البطاقة الوطنية، إجازة السوق، بطاقة السكن)
 * بمقاس ١٠٠٪ حقيقي (١:١ بالمليمتر) على ورق A4.
 *
 * الأنماط المدعومة:
 * ١. صفحة واحدة A4 (وجه وظهر): الوجه في النصف العلوي، والظهر في النصف السفلي
 *    وهو النمط الرسمي المطلوب في كافة الدوائر والمعاملات العراقية.
 * ٢. صفحة واحدة متجاورة (جنبًا إلى جنب): مناسب لطي الورقة والتغليف.
 * ٣. طباعة بوجهين (Duplex): الوجه في الصفحة الأولى، والظهر في الصفحة الثانية
 *    في عين الإحداثيات تمامًا ليتطابقا ١٠٠٪ عند خروج الورقة من طابعة الوجهين.
 * ٤. تكرار (Batch): تكرار البطاقة على الورقة لطباعة عدة نسخ دفعة واحدة.
 */
import { tiledWatermark, type WatermarkOptions } from './watermark';

export type CardDimension = {
  key: string;
  label: string;
  w: number; // بالمليمتر
  h: number; // بالمليمتر
};

export const STANDARD_CARD_SIZES: CardDimension[] = [
  { key: 'id1', label: 'البطاقة الوطنية / إجازة السوق (ID-1)', w: 85.6, h: 54.0 },
  { key: 'a7', label: 'بطاقة السكن / هوية الأحوال (A7)', w: 105.0, h: 74.0 },
  { key: 'a6', label: 'شهادة الجنسية القديمة (A6)', w: 148.0, h: 105.0 }
];

export type IdDuplexLayoutMode = 'stacked' | 'sideBySide' | 'duplex' | 'repeat';
export type IdColorFilter = 'color' | 'photocopy' | 'grayscale';

export type IdCardConfig = {
  cardSize: { w: number; h: number };
  mode: IdDuplexLayoutMode;
  frontSrc: string | null;
  backSrc: string | null;
  colorFilter: IdColorFilter;
  brightness: number; // 1 = default
  contrast: number; // 1 = default
  showDividerLine?: boolean;
  showCutMarks?: boolean;
  repeatCount?: number;
  /** علامةٌ مائية مكرَّرة **فوق** صورة البطاقة (هـ٣): «نسخة لغرض …». */
  watermark?: WatermarkOptions | null;
};

export type CardPlacement = {
  x: number;
  y: number;
  w: number;
  h: number;
  side: 'front' | 'back';
};

export type IdPageLayout = {
  pageIndex: number;
  cards: CardPlacement[];
};

const A4 = { w: 210, h: 297 };

export function layoutIdCards(config: IdCardConfig): IdPageLayout[] {
  const { cardSize, mode } = config;
  const { w, h } = cardSize;

  if (mode === 'stacked') {
    // صفحة واحدة A4: الوجه في النصف العلوي، والظهر في النصف السفلي
    const x = (A4.w - w) / 2;
    const yFront = A4.h / 4 - h / 2;
    const yBack = (3 * A4.h) / 4 - h / 2;
    return [
      {
        pageIndex: 0,
        cards: [
          { x, y: yFront, w, h, side: 'front' },
          { x, y: yBack, w, h, side: 'back' }
        ]
      }
    ];
  }

  if (mode === 'sideBySide') {
    // صفحة واحدة متجاورة أفقياً في الوسط
    const gap = 8;
    const totalW = 2 * w + gap;
    const startX = (A4.w - totalW) / 2;
    const y = (A4.h - h) / 2;
    return [
      {
        pageIndex: 0,
        cards: [
          { x: startX, y, w, h, side: 'front' },
          { x: startX + w + gap, y, w, h, side: 'back' }
        ]
      }
    ];
  }

  if (mode === 'duplex') {
    // صفحتان A4: الوجه في مركز الصفحة 1، والظهر في مركز الصفحة 2 بنفس المكان بالضبط
    const x = (A4.w - w) / 2;
    const y = (A4.h - h) / 2;
    return [
      {
        pageIndex: 0,
        cards: [{ x, y, w, h, side: 'front' }]
      },
      {
        pageIndex: 1,
        cards: [{ x, y, w, h, side: 'back' }]
      }
    ];
  }

  // repeat mode: تكرار في شبكة A4
  const margin = 10;
  const gap = 4;
  const cols = Math.max(1, Math.floor((A4.w - 2 * margin + gap) / (w + gap)));
  const rows = Math.max(1, Math.floor((A4.h - 2 * margin + gap) / (h + gap)));
  const gridW = cols * w + (cols - 1) * gap;
  const gridH = rows * h + (rows - 1) * gap;
  const x0 = (A4.w - gridW) / 2;
  const y0 = (A4.h - gridH) / 2;

  const totalSlots = cols * rows;
  const count = Math.min(totalSlots, config.repeatCount ?? totalSlots);
  const cards: CardPlacement[] = [];

  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    // إذا وجد ظهر، نوزع بالتناوب وجه ثم ظهر، أو الوجه فقط إن لم يتوفر
    const side: 'front' | 'back' = config.backSrc && i % 2 === 1 ? 'back' : 'front';
    cards.push({
      x: x0 + c * (w + gap),
      y: y0 + r * (h + gap),
      w,
      h,
      side
    });
  }

  return [{ pageIndex: 0, cards }];
}

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;

/** مرشّح الصورة: ملوّنة، أو «نسخة تصوير» عالية التباين، أو رمادية — ولورقة المستمسكات المجمّعة أيضًا. */
export function cardFilterCss(colorFilter: IdColorFilter, brightness = 1, contrast = 1): string {
  if (colorFilter === 'photocopy') return `grayscale(100%) contrast(150%) brightness(${Math.max(0.9, brightness * 1.05)})`;
  if (colorFilter === 'grayscale') return `grayscale(100%) brightness(${brightness}) contrast(${contrast})`;
  return `brightness(${brightness}) contrast(${contrast})`;
}

/**
 * يولّد كود HTML لأوراق الطباعة بمقاس A4 الحقيقي بالمليمتر
 */
export function generateIdDuplexHtml(config: IdCardConfig, resolveUrl: (src: string) => string): string[] {
  const layouts = layoutIdCards(config);

  const filterStr = cardFilterCss(config.colorFilter, config.brightness, config.contrast);

  const pagesHtml: string[] = [];

  for (const page of layouts) {
    let pageContent = '';

    // خط منصف في نمط stacked
    if (config.mode === 'stacked' && config.showDividerLine !== false) {
      pageContent += `<div style="position:absolute;left:10mm;right:10mm;top:${mm(
        A4.h / 2
      )};height:0;border-top:0.2mm dashed #ccc;pointer-events:none"></div>`;
    }

    // رسم البطاقات
    for (const card of page.cards) {
      const src = card.side === 'front' ? config.frontSrc : config.backSrc;
      const borderStyle = config.showCutMarks !== false ? 'outline:0.15mm solid #bbb;border-radius:2mm;' : '';

      pageContent += `
        <div style="position:absolute;left:${mm(card.x)};top:${mm(card.y)};width:${mm(card.w)};height:${mm(
          card.h
        )};overflow:hidden;background:#fafafa;${borderStyle}">
          ${
            src
              ? `<img alt="${card.side}" src="${resolveUrl(
                  src
                )}" style="width:100%;height:100%;object-fit:cover;filter:${filterStr};display:block"/>${
                  config.watermark ? tiledWatermark(config.watermark) : ''
                }`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;font-family:sans-serif">
                  ${card.side === 'front' ? 'وجه الهوية' : 'ظهر الهوية'}
                </div>`
          }
        </div>
      `;
    }

    pagesHtml.push(`
      <div class="print-page" style="position:relative;width:${mm(A4.w)};height:${mm(
        A4.h
      )};overflow:hidden;background:#fff;break-after:page;page-break-after:always">
        ${pageContent}
      </div>
    `);
  }

  return pagesHtml;
}
