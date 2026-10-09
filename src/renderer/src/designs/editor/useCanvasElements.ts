/**
 * عناصر اللوحة والمحدَّد منها: الإضافة والتعديل والحذف والتكرار، والمحاذاة والتوزيع والطبقات والقفل.
 * والحساب الهندسي في `shared/canvasEdit.ts` — هنا يُنادى ولا يُحسب.
 */
import { useCallback, useState } from 'react';
import { newUuid } from '@shared/doc';
import { topZ, type Canvas, type CanvasElement } from '@shared/canvas';
import { alignBoxes, cloneElements, distribute, moveLayer, withBoxes, type AlignMode, type LayerMove } from '@shared/canvasEdit';

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
    apply({ ...canvas, elements: canvas.elements.filter((el) => !selection.includes(el.id)) });
    setSelection([]);
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

  const selected = canvas.elements.filter((el) => selection.includes(el.id));
  const single = selected.length === 1 ? selected[0]! : null;

  return { selection, setSelection, selected, single, add, patchElement, removeSelected, duplicateSelected, align, spread, layer, toggleLock };
}
