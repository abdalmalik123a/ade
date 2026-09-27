import type { Database } from 'better-sqlite3';
import {
  emptyLayout,
  layoutText,
  normalizeLayout,
  type Letterhead,
  type LetterheadLayout
} from '@shared/letterhead';
import { normalizeFold } from '@shared/arabic';
import type { RevisionPayloads, Seal } from '@shared/api';
import { forgetRevisions, prepareIdentity, recordRevision, stampNew } from './revisions';

/**
 * منطق الترويسات والأختام — دوالّ نقيّة تأخذ الاتصال وسيطًا،
 * فيمكن اختبارها بقاعدة في الذاكرة دون تشغيل Electron.
 */

type Row = {
  id: number;
  name: string;
  authority_id: number | null;
  layout_json: string;
  is_default: number;
  category: string | null;
  is_favorite: number;
  used_at: string | null;
  revision: number;
};

const SELECT = `SELECT id, name, authority_id, layout_json, is_default,
  category, is_favorite, used_at, revision FROM letterheads`;

/**
 * ترتيب القائمة: المفضّلة أولًا، ثم الأحدث استعمالًا.
 *
 * المكتب الذي يخدم التربية يرى ترويسة التربية في الأعلى بلا أن يصنّف شيئًا —
 * والترتيب الأبجدي يدفن ما يُستعمل كل يوم تحت ما لم يُستعمل منذ سنة.
 */
const ORDER = `ORDER BY is_favorite DESC, COALESCE(used_at, '') DESC, is_default DESC, name`;

/**
 * أعمدة المكتبة تُضاف عند الحاجة — الترحيل هنا ليعمل على قواعد قائمة.
 * والفهرس بعد ضمان العمود لا قبله، وإلا سقط إقلاع التطبيق على قاعدة المكتب.
 */
export function prepareLetterheads(db: Database): void {
  const cols = (db.prepare('PRAGMA table_info(letterheads)').all() as { name: string }[]).map(
    (c) => c.name
  );
  const add = (name: string, decl: string) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE letterheads ADD COLUMN ${name} ${decl}`);
  };
  add('category', 'TEXT');
  add('is_favorite', 'INTEGER NOT NULL DEFAULT 0');
  add('used_at', 'TEXT');
  add('search_fold', 'TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS ix_letterheads_fold ON letterheads(search_fold)');
  prepareIdentity(db, 'letterhead');
}

/** ما يُحفظ في نسخ الترويسة — ما يُحرَّر منها، لا التفضيل ولا الافتراضية. */
function letterheadPayload(row: Row): RevisionPayloads['letterhead'] {
  let layout: LetterheadLayout;
  try {
    layout = JSON.parse(row.layout_json) as LetterheadLayout;
  } catch {
    layout = emptyLayout();
  }
  return { name: row.name, category: row.category ?? null, authorityId: row.authority_id, layout };
}

/** ما يجري عليه البحث: الاسم والتصنيف ونصّ الترويسة — مطبَّعًا ومخزَّنًا. */
function searchFold(name: string, category: string | null, layout: LetterheadLayout): string {
  return normalizeFold([name, category ?? '', layoutText(layout)].join(' '));
}

function toLetterhead(row: Row): Letterhead {
  // الترويسات المحفوظة قبل الأقسام تُرحَّل عند القراءة، فلا يفقد المكتب ما بناه.
  let layout: LetterheadLayout;
  try {
    layout = normalizeLayout(JSON.parse(row.layout_json));
  } catch {
    layout = emptyLayout();
  }
  return {
    id: row.id,
    name: row.name,
    authorityId: row.authority_id,
    layout,
    isDefault: row.is_default === 1,
    category: row.category ?? null,
    isFavorite: row.is_favorite === 1,
    usedAt: row.used_at ?? null,
    revision: row.revision
  };
}

export type LetterheadQuery = {
  /** بحث متساهل مع الهمزة في الاسم والتصنيف ونصّ الترويسة. */
  query?: string;
  category?: string | null;
  favoritesOnly?: boolean;
};

export function listLetterheads(db: Database, opts: LetterheadQuery = {}): Letterhead[] {
  const where: string[] = [];
  const args: unknown[] = [];

  const q = normalizeFold(opts.query ?? '');
  if (q) {
    // الترويسات عشرات لا آلاف، فالمسح على العمود المطبَّع أبسط من فهرس FTS وأكفأ منه هنا.
    where.push('search_fold LIKE ?');
    args.push(`%${q}%`);
  }
  if (opts.category) {
    where.push('category = ?');
    args.push(opts.category);
  }
  if (opts.favoritesOnly) where.push('is_favorite = 1');

  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${ORDER}`;
  return (db.prepare(sql).all(...args) as Row[]).map(toLetterhead);
}

/** التصنيفات الموجودة فعلًا — تنبت من استعمال المكتب، ولا قائمة مفروضة. */
export function listCategories(db: Database): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT category FROM letterheads
       WHERE category IS NOT NULL AND TRIM(category) <> '' ORDER BY category`
    )
    .all() as { category: string }[];
  return rows.map((r) => r.category);
}

export function getLetterhead(db: Database, id: number): Letterhead | null {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Row | undefined;
  return row ? toLetterhead(row) : null;
}

export function getDefaultLetterhead(db: Database): Letterhead | null {
  const row = db.prepare(`${SELECT} WHERE is_default = 1`).get() as Row | undefined;
  return row ? toLetterhead(row) : null;
}

export function saveLetterhead(
  db: Database,
  input: {
    id: number | null;
    name: string;
    authorityId: number | null;
    layout: LetterheadLayout;
    category?: string | null;
  }
): Letterhead {
  const json = JSON.stringify(input.layout);
  const category = input.category?.trim() || null;
  const fold = searchFold(input.name, category, input.layout);

  const id = db.transaction(() => {
    if (input.id === null) {
      // أول ترويسة تُنشأ تصير الافتراضية تلقائيًا — وإلا بقي المكتب بلا رأس كتاب.
      const isFirst =
        (db.prepare('SELECT COUNT(*) AS n FROM letterheads').get() as { n: number }).n === 0;
      const info = db
        .prepare(
          `INSERT INTO letterheads (authority_id, name, layout_json, is_default, category, search_fold)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(input.authorityId, input.name, json, isFirst ? 1 : 0, category, fold);
      const id = Number(info.lastInsertRowid);
      stampNew(db, 'letterhead', id);
      return id;
    }
    // الحالة المحفوظة تصير نسخةً قبل أن يُكتب فوقها — إن تغيّر شيء.
    const before = db.prepare(`${SELECT} WHERE id = ?`).get(input.id) as Row | undefined;
    if (before) {
      recordRevision(db, 'letterhead', input.id, letterheadPayload(before), {
        name: input.name,
        category,
        authorityId: input.authorityId,
        layout: input.layout
      });
    }
    db.prepare(
      `UPDATE letterheads SET name = ?, authority_id = ?, layout_json = ?, category = ?, search_fold = ?
       WHERE id = ?`
    ).run(input.name, input.authorityId, json, category, fold, input.id);
    return input.id;
  })();

  return toLetterhead(db.prepare(`${SELECT} WHERE id = ?`).get(id) as Row);
}

/**
 * نسخةٌ من ترويسة قائمة.
 *
 * وهو أسرع طرق البناء: «مديرية تربية الأنبار» تصير «مديرية تربية ديالى» بتبديل
 * كلمة. والنسخة لا ترث الافتراضية ولا التفضيل — فالأصل يبقى هو المستعمَل.
 */
export function duplicateLetterhead(db: Database, id: number, name?: string): Letterhead | null {
  const src = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Row | undefined;
  if (!src) return null;

  const copyName = name?.trim() || `${src.name} — نسخة`;
  const layout = normalizeLayout(JSON.parse(src.layout_json || '{}'));
  const info = db
    .prepare(
      `INSERT INTO letterheads (authority_id, name, layout_json, is_default, category, search_fold)
       VALUES (?, ?, ?, 0, ?, ?)`
    )
    .run(src.authority_id, copyName, src.layout_json, src.category, searchFold(copyName, src.category, layout));
  // النسخة قطعةٌ أخرى: معرّفٌ جديد ونسختها الأولى.
  stampNew(db, 'letterhead', Number(info.lastInsertRowid));

  return toLetterhead(db.prepare(`${SELECT} WHERE id = ?`).get(Number(info.lastInsertRowid)) as Row);
}

export function setFavorite(db: Database, id: number, on: boolean): void {
  db.prepare('UPDATE letterheads SET is_favorite = ? WHERE id = ?').run(on ? 1 : 0, id);
}

/** تُستدعى عند استعمال الترويسة في كتاب — عليها يقوم ترتيب القائمة. */
export function touchLetterhead(db: Database, id: number): void {
  db.prepare("UPDATE letterheads SET used_at = datetime('now') WHERE id = ?").run(id);
}

export function setDefaultLetterhead(db: Database, id: number): void {
  db.transaction(() => {
    db.prepare('UPDATE letterheads SET is_default = 0').run();
    db.prepare('UPDATE letterheads SET is_default = 1 WHERE id = ?').run(id);
  })();
}

export function deleteLetterhead(db: Database, id: number): void {
  db.transaction(() => {
    const was = db.prepare('SELECT is_default FROM letterheads WHERE id = ?').get(id) as
      | { is_default: number }
      | undefined;
    forgetRevisions(db, 'letterhead', id);
    db.prepare('DELETE FROM letterheads WHERE id = ?').run(id);
    // لا يبقى المكتب بلا افتراضية: ترقّى الأقدم مكانها.
    if (was?.is_default === 1) {
      const next = db.prepare('SELECT id FROM letterheads ORDER BY id LIMIT 1').get() as
        | { id: number }
        | undefined;
      if (next) db.prepare('UPDATE letterheads SET is_default = 1 WHERE id = ?').run(next.id);
    }
  })();
}

// ── الأختام والتواقيع ────────────────────────────────────────────────
const SEAL_SELECT =
  'SELECT id, name, kind, image_path AS imagePath, authority_id AS authorityId FROM seals';

export function listSeals(db: Database): Seal[] {
  return db.prepare(`${SEAL_SELECT} ORDER BY id`).all() as Seal[];
}

export function addSeal(
  db: Database,
  input: { name: string; kind: string; imagePath: string | null }
): Seal {
  const info = db
    .prepare('INSERT INTO seals (name, kind, image_path) VALUES (?, ?, ?)')
    .run(input.name, input.kind, input.imagePath);
  return db.prepare(`${SEAL_SELECT} WHERE id = ?`).get(Number(info.lastInsertRowid)) as Seal;
}

export function deleteSeal(db: Database, id: number): void {
  db.prepare('DELETE FROM seals WHERE id = ?').run(id);
}
