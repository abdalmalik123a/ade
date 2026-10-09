/**
 * لوحة المفاتيح في المحرّر — مفاتيح Windows وحدها، ولكلٍّ زرّه في الشريط (DESIGNS.md ١٫٦): Ctrl+Z وCtrl+Y وCtrl+D، وCtrl+A
 * وCtrl+C وCtrl+X وCtrl+V، وCtrl+G وCtrl+Shift+G (كما في Office)، وDelete وEsc والأسهم (ومع Shift أبعد). ولا تعمل وهو يكتب في
 * خانة.
 */
import { useEffect } from 'react';
import { nudge, withBoxes } from '@shared/canvasEdit';
import type { Canvas } from '@shared/canvas';
import { NUDGE } from './kit';

type Inputs = {
  canvas: Canvas;
  selection: string[];
  setSelection: (ids: string[]) => void;
  apply: (next: Canvas, commit?: boolean) => void;
  undo: () => void;
  redo: () => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  selectAll: () => void;
  copy: () => boolean;
  cut: () => void;
  paste: () => void;
  group: () => void;
  ungroup: () => void;
};

export function useDesignKeys(k: Inputs): void {
  const { canvas, selection, setSelection, apply, undo, redo, duplicateSelected, removeSelected } = k;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.ctrlKey && e.code === 'KeyD') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.ctrlKey && e.code === 'KeyA') {
        e.preventDefault();
        k.selectAll();
        return;
      }
      if (e.ctrlKey && e.code === 'KeyV') {
        e.preventDefault();
        k.paste();
        return;
      }
      if (e.ctrlKey && e.code === 'KeyG') {
        e.preventDefault();
        if (e.shiftKey) k.ungroup();
        else k.group();
        return;
      }
      if (e.ctrlKey && selection.length && (e.code === 'KeyC' || e.code === 'KeyX')) {
        e.preventDefault();
        if (e.code === 'KeyC') k.copy();
        else k.cut();
        return;
      }
      if (e.code === 'Escape') {
        setSelection([]);
        return;
      }
      if (!selection.length) return;

      if (e.code === 'Delete') {
        e.preventDefault();
        removeSelected();
        return;
      }

      const arrows: Record<string, [number, number]> = {
        ArrowRight: [-1, 0],
        ArrowLeft: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1]
      };
      const move = arrows[e.code];
      if (move) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE * 10 : NUDGE;
        apply(withBoxes(canvas, selection, (boxes) => boxes.map((b) => nudge(b, move[0]!, move[1]!, step))));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canvas, selection, setSelection, apply, undo, redo, duplicateSelected, removeSelected, k]);
}
