/**
 * اللوحة نفسها: بناؤها فارغةً ووثيقةً، وطبقاتها، وحقولها ونصّها، وتقويمها من القرص — بالمرور على سجلّ الأنواع.
 */
import { emptyDoc, newUuid, type Doc } from '../../doc';
import { KINDS, LEGACY_KINDS, kindSpec } from '../kinds/registry';
import type { ElementCommon } from '../kinds/types';
import { SIZE_PRESETS } from './units';
import { CANVAS_VERSION, migrateCanvas } from './version';
import { clampBox, isObj, num } from './box';
import type { Background, Box, Canvas, CanvasElement, CanvasSize } from './types';

/** العناصر مرتّبةً بطبقاتها — الأصغر `z` أولًا، والمتساوي بترتيب إضافته. */
export function byLayer(elements: CanvasElement[]): CanvasElement[] {
  return elements
    .map((el, i) => ({ el, i }))
    .sort((a, b) => a.el.z - b.el.z || a.i - b.i)
    .map((p) => p.el);
}

/** أعلى طبقة — لما يُضاف جديدًا فيستقرّ أمام ما قبله. */
export function topZ(elements: CanvasElement[]): number {
  return elements.reduce((max, el) => Math.max(max, el.z), 0);
}

/** مفاتيح الحقول المستعملة في اللوحة — نصًّا وصورةً وباركودًا وجدولاً. */
export function canvasKeys(canvas: Canvas): string[] {
  const seen = new Set<string>();
  for (const el of canvas.elements) for (const key of kindSpec(el)?.keys(el) ?? []) seen.add(key);
  return [...seen];
}

/** نصّ اللوحة مجرّدًا — للبحث والبصمة، كما يفعل `docText` بالمتن. */
export function canvasText(canvas: Canvas, values: Record<string, string> = {}): string {
  const lines: string[] = [];
  for (const el of byLayer(canvas.elements)) lines.push(...(kindSpec(el)?.text?.(el, values) ?? []));
  return lines.join('\n');
}

export function emptyCanvas(size: CanvasSize, bleed = 0): Canvas {
  return {
    v: CANVAS_VERSION,
    size: { ...size },
    bleed,
    cropMarks: bleed > 0,
    background: { kind: 'none' },
    elements: []
  };
}

/**
 * لوحةٌ فارغة بمقاسها.
 *
 * وحكمها `print-only` دائمًا: الشهادة تُطبع بعدد الطلاب ولا تحرق رقم صادر —
 * كورقة الأسئلة، وللسبب نفسه (§٨).
 */
export function canvasDoc(canvas: Canvas, meta: Doc['meta'] = {}): Doc {
  const doc = emptyDoc();
  doc.kind = 'canvas';
  doc.issuing = 'print-only';
  doc.blocks = [];
  doc.canvas = canvas;
  doc.meta = { ...meta };
  return doc;
}

/**
 * عنصرٌ قُرئ من القرص: المشترك يُقوَّم هنا، وما يخصّ نوعه يقوّمه نوعه. ونوعٌ لا يُعرف يسقط — كعنصر الويب القديم
 * (`html`) الذي لا يُرسم إلا بتنفيذ كودٍ لم يعد البرنامج يقبله.
 */
function normalizeElement(raw: unknown, index: number): CanvasElement | null {
  if (!isObj(raw) || typeof raw.kind !== 'string') return null;
  // أنواع السجلّ نفسها لا ما يرثه الكائن: ملفٌّ تالف نوعُ عنصره «constructor» لا يجد دالّةً فيُسقط القراءة.
  const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
  const spec = own(KINDS, raw.kind)
    ? (KINDS as unknown as Record<string, { normalize: (r: Record<string, unknown>, b: ElementCommon) => CanvasElement | null }>)[raw.kind]
    : undefined;
  const legacy = own(LEGACY_KINDS, raw.kind) ? LEGACY_KINDS[raw.kind] : undefined;
  if (!spec && !legacy) return null;
  const base: ElementCommon = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newUuid(),
    box: clampBox(isObj(raw.box) ? (raw.box as unknown as Box) : ({} as Box)),
    z: num(raw.z, index + 1),
    name: typeof raw.name === 'string' ? raw.name : undefined,
    locked: raw.locked === true,
    rotate: typeof raw.rotate === 'number' ? raw.rotate : undefined,
    dir: raw.dir === 'ltr' ? 'ltr' : 'rtl'
  };
  const el = spec ? spec.normalize(raw, base) : legacy!(raw, base);
  // الشفافية خاصّيةٌ مشتركة (DESIGNS.md ١٫٣): تُقوَّم هنا لكلّ نوع، و١ (الغياب) لا يُكتب.
  const opacity = typeof raw.opacity === 'number' && Number.isFinite(raw.opacity) ? Math.min(1, Math.max(0, raw.opacity)) : 1;
  if (el && opacity < 1) el.opacity = Math.round(opacity * 100) / 100;
  // والمجموعة والإخفاء (١٫٦) كذلك: مشتركان، والمعرّف حروفٌ آمنة بحدّ.
  if (el && typeof raw.group === 'string' && /^[\w-]{1,40}$/.test(raw.group)) el.group = raw.group;
  if (el && raw.hidden === true) el.hidden = true;
  return el;
}

function normalizeBackground(raw: unknown): Background {
  if (!isObj(raw)) return { kind: 'none' };
  if (raw.kind === 'color' && typeof raw.color === 'string') {
    return { kind: 'color', color: raw.color };
  }
  if (raw.kind === 'image' && typeof raw.src === 'string') {
    const dpi = typeof raw.dpi === 'number' && raw.dpi > 0 ? raw.dpi : undefined;
    return dpi ? { kind: 'image', src: raw.src, dpi } : { kind: 'image', src: raw.src };
  }
  if (raw.kind === 'css' && typeof raw.style === 'string') {
    return { kind: 'css', style: raw.style };
  }
  return { kind: 'none' };
}

/** لوحةٌ قُرئت من القرص: ما فسد منها يُردّ إلى حدّه ولا يُسقط الورقة كلّها. */
export function normalizeCanvas(input: unknown): Canvas {
  const fallback = SIZE_PRESETS[1]!.size;
  if (!isObj(input)) return emptyCanvas(fallback);
  // الترحيل على الخام قبل التقويم (DESIGNS.md ٣٫٥) — وما حُفظ قبل الرقم إصداره ١.
  const { raw, version } = migrateCanvas(input);
  const size = isObj(raw.size) ? (raw.size as unknown as CanvasSize) : fallback;
  const bleed = Math.max(0, num(raw.bleed, 0));
  return {
    v: version,
    size: { w: Math.max(1, num(size.w, fallback.w)), h: Math.max(1, num(size.h, fallback.h)) },
    bleed,
    cropMarks: raw.cropMarks === true,
    background: normalizeBackground(raw.background),
    elements: Array.isArray(raw.elements) ? raw.elements.map(normalizeElement).filter((el): el is CanvasElement => el !== null) : []
  };
}
