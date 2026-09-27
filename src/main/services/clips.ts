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
import { ADDRESSING, guessAddressing } from '@shared/addressing';
import type { Addressing, Clip, RevisionPayloads } from '@shared/api';
import { forgetRevisions, prepareIdentity, recordRevision, stampNew } from './revisions';
import { prepareLearning } from './learning';

export type { Clip };

const SELECT = 'SELECT id, title, body, category, used_at AS usedAt, direction, revision FROM clips';
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
  const cols = (db.prepare('PRAGMA table_info(clips)').all() as { name: string }[]).map((c) => c.name);
  // اتجاه المخاطبة: لمن تُكتب العبارة (FOUNDATION §٦). عدمٌ = لأيٍّ منها.
  if (!cols.includes('direction')) db.exec('ALTER TABLE clips ADD COLUMN direction TEXT');
  prepareIdentity(db, 'clip');
}

const asDirection = (v: unknown): Addressing | null =>
  ADDRESSING.includes(v as Addressing) ? (v as Addressing) : null;

export function listClips(db: Database, query = ''): Clip[] {
  prepareClips(db);
  const q = normalizeFold(query);
  if (!q) return db.prepare(`${SELECT} ${ORDER}`).all() as Clip[];
  // الكليشات عشرات، فالمسح على العمود المطبَّع أبسط من فهرس وأكفأ منه هنا.
  return db.prepare(`${SELECT} WHERE search_fold LIKE ? ${ORDER}`).all(`%${q}%`) as Clip[];
}

/** ما يُحفظ في نسخ الكليشة — ما يُحرَّر منها. */
function clipPayload(c: Pick<Clip, 'title' | 'body' | 'category' | 'direction'>): RevisionPayloads['clip'] {
  return { title: c.title, body: c.body, category: c.category, direction: c.direction };
}

export function saveClip(
  db: Database,
  input: {
    id: number | null;
    title: string;
    body: string;
    category?: string | null;
    /** غائبٌ = يُخمَّن من أفعال العبارة؛ وعدمٌ صريح = لأيّ اتجاه. */
    direction?: Addressing | null;
  }
): Clip {
  prepareClips(db);
  const title = input.title.trim();
  if (!title) throw new Error('سمِّ الكليشة أولًا');
  if (!input.body.trim()) throw new Error('لا تُحفظ كليشة فارغة');

  const category = input.category?.trim() || null;
  const direction = input.direction === undefined ? guessAddressing(input.body) : asDirection(input.direction);
  const fold = normalizeFold([title, category ?? '', input.body].join(' '));

  const id = db.transaction(() => {
    if (input.id === null) {
      const info = db
        .prepare('INSERT INTO clips (title, body, category, direction, search_fold) VALUES (?, ?, ?, ?, ?)')
        .run(title, input.body, category, direction, fold);
      const id = Number(info.lastInsertRowid);
      stampNew(db, 'clip', id);
      return id;
    }
    const before = db.prepare(`${SELECT} WHERE id = ?`).get(input.id) as Clip | undefined;
    if (before) recordRevision(db, 'clip', input.id, clipPayload(before), clipPayload({ title, body: input.body, category, direction }));
    db.prepare('UPDATE clips SET title = ?, body = ?, category = ?, direction = ?, search_fold = ? WHERE id = ?').run(
      title,
      input.body,
      category,
      direction,
      fold,
      input.id
    );
    return input.id;
  })();
  return db.prepare(`${SELECT} WHERE id = ?`).get(id) as Clip;
}

export function deleteClip(db: Database, id: number): void {
  prepareClips(db);
  forgetRevisions(db, 'clip', id);
  db.prepare('DELETE FROM clips WHERE id = ?').run(id);
}

/** تُستدعى عند الإدراج — عليها يقوم ترتيب المكتبة. */
export function touchClip(db: Database, id: number): void {
  prepareClips(db);
  db.prepare("UPDATE clips SET used_at = datetime('now') WHERE id = ?").run(id);
}

/**
 * الفقرة التي تتكرّر حرفيًّا في الكتب الصادرة — يُقترح حفظها كليشة (د١٢، FOUNDATION §٦:
 * «وأي فقرةٍ تتكرّر يُقترح حفظها كليشة»).
 *
 * تُعدّ الكتب التي فيها الفقرة نفسها (مطويّةً — «أحمد» و«احمد» واحد)، والكتاب الجاري
 * منها؛ ولا تُقترح فقرةٌ قصيرة (سطرٌ عابر)، ولا ما صار كليشةً، ولا ما رفض الموظف
 * حفظه من قبل (يُقيَّد رفضه في التصحيحات). والفقرة بأسماء أصحابها لا تتكرّر حرفيًّا —
 * فما يتكرّر هو الصياغة وحدها.
 */
export function repeatedParagraphs(
  db: Database,
  paragraphs: string[],
  minTimes = 3
): { text: string; count: number }[] {
  prepareClips(db);
  prepareLearning(db);
  const clips = (db.prepare('SELECT search_fold AS f FROM clips').all() as { f: string | null }[]).map((r) => r.f ?? '');
  const rejected = new Set(
    (
      db
        .prepare("SELECT input FROM corrections WHERE kind = 'clip' AND chosen = 'reject'")
        .all() as { input: string }[]
    ).map((r) => r.input)
  );
  const count = db.prepare("SELECT COUNT(*) AS n FROM documents WHERE search_fold LIKE ? ESCAPE '!'");
  const seen = new Set<string>();
  const out: { text: string; count: number }[] = [];
  for (const raw of paragraphs) {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (text.length < 40 || text.length > 600) continue;
    const folded = normalizeFold(text);
    if (seen.has(folded)) continue;
    seen.add(folded);
    if (rejected.has(folded.slice(0, 200))) continue;
    if (clips.some((c) => c.includes(folded))) continue;
    // «%» و«_» في الفقرة حرفان لا نمطان — يُهرَّبان بـ«!» (حرف الهروب في السؤال).
    const n = (count.get(`%${folded.replace(/[%_!]/g, (m) => `!${m}`)}%`) as { n: number }).n;
    if (n >= minTimes) out.push({ text, count: n });
  }
  return out.slice(0, 3);
}
