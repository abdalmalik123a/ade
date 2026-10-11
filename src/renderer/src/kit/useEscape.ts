/**
 * Escape يغلق النافذة كما يغلقها ✕ (البند ١٩، دليل الواجهة `UI.md`) — **العليا وحدها**: النوافذ المفتوحة كومة، وكلّ Escape
 * يغلق آخرها فتحًا، فنافذة التقويم فوق نافذة الهوية تُغلق وتبقى الهوية.
 *
 * ومن سبق فعالج المفتاح (`preventDefault` — السؤال المعلَّق، واختيار الطابعة، والقائمة المفتوحة) لا يُغلق بعده شيء.
 */
import { useEffect, useRef } from 'react';

const stack: { current: () => void }[] = [];

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || stack.length === 0) return;
  e.preventDefault();
  stack[stack.length - 1]!.current();
}

/** `active`: للنافذة التي تبقى مركّبةً وتُخفى (`isOpen`). */
export function useEscape(close: () => void, active = true): void {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!active) return;
    if (stack.length === 0) window.addEventListener('keydown', onKey);
    stack.push(ref);
    return () => {
      const at = stack.lastIndexOf(ref);
      if (at >= 0) stack.splice(at, 1);
      if (stack.length === 0) window.removeEventListener('keydown', onKey);
    };
  }, [active]);
}
