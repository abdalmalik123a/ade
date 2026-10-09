/**
 * وجه التصميم وظهره، ولكلٍّ تاريخه (ستّون خطوة): الحاضر يُعدَّل، وكلّ تغييرٍ منتهٍ قيد. والظهر لا يُنشأ حتى يُفتح.
 */
import { useCallback, useState } from 'react';
import { SIZE_PRESETS, emptyCanvas, type Canvas } from '@shared/canvas';
import { commitCanvas, redoCanvas, startCanvasHistory, undoCanvas, type CanvasHistory } from '@shared/canvasEdit';

export type Side = 'front' | 'back';

export function useCanvasSides() {
  const [history, setHistory] = useState(() => startCanvasHistory(emptyCanvas(SIZE_PRESETS[1]!.size)));
  const [activeSide, setActiveSide] = useState<Side>('front');
  const [backHistory, setBackHistory] = useState<CanvasHistory | null>(null);

  const canvas = activeSide === 'front' ? history.present : (backHistory?.present ?? emptyCanvas(history.present.size, history.present.bleed));

  /** كل تغييرٍ منتهٍ يُقيَّد في التاريخ؛ وأثناء السحب يُبدَّل الحاضر بلا قيد. */
  const apply = useCallback(
    (next: Canvas, commit = true) => {
      if (activeSide === 'front') {
        setHistory((h) => (commit ? commitCanvas(h, next) : { ...h, present: next }));
      } else {
        setBackHistory((h) => {
          const base = h ?? startCanvasHistory(emptyCanvas(history.present.size, history.present.bleed));
          return commit ? commitCanvas(base, next) : { ...base, present: next };
        });
      }
    },
    [activeSide, history.present.size, history.present.bleed]
  );

  /**
   * انتهاء السحب: قيدٌ واحد للسحبة كلّها — ما قبلها يُدفع إلى الماضي.
   *
   * ولو قُيّد كل تحرّكٍ بالفأرة لامتلأ التاريخ بمئة خطوةٍ لا معنى لها، وصار
   * «تراجع» يزحف بالعنصر بكسلًا بكسلًا بدل أن يعيده إلى حيث كان.
   */
  const pushPast = useCallback(
    (before: Canvas) => {
      if (activeSide === 'front') {
        setHistory((h) => ({ past: [...h.past, before].slice(-60), present: h.present, future: [] }));
      } else {
        setBackHistory((h) => {
          const base = h ?? startCanvasHistory(emptyCanvas(history.present.size, history.present.bleed));
          return { past: [...base.past, before].slice(-60), present: base.present, future: [] };
        });
      }
    },
    [activeSide, history.present.size, history.present.bleed]
  );

  const undo = useCallback(() => {
    if (activeSide === 'front') setHistory(undoCanvas);
    else setBackHistory((h) => (h ? undoCanvas(h) : h));
  }, [activeSide]);

  const redo = useCallback(() => {
    if (activeSide === 'front') setHistory(redoCanvas);
    else setBackHistory((h) => (h ? redoCanvas(h) : h));
  }, [activeSide]);

  /** في الظهر عناصر أو خلفية — فالتصميم بوجهين. */
  const backHasContent = Boolean(backHistory?.present && (backHistory.present.elements.length > 0 || backHistory.present.background.kind !== 'none'));

  return { history, setHistory, activeSide, setActiveSide, backHistory, setBackHistory, canvas, apply, pushPast, undo, redo, backHasContent };
}
