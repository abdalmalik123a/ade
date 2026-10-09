/**
 * التحديد والتجميع والتدوير (DESIGNS.md ١٫٦) — عملياتٌ خالصة تُختبر بالأرقام: مستطيل التحديد بالفأرة، والمجموعة (عناصرُ
 * تحمل `group` واحدًا فتُحدَّد وتُسحب معًا)، واللصق بمعرّفاتٍ ومجموعاتٍ جديدة، والزاوية من موضع الفأرة حول المركز.
 */
import { clampBox } from '../model/box';
import type { Box, CanvasElement } from '../model/types';

/** المستطيل من نقطتين (نِسَبًا) — أيًّا كان اتّجاه السحب. */
export function rectFrom(a: { x: number; y: number }, b: { x: number; y: number }): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** ما يمسّه مستطيل التحديد من العناصر — والمخفيّ لا يُحدَّد بالفأرة. */
export function idsInRect(elements: CanvasElement[], rect: Box): string[] {
  if (rect.w < 0.002 && rect.h < 0.002) return [];
  return elements.filter((el) => !el.hidden && overlaps(el.box, rect)).map((el) => el.id);
}

/** المحدَّد ومجموعاته كاملةً: عنصرٌ في مجموعةٍ يأتي بها كلّها. */
export function expandToGroups(elements: CanvasElement[], ids: string[]): string[] {
  const groups = new Set(elements.filter((el) => ids.includes(el.id) && el.group).map((el) => el.group!));
  if (!groups.size) return ids;
  const out = new Set(ids);
  for (const el of elements) if (el.group && groups.has(el.group)) out.add(el.id);
  return elements.filter((el) => out.has(el.id)).map((el) => el.id);
}

/** يجمع المحدَّد (اثنين فأكثر) في مجموعةٍ واحدة — وما كان في مجموعةٍ أخرى يخرج منها إليها. */
export function groupElements(elements: CanvasElement[], ids: string[], groupId: string): CanvasElement[] {
  if (ids.length < 2) return elements;
  return elements.map((el) => (ids.includes(el.id) ? { ...el, group: groupId } : el));
}

/** يفكّ مجموعات المحدَّد كلّها. */
export function ungroupElements(elements: CanvasElement[], ids: string[]): CanvasElement[] {
  const groups = new Set(elements.filter((el) => ids.includes(el.id) && el.group).map((el) => el.group!));
  return elements.map((el) => {
    if (!el.group || !groups.has(el.group)) return el;
    const { group: _drop, ...rest } = el;
    return rest as CanvasElement;
  });
}

/** المسافة التي يُزاح بها الملصوق — فلا يقع فوق أصله تمامًا. */
export const PASTE_OFFSET = 0.02;

/**
 * الملصوق: نسخٌ بمعرّفاتٍ جديدة فوق كلّ ما في اللوحة، مزاحةٌ قليلًا، ومجموعاتها مجموعاتٌ جديدة (فلا تلتحق بمجموعة الأصل).
 * و`times` عدد مرّات اللصق المتتالية — كلّ لصقةٍ أبعد من سابقتها.
 */
export function pasteElements(clip: CanvasElement[], existing: CanvasElement[], newId: () => string, times = 1): CanvasElement[] {
  const top = existing.reduce((max, el) => Math.max(max, el.z), 0);
  const groups = new Map<string, string>();
  const shift = PASTE_OFFSET * times;
  return [...clip]
    .sort((a, b) => a.z - b.z)
    .map((el, i) => {
      const group = el.group ? (groups.get(el.group) ?? groups.set(el.group, newId()).get(el.group)!) : undefined;
      const { group: _old, ...rest } = el;
      return {
        ...rest,
        ...(group ? { group } : {}),
        id: newId(),
        z: top + i + 1,
        box: clampBox({ ...el.box, x: el.box.x + shift, y: el.box.y + shift })
      } as CanvasElement;
    });
}

/**
 * زاوية العنصر وهو يُدار من مقبضه: الفرق بين اتّجاه الفأرة الآن وعند البدء حول مركزه. والعنصر يُرسم `rotate(-r)`
 * (صندوقه من اليمين)، فما يدور مع عقارب الساعة على الشاشة يُنقص `r`. و`snap` بخطوة ١٥° (مع Shift).
 */
export function rotationFrom(center: { x: number; y: number }, start: { x: number; y: number }, now: { x: number; y: number }, r0: number, snap = false): number {
  const angle = (p: { x: number; y: number }) => (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
  let r = r0 - (angle(now) - angle(start));
  if (snap) r = Math.round(r / 15) * 15;
  r = ((((r + 180) % 360) + 360) % 360) - 180;
  return Math.round(r * 10) / 10;
}
