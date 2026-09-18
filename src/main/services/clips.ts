/**
 * الكليشات — مكتبة عبارات المكتب.
 *
 * في عُرف الدوائر، متن الكتاب يُسمّى «الكليشة»، والموظف الأقدم هو من يملك خبرة
 * تأليفها. والدوائر لا تكتب كتبًا — تعيد استعمال كليشات.
 *
 * **وتبدأ فارغة** (مبدأ ١): تُبنى بالاستعمال أو تُستورد من ملفات المكتب، ولا
 * عبارة مبرمَجة. والترتيب بآخر استعمال: ما يُدرج كل يوم يتصدّر بلا أن يصنّف.
 */
import type { Database } from 'better-sqlite3';
import { normalizeFold } from '@shared/arabic';

export type Clip = {
  id: number;
  title: string;
  body: string;
  category: string | null;
  usedAt: string | null;
};

const SELECT = 'SELECT id, title, body, category, used_at AS usedAt FROM clips';
const ORDER = "ORDER BY COALESCE(used_at, '') DESC, id DESC";

/** جدول الكليشات يُنشأ عند الحاجة — الترحيل هنا ليعمل على قواعد قائمة. */
export function prepareClips(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS clips (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    category    TEXT,
    used_at     TEXT,
    search_fold TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS ix_clips_fold ON clips(search_fold)');
}

export function listClips(db: Database, query = ''): Clip[] {
  prepareClips(db);
  const q = normalizeFold(query);
  if (!q) return db.prepare(`${SELECT} ${ORDER}`).all() as Clip[];
  // الكليشات عشرات، فالمسح على العمود المطبَّع أبسط من فهرس وأكفأ منه هنا.
  return db.prepare(`${SELECT} WHERE search_fold LIKE ? ${ORDER}`).all(`%${q}%`) as Clip[];
}

export function saveClip(
  db: Database,
  input: { id: number | null; title: string; body: string; category?: string | null }
): Clip {
  prepareClips(db);
  const title = input.title.trim();
  if (!title) throw new Error('سمِّ الكليشة أولًا');
  if (!input.body.trim()) throw new Error('لا تُحفظ كليشة فارغة');

  const category = input.category?.trim() || null;
  const fold = normalizeFold([title, category ?? '', input.body].join(' '));

  let id = input.id;
  if (id === null) {
    const info = db
      .prepare('INSERT INTO clips (title, body, category, search_fold) VALUES (?, ?, ?, ?)')
      .run(title, input.body, category, fold);
    id = Number(info.lastInsertRowid);
  } else {
    db.prepare('UPDATE clips SET title = ?, body = ?, category = ?, search_fold = ? WHERE id = ?').run(
      title,
      input.body,
      category,
      fold,
      id
    );
  }
  return db.prepare(`${SELECT} WHERE id = ?`).get(id) as Clip;
}

export function deleteClip(db: Database, id: number): void {
  prepareClips(db);
  db.prepare('DELETE FROM clips WHERE id = ?').run(id);
}

/** تُستدعى عند الإدراج — عليها يقوم ترتيب المكتبة. */
export function touchClip(db: Database, id: number): void {
  prepareClips(db);
  db.prepare("UPDATE clips SET used_at = datetime('now') WHERE id = ?").run(id);
}
