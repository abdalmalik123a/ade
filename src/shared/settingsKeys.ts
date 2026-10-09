/**
 * ما يُحفظ من «الإعدادات» عبر `settings:set` (و٣): حقول `OfficeSettings` وحدها — من قائمةٍ واحدة.
 *
 * وكانت القناة تكتب أيّ مفتاحٍ يصلها في جدول الإعدادات نفسه الذي فيه ما لا تملكه الواجهة: `appVersion` مرتفعةٌ تقفل
 * الإقلاع بعد حارس إصدار البيانات، و`licenseKeys` ليست JSON توقف الإصدار. ومفتاحٌ ناقص من القائمة يجعل إعدادًا لا
 * يُحفظ — فحقلٌ جديد في `OfficeSettings` بلا مفتاحٍ هنا لا يُبنى (`SETTING_KEYS_COMPLETE`).
 */
import type { OfficeSettings } from './api';

export const OFFICE_SETTING_KEYS = [
  'officeName',
  'officePhone',
  'officeAddress',
  'operatorName',
  'defaultPrinter',
  'printRoles',
  'serialPrefix',
  'serialYear',
  'uiScale',
  'onboarded',
  'printOffsets',
  'basmala',
  'lastBackupAt',
  'hijriOffset',
  'counterCards',
  'schoolFiles',
  'receiptSlip'
] as const satisfies readonly (keyof OfficeSettings)[];

/** حقلٌ في `OfficeSettings` ليس في القائمة يجعل هذا السطر خطأً يسمّي الحقل — فلا يُنسى. */
type Missing = Exclude<keyof OfficeSettings, (typeof OFFICE_SETTING_KEYS)[number]>;
export const SETTING_KEYS_COMPLETE: [Missing] extends [never] ? true : Missing = true;

const ALLOWED = new Set<string>(OFFICE_SETTING_KEYS);

/** ما يصل القناة: كائنٌ مفاتيحه من القائمة — وما سواه يُرفض كلّه بعربية، فلا يُكتب نصفه. */
export function assertSettingsPatch(patch: unknown): asserts patch is Partial<OfficeSettings> {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('الإعدادات لم تصل كما ينبغي — لم يُحفظ شيء');
  const unknown = Object.keys(patch).filter((k) => !ALLOWED.has(k));
  if (unknown.length) throw new Error(`«${unknown.join('»، «')}» ليس من إعدادات المكتب — لم يُحفظ شيء`);
}
