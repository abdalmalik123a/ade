/**
 * ترقيات القاعدة المرقّمة (A02، D49): القاعدة تحمل مستوى ترقيتها في `PRAGMA user_version`، وهذه القائمة وحدها تقول
 * ما بعده — تجري خطواتها الناقصة مرّةً بترتيبها داخل معاملة الإقلاع (`runBootSequence`) وبعد الاسترجاع (`reopen`).
 *
 * **ترقيةٌ جديدة = سطرٌ برقمه التالي، ولا يُعدَّل سطرٌ قديم ولا يُعاد ترقيمه:** قاعدةٌ بلغت مستوًى لا تجري ما تحته ثانيةً،
 * فتعديل سطرٍ قديم لا يبلغ مكتبًا رُقّي قبله، وإعادة ترقيمه تُجري ما جرى أو تُسقط ما لم يجرِ.
 *
 * والخطوات ١–٩ خطّ أساس: تلفّ دوالّ `prepare*`/`ensure*` القائمة كما هي — تفحص قبل أن تضيف، فتمرّ على قاعدة كلّ إصدارٍ
 * من ١٫٠٫٠ إلى ١٫٨٫٠ (مستواها صفر). ونداءاتها عند الطلب في خدماتها باقيةٌ حتى يثبت المشغّل بإصدار (A17).
 *
 * ولا معاملة هنا: معاملة النادي تحمله، فإن رمت خطوةٌ تراجع كلّ ما قبلها معها ومنه رقم المستوى.
 */
import type { Database } from 'better-sqlite3';
import { ensureSearchColumn } from '../services/citizens';
import { prepareClients } from '../services/clients';
import { prepareClips } from '../services/clips';
import { prepareDocuments } from '../services/documents';
import { prepareGenderMemory } from '../services/genderMemory';
import { prepareLearning } from '../services/learning';
import { prepareLetterheads } from '../services/letterheads';
import { prepareOrders } from '../services/orders';
import { prepareTemplates } from '../services/templates';

export type Migration = { n: number; name: string; up: (db: Database) => void };

export const MIGRATIONS: readonly Migration[] = [
  { n: 1, name: 'الكتب: البحث واللقطة والترويسة والمعاملة والإبطال والسلسلة والأنماط', up: prepareDocuments },
  // ومعه خانات الاستمارات (`ensureCitizenColumns`) من داخله.
  { n: 2, name: 'الزبائن: خانات الاستمارات وعمود البحث', up: ensureSearchColumn },
  { n: 3, name: 'الجهات: ملفّ الجهة وطقمها', up: prepareClients },
  { n: 4, name: 'الطلبات: ما تُرك عندنا والزبون الفرد', up: prepareOrders },
  // و`prepareIdentity` (سجلّ النسخ وعمودا الهويّة) تجري من داخل ٥ و٦ و٧.
  { n: 5, name: 'النماذج: الوثيقة وطريقة الإصدار', up: prepareTemplates },
  { n: 6, name: 'الترويسات: أعمدة المكتبة', up: prepareLetterheads },
  { n: 7, name: 'الكليشات: الجدول واتجاه المخاطبة', up: prepareClips },
  { n: 8, name: 'التعلّم: جدول التصحيحات', up: prepareLearning },
  { n: 9, name: 'التذكير والتأنيث: ذاكرة الأسماء', up: prepareGenderMemory }
];

export const NEWER_SCHEMA = 'قاعدة البيانات من إصدارٍ أحدث من هذا البرنامج';

/** مستوى الترقية المكتوب في القاعدة — وصفرٌ لقاعدةٍ قبل المشغّل. */
export function schemaLevel(db: Database): number {
  return db.pragma('user_version', { simple: true }) as number;
}

/** يجري ما فوق مستوى القاعدة بترتيبه، ويكتب رقم كلّ خطوةٍ بعدها — ويعيد المستوى الذي بلغته. */
export function runMigrations(db: Database, list: readonly Migration[] = MIGRATIONS): number {
  const at = schemaLevel(db);
  const last = list.at(-1)?.n ?? 0;
  if (at > last) throw new Error(NEWER_SCHEMA);
  for (const m of list) {
    if (m.n <= at) continue;
    m.up(db);
    db.pragma(`user_version = ${m.n}`);
  }
  return Math.max(at, last);
}
