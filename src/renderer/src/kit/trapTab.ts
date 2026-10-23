/**
 * حصر Tab في حاوية: الشبّاك كلّه (D117، D138) ونافذتا «هات الزبون» و«هات المدرسة» (D140) — نُقلا من `screens/service/CounterFill.tsx`
 * ليستعملهما اثنان.
 */

const TABBABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * ما يقف عنده Tab في الحاوية بترتيبه — بلا المعطَّل ولا المخفيّ بصنفه أو بأبيه (`hidden` و`hidden lg:flex`): فلا يُعدّ أوّلًا ولا آخرًا،
 * و«راجع» المخفيّة في «املأ» كانت ستصير آخرَ الدورة ولا يُبلغ. وبلا تخطيطٍ (jsdom) لا يُقاس الظاهر فيُعرف المخفيّ بصنفه.
 */
export function tabStops(root: HTMLElement): HTMLElement[] {
  const measured = root.getClientRects().length > 0;
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.tabIndex >= 0 && (measured ? el.getClientRects().length > 0 : !el.closest('[hidden], .hidden') && el.style.display !== 'none')
  );
}

/**
 * حصر Tab (D117 — S04): يدور في «املأ» على ورقة الإدخال **وشريط القرار** معًا، وفي «راجع» على الأوراق والشريط، ولا يخرج إلى السكّة
 * أو الشريط العلوي (D138) — كان محصورًا في الورقة وحدها فلا تبلغ ٤٥ ضغطةً «راجع الأوراق» ولا «اطبع». وما بين الأوّل والآخر يمشيه المتصفّح كعادته،
 * والتركيز الضائع على الصفحة (زرٌّ ضُغط فزال) يعود إلى الحاوية — إلا ونافذةٌ مفتوحة.
 * و`modal` للنافذة (D140): التركيز في أيّ موضعٍ خارجها يعود إليها — كانت ضغطتان تخرجان من «هات الزبون» إلى الشريط العلوي وهي مفتوحة — إلا من نافذةٍ فوقها.
 */
export function trapTab(e: KeyboardEvent, root: HTMLElement | null, modal = false): void {
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey || !root) return;
  const current = document.activeElement;
  const lost = !current || current === document.body;
  const outside = lost || !root.contains(current);
  if (outside && (modal ? current?.closest('[role="dialog"]') : !lost || document.querySelector('[role="dialog"]'))) return;
  const stops = tabStops(root);
  if (!stops.length) return;
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  const to = e.shiftKey ? (outside || current === first ? last : null) : outside || current === last ? first : null;
  if (!to) return;
  e.preventDefault();
  to.focus();
}
