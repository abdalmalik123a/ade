/**
 * قائمة النقر بالزرّ الأيمن (د٦): قصّ ونسخ ولصق وتحديد الكلّ بالعربية — وكانت القائمة غائبة كلّها في المثبّت،
 * فمن اعتاد اللصق بالزرّ الأيمن من Word لا يجد شيئًا. ولا «فحص العنصر» ولا أدوات المطوّر.
 *
 * والقالب دالّةٌ خالصة (بلا Electron) تُختبر بوحدة؛ و`harden.ts` يبني منها القائمة الأصلية ويعرضها.
 */

/** ما يلزم من `ContextMenuParams` في Electron. */
export type MenuParams = {
  isEditable: boolean;
  selectionText: string;
  editFlags: { canCut: boolean; canCopy: boolean; canPaste: boolean; canSelectAll: boolean };
};

export type MenuItem = { role: 'cut' | 'copy' | 'paste' | 'selectAll'; label: string; enabled: boolean };

/**
 * العناصر بحسب موضع النقر: «قصّ» في حقلٍ فيه تحديد، و«نسخ» حيث يوجد تحديد، و«لصق» في حقلٍ يُكتب فيه،
 * و«تحديد الكلّ» دائمًا. وما لا يصلح لموضعه لا يُعرض أصلًا — قائمةٌ قصيرة لا عناصر معطّلة.
 */
export function contextMenuItems(p: MenuParams): MenuItem[] {
  const selected = p.selectionText.trim() !== '';
  const items: MenuItem[] = [];
  if (p.isEditable && selected) items.push({ role: 'cut', label: 'قصّ', enabled: p.editFlags.canCut });
  if (selected) items.push({ role: 'copy', label: 'نسخ', enabled: p.editFlags.canCopy });
  if (p.isEditable) items.push({ role: 'paste', label: 'لصق', enabled: p.editFlags.canPaste });
  items.push({ role: 'selectAll', label: 'تحديد الكلّ', enabled: p.editFlags.canSelectAll });
  return items;
}
