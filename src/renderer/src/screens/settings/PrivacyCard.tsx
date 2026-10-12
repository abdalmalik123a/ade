/**
 * بطاقة الخصوصية في الإعدادات: أين البيانات وما يُحفظ (تقسيم الإعدادات بعد ١٫٧٫٠) — منقولةٌ من `SettingsScreen` كما هي.
 */

type Props = {
  card: string;
  title: (icon: string, text: string) => JSX.Element;
  info: { version: string; dataDir: string; } | null;
};

export default function PrivacyCard({ card, title, info }: Props) {
  return (
    <section className={card} data-privacy="">
      {title('shield_lock', 'سياسة الخصوصية')}
      <ul className="font-body-sm text-body-sm text-on-surface flex flex-col gap-space-xs list-disc pr-5 leading-7">
        <li>
          <b>البيانات كلّها على هذا الجهاز</b>، في مجلّد واحد:{' '}
          <span className="font-mono text-label-sm break-all" dir="ltr">
            {info?.dataDir ?? '…'}
          </span>
        </li>
        <li>
          <b>البرنامج لا يتّصل بالإنترنت أبدًا</b>: لا حساب، ولا خدمة، ولا تحديث تلقائي، ولا يُرسَل شيءٌ إلى
          أحد.
        </li>
        <li>
          يُحفظ فيه: النماذج والترويسات والكليشات، وسجلّ الكتب الصادرة، وسجلّ المواطنين ومستمسكاتهم الممسوحة،
          والطلبات والجهات والتصاميم.
        </li>
        <li>
          <b>الكتاب الصادر لا يُحذف</b>: هو قيدٌ في الأرشيف ببصمته. وحذف مواطنٍ يحذف مستمسكاته الممسوحة من
          المخزن، وتبقى الكتب التي صدرت باسمه شاهدًا.
        </li>
        <li>
          <b>النسخة الاحتياطية تحوي ذلك كلّه</b> — ومنه صور المستمسكات — وهي غير مشفّرة: احفظها في مكانٍ
          آمن، ولا تتركها على ذاكرةٍ يتداولها الناس.
        </li>
        <li>من يستعمل هذا الجهاز يرى بياناته: احمِ حساب ويندوز بكلمة مرور، وأقفله حين تبتعد.</li>
      </ul>
    </section>
  );
}
