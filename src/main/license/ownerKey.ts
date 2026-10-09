/**
 * المفتاح العامّ للمالك (Ed25519) — به يتحقّق البرنامج من مفاتيح التفعيل. صنعته tools/license/keygen.mjs init
 * يوم 2026-10-02؛ والخاصّ عند المالك وحده خارج المشروع. لا يُغيَّر إلا بإصدارٍ جديد: ما صدر بغيره لا يعمل به.
 * (`tools/keytool/sync-key.mjs` يقرأ أوّل مفتاحٍ في هذا الملفّ — فيبقى هذا أوّلها.)
 */
export const OWNER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAjot17nFrxaRBd7wB8jngq+NgOj0j8UShdkXVaqtNR6U=
-----END PUBLIC KEY-----`;

/** دور المفتاح (و١٠): `license` لمفاتيح التفعيل، و`update` لملفّات التحديث، و`both` لهما. */
export type OwnerKeyRole = 'license' | 'update' | 'both';
export type OwnerKey = { id: string; role: OwnerKeyRole; publicKey: string };

/**
 * مفاتيح المالك العامّة بأدوارها (و١٠) — فيُفصل مفتاح التحديث عن مفتاح التراخيص قبل أوّل نسخةٍ تُسلَّم لمكتب.
 *
 * **الأوّل يبقى `both`**: به صدرت كلّ المفاتيح وكلّ تحديثٍ قائم، فلا يبطل منها شيء. ومفتاح التحديث الثاني يولّده
 * المالك بيده (لا يُولَّد على مجلّده آليًّا) ثم يُضاف هنا بدوره `update` في إصدارٍ جديد. وخطأٌ هنا يعطّل التفعيل
 * والتحديث عند كلّ المكاتب — فالقائمة محروسةٌ ببصمةٍ في `tests/license.test.ts` تفشل عند أيّ تعديلٍ غير مقصود.
 *
 * ولا بادئة سياقٍ لتوقيع التحديث الآن: المكاتب على 1.2.0 تتحقّق من التوقيع بلا بادئة، فملفّ تحديثٍ موقَّعٌ بها
 * لا يُثبَّت عندها. وصيغتا التوقيع منفصلتان أصلًا: المفتاح نصّ base64url والتحديث JSON — فلا يصلح أحدهما للآخر.
 */
export const OWNER_KEYS: readonly OwnerKey[] = [{ id: 'owner-2026-10-02', role: 'both', publicKey: OWNER_PUBLIC_KEY }];

/** المفاتيح العامّة المقبولة لعملٍ: التفعيل (`license|both`) أو التحديث (`update|both`). */
export function keysFor(role: 'license' | 'update', keys: readonly OwnerKey[] = OWNER_KEYS): string[] {
  return keys.filter((k) => k.role === role || k.role === 'both').map((k) => k.publicKey);
}
