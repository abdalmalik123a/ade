/**
 * الاختصارات الثابتة — قائمةٌ واحدة تقرؤها الشاشات وتعرضها «الإعدادات».
 *
 * **ولكل اختصارٍ زرٌّ ظاهر** (قرار المالك): الاختصار تسريعٌ لمن حفظه، لا بابٌ
 * وحيدٌ إلى عمل. فكل سطرٍ هنا يسمّي زرّه.
 *
 * **واختصاراتٌ أقلّ** (قرار ٣ تشرين الأول، ن١٥): ما يعرفه الموظف من Windows وWord وحده، وF4 للخانة.
 * فزال Ctrl+K (شريط الأوامر) وCtrl+M والأرقام في الشبّاك ومعنيا F2 — ولكلٍّ منها زرّه ظاهرٌ كما كان.
 *
 * **والمفتاح يُعرف بموضعه على اللوحة لا بحرفه** (`KeyboardEvent.code`): لوحة
 * المكتب عربيةٌ أكثر الوقت، و`Ctrl+F` عليها يصل حرفًا عربيًّا («ب») لا «f» —
 * فكان الاختصار يموت كلّما كانت اللوحة عربية (FOUNDATION §١٠، البند ٩).
 */

export type Combo = {
  /** موضع المفتاح: `KeyK`، `F2`، `Enter`… */
  code: string;
  ctrl?: boolean;
  shift?: boolean;
};

export type Shortcut = {
  id: string;
  combo: Combo;
  /** كما يُكتب للموظف. */
  keys: string;
  /** ماذا يفعل. */
  label: string;
  /** أين يعمل. */
  where: string;
  /** الزرّ الظاهر الذي يفعل الشيء نفسه. */
  button: string;
};

export const SHORTCUTS: Shortcut[] = [
  { id: 'search', combo: { code: 'KeyF', ctrl: true }, keys: 'Ctrl+F', label: 'البحث الشامل', where: 'في كل الشاشات', button: 'خانة البحث في الشريط العلوي' },
  { id: 'print', combo: { code: 'KeyP', ctrl: true }, keys: 'Ctrl+P', label: 'طباعة الورقة المعروضة', where: 'المحرّر والأسئلة', button: '«اطبع» في الشاشة نفسها' },
  { id: 'save', combo: { code: 'KeyS', ctrl: true }, keys: 'Ctrl+S', label: 'حفظ مسودة الكتاب', where: 'المحرّر', button: '«حفظ مسودة»' },
  { id: 'select-all', combo: { code: 'KeyA', ctrl: true }, keys: 'Ctrl+A', label: 'تحديد الورقة كلّها', where: 'المحرّر', button: '«تحديد الكلّ»' },
  { id: 'bold', combo: { code: 'KeyB', ctrl: true }, keys: 'Ctrl+B', label: 'عريض', where: 'المحرّر', button: 'زرّ العريض' },
  { id: 'italic', combo: { code: 'KeyI', ctrl: true }, keys: 'Ctrl+I', label: 'مائل', where: 'المحرّر', button: 'زرّ المائل' },
  { id: 'underline', combo: { code: 'KeyU', ctrl: true }, keys: 'Ctrl+U', label: 'تسطير', where: 'المحرّر', button: 'زرّ التسطير' },
  { id: 'page-break', combo: { code: 'Enter', ctrl: true }, keys: 'Ctrl+Enter', label: 'صفحةٌ جديدة من موضع المؤشّر', where: 'المحرّر', button: '«إدراج ← فاصل صفحة»' },
  { id: 'line-break', combo: { code: 'Enter', shift: true }, keys: 'Shift+Enter', label: 'سطرٌ جديد في الفقرة نفسها', where: 'المحرّر', button: '—' },
  { id: 'field', combo: { code: 'F4' }, keys: 'F4', label: 'اجعل النصّ المظلَّل خانة', where: 'المحرّر', button: '«خانة»' },
  { id: 'undo', combo: { code: 'KeyZ', ctrl: true }, keys: 'Ctrl+Z', label: 'تراجع', where: 'المحرّر والتصاميم', button: 'زرّ التراجع' },
  { id: 'redo', combo: { code: 'KeyY', ctrl: true }, keys: 'Ctrl+Y', label: 'إعادة', where: 'المحرّر والتصاميم', button: 'زرّ الإعادة' },
  { id: 'duplicate', combo: { code: 'KeyD', ctrl: true }, keys: 'Ctrl+D', label: 'تكرار العنصر', where: 'التصاميم', button: '«تكرار» في خصائص العنصر' }
];

/** أهذه الضغطة هي الاختصار؟ بموضع المفتاح — فتعمل بالعربية والإنجليزية سواء. */
export function isCombo(e: { code: string; ctrlKey: boolean; metaKey?: boolean; shiftKey: boolean }, combo: Combo): boolean {
  const ctrl = e.ctrlKey || Boolean(e.metaKey);
  return e.code === combo.code && ctrl === Boolean(combo.ctrl) && e.shiftKey === Boolean(combo.shift);
}

/** اختصارٌ بمعرّفه — فلا تُكتب المفاتيح في الشاشات مرّتين. */
export function shortcut(id: string): Shortcut {
  const s = SHORTCUTS.find((x) => x.id === id);
  if (!s) throw new Error(`اختصارٌ غير معروف: ${id}`);
  return s;
}
