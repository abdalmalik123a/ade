import type { Database } from 'better-sqlite3';
import { emptyLayout, normalizeLayout, type Letterhead, type LetterheadLayout } from '@shared/letterhead';
import type { Seal } from '@shared/api';

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
};

const SELECT = 'SELECT id, name, authority_id, layout_json, is_default FROM letterheads';

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
    isDefault: row.is_default === 1
  };
}

export function listLetterheads(db: Database): Letterhead[] {
  const rows = db.prepare(`${SELECT} ORDER BY is_default DESC, name`).all() as Row[];
  return rows.map(toLetterhead);
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
  input: { id: number | null; name: string; authorityId: number | null; layout: LetterheadLayout }
): Letterhead {
  const json = JSON.stringify(input.layout);
  let id = input.id;

  if (id === null) {
    // أول ترويسة تُنشأ تصير الافتراضية تلقائيًا — وإلا بقي المكتب بلا رأس كتاب.
    const isFirst =
      (db.prepare('SELECT COUNT(*) AS n FROM letterheads').get() as { n: number }).n === 0;
    const info = db
      .prepare(
        'INSERT INTO letterheads (authority_id, name, layout_json, is_default) VALUES (?, ?, ?, ?)'
      )
      .run(input.authorityId, input.name, json, isFirst ? 1 : 0);
    id = Number(info.lastInsertRowid);
  } else {
    db.prepare('UPDATE letterheads SET name = ?, authority_id = ?, layout_json = ? WHERE id = ?').run(
      input.name,
      input.authorityId,
      json,
      id
    );
  }

  return toLetterhead(db.prepare(`${SELECT} WHERE id = ?`).get(id) as Row);
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
