/**
 * السحب بالفأرة: نِسَبٌ لا بكسلات — تحريك العناصر بالتصاقها وخطوط إرشادها، ومقابض المقاس، ومقبض التدوير، ومستطيل
 * التحديد (DESIGNS.md ١٫٦). والسحبة كلّها قيدٌ واحد، والضغط على عضوٍ في مجموعةٍ يحدّدها كلّها.
 */
import { useCallback, useRef, useState } from 'react';
import { clampBox, type Box, type Canvas, type CanvasElement } from '@shared/canvas';
import { dragShare } from '@shared/shares';
import { minShare, withRowWeights } from '@shared/design/tableSizes';
import { expandToGroups, idsInRect, rectFrom, resizeBox, rotationFrom, snapBox, type Edge, type Guide } from '@shared/canvasEdit';
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
  /** مستطيل التحديد وهو يُسحب — نِسَبًا. */
  const [marquee, setMarquee] = useState<Box | null>(null);
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

      if (drag.kind === 'rotate') {
        const rotate = rotationFrom(drag.center, drag.start, { x: e.clientX, y: e.clientY }, drag.r0, e.shiftKey);
        patchElement(drag.id, { rotate: rotate || undefined } as Partial<CanvasElement>, false);
        return;
      }

      if (drag.kind === 'marquee') {
        const rect = rectFrom(drag.from, at);
        setMarquee(rect);
        setSelection([...new Set([...drag.add, ...expandToGroups(canvas.elements, idsInRect(canvas.elements, rect))])]);
        return;
      }

      // حدٌّ في جدول: الجاران يتقاسمان، وصندوق الجدول كما هو (البند ٢).
      if (drag.kind === 'table') {
        const el = canvas.elements.find((x) => x.id === drag.id);
        if (el?.kind !== 'table') return;
        const moved = (drag.axis === 'col' ? e.clientX : e.clientY) - drag.from;
        const next = dragShare(drag.start, drag.border, (drag.sign * moved) / drag.size, minShare(drag.start.length));
        patchElement(
          drag.id,
          (drag.axis === 'col' ? { columns: el.columns.map((c, i) => ({ ...c, widthPercent: next[i]! })) } : withRowWeights(el, next)) as Partial<CanvasElement>,
          false
        );
        return;
      }

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
    [canvas, apply, patchElement, pointAt, setSelection]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    const ending = dragRef.current;
    dragRef.current = null;
    setGuides([]);
    setMarquee(null);
    // مستطيل التحديد لا يغيّر اللوحة — فلا قيد.
    if (ending.kind === 'marquee') return;
    const before = beforeDrag.current;
    beforeDrag.current = null;
    if (before) pushPast(before);
  }, [pushPast]);

  /** ضغطٌ على عنصر: يُحدَّد (ومع Ctrl يُضاف إلى المحدَّد) ويبدأ سحبه — إلا أن يكون مقفلًا. */
  const startMove = (e: React.MouseEvent, el: CanvasElement) => {
    e.stopPropagation();
    const own = expandToGroups(canvas.elements, [el.id]);
    const ids = e.ctrlKey ? [...new Set([...selection, ...own])] : selection.includes(el.id) ? selection : own;
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

  /** ضغطٌ على مقبض التدوير: يدور حول مركز العنصر كما يُرى على الشاشة. */
  const startRotate = (e: React.MouseEvent, el: CanvasElement, handle: HTMLElement | null) => {
    e.stopPropagation();
    const box = handle?.parentElement?.getBoundingClientRect();
    if (!box) return;
    beforeDrag.current = canvas;
    dragRef.current = { kind: 'rotate', id: el.id, center: { x: box.left + box.width / 2, y: box.top + box.height / 2 }, start: { x: e.clientX, y: e.clientY }, r0: el.rotate ?? 0 };
  };

  /** ضغطٌ على حدٍّ في جدولٍ محدَّد (`TableGrips`): يبدأ تقاسم العرض أو الارتفاع بين جاريه — والسحبة كلّها قيدٌ واحد. */
  const startTableDrag = (e: React.MouseEvent, id: string, axis: 'col' | 'row', border: number, start: number[], size: number, sign: number) => {
    e.stopPropagation();
    e.preventDefault();
    beforeDrag.current = canvas;
    dragRef.current = { kind: 'table', id, axis, border, start, size: size || 1, from: axis === 'col' ? e.clientX : e.clientY, sign };
  };

  /** ضغطٌ على الورقة نفسها: يبدأ مستطيل التحديد — ومع Ctrl يضيف إلى المحدَّد. */
  const startMarquee = (e: React.MouseEvent) => {
    const add = e.ctrlKey ? selection : [];
    setSelection(add);
    dragRef.current = { kind: 'marquee', from: pointAt(e), add };
  };

  return { sheetRef, guides, marquee, onMove, endDrag, startMove, startResize, startRotate, startMarquee, startTableDrag };
}
