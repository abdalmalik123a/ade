/**
 * هويّة البرنامج ومطوّره (قرار المالك ٢٩ أيلول ٢٠٢٦) — في مكانٍ واحد: «عن البرنامج»، وشريط المدّة
 * التجريبية، و«التفعيل»، ورسائل ما يتوقّف بعدها.
 */
export const DEVELOPER = {
  nameAr: 'عبدالملك عواد ابو جنيد',
  nameEn: 'Abdulmalik Awad Abu Junaid',
  company: 'MADA TECH',
  /** واتساب واتصال. */
  phone: '+9647819154368',
  phoneDisplay: '+964 781 915 4368',
  whatsapp: 'https://wa.me/9647819154368'
} as const;

/**
 * «قنواتنا» (قرار المالك ٢ تشرين الأول ٢٠٢٦): قنوات المطوّر الرسمية تُفتح في متصفّح الجهاز — والبرنامج نفسه
 * لا يتّصل. ما بقي فارغًا لا يُعرض؛ والزرّ كلّه يظهر حين يُملأ رابطٌ واحد.
 */
export const CHANNELS: readonly { key: 'telegram' | 'youtube' | 'whatsapp'; label: string; url: string }[] = [
  { key: 'telegram', label: 'تيليجرام', url: '' },
  { key: 'youtube', label: 'يوتيوب', url: '' },
  { key: 'whatsapp', label: 'قناة واتساب', url: '' }
];

export const channels = () => CHANNELS.filter((c) => /^https:\/\//.test(c.url));
