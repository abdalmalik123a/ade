import type { Database } from 'better-sqlite3';

/**
 * مراجع ملفّات المخزن: أيستعمل سجلٌّ ملفًّا قبل أن يُحذف من القرص؟
 *
 * المخزن يسمّي الملف ببصمته (`ipc/files.ts`)، فالبايتات المتطابقة مسارٌ واحد: بطاقة سكن
 * العائلة مستمسكٌ للأب وللأمّ بملفٍّ واحد، والصورة الشخصية قد تكون صورةً في تصميم. فكان
 * حذفُ مستمسكٍ يحذف ملفّ غيره، ويبقى سجلّه يشير إلى لا شيء (خطة Production، ١٫١).
 *
 * فالملفّ يُحذف إن لم يبقَ له مرجعٌ في القاعدة — بعد حذف سجلّه لا قبله. وما يُظنّ مرجعًا
 * وليس كذلك (مسارٌ في نصٍّ عابر) يُبقي الملفّ: ملفٌّ زائد أهون من مستمسكٍ ضائع.
 */

/** أعمدةٌ تحمل المسار كما هو. */
const EXACT: [table: string, column: string][] = [
  ['attachments', 'file_path'],
  ['citizens', 'photo_path'],
  ['seals', 'image_path']
];

/** أعمدةٌ نصّية يرد فيها المسار داخل JSON أو علامات الورقة (`diwan://store/…`). */
const WITHIN: [table: string, column: string][] = [
  ['settings', 'value'],
  ['templates', 'doc_json'],
  ['templates', 'body_html'],
  ['letterheads', 'layout_json'],
  ['drafts', 'values_json'],
  ['drafts', 'body_html'],
  ['question_bank', 'item_json'],
  ['revisions', 'payload'],
  ['documents', 'body_html']
];

function hasColumn(db: Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

/** أيذكر سجلٌّ في القاعدة هذا الملفّ؟ والجدول أو العمود الغائب (قاعدةٌ أقدم) يُتخطّى. */
export function storeFileInUse(db: Database, relativePath: string): boolean {
  for (const [table, column] of EXACT) {
    if (!hasColumn(db, table, column)) continue;
    if (db.prepare(`SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT 1`).get(relativePath)) return true;
  }
  for (const [table, column] of WITHIN) {
    if (!hasColumn(db, table, column)) continue;
    // instr لا LIKE: المسار قد يحمل «_» فيصير في LIKE حرفًا أيًّا كان.
    if (db.prepare(`SELECT 1 FROM ${table} WHERE instr(${column}, ?) > 0 LIMIT 1`).get(relativePath)) return true;
  }
  return false;
}

/** ما يُحذف من القرص فعلًا: المسارات التي لم يبقَ لها مرجع — بعد حذف سجلّها. */
export function unreferenced(db: Database, paths: (string | null | undefined)[]): string[] {
  return [...new Set(paths.filter((p): p is string => Boolean(p)))].filter((p) => !storeFileInUse(db, p));
}
