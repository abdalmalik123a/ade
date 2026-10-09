/**
 * السحب بالفأرة: نِسَبٌ لا بكسلات — تحريك العناصر بالتصاقها وخطوط إرشادها، ومقابض المقاس. والسحبة كلّها قيدٌ واحد.
 */
import { useCallback, useRef, useState } from 'react';
import { clampBox, type Box, type Canvas, type CanvasElement } from '@shared/canvas';
import { resizeBox, snapBox, type Edge, type Guide } from '@shared/canvasEdit';
import type { Drag } from './kit';

type Inputs = {
  canvas: Canvas;
  apply: (next: Canvas, commit?: boolean) => void;
  patchElement: (id: string, patch: Partial<CanvasElement>, commit?: boolean) => void;
  selection: string[];
  setSelection: (ids: string[]) => void;
  pushPast: (before: Canvas) => void;
  zoom: number;
  geometry: { pxW: number; pxH: number; offset: number };
};

export function useCanvasPointer({ canvas, apply, patchElement, selection, setSelection, pushPast, zoom, geometry }: Inputs) {
  const { pxW, pxH, offset } = geometry;
  const [guides, setGuides] = useState<Guide[]>([]);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const beforeDrag = useRef<Canvas | null>(null);

  /** موضعُ الفأرة نسبةً من مقاس التصميم — والمحور الأفقي من اليمين. */
  const pointAt = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = sheetRef.current!.getBoundingClientRect();
      return {
        x: (rect.right - e.clientX - offset * zoom) / (pxW * zoom),
        y: (e.clientY - rect.top - offset * zoom) / (pxH * zoom)
      };
    },
    [offset, pxW, pxH, zoom]
  );

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const at = pointAt(e);

      if (drag.kind === 'resize') {
        const box = resizeBox(drag.box, drag.edge, { dx: at.x - drag.from.x, dy: at.y - drag.from.y }, e.shiftKey);
        patchElement(drag.id, { box } as Partial<CanvasElement>, false);
        return;
      }

      const dx = at.x - drag.from.x;
      const dy = at.y - drag.from.y;
      const moving = new Map<string, Box>();
      for (const id of drag.ids) {
        const start = drag.boxes.get(id);
        if (start) moving.set(id, clampBox({ ...start, x: start.x + dx, y: start.y + dy }));
      }

      // الالتصاق يُحسب على عنصرٍ واحد: التصاقُ مجموعةٍ يشدّها في اتجاهين.
      let hits: Guide[] = [];
      if (drag.ids.length === 1) {
        const id = drag.ids[0]!;
        const siblings = canvas.elements.filter((el) => el.id !== id).map((el) => el.box);
        const snapped = snapBox(moving.get(id)!, siblings);
        moving.set(id, snapped.box);
        hits = snapped.guides;
      }
      setGuides(hits);

      apply(
        {
          ...canvas,
          elements: canvas.elements.map((el) => (moving.has(el.id) && !el.locked ? { ...el, box: moving.get(el.id)! } : el))
        },
        false
      );
    },
    [canvas, apply, patchElement, pointAt]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setGuides([]);
    const before = beforeDrag.current;
    beforeDrag.current = null;
    if (before) pushPast(before);
  }, [pushPast]);

  /** ضغطٌ على عنصر: يُحدَّد (ومع Ctrl يُضاف إلى المحدَّد) ويبدأ سحبه — إلا أن يكون مقفلًا. */
  const startMove = (e: React.MouseEvent, el: CanvasElement) => {
    e.stopPropagation();
    const ids = e.ctrlKey ? (selection.includes(el.id) ? selection : [...selection, el.id]) : selection.includes(el.id) ? selection : [el.id];
    setSelection(ids);
    if (el.locked) return;
    beforeDrag.current = canvas;
    dragRef.current = {
      kind: 'move',
      ids,
      from: pointAt(e),
      boxes: new Map(canvas.elements.filter((x) => ids.includes(x.id)).map((x) => [x.id, x.box]))
    };
  };

  /** ضغطٌ على مقبض: يبدأ تغيير المقاس من ذلك الطرف. */
  const startResize = (e: React.MouseEvent, el: CanvasElement, edge: Edge) => {
    e.stopPropagation();
    beforeDrag.current = canvas;
    dragRef.current = { kind: 'resize', id: el.id, edge, from: pointAt(e), box: el.box };
  };

  return { sheetRef, guides, onMove, endDrag, startMove, startResize };
}
