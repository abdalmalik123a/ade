/**
 * التراجع والإعادة: ستّون خطوة.
 *
 * تحرير اللوحة عملياتٌ خالصة لا تمسّ DOM ولا React — شرطُ أن تُقاس: قواعدُ هندسية تُختبر بالأرقام. والوحدة في كلّ
 * ما هنا **نسبةٌ من مقاس التصميم (٠..١)**. (DESIGNS.md ٠٫٤: كانت في `shared/canvasEdit.ts`، وهو مدخلٌ يعيد التصدير.)
 */
import type { Canvas } from '../model/types';

export type CanvasHistory = { past: Canvas[]; present: Canvas; future: Canvas[] };

export const HISTORY_DEPTH = 60;

export const startCanvasHistory = (canvas: Canvas): CanvasHistory => ({
  past: [],
  present: canvas,
  future: []
});

export function commitCanvas(history: CanvasHistory, next: Canvas): CanvasHistory {
  if (next === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_DEPTH),
    present: next,
    future: []
  };
}

export function undoCanvas(history: CanvasHistory): CanvasHistory {
  const prev = history.past[history.past.length - 1];
  if (!prev) return history;
  return {
    past: history.past.slice(0, -1),
    present: prev,
    future: [history.present, ...history.future].slice(0, HISTORY_DEPTH)
  };
}

export function redoCanvas(history: CanvasHistory): CanvasHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_DEPTH),
    present: next,
    future: history.future.slice(1)
  };
}
