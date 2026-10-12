/**
 * المفتاح العامّ للمالك (Ed25519) — به يتحقّق البرنامج من مفاتيح التفعيل. صنعته tools/license/keygen.mjs init
 * يوم 2026-10-02؛ والخاصّ عند المالك وحده خارج المشروع. لا يُغيَّر إلا بإصدارٍ جديد: ما صدر بغيره لا يعمل به.
 * (`tools/keytool/sync-key.mjs` يقرأ أوّل مفتاحٍ في هذا الملفّ — فيبقى هذا أوّلها.)
 */
export const OWNER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAjot17nFrxaRBd7wB8jngq+NgOj0j8UShdkXVaqtNR6U=
-----END PUBLIC KEY-----`;

/**
 * مفتاح التحديث العامّ (البند ٣٣) — صنعه المالك بأداة المفاتيح ١٫٢٫٠ يوم 2026-10-12 وأرسل عامَّه؛ والخاصّ مشفّرٌ بكلمته في
 * مجلّده. به وحده تُقبل ملفّات التحديث من الإصدار 1.7.2. (`sync-key.mjs` يقرأ ما يلي اسمه.)
 */
export const OWNER_UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEADV78fgCqfoPjuBJOIb54M9E/+Aj3pRpGpqHFCGxF78I=
-----END PUBLIC KEY-----`;

/** دور المفتاح (و١٠): `license` لمفاتيح التفعيل، و`update` لملفّات التحديث، و`both` لهما. */
export type OwnerKeyRole = 'license' | 'update' | 'both';
export type OwnerKey = { id: string; role: OwnerKeyRole; publicKey: string };

/**
 * مفاتيح المالك العامّة بأدوارها (و١٠، البند ٣٣) — **مفصولة**: الأوّل للتفعيل وحده، ومفتاح التحديث للتحديث وحده؛ فإن تسرّب
 * أحدهما لم يُغنِ عن الآخر.
 *
 * - **الأوّل صار `license`** (كان `both`): به صدرت كلّ مفاتيح التفعيل فتبقى تعمل. ولا يُقبل به تحديثٌ بعد اليوم — وملفّات
 *   التحديث من أداة المفاتيح ١٫٢٫٠ بتوقيعين (`signature` به للإصدارات حتى 1.7.1، و`signatures` بمفتاح التحديث لما بعدها).
 * - **مفتاح التحديث** `update`.
 *
 * وخطأٌ هنا يعطّل التفعيل والتحديث عند كلّ المكاتب — فالقائمة محروسةٌ ببصمةٍ في `tests/license.test.ts` تفشل عند أيّ تعديلٍ
 * غير مقصود. ولا بادئة سياقٍ لتوقيع التحديث: الإصدارات القديمة تتحقّق بلا بادئة، وصيغتا التوقيع منفصلتان أصلًا (المفتاح نصّ
 * base64url والتحديث JSON).
 */
export const OWNER_KEYS: readonly OwnerKey[] = [
  { id: 'owner-2026-10-02', role: 'license', publicKey: OWNER_PUBLIC_KEY },
  { id: 'update-2026-10-12', role: 'update', publicKey: OWNER_UPDATE_PUBLIC_KEY }
];

/** المفاتيح العامّة المقبولة لعملٍ: التفعيل (`license|both`) أو التحديث (`update|both`). */
export function keysFor(role: 'license' | 'update', keys: readonly OwnerKey[] = OWNER_KEYS): string[] {
  return keys.filter((k) => k.role === role || k.role === 'both').map((k) => k.publicKey);
}
