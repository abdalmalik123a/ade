/**
 * ثوابت شاشة الأرشيف المشتركة بين أجزائها: أعمدة الجدول، وتنسيق الأرقام، والمدد (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `ArchiveScreen` كما هي.
 */

export const COLUMNS = ['رقم الصادر', 'صاحب العلاقة', 'نوع الكتاب', 'الجهة', 'التاريخ والنسخ'];

export const nf = new Intl.NumberFormat('en-US');

export type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'year', label: 'هذه السنة' },
  { value: 'all', label: 'كامل الأرشيف' },
  { value: 'custom', label: 'مدة مخصّصة' }
];
