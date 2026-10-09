/**
 * استيراد التصاميم — Photoshop: الخلفية المسطَّحة بلا ما صار عنصرًا، والطبقات عناصرَ تُحرَّر (DESIGNS.md ٠٫٩).
 */
import { basename, extname } from 'node:path';
import { clampBox, type Box } from '@shared/canvas';
import { tokenInlines, type Inline } from '@shared/doc';
import { fieldFromLayerName } from '@shared/design/layerFields';
import { FONT } from '@shared/design/kit/styles';
import { BUNDLED_FONTS, cleanFamily, familyFromPostScript, matchFamily, stackOf } from '@shared/fonts';
import { writePng } from '../png';
import { readPsd } from '../psd';
import { eraseLayers, parsePsdLayers, psdItems, type PsdItem, type Rect } from '../psdLayers';
import type { DesignImport } from './importTypes';

// ── Photoshop ────────────────────────────────────────────────────────

/**
 * أقرب ما عندنا محزومًا لخطٍّ ليس في المكتبة — بعائلته لا باسمه: نسخٌ لما كان نسخًا، وكوفيٌّ لما كان كوفيًّا، والباقي
 * القاهرة (وحروفها اللاتينية هندسيّةٌ كخطوط قوالب Photoshop: Poppins وMontserrat…).
 */
function nearestBundled(name: string | null): string {
  const n = (name ?? '').toLowerCase();
  if (/ruq|رقعة/.test(n)) return FONT.ruqaa;
  if (/kufi|كوفي/.test(n)) return FONT.kufiText;
  if (/naskh|amiri|lotus|traditional|badr|mudir|times|georgia|garamond|serif(?!.*sans)|playfair|merriweather|نسخ/.test(n)) {
    return FONT.naskh;
  }
  return FONT.cairo;
}

/**
 * خطّ النصّ من اسم خطّه في Photoshop (DESIGNS.md ١٫٥): **من «خطوط ديوان» إن كان فيها** (المحزوم وما أضافه المكتب)،
 * وإلا **باسمه** وبعده أقرب المحزوم — فيُرسم بالبديل حتى يُضاف، ويُقال اسمه في التقرير وعند اختيار النصّ (لا بديلٌ صامت).
 */
function fontFor(name: string | null, families: string[], missing: Set<string>): string {
  if (!name) return FONT.cairo;
  const match = matchFamily(name, families);
  if (match) return stackOf(match);
  const family = cleanFamily(familyFromPostScript(name));
  if (!family) return nearestBundled(name);
  missing.add(family);
  return `'${family}', ${nearestBundled(name)}`;
}

const ARABIC = /[؀-ۿ]/;

/**
 * صندوق النصّ من موضع حبره: الارتفاع سطرٌ كامل حول وسط الحبر، والعرض يزيد
 * قليلًا من جهة المحاذاة — فخطّنا ليس خطّ التصميم، والاسم الأطول يصغر ولا يُقصّ.
 */
function textBox(item: Extract<PsdItem, { kind: 'text' }>, W: number, H: number): Box {
  const s = item.style.sizePx;
  const { top, bottom, left, right } = item.rect;
  const toBox = (x0: number, y0: number, x1: number, y1: number) =>
    // المواضع نِسَبٌ من اليمين: اللوحة عربية.
    clampBox({ x: (W - Math.min(W, x1)) / W, y: y0 / H, w: (Math.min(W, x1) - Math.max(0, x0)) / W, h: (y1 - y0) / H });
  // الصندوق الملتفّ كما رسمه المصمّم، والنصّ يلتفّ فيه بخطّنا.
  if (!item.single) return toBox(left, top, right, bottom + s * 0.3);
  const h = Math.max(bottom - top, s * 1.3);
  const cy = (top + bottom) / 2;
  const w = (right - left) * 1.12 + s * 0.4;
  let x0 =
    item.style.align === 'left'
      ? left - s * 0.05
      : item.style.align === 'right'
        ? right + s * 0.05 - w
        : (left + right) / 2 - w / 2;
  x0 = Math.max(0, Math.min(W - Math.min(w, W), x0));
  return toBox(x0, cy - h / 2, x0 + w, cy + h / 2);
}

/**
 * Photoshop: الخلفيةُ صورتُه المسطَّحة، والنصوصُ والصورةُ والرمز عناصرُ فوقها.
 *
 * وكلُّ ما صار عنصرًا يُمحى من الخلفية (`psdLayers.eraseLayers`) — وإلا ظهر
 * الاسم مرّتين: المطبوعُ في الصورة، والمحرَّرُ فوقه بخطٍّ آخر.
 */
/** `families`: «خطوط ديوان» — المحزوم وحده إن لم يُعطَ (الاختبار)، وفي البرنامج ما أضافه المكتب معه. */
export function psdDesign(bytes: Uint8Array, name: string, families: string[] = BUNDLED_FONTS.map((f) => f.family)): DesignImport {
  const missingFonts = new Set<string>();
  const read = readPsd(bytes);
  // ملفٌّ لا يُقرأ يُقال — لا لوحةٌ فارغة تسأل عن مقاس ملفٍّ لم يُفتح.
  if (!read) throw new Error('تعذّر قراءة ملف Photoshop — قد يكون تالفًا أو مقطوعًا');
  const warnings = [...read.warnings];
  if (!read.dpi) warnings.push('الملف لا يذكر دقّته — اختر المقاس');
  const W = read.width;
  const H = read.height;

  const doc = parsePsdLayers(bytes);
  const items = doc ? psdItems(bytes, doc) : [];
  if (!read.rgba && !items.length) throw new Error('ملف Photoshop مبتور — لم تُقرأ صورته ولا طبقاته');
  const background = doc ? eraseLayers(bytes, doc, read.rgba, read.planes ?? null, items.map((i) => i.layer), read.dpi) : null;
  const rgba = background?.rgba ?? read.rgba;
  const images = rgba
    ? [{ name: `${basename(name, extname(name))}.png`, bytes: writePng(rgba, W, H, read.dpi ?? 300) }]
    : [];

  const elements: DesignImport['elements'] = items.map((item) => {
    const box = (r: Rect) =>
      clampBox({ x: (W - r.right) / W, y: r.top / H, w: (r.right - r.left) / W, h: (r.bottom - r.top) / H });
    if (item.kind === 'photo') {
      return { kind: 'image', box: box(item.rect), ref: 'صورة الموظف', fit: 'cover', radius: item.round ? 50 : undefined };
    }
    if (item.kind === 'barcode') {
      return { kind: 'barcode', box: box(item.rect), symbology: 'qr', ref: 'الرقم' };
    }
    const arabic = ARABIC.test(item.text);
    const suggest = fieldFromLayerName(item.name, item.text) ?? undefined;
    return {
      kind: 'text',
      layerName: item.name,
      suggest,
      box: textBox(item, W, H),
      // أسطر الصندوق فواصلُ في النصّ نفسه، والحقول `{…}` عُقدٌ في كلّ سطر.
      inlines: item.text
        .split('\n')
        .flatMap((line, i): Inline[] => [...(i ? [{ kind: 'break' as const }] : []), ...tokenInlines(line)]),
      sizeFrac: item.style.sizePx / H,
      color: item.style.color,
      align: item.style.align,
      bold: item.style.bold,
      italic: item.style.italic || undefined,
      dir: arabic ? 'rtl' : 'ltr',
      font: fontFor(item.style.font, families, missingFonts),
      letterSpacing: item.style.tracking || undefined,
      fit: item.single ? 'shrink' : undefined,
      vAlign: item.single ? undefined : 'top',
      lineHeight: item.single ? 1.2 : item.style.lineHeight
    };
  });

  if (missingFonts.size) {
    warnings.push(`خطوطٌ ليست في خطوط ديوان: ${[...missingFonts].join('، ')} — تُرسم ببديلٍ حتى تُضاف من «المكتبة ← الخطوط»`);
  }
  if (items.length) {
    const texts = items.filter((i) => i.kind === 'text').length;
    warnings.push(`صار ${texts} نصًّا${items.length > texts ? ' والصورة والرمز' : ''} عناصرَ تُحرَّر، ومُحيت من الخلفية`);
  }
  if (background?.filledAreas) {
    warnings.push(`${background.filledAreas} موضعًا تحته مؤثّرٌ لا يُرسم فمُلئ ممّا حوله — راجعه في المعاينة`);
  }
  if (background?.recomposed) {
    warnings.push('الصورة المسطَّحة في الملف فارغة (حُفظ بلا «توافقٍ أقصى») — رُكّبت الخلفية من طبقاته بلا مؤثّراتها');
  }

  return {
    source: 'psd',
    name,
    size: read.dpi ? { w: (W / read.dpi) * 25.4, h: (H / read.dpi) * 25.4 } : null,
    dpi: read.dpi,
    images,
    elements,
    warnings
  };
}
