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
export const CHANNELS: readonly { key: 'telegram' | 'youtube' | 'whatsapp' | 'facebook'; label: string; icon: string; url: string }[] = [
  { key: 'telegram', label: 'تيليجرام', icon: 'send', url: 'https://t.me/MadaTechDev' },
  { key: 'youtube', label: 'يوتيوب', icon: 'smart_display', url: 'https://www.youtube.com/@MadaTechDev' },
  { key: 'whatsapp', label: 'قناة واتساب', icon: 'chat', url: 'https://whatsapp.com/channel/0029Vb8MXnI47Xe4ggEiCC2S' },
  { key: 'facebook', label: 'فيسبوك', icon: 'thumb_up', url: 'https://web.facebook.com/profile.php?id=61595170464546' }
];

export const channels = () => CHANNELS.filter((c) => /^https:\/\//.test(c.url));
