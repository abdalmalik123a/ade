/**
 * قائمة النقر بالزرّ الأيمن (د٦): ما يُعرض بحسب موضع النقر — والقائمة الأصلية نفسها لا تُرى عبر البروتوكول،
 * فتُجرَّب يدويًّا (قائمة الأجهزة).
 */
import { describe, expect, it } from 'vitest';
import { contextMenuItems, type MenuParams } from '../src/main/contextMenu';

const flags = { canCut: true, canCopy: true, canPaste: true, canSelectAll: true };
const at = (p: Partial<MenuParams>): MenuParams => ({ isEditable: false, selectionText: '', editFlags: flags, ...p });
const roles = (p: Partial<MenuParams>) => contextMenuItems(at(p)).map((i) => i.role);

describe('قائمة النقر بالزرّ الأيمن', () => {
  it('في حقلٍ فيه تحديد: قصّ ونسخ ولصق وتحديد الكلّ', () => {
    expect(roles({ isEditable: true, selectionText: 'سالم' })).toEqual(['cut', 'copy', 'paste', 'selectAll']);
  });

  it('في حقلٍ فارغ التحديد: لصق وتحديد الكلّ — لا قصّ ولا نسخ لشيء', () => {
    expect(roles({ isEditable: true })).toEqual(['paste', 'selectAll']);
  });

  it('على نصٍّ محدّد لا يُكتب فيه: نسخ وتحديد الكلّ — لا قصّ ولا لصق', () => {
    expect(roles({ selectionText: 'تأييد' })).toEqual(['copy', 'selectAll']);
  });

  it('والتحديد بالمسافات وحدها ليس تحديدًا', () => {
    expect(roles({ selectionText: '   ' })).toEqual(['selectAll']);
  });

  it('بالعربية، ولا «فحص العنصر» ولا أدوات المطوّر', () => {
    const items = contextMenuItems(at({ isEditable: true, selectionText: 'x' }));
    expect(items.map((i) => i.label)).toEqual(['قصّ', 'نسخ', 'لصق', 'تحديد الكلّ']);
    expect(items.some((i) => /inspect|فحص|devtools/i.test(`${i.role} ${i.label}`))).toBe(false);
  });

  it('وما لا يقدر عليه الحقل يُعرض معطّلًا (لصقٌ والحافظة فارغة)', () => {
    const paste = contextMenuItems(at({ isEditable: true, editFlags: { ...flags, canPaste: false } })).find((i) => i.role === 'paste');
    expect(paste?.enabled).toBe(false);
  });
});
