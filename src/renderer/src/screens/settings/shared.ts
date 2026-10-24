/**
 * ثوابت شاشة الإعدادات المشتركة بين أجزائها: إزاحة الهجري، وصنف خانة الإدخال (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `SettingsScreen` كما هي.
 */

/** إزاحة الهجري بالأيام — يُختار منها ما يطابق ما أُعلن في العراق. */
export const HIJRI_OFFSETS = [-2, -1, 0, 1, 2] as const;

export const input =
  'input-field w-full h-10 px-3 text-on-surface font-label-md text-label-md';
