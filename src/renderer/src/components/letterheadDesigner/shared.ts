/**
 * ثوابت مصمّم الترويسة المشتركة بين أجزائه: أنواع الكتل، والمحاذاة، وعدد الأقسام وأسماؤها ومواضعها (تقسيمه بعد ١٫٧٫٠) — منقولةٌ
 * من `LetterheadDesigner` كما هي.
 */
import type { BlockKind, Align, ColumnCount } from '@shared/letterhead';

export const KIND_META: { kind: BlockKind; icon: string; label: string }[] = [
  { kind: 'text', icon: 'title', label: 'سطر نصّي' },
  { kind: 'image', icon: 'image', label: 'شعار أو صورة' },
  { kind: 'field', icon: 'data_object', label: 'حقل تلقائي' },
  { kind: 'divider', icon: 'horizontal_rule', label: 'خط فاصل' },
  { kind: 'spacer', icon: 'height', label: 'فراغ' }
];

export const ALIGN_META: { value: Align; icon: string; title: string }[] = [
  { value: 'right', icon: 'format_align_right', title: 'يمين' },
  { value: 'center', icon: 'format_align_center', title: 'وسط' },
  { value: 'left', icon: 'format_align_left', title: 'يسار' }
];

export const COLUMN_CHOICES: { value: ColumnCount; label: string; hint: string }[] = [
  { value: 1, label: 'قسم واحد', hint: 'بعرض الورقة' },
  { value: 2, label: 'قسمان', hint: 'يمين ويسار' },
  { value: 3, label: 'ثلاثة أقسام', hint: 'يمين ووسط ويسار' }
];

export const SECTION_NAMES = ['القسم الأول', 'القسم الثاني', 'القسم الثالث'];

export function sectionPlace(index: number, columns: ColumnCount): string {
  if (columns === 1) return 'بعرض الورقة';
  if (index === 0) return 'يمين الورقة';
  if (index === columns - 1) return 'يسار الورقة';
  return 'وسط الورقة';
}
