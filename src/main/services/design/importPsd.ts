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
import { layerPixels, toRgb } from './psdPixels';
import type { PsdDoc, PsdLayer } from './psdTypes';
import { readPsd } from '../psd';
import { eraseLayers, parsePsdLayers, psdItems, type PsdItem, type Rect } from '../psdLayers';
import type { DesignImport } from './importTypes';
import { psdGlobalAngle } from './psdEffects';
import { photoFrame, PsdLosses, textStyle } from './psdStyle';

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

/** الصورة التي تُستبدل PNG بشفافيّتها وقناعها، مقصوصةً على مستطيلها الظاهر (٢٫١). */
function picturePng(bytes: Uint8Array, doc: PsdDoc, layer: PsdLayer, r: Rect, dpi: number): Buffer | null {
  const px = layerPixels(bytes, doc, layer);
  if (!px) return null;
  const w = r.right - r.left;
  const h = r.bottom - r.top;
  const lw = layer.rect.right - layer.rect.left;
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (r.top - layer.rect.top + y) * lw + (r.left - layer.rect.left + x);
      const o = (y * w + x) * 4;
      toRgb(px.k, px.native, i * px.k, rgba, o);
      rgba[o + 3] = px.alpha[i]!;
    }
  }
  return writePng(rgba, w, h, dpi);
}

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
  // الصور التي تُستبدل تُستخرج قبل المحو (٢٫١): ما لم تُقرأ بكسلاته يبقى في الخلفية لا يضيع — ولا صور بلا صورةٍ مسطَّحة.
  const pictures = new Map<number, Buffer>();
  const all = doc ? psdItems(bytes, doc) : [];
  for (const item of all) {
    if (item.kind !== 'picture' || !doc || !read.rgba) continue;
    const png = picturePng(bytes, doc, doc.layers.find((l) => l.index === item.layer)!, item.rect, read.dpi ?? 300);
    if (png) pictures.set(item.layer, png);
  }
  const items = all.filter((item) => item.kind !== 'picture' || pictures.has(item.layer));
  if (!read.rgba && !items.length) throw new Error('ملف Photoshop مبتور — لم تُقرأ صورته ولا طبقاته');
  const background = doc ? eraseLayers(bytes, doc, read.rgba, read.planes ?? null, items.map((i) => i.layer), read.dpi) : null;
  const rgba = background?.rgba ?? read.rgba;
  const images = rgba
    ? [{ name: `${basename(name, extname(name))}.png`, bytes: writePng(rgba, W, H, read.dpi ?? 300) }]
    : [];

  const losses = new PsdLosses();
  const globalAngle = psdGlobalAngle(bytes);
  const layerOf = new Map((doc?.layers ?? []).map((l) => [l.index, l]));
  const elements: DesignImport['elements'] = items.map((item) => {
    const box = (r: Rect) =>
      clampBox({ x: (W - r.right) / W, y: r.top / H, w: (r.right - r.left) / W, h: (r.bottom - r.top) / H });
    if (item.kind === 'photo') {
      const at = (i: number | undefined) => (i === undefined ? undefined : layerOf.get(i));
      const style = photoFrame(at(item.ring), at(item.base), layerOf.get(item.layer)!, H, losses);
      // بحلقةٍ: الدائرة شكلُ القصّ (١٫١) والحلقة حولها؛ وبلاها كما كانت.
      const round = item.round && style.frameFrac ? { shape: 'circle' as const } : { radius: item.round ? 50 : undefined };
      return { kind: 'image', box: box(item.rect), ref: 'صورة الموظف', fit: 'cover', ...round, ...style };
    }
    if (item.kind === 'barcode') {
      return { kind: 'barcode', box: box(item.rect), symbology: 'qr', ref: 'الرقم' };
    }
    if (item.kind === 'picture') {
      const layer = layerOf.get(item.layer)!;
      images.push({ name: `${layer.name || 'صورة'}.png`, bytes: pictures.get(item.layer)! });
      return { kind: 'image', box: box(item.rect), imageIndex: images.length - 1, fit: 'contain', ...(layer.opacity < 0.99 && { opacity: Math.round(layer.opacity * 100) / 100 }) };
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
      lineHeight: item.single ? 1.2 : item.style.lineHeight,
      ...textStyle(layerOf.get(item.layer)!, H, globalAngle, losses)
    };
  });

  // مجموعات Photoshop: ما صار منها عنصرين فأكثر مجموعةٌ في اللوحة (١٫٦) — يُحدَّد ويُنقل معًا.
  const groupKey = (i: number) => layerOf.get(items[i]!.layer)?.groups.join(' › ') ?? '';
  const sizes = new Map<string, number>();
  items.forEach((_, i) => groupKey(i) && sizes.set(groupKey(i), (sizes.get(groupKey(i)) ?? 0) + 1));
  const ids = [...sizes].filter(([, n]) => n > 1).map(([key]) => key);
  elements.forEach((el, i) => {
    const at = ids.indexOf(groupKey(i));
    if (at >= 0) el.group = `psd-${at + 1}`;
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
  warnings.push(...losses.lines());
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
