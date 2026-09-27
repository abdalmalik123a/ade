/**
 * الاختصارات الثابتة — قائمةٌ واحدة تقرؤها الشاشات وتعرضها «الإعدادات».
 *
 * **ولكل اختصارٍ زرٌّ ظاهر** (قرار المالك): الاختصار تسريعٌ لمن حفظه، لا بابٌ
 * وحيدٌ إلى عمل. فكل سطرٍ هنا يسمّي زرّه.
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
  { id: 'palette', combo: { code: 'KeyK', ctrl: true }, keys: 'Ctrl+K', label: 'شريط الأوامر', where: 'في كل الشاشات', button: '«الأوامر» في الشريط العلوي' },
  { id: 'search', combo: { code: 'KeyF', ctrl: true }, keys: 'Ctrl+F', label: 'البحث الشامل', where: 'في كل الشاشات', button: 'خانة البحث في الشريط العلوي' },
  { id: 'print', combo: { code: 'KeyP', ctrl: true }, keys: 'Ctrl+P', label: 'طباعة الورقة المعروضة', where: 'المحرّر والأسئلة', button: '«طباعة» في الشاشة نفسها' },
  { id: 'library', combo: { code: 'KeyM', ctrl: true }, keys: 'Ctrl+M', label: 'مكتبة النماذج', where: 'في كل الشاشات', button: '«مكتبة النماذج» في الشريط الجانبي' },
  { id: 'save', combo: { code: 'KeyS', ctrl: true }, keys: 'Ctrl+S', label: 'حفظ مسودة الكتاب', where: 'المحرّر', button: '«حفظ مسودة»' },
  { id: 'citizen', combo: { code: 'F2' }, keys: 'F2', label: 'جلب بيانات مواطن من السجل', where: 'الشبّاك والمحرّر', button: '«استيراد (F2)»' },
  { id: 'new-citizen', combo: { code: 'F2' }, keys: 'F2', label: 'ملف مواطن جديد', where: 'سجل المواطنين', button: '«إضافة ملف مواطن»' },
  { id: 'to-editor', combo: { code: 'Enter', ctrl: true }, keys: 'Ctrl+Enter', label: 'إدراج المواطن في محرّر الكتب', where: 'سجل المواطنين', button: '«إدراج في محرر الكتب»' },
  { id: 'field', combo: { code: 'F4' }, keys: 'F4', label: 'اجعل النصّ المظلَّل حقلًا', where: 'محرّر الكتل', button: '«اجعل المظلَّل متغيّرًا»' },
  { id: 'bold', combo: { code: 'KeyB', ctrl: true }, keys: 'Ctrl+B', label: 'عريض', where: 'محرّر الكتل', button: 'زرّ العريض' },
  { id: 'underline', combo: { code: 'KeyU', ctrl: true }, keys: 'Ctrl+U', label: 'تسطير', where: 'محرّر الكتل', button: 'زرّ التسطير' },
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
