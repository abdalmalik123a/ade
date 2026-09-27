/**
 * وصفة التصميم وكود الذكاء الاصطناعي — Diwan Design Recipe
 *
 * جسرٌ آمن يربط بين الذكاء الاصطناعي الخارجي (Gemini / Claude / ChatGPT)
 * وبين محرّك اللوحات في ديوان، دون أن يتّصل التطبيق بأي شبكة:
 *
 * 1. المستخدم ينسخ التوجيه (Prompt) ومعه طلبه.
 * 2. الذكاء الاصطناعي يعيد كود JSON خالصًا يصف عناصر التصميم ومقاسه.
 * 3. ديوان يفحص الكود محليًّا، ويحوّله إلى لوحة متعدّدة الطبقات (Canvas)
 *    قابلة للتعديل والتحريك بالفأرة، وكأنها ملف Photoshop مفتوح.
 */

import {
  BLEED_MM,
  SIZE_PRESETS,
  barcodeElement,
  clampBox,
  emptyCanvas,
  imageElement,
  shapeElement,
  textElement,
  type Canvas,
  type CanvasElement,
  type CanvasSize
} from './canvas';
import { tokenInlines, type Inline } from './doc';
import { findClipart, svgToDataUrl } from './clipart';
import { fromHsl, toHsl } from './designKit/color';

export type RecipeBackground = {
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  pattern?: 'guilloche' | 'rosette' | 'khatam' | 'artDeco' | 'sprouts' | 'none';
};

export type RecipeElement = {
  type: 'text' | 'image' | 'barcode' | 'qr' | 'badge' | 'line' | 'shape' | 'clipart' | 'svg';
  text?: string;
  value?: string;
  ref?: string;
  clipart?: string;
  icon?: string;
  svg?: string;
  symbology?: 'code128' | 'qr';
  x: number; // نسبة 0..1 من عرض التصميم
  y: number; // نسبة 0..1 من ارتفاع التصميم
  w: number; // نسبة 0..1
  h: number; // نسبة 0..1
  size?: number; // حجم الخط بالنقاط (افتراضي: 14)
  color?: string; // لون النص أو العنصر (hex)
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  font?: string; // اسم الخط العربي
  bold?: boolean;
  align?: 'right' | 'center' | 'left';
  vAlign?: 'top' | 'middle' | 'bottom';
};

export type DesignRecipe = {
  title: string;
  size: CanvasSize;
  bleed?: number;
  background?: RecipeBackground;
  elements: RecipeElement[];
};

// ── الألوان: يقرّرها صاحب الطلب أو النموذج — لا البرنامج ─────────────

/** لونان يختارهما صاحب الطلب: رئيسيٌّ يحمل التصميم، وإبرازٌ للزخرفة والأطر. */
export type DesignColors = { primary?: string; accent?: string };

const COLOR_WORDS: [string[], string][] = [
  [['كحلي', 'كحلية'], '#1b2a4a'],
  [['أزرق', 'ازرق', 'زرقاء'], '#1f5fbf'],
  [['سماوي', 'سماوية'], '#3aa0e0'],
  [['تركوازي', 'تركواز', 'فيروزي', 'فيروزية'], '#1aa6a0'],
  [['أخضر', 'اخضر', 'خضراء', 'زمردي', 'زمردية'], '#1f7a4a'],
  [['زيتي', 'زيتية'], '#6b7a2a'],
  [['ذهبي', 'ذهبية', 'مذهب', 'مذهبة'], '#c5a059'],
  [['فضي', 'فضية'], '#a8b0b8'],
  [['أحمر', 'احمر', 'حمراء'], '#c0282d'],
  [['عنابي', 'عنابية', 'خمري', 'خمرية', 'نبيذي'], '#7b1e2e'],
  [['وردي', 'وردية', 'زهري', 'زهرية'], '#e0659a'],
  [['بنفسجي', 'بنفسجية', 'موف', 'ليلكي'], '#6b3fa0'],
  [['برتقالي', 'برتقالية'], '#e8772e'],
  [['أصفر', 'اصفر', 'صفراء'], '#e6b800'],
  [['بني', 'بنية', 'قهوائي'], '#7a4b2a'],
  [['أسود', 'اسود', 'سوداء'], '#1a1a1a'],
  [['رمادي', 'رمادية'], '#6b7280']
];

/**
 * الألوان كما كتبها صاحب الطلب: «بألوان خضراء وذهبية» ← أخضر رئيسيّ وذهبيٌّ
 * للإبراز، بترتيب ذكرهما. والكلمة تُطابَق كاملةً بعد حروف العطف والجرّ و«ال» —
 * فـ«للبنين» ليست «بني».
 */
export function colorsFromText(text: string): DesignColors {
  const found: string[] = [];
  for (const raw of text.split(/[^ء-ي]+/)) {
    const word = raw.replace(/^و?(?:ب|ل|ك)?(?:ال)?/, '');
    const hit = COLOR_WORDS.find(([names]) => names.includes(word) || names.includes(raw));
    if (hit && !found.includes(hit[1])) found.push(hit[1]);
  }
  return { primary: found[0], accent: found[1] };
}

const HEX = /^#[0-9a-f]{6}$/i;
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/**
 * يعيد تلوين وصفةٍ بألوان صاحب الطلب — ويبقي درجاتها.
 *
 * ألوانُ الوصفة المشبعة تُجمع أطيافًا بترتيب ظهورها (الخلفية أولًا ثم العناصر
 * ثم الإطار): الطيف الأول يأخذ اللون الرئيسي، والثاني لون الإبراز. ويُبدَّل
 * الطيف والتشبّع وتبقى الإضاءة — فالخلفية الداكنة تبقى داكنةً باللون الجديد،
 * والعنوان الفاتح فاتحًا. والأبيض والأسود والرمادي لا تُمسّ.
 */
export function recolorRecipe(recipe: DesignRecipe, colors: DesignColors): DesignRecipe {
  const targets = [colors.primary, colors.accent].map((c) => (c && HEX.test(c) ? toHsl(c) : null));
  if (!targets[0] && !targets[1]) return recipe;

  const hues: number[] = [];
  const note = (c?: string) => {
    if (!c || !HEX.test(c)) return;
    const { h, s, l } = toHsl(c);
    if (s < 0.2 || l < 0.05 || l > 0.95) return;
    if (!hues.some((x) => hueGap(x, h) < 25)) hues.push(h);
  };
  note(recipe.background?.color);
  for (const el of recipe.elements) [el.color, el.fill, el.stroke].forEach(note);
  note(recipe.background?.borderColor);

  const paint = (c?: string): string | undefined => {
    if (!c || !HEX.test(c)) return c;
    const hsl = toHsl(c);
    if (hsl.s < 0.2) return c;
    const group = hues.findIndex((x) => hueGap(x, hsl.h) < 25);
    const target = group === 0 || group === 1 ? targets[group] : null;
    return target ? fromHsl({ h: target.h, s: target.s, l: hsl.l }) : c;
  };

  return {
    ...recipe,
    background: recipe.background && {
      ...recipe.background,
      color: paint(recipe.background.color),
      borderColor: paint(recipe.background.borderColor)
    },
    elements: recipe.elements.map((el) => ({ ...el, color: paint(el.color), fill: paint(el.fill), stroke: paint(el.stroke) }))
  };
}

/** سطر الألوان في التوجيه: ما اختاره صاحب الطلب، وإلا فالنموذج يختار ما يناسب. */
export function colorsInstruction(colors: DesignColors = {}): string {
  const chosen = [colors.primary && `اللون الرئيسي ${colors.primary}`, colors.accent && `لون الإبراز ${colors.accent}`].filter(Boolean);
  return chosen.length
    ? `الألوان: التزم بما اختاره صاحب الطلب — ${chosen.join('، ')} — وابنِ منها درجاتها للخلفية والنصوص.`
    : 'الألوان: اختر لوحةً تناسب موضوع الطلب وجمهوره؛ وإن ذكر صاحب الطلب ألوانًا فالتزم بها. ولا تنسخ ألوان المثال — المثال للبنية وحدها.';
}

/** الخطوط العربية المتاحة محليًّا داخل ديوان. */
export const AVAILABLE_FONTS = [
  'Amiri',
  'Noto Naskh Arabic',
  'Cairo',
  'Aref Ruqaa',
  'Reem Kufi',
  'Lalezar',
  'El Messiri',
  'IBM Plex Sans Arabic'
] as const;

/** استخراج كود JSON من النص الملصق حتى لو كان محاطًا بماركداون. */
export function extractJsonFromText(input: string): string {
  const trimmed = input.trim();
  // إزالة أقواس الماركداون: ```json ... ``` أو ``` ... ```
  const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }
  // البحث عن أول { وآخر }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

/** فحص وتفكيك وصفة التصميم. */
export function parseDesignRecipe(rawText: string): {
  recipe: DesignRecipe | null;
  error?: string;
} {
  if (!rawText.trim()) {
    return { recipe: null, error: 'النص فارغ — الصق كود الوصفة أولاً' };
  }

  let parsed: unknown;
  try {
    const jsonStr = extractJsonFromText(rawText);
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      recipe: null,
      error: `صيغة JSON غير صحيحة: ${e instanceof Error ? e.message : 'تأكد من إغلاق الأقواس والفواصل'}`
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { recipe: null, error: 'الكود يجب أن يكون كائن JSON يبدأ بـ {' };
  }

  const obj = parsed as Record<string, unknown>;

  // عنوان التصميم
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'تصميم جديد';

  // المقاس
  let size: CanvasSize = SIZE_PRESETS[1]!.size; // افتراضي: A4 أفقي
  if (typeof obj.size === 'object' && obj.size !== null) {
    const s = obj.size as Record<string, unknown>;
    const w = typeof s.w === 'number' && s.w > 10 ? s.w : typeof s.width === 'number' ? s.width : size.w;
    const h = typeof s.h === 'number' && s.h > 10 ? s.h : typeof s.height === 'number' ? s.height : size.h;
    size = { w, h };
  } else if (typeof obj.preset === 'string') {
    const found = SIZE_PRESETS.find((p) => p.key === obj.preset);
    if (found) size = found.size;
  }

  const bleed =
    typeof obj.bleed === 'number' && obj.bleed >= 0 ? obj.bleed : size.w < 120 ? BLEED_MM : 0;

  // الخلفية
  let background: RecipeBackground | undefined;
  if (typeof obj.background === 'object' && obj.background !== null) {
    const bg = obj.background as Record<string, unknown>;
    background = {
      color: typeof bg.color === 'string' ? bg.color : undefined,
      borderColor: typeof bg.borderColor === 'string' ? bg.borderColor : undefined,
      borderWidth: typeof bg.borderWidth === 'number' ? bg.borderWidth : undefined,
      pattern: typeof bg.pattern === 'string' ? (bg.pattern as RecipeBackground['pattern']) : undefined
    };
  }

  // العناصر
  const rawElements = Array.isArray(obj.elements) ? obj.elements : [];
  const elements: RecipeElement[] = [];

  for (const item of rawElements) {
    if (typeof item !== 'object' || item === null) continue;
    const el = item as Record<string, unknown>;

    const type = (
      typeof el.type === 'string' ? el.type.toLowerCase() : 'text'
    ) as RecipeElement['type'];

    // الإحداثيات: التحقق من وجودها وحصرها 0..1
    const x = typeof el.x === 'number' ? Math.max(0, Math.min(0.95, el.x)) : 0.1;
    const y = typeof el.y === 'number' ? Math.max(0, Math.min(0.95, el.y)) : 0.1;
    const w = typeof el.w === 'number' ? Math.max(0.01, Math.min(1 - x, el.w)) : 0.8;
    const h = typeof el.h === 'number' ? Math.max(0.01, Math.min(1 - y, el.h)) : 0.1;

    const clipart =
      typeof el.clipart === 'string'
        ? el.clipart
        : typeof el.icon === 'string'
          ? el.icon
          : typeof el.رسمة === 'string'
            ? (el.رسمة as string)
            : typeof el.ايقونة === 'string'
              ? (el.ايقونة as string)
              : undefined;

    const svg =
      typeof el.svg === 'string'
        ? el.svg
        : typeof el.vector === 'string'
          ? (el.vector as string)
          : undefined;

    elements.push({
      type,
      text: typeof el.text === 'string' ? el.text : undefined,
      value: typeof el.value === 'string' ? el.value : undefined,
      ref: typeof el.ref === 'string' ? el.ref : undefined,
      clipart,
      icon: typeof el.icon === 'string' ? el.icon : undefined,
      svg,
      symbology: el.symbology === 'qr' || type === 'qr' ? 'qr' : 'code128',
      x,
      y,
      w,
      h,
      size: typeof el.size === 'number' && el.size > 0 ? el.size : undefined,
      color: typeof el.color === 'string' ? el.color : undefined,
      fill: typeof el.fill === 'string' ? el.fill : undefined,
      stroke: typeof el.stroke === 'string' ? el.stroke : undefined,
      strokeWidth: typeof el.strokeWidth === 'number' ? el.strokeWidth : undefined,
      font: typeof el.font === 'string' ? el.font : undefined,
      bold: el.bold === true,
      align: el.align === 'right' || el.align === 'left' ? el.align : 'center',
      vAlign: el.vAlign === 'top' || el.vAlign === 'bottom' ? el.vAlign : 'middle'
    });
  }

  if (elements.length === 0 && !background?.color) {
    return { recipe: null, error: 'الوصفة لا تحتوي على عناصر ولا لون خلفية' };
  }

  return {
    recipe: {
      title,
      size,
      bleed,
      background,
      elements
    }
  };
}

/** تحويل كائن الوصفة إلى لوحة ديوان كاملة الطبقات وقابلة للتعديل. */
export function recipeToCanvas(recipe: DesignRecipe): Canvas {
  const canvas = emptyCanvas(recipe.size, recipe.bleed);

  // إعداد الخلفية إن وُجدت
  if (recipe.background?.color || recipe.background?.borderColor) {
    const bg = recipe.background;
    const color = bg.color ?? '#ffffff';
    const border = bg.borderColor ? `stroke="${bg.borderColor}" stroke-width="${(bg.borderWidth ?? 2) * 10}"` : '';
    const inset = bg.borderWidth ? (bg.borderWidth * 10) / 2 : 0;
    const w = recipe.size.w * 10;
    const h = recipe.size.h * 10;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" fill="${color}" ${border} />
    </svg>`;
    canvas.background = {
      kind: 'image',
      src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    };
  }

  const canvasElements: CanvasElement[] = [];

  for (const [i, el] of recipe.elements.entries()) {
    const box = clampBox({ x: el.x, y: el.y, w: el.w, h: el.h });
    const z = i + 1;

    if (el.type === 'barcode' || el.type === 'qr') {
      canvasElements.push(
        barcodeElement({
          box,
          symbology: el.symbology ?? (el.type === 'qr' ? 'qr' : 'code128'),
          value: el.value ?? el.text ?? '12345678',
          ref: el.ref,
          z
        })
      );
    } else if (el.type === 'image' || el.type === 'clipart' || el.type === 'svg') {
      let src = el.value ?? '';

      // 1. كود SVG مباشر
      if (el.svg) {
        src = svgToDataUrl(el.svg);
      } else if (src.trim().startsWith('<svg')) {
        src = svgToDataUrl(src);
      }

      // 2. اسم رسمة من مكتبة الكليب آرت المدمجة
      const clipartKey =
        el.clipart ?? el.icon ?? (el.type === 'clipart' ? el.text || el.value : undefined);
      if (!src && clipartKey) {
        const found = findClipart(clipartKey);
        if (found) src = svgToDataUrl(found.svg);
      }

      // 3. تحليل ذكي من النص أو المرجع لو ذُكر قرآن، كارتون، كأس، إلخ
      if (!src && (el.text || el.ref)) {
        const hint = `${el.text ?? ''} ${el.ref ?? ''}`;
        const found = findClipart(hint);
        if (found) src = svgToDataUrl(found.svg);
      }

      canvasElements.push(
        imageElement({
          box,
          src,
          ref: el.ref ?? (el.text && !src ? el.text.replace(/[{}]/g, '') : undefined),
          fit: 'contain',
          z
        })
      );
    } else if (el.type === 'shape' || el.type === 'badge' || el.type === 'line') {
      const isLine = el.type === 'line';
      const isBadge = el.type === 'badge';
      canvasElements.push(
        shapeElement({
          box,
          shape: isLine ? 'line' : 'rect',
          radius: isBadge ? Math.min(box.w, box.h) / 2 : undefined,
          fill: isLine ? undefined : el.fill ?? el.color ?? '#c5a059',
          stroke: isLine ? el.color ?? el.stroke ?? '#c5a059' : el.stroke,
          strokeWidth: el.strokeWidth ?? (isLine ? 1 : undefined),
          z
        })
      );
    } else {
      // نص عادي أو حقل وسم مثل {اسم الطالب}
      const rawText = el.text ?? '';
      // السطر الجديد فاصلٌ حقيقيّ — سواءٌ جاء سطرًا أو الحرفين «\n» كما يكتبهما
      // النموذج في JSON مهرَّبًا، وكما كُتبت الوصفات المحلية. وإلا طُبع «\n» على الشهادة.
      const inlines = rawText
        .split(/\r?\n|\\n/)
        .flatMap((line, i): Inline[] => [...(i ? [{ kind: 'break' as const }] : []), ...tokenInlines(line)]);
      // تطبيق علامات الحجم والخط
      for (const node of inlines) {
        if (node.kind === 'run') {
          node.marks = {
            ...node.marks,
            bold: el.bold,
            size: el.size
          };
        }
      }
      canvasElements.push(
        textElement({
          box,
          inlines,
          align: el.align ?? 'center',
          vAlign: el.vAlign ?? 'middle',
          size: el.size ?? 16,
          color: el.color ?? '#111111',
          font: el.font,
          z
        })
      );
    }
  }

  canvas.elements = canvasElements;
  return canvas;
}

/**
 * توليد نص التوجيه الجاهز للنسخ إلى Gemini أو ChatGPT مع دعم كامل للرسومات والصور.
 */
export function generateAiPrompt(userDescription: string, kind = 'شهادة تقدير', colors: DesignColors = {}): string {
  const req = userDescription.trim() || `صمم ${kind} بتنسيق راقٍ ومتناسق للمدارس والمؤسسات العراقية`;
  return `أنت مصمم تصاميم جرافيكية رسمي واحترافي لمنظومة «ديوان» للطباعة والنشر.
المطلوب إنشاء كود JSON دقيق لوصفة التصميم (Diwan Design Recipe) وفق المعايير الآتية:

المواصفات المطلوبة للتصميم:
${req}

${colorsInstruction(colors)}

قواعد بنية كود الـ JSON:
1. المقاس "size": بالمليمتر { "w": 297, "h": 210 } للشهادات A4 أفقي، أو { "w": 85.6, "h": 54 } للهويات، أو { "w": 210, "h": 297 } لـ A4 عمودي.
2. النزف "bleed": 0 للشهادات الكبيرة، أو 3 للهويات المقصوصة.
3. الخلفية "background": { "color": "<لون الخلفية>", "borderColor": "<لون الإطار>", "borderWidth": 4 } — بألوان التصميم لا بلونٍ ثابت.
4. العناصر "elements": مصفوفة تحتوي على عناصر بمواضع نسبية دقيقة بين 0.0 و 1.0 (x, y, w, h).

   أ) عناصر النصوص ("type": "text"):
      - "text": نص العنصر بالعربية. يمكن استخدام وسوم الحقول المتغيرة مثل: "{اسم الطالب}" أو "{الرقم الوطني}".
      - "font": اختر من الخطوط العربية المتاحة: "Amiri", "Noto Naskh Arabic", "Cairo", "Aref Ruqaa", "Reem Kufi", "Lalezar", "El Messiri".
      - "size": حجم الخط بالنقاط (32 للعناوين، 18 للمتن، 26 للأسماء).
      - "color": لون النص كود Hex من ألوان التصميم.
      - "align": "center" أو "right" أو "left".
      - "bold": true أو false.

   ب) عناصر الرسومات والأيقونات الجاهزة ("type": "clipart"):
      اختر من الرسومات المدمجة عالية الدقة:
      - "quran" ⬅ لرسمة القرآن الكريم والمصحف الشريف المذهب على رحلة خشبية.
      - "bismillah" ⬅ لمخطوطة بسم الله الرحمن الرحيم كاليغرافي فاخرة.
      - "islamic_ornament" ⬅ لزخرفة إسلامية هندسية أندلسية مذهبة.
      - "cartoon_boy" ⬅ لشخصية كارتونية لتلميذ متفوق سعيد وذكي.
      - "cartoon_girl" ⬅ لشخصية كارتونية لتلميذة متفوقة سعيدة ومبتسمة.
      - "cartoon_star" ⬅ لنجمة كارتونية ذهبية مبتسمة ومبهجة لشهادات الأطفال.
      - "cartoon_pencil" ⬅ لقلم مدرسي كارتوني مرح للأنشطة الابتدائية.
      - "golden_trophy" ⬅ لكأس تفوق وبطولة ذهبي ثلاثي الأبعاد.
      - "medal_ribbon" ⬅ لوسام شرف مع شريط ملكي أحمر وأزرق.
      - "laurel_wreath" ⬅ لإكليل الغار الذهبي المحيط بالشعارات والتكريم.
      - "iraq_emblem" ⬅ لشعار جمهورية العراق (النسر العراقي مع العلم).
      - "graduation_cap" ⬅ لقبعة تخرج جامعية وشهادة ملفوفة.

   ج) عناصر الفيكتور والتصاميم الإبداعية الحرة ("type": "svg"):
      - يمكنك كتابة أي كود رسم متجه مخصص تريده بالكامل بكود SVG نقي داخل خاصية "svg": "<svg viewBox='0 0 100 100'>...</svg>" وسيقوم ديوان برسمه فوراً!

   د) حقول الصور المرفوعة ("type": "image"):
      - لحجز موضع صورة شخصية للطالب أو الموظف: { "type": "image", "ref": "صورة الطالب", "x": 0.06, "y": 0.2, "w": 0.2, "h": 0.3 }

   هـ) الأشكال والفواصل ("type": "badge" أو "shape" أو "line"):
      - لرسم أطر وخطوط تزيينية بلون الإبراز في التصميم.

مثال لشكل الناتج المطلوب (للبنية وحدها — ألوانه ونصوصه ليست مطلوبة):
\`\`\`json
{
  "title": "شهادة شكر وتقدير وتفوق",
  "size": { "w": 297, "h": 210 },
  "bleed": 0,
  "background": {
    "color": "#0d1b2a",
    "borderColor": "#c5a059",
    "borderWidth": 4
  },
  "elements": [
    {
      "type": "clipart",
      "clipart": "bismillah",
      "x": 0.35, "y": 0.04, "w": 0.3, "h": 0.08
    },
    {
      "type": "clipart",
      "clipart": "quran",
      "x": 0.44, "y": 0.12, "w": 0.12, "h": 0.12
    },
    {
      "type": "text",
      "text": "شكر وتقدير",
      "x": 0.2, "y": 0.25, "w": 0.6, "h": 0.1,
      "size": 36, "color": "#e0c068", "font": "Reem Kufi", "bold": true, "align": "center"
    },
    {
      "type": "text",
      "text": "تسر إدارة المدرسة أن تمنح هذه الشهادة للتلميذ/ة المتميز/ة:",
      "x": 0.15, "y": 0.38, "w": 0.7, "h": 0.06,
      "size": 17, "color": "#ffffff", "font": "Cairo", "align": "center"
    },
    {
      "type": "text",
      "text": "{اسم الطالب}",
      "x": 0.15, "y": 0.46, "w": 0.7, "h": 0.1,
      "size": 28, "color": "#f3e5ab", "font": "Amiri", "bold": true, "align": "center"
    },
    {
      "type": "clipart",
      "clipart": "golden_trophy",
      "x": 0.08, "y": 0.6, "w": 0.14, "h": 0.22
    },
    {
      "type": "clipart",
      "clipart": "cartoon_star",
      "x": 0.78, "y": 0.6, "w": 0.14, "h": 0.22
    },
    {
      "type": "text",
      "text": "تقديرًا لتفوقه الباهر وحصوله على المركز الأول للعام الدراسي 2026",
      "x": 0.22, "y": 0.6, "w": 0.56, "h": 0.08,
      "size": 16, "color": "#e2e8f0", "font": "Cairo", "align": "center"
    },
    {
      "type": "text",
      "text": "مدير المدرسة\\nأ. حيدر جاسم",
      "x": 0.35, "y": 0.76, "w": 0.3, "h": 0.12,
      "size": 16, "color": "#c5a059", "font": "Amiri", "bold": true, "align": "center"
    }
  ]
}
\`\`\`

أجب بكود الـ JSON فقط داخل كتلة ماركداون، بدون أي مقدمات أو شروحات إضافية.`;
}

/**
 * توليد وصفة تصميم محليًّا وفوريًّا بدون الحاجة للإنترنت أو مفاتيح API.
 */
export function generateOfflineRecipe(description: string, presetKey = 'a4-landscape'): DesignRecipe {
  const lower = description.toLowerCase();

  // 1. هوية موظف أو بطاقة
  if (presetKey === 'id-card' || lower.includes('هوية') || lower.includes('موظف') || lower.includes('بطاقة موظف')) {
    return {
      title: 'هوية موظف رسمية',
      size: { w: 54, h: 85.6 },
      bleed: 3,
      background: { color: '#f8fafc', borderColor: '#2b6cb0', borderWidth: 2 },
      elements: [
        {
          type: 'text',
          text: 'شركة ديوان للتقنية والخدمات',
          x: 0.05,
          y: 0.04,
          w: 0.9,
          h: 0.06,
          size: 12,
          color: '#1a365d',
          font: 'Cairo',
          bold: true,
          align: 'center'
        },
        {
          type: 'image',
          ref: 'صورة الموظف',
          x: 0.22,
          y: 0.13,
          w: 0.56,
          h: 0.28
        },
        {
          type: 'text',
          text: '{اسم الموظف}',
          x: 0.05,
          y: 0.44,
          w: 0.9,
          h: 0.07,
          size: 15,
          color: '#1a202c',
          font: 'Cairo',
          bold: true,
          align: 'center'
        },
        {
          type: 'text',
          text: '{المسمى الوظيفي}',
          x: 0.05,
          y: 0.52,
          w: 0.9,
          h: 0.05,
          size: 11,
          color: '#4a5568',
          font: 'Cairo',
          align: 'center'
        },
        {
          type: 'text',
          text: 'الرقم الوظيفي: {الرقم}',
          x: 0.05,
          y: 0.58,
          w: 0.9,
          h: 0.05,
          size: 9,
          color: '#718096',
          font: 'Cairo',
          align: 'center'
        },
        {
          type: 'qr',
          ref: 'الرقم',
          value: 'EMP-2026',
          x: 0.33,
          y: 0.67,
          w: 0.34,
          h: 0.18
        },
        {
          type: 'text',
          text: 'www.diwan-service.iq',
          x: 0.05,
          y: 0.88,
          w: 0.9,
          h: 0.05,
          size: 8,
          color: '#2b6cb0',
          font: 'Cairo',
          align: 'center'
        }
      ]
    };
  }

  // 2. شهادة قرآن كريم
  if (lower.includes('قرآن') || lower.includes('مصحف') || lower.includes('حفظ') || lower.includes('إسلام')) {
    return {
      title: 'شهادة حفظ القرآن الكريم',
      size: { w: 297, h: 210 },
      bleed: 0,
      background: { color: '#091e2b', borderColor: '#d4af37', borderWidth: 4 },
      elements: [
        {
          type: 'clipart',
          clipart: 'bismillah',
          x: 0.35,
          y: 0.04,
          w: 0.3,
          h: 0.08
        },
        {
          type: 'clipart',
          clipart: 'quran',
          x: 0.44,
          y: 0.13,
          w: 0.12,
          h: 0.12
        },
        {
          type: 'text',
          text: 'شهادة إتمام وحفظ القرآن الكريم',
          x: 0.1,
          y: 0.27,
          w: 0.8,
          h: 0.1,
          size: 34,
          color: '#e0c068',
          font: 'Reem Kufi',
          bold: true,
          align: 'center'
        },
        {
          type: 'text',
          text: 'تتشرف إدارة الحلقات القرآنية بأن تشهد بأن الحافظ/ة المتقن/ة:',
          x: 0.15,
          y: 0.39,
          w: 0.7,
          h: 0.06,
          size: 16,
          color: '#ffffff',
          font: 'Cairo',
          align: 'center'
        },
        {
          type: 'text',
          text: '{اسم الطالب الحافظ}',
          x: 0.15,
          y: 0.47,
          w: 0.7,
          h: 0.1,
          size: 28,
          color: '#f5e6a8',
          font: 'Amiri',
          bold: true,
          align: 'center'
        },
        {
          type: 'text',
          text: 'قد أتم/ت بحمد الله وتوفيقه حفظ ومراجعة المقرر بجدارة وإتقان',
          x: 0.2,
          y: 0.59,
          w: 0.6,
          h: 0.06,
          size: 16,
          color: '#e2e8f0',
          font: 'Cairo',
          align: 'center'
        },
        {
          type: 'clipart',
          clipart: 'laurel_wreath',
          x: 0.08,
          y: 0.64,
          w: 0.14,
          h: 0.22
        },
        {
          type: 'clipart',
          clipart: 'golden_trophy',
          x: 0.78,
          y: 0.64,
          w: 0.14,
          h: 0.22
        },
        {
          type: 'text',
          text: 'المشرف العام على الحلقات\\nفضيلة الشيخ / {اسم الشيخ}',
          x: 0.3,
          y: 0.76,
          w: 0.4,
          h: 0.12,
          size: 15,
          color: '#d4af37',
          font: 'Amiri',
          bold: true,
          align: 'center'
        }
      ]
    };
  }

  // 3. أطفال وتفوق مدرسي
  if (lower.includes('طفل') || lower.includes('أطفال') || lower.includes('كارتون') || lower.includes('مدرسة') || lower.includes('ابتدائي')) {
    return {
      title: 'شهادة تميّز وتفوق للأبطال',
      size: { w: 297, h: 210 },
      bleed: 0,
      background: { color: '#fffdf5', borderColor: '#4361ee', borderWidth: 4 },
      elements: [
        {
          type: 'text',
          text: '🌟 شهادة تميّز وتفوق للأبطال 🌟',
          x: 0.1,
          y: 0.06,
          w: 0.8,
          h: 0.12,
          size: 34,
          color: '#3a0ca3',
          font: 'Lalezar',
          bold: true,
          align: 'center'
        },
        {
          type: 'clipart',
          clipart: 'cartoon_star',
          x: 0.08,
          y: 0.12,
          w: 0.14,
          h: 0.16
        },
        {
          type: 'clipart',
          clipart: 'cartoon_pencil',
          x: 0.78,
          y: 0.12,
          w: 0.14,
          h: 0.16
        },
        {
          type: 'text',
          text: 'تمنح إدارة المدرسة هذه الشهادة للبطل/ة المبدع/ة:',
          x: 0.15,
          y: 0.26,
          w: 0.7,
          h: 0.06,
          size: 17,
          color: '#2b2d42',
          font: 'Cairo',
          align: 'center'
        },
        {
          type: 'text',
          text: '{اسم التلميذ}',
          x: 0.15,
          y: 0.36,
          w: 0.7,
          h: 0.12,
          size: 32,
          color: '#d90429',
          font: 'Lalezar',
          bold: true,
          align: 'center'
        },
        {
          type: 'text',
          text: 'تقديرًا لاجتهاده وتفوقه في الأنشطة المدرسية وأخلاقه الرفيعة',
          x: 0.2,
          y: 0.5,
          w: 0.6,
          h: 0.06,
          size: 16,
          color: '#4a5568',
          font: 'Cairo',
          align: 'center'
        },
        {
          type: 'clipart',
          clipart: 'golden_trophy',
          x: 0.43,
          y: 0.6,
          w: 0.14,
          h: 0.18
        },
        {
          type: 'text',
          text: 'معلم/ة الفصل\\nأ. {اسم المعلم}',
          x: 0.1,
          y: 0.8,
          w: 0.35,
          h: 0.12,
          size: 15,
          color: '#3a0ca3',
          font: 'Cairo',
          bold: true,
          align: 'center'
        },
        {
          type: 'text',
          text: 'مدير/ة المدرسة\\nأ. {اسم المدير}',
          x: 0.55,
          y: 0.8,
          w: 0.35,
          h: 0.12,
          size: 15,
          color: '#3a0ca3',
          font: 'Cairo',
          bold: true,
          align: 'center'
        }
      ]
    };
  }

  // 4. درع تكريم وشكر ووفاء
  return {
    title: 'درع شكر وتقدير ووفاء',
    size: { w: 297, h: 210 },
    bleed: 0,
    background: { color: '#071e16', borderColor: '#c5a059', borderWidth: 4 },
    elements: [
      {
        type: 'clipart',
        clipart: 'iraq_emblem',
        x: 0.44,
        y: 0.04,
        w: 0.12,
        h: 0.12
      },
      {
        type: 'text',
        text: 'درع الشكر والتقدير والوفاء',
        x: 0.1,
        y: 0.18,
        w: 0.8,
        h: 0.1,
        size: 34,
        color: '#d4af37',
        font: 'Reem Kufi',
        bold: true,
        align: 'center'
      },
      {
        type: 'text',
        text: 'تتقدم إدارة المؤسسة بأسمى آيات الشكر والعرفان إلى:',
        x: 0.15,
        y: 0.32,
        w: 0.7,
        h: 0.06,
        size: 16,
        color: '#ffffff',
        font: 'Cairo',
        align: 'center'
      },
      {
        type: 'text',
        text: '{الاسم المكرّم}',
        x: 0.15,
        y: 0.42,
        w: 0.7,
        h: 0.1,
        size: 28,
        color: '#f9f1d8',
        font: 'Amiri',
        bold: true,
        align: 'center'
      },
      {
        type: 'text',
        text: 'تثمينًا لمسيرته المتميزة وجهوده الاستثنائية وتفانيه وإخلاصه',
        x: 0.2,
        y: 0.56,
        w: 0.6,
        h: 0.06,
        size: 16,
        color: '#e2e8f0',
        font: 'Cairo',
        align: 'center'
      },
      {
        type: 'clipart',
        clipart: 'golden_trophy',
        x: 0.08,
        y: 0.64,
        w: 0.14,
        h: 0.22
      },
      {
        type: 'clipart',
        clipart: 'laurel_wreath',
        x: 0.78,
        y: 0.64,
        w: 0.14,
        h: 0.22
      },
      {
        type: 'text',
        text: 'رئيس مجلس الإدارة\\n{اسم المسؤول}',
        x: 0.3,
        y: 0.76,
        w: 0.4,
        h: 0.12,
        size: 15,
        color: '#d4af37',
        font: 'Amiri',
        bold: true,
        align: 'center'
      }
    ]
  };
}


/** ما يحمل الطلب إلى Gemini ويعيد نصّه — يُنفَّذ في العملية الرئيسية لا في الواجهة. */
export type GeminiTransport = (prompt: string) => Promise<{ text: string | null; error?: string }>;

/**
 * يولّد وصفة التصميم بـGemini (المستوى المجاني).
 *
 * والاتصال نفسه في العملية الرئيسية (`designs:gemini`): سياسةُ أمان الواجهة
 * (`connect-src 'self'`) تمنع كلّ اتصالٍ منها، فكان الطلب يسقط قبل أن يخرج.
 * وهنا يُبنى التوجيه ويُفحص الجواب — وكلاهما يُختبر بلا شبكة.
 */
export async function callGeminiAi(
  userDescription: string,
  send: GeminiTransport,
  colors: DesignColors = {}
): Promise<{ recipe: DesignRecipe | null; error?: string }> {
  // والمفتاح لا يمرّ من هنا: يحفظه ويقرؤه الرئيسيُّ وحده.
  const res = await send(generateAiPrompt(userDescription, undefined, colors));
  if (!res.text) return { recipe: null, error: res.error || 'لم يُرجع الذكاء الاصطناعي أي استجابة' };
  return parseDesignRecipe(res.text);
}
