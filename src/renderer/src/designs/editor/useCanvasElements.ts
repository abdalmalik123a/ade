/**
 * عناصر اللوحة والمحدَّد منها: الإضافة والتعديل والحذف والتكرار، والمحاذاة والتوزيع والطبقات والقفل.
 * والحساب الهندسي في `shared/canvasEdit.ts` — هنا يُنادى ولا يُحسب.
 */
import { useCallback, useRef, useState } from 'react';
import { newUuid } from '@shared/doc';
import { topZ, type Canvas, type CanvasElement } from '@shared/canvas';
import {
  alignBoxes,
  cloneElements,
  distribute,
  groupElements,
  moveLayer,
  pasteElements,
  ungroupElements,
  withBoxes,
  type AlignMode,
  type LayerMove
} from '@shared/canvasEdit';

/** حافظة العناصر (DESIGNS.md ١٫٦): داخل البرنامج، وتبقى بين التصاميم — يُنسخ من تصميمٍ ويُلصق في غيره. */
let clipboard: CanvasElement[] = [];

export function useCanvasElements(canvas: Canvas, apply: (next: Canvas, commit?: boolean) => void) {
  const [selection, setSelection] = useState<string[]>([]);

  const add = useCallback(
    (el: CanvasElement) => {
      apply({ ...canvas, elements: [...canvas.elements, { ...el, z: topZ(canvas.elements) + 1 }] });
      setSelection([el.id]);
    },
    [canvas, apply]
  );

  const patchElement = useCallback(
    (id: string, patch: Partial<CanvasElement>, commit = true) => {
      apply(
        {
          ...canvas,
          elements: canvas.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as CanvasElement) : el))
        },
        commit
      );
    },
    [canvas, apply]
  );

  const removeSelected = useCallback(() => {
    if (!selection.length) return;
    const canDelete = canvas.elements.some((el) => selection.includes(el.id) && !el.locked);
    if (!canDelete) return;
    apply({ ...canvas, elements: canvas.elements.filter((el) => !(selection.includes(el.id) && !el.locked)) });
    setSelection((prev) => prev.filter((id) => canvas.elements.some((el) => el.id === id && el.locked)));
  }, [canvas, selection, apply]);

  const duplicateSelected = useCallback(() => {
    if (!selection.length) return;
    const made = cloneElements(canvas.elements, selection, newUuid);
    apply({ ...canvas, elements: [...canvas.elements, ...made] });
    setSelection(made.map((el) => el.id));
  }, [canvas, selection, apply]);

  const align = useCallback((mode: AlignMode) => apply(withBoxes(canvas, selection, (boxes) => alignBoxes(boxes, mode))), [canvas, selection, apply]);

  const spread = useCallback((axis: 'x' | 'y') => apply(withBoxes(canvas, selection, (boxes) => distribute(boxes, axis))), [canvas, selection, apply]);

  const layer = useCallback((move: LayerMove) => apply({ ...canvas, elements: moveLayer(canvas.elements, selection, move) }), [canvas, selection, apply]);

  const toggleLock = useCallback(() => {
    const anyOpen = canvas.elements.some((el) => selection.includes(el.id) && !el.locked);
    apply({
      ...canvas,
      elements: canvas.elements.map((el) => (selection.includes(el.id) ? { ...el, locked: anyOpen } : el))
    });
  }, [canvas, selection, apply]);

  // ── الحافظة والتجميع والطبقات (١٫٦) ─────────────────────────────
  /** كم لصقةً متتالية للحافظة نفسها — فكلّ لصقةٍ أبعد من سابقتها. */
  const pastes = useRef(0);
  const selectAll = useCallback(() => setSelection(canvas.elements.filter((el) => !el.hidden).map((el) => el.id)), [canvas]);
  const copy = useCallback(() => {
    if (!selection.length) return false;
    clipboard = canvas.elements.filter((el) => selection.includes(el.id)).map((el) => structuredClone(el));
    pastes.current = 0;
    return true;
  }, [canvas, selection]);
  const cut = useCallback(() => {
    if (copy()) removeSelected();
  }, [copy, removeSelected]);
  const paste = useCallback(() => {
    if (!clipboard.length) return;
    pastes.current += 1;
    const made = pasteElements(clipboard, canvas.elements, newUuid, pastes.current);
    apply({ ...canvas, elements: [...canvas.elements, ...made] });
    setSelection(made.map((el) => el.id));
  }, [canvas, apply]);
  const group = useCallback(() => {
    if (selection.length < 2) return;
    apply({ ...canvas, elements: groupElements(canvas.elements, selection, newUuid()) });
  }, [canvas, selection, apply]);
  const ungroup = useCallback(() => apply({ ...canvas, elements: ungroupElements(canvas.elements, selection) }), [canvas, selection, apply]);
  /** إخفاء عنصرٍ أو إظهاره، وقفله — من صفّه في «الطبقات». */
  const toggleOf = useCallback(
    (id: string, key: 'hidden' | 'locked') =>
      apply({ ...canvas, elements: canvas.elements.map((el) => (el.id === id ? ({ ...el, [key]: el[key] ? undefined : true } as CanvasElement) : el)) }),
    [canvas, apply]
  );

  const selected = canvas.elements.filter((el) => selection.includes(el.id));
  const single = selected.length === 1 ? selected[0]! : null;

  /** في المحدَّد مجموعة — فزرّ «فكّ التجميع» يُفعَّل. */
  const grouped = selected.some((el) => el.group);

  return {
    selection, setSelection, selected, single, add, patchElement, removeSelected, duplicateSelected, align, spread, layer, toggleLock,
    selectAll, copy, cut, paste, group, ungroup, grouped, toggleOf, canPaste: () => clipboard.length > 0
  };
}
