import type { Database } from 'better-sqlite3';

/**
 * إعدادات الاتصال بالقاعدة — في ملفٍّ بلا Electron ليُختبر.
 *
 * **synchronous = FULL لا NORMAL** (خطة Production، ١٫٢). في وضع WAL مع NORMAL قد يُلغى بعد
 * انقطاع الكهرباء أو انهيار النظام قيدٌ تمّ — بنصّ وثائق SQLite — وقد طُبعت ورقته، فيعود رقمه
 * لكتابٍ بعده: ورقتان برقمٍ واحد، وهو ما يعد البرنامج ألّا يقع (FOUNDATION §١٥). وقتلُ العملية
 * لا يكشفه — ذاكرة القرص المؤقّتة تبقى معه — فلا يظهر إلا بانقطاعٍ حقيقي.
 *
 * والكلفة مزامنةٌ للقرص مع كلّ قيد، والدفعة كلّها قيدٌ واحد. قيس على NVMe (٢ تشرين الأول ٢٠٢٦):
 * الكتاب الواحد من نحو ١٫٥ م.ث إلى ٢٫٦–٤٫٥، ودفعة مئة اسم بلا فرقٍ يُذكر. والقرص الدوّار يُقاس
 * على جهاز مكتب.
 */
export function configureConnection(db: Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456');
}
