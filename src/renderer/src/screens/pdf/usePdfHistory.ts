/**
 * التراجع والإعادة في محرّر PDF، وما لم يُخرَج منه (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو: لقطةٌ للصفحات والطبقات
 * حين يهدأ التعديل، وCtrl+Z وCtrl+Y، و«ما لم يُحفظ» لما ضُمّ أو عُدِّل ولم يُخرَج.
 */
import { useRef, useState, useEffect } from 'react';
import type { Snap } from './pdfPages';
import type { PageRef, Overlay, FracBox } from '@shared/pdfEdit';
import type { Dispatch, SetStateAction } from 'react';

export function usePdfHistory(
  ctx: {
    pages: PageRef[];
    overlays: Overlay[];
    setPages: Dispatch<SetStateAction<PageRef[]>>;
    setOverlays: Dispatch<SetStateAction<Overlay[]>>;
    setSelected: Dispatch<SetStateAction<string[]>>;
    setCurrent: Dispatch<SetStateAction<string | null>>;
    setActive: Dispatch<SetStateAction<string | null>>;
    setCrop: Dispatch<SetStateAction<FracBox | null>>;
  }
) {
  const { pages, overlays, setPages, setOverlays, setSelected, setCurrent, setActive, setCrop } = ctx;

  // لقطةٌ للصفحات والطبقات حين يهدأ التعديل: فالسحب كلّه خطوةٌ واحدة، والكتابة كلُّ وقفةٍ خطوة.
  const latest = useRef<Snap>({ pages, overlays });
  latest.current = { pages, overlays };
  const committed = useRef<Snap>(latest.current);
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const restoring = useRef(false);
  const settle = useRef<number | undefined>(undefined);
  const [, bumpHistory] = useState(0);

  function flush() {
    window.clearTimeout(settle.current);
    const now = latest.current;
    if (now.pages === committed.current.pages && now.overlays === committed.current.overlays) return;
    past.current.push(committed.current);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    committed.current = now;
    bumpHistory((n) => n + 1);
  }

  useEffect(() => {
    if (restoring.current) {
      restoring.current = false;
      committed.current = latest.current;
      return;
    }
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(flush, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, overlays]);

  function restore(s: Snap) {
    restoring.current = true;
    committed.current = s;
    setPages(s.pages);
    setOverlays(s.overlays);
    setSelected((sel) => sel.filter((id) => s.pages.some((p) => p.id === id)));
    setCurrent((c) => (s.pages.some((p) => p.id === c) ? c : s.pages[0]?.id ?? null));
    setActive((a) => (s.overlays.some((o) => o.id === a) ? a : null));
    setCrop(null);
    bumpHistory((n) => n + 1);
  }

  function undo() {
    flush();
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(committed.current);
    restore(prev);
  }

  function redo() {
    flush();
    const next = future.current.pop();
    if (!next) return;
    past.current.push(committed.current);
    restore(next);
  }

  const dirty = pages !== committed.current.pages || overlays !== committed.current.overlays;

  // ── ما لم يُخرَج منه (ج٣) ────────────────────────────────────────────
  // جلسةٌ ضُمّت فيها ملفّات أو عُدِّلت صفحاتها ولم تُحفظ ملفًّا ولم تذهب إلى ملفّ الزبون: تضيع بالانتقال أو بـ«ابدأ من جديد».
  // وملفٌّ واحد فُتح ولم يُمسّ، أو ما أُخرج للتوّ، ليس عملًا يضيع.
  const [baseline, setBaseline] = useState<Snap>({ pages: [], overlays: [] });
  const baselinePending = useRef(false);
  useEffect(() => {
    if (!baselinePending.current) return;
    baselinePending.current = false;
    setBaseline({ pages, overlays });
  }, [pages, overlays]);
  const unsaved = pages.length > 0 && (pages !== baseline.pages || overlays !== baseline.overlays);
  const canUndo = past.current.length > 0 || dirty;
  const canRedo = future.current.length > 0 && !dirty;

  return { latest, baselinePending, past, future, restoring, committed, setBaseline, unsaved, redo, undo, canUndo, canRedo };
}
