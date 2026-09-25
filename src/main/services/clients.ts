import type { Database } from 'better-sqlite3';
import { normalizeFold } from '@shared/arabic';
import type { Client, ClientInput } from '@shared/orders';

/**
 * الجهات — المدارس والدوائر والشركات التي يعمل لها المكتب.
 *
 * جدول `authorities` قائمٌ منذ الأساس، والترويسات والشعارات تشير إليه — فهو ملف
 * الجهة بلا جدولٍ جديد. تُضاف إليه الأعمدة هنا عند الحاجة، فقاعدة المكتب القائمة
 * لا تسقط. والشعار شعارٌ في جدول الشعارات مربوطٌ بالجهة: فيراه مصمّم الترويسة
 * والعلامة المائية كما يراه ملف الجهة، صورةً واحدة.
 */

export function prepareClients(db: Database): void {
  const cols = (db.prepare('PRAGMA table_info(authorities)').all() as { name: string }[]).map((c) => c.name);
  const add = (name: string, decl: string) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE authorities ADD COLUMN ${name} ${decl}`);
  };
  add('phone', 'TEXT');
  add('address', 'TEXT');
  add('color', 'TEXT');
  add('notes', 'TEXT');
  add('search_fold', 'TEXT');
}

type Row = {
  id: number;
  name: string;
  kind: string | null;
  phone: string | null;
  address: string | null;
  color: string | null;
  notes: string | null;
  logo: string | null;
  letterheads: number;
  openOrders: number;
};

const SELECT = `
  SELECT a.id, a.name, a.kind, a.phone, a.address, a.color, a.notes,
    (SELECT s.image_path FROM seals s WHERE s.authority_id = a.id AND s.kind = 'شعار' AND s.image_path IS NOT NULL
      ORDER BY s.id DESC LIMIT 1) AS logo,
    (SELECT COUNT(*) FROM letterheads l WHERE l.authority_id = a.id) AS letterheads,
    (SELECT COUNT(*) FROM orders o WHERE o.authority_id = a.id AND o.status IN ('new','waiting','working','ready')) AS openOrders
  FROM authorities a`;

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export function listClients(db: Database, query = ''): Client[] {
  prepareClients(db);
  const q = normalizeFold(query.trim());
  const rows = db.prepare(`${SELECT} ORDER BY a.name`).all() as Row[];
  return q ? rows.filter((r) => normalizeFold(`${r.name} ${r.kind ?? ''} ${r.phone ?? ''}`).includes(q)) : rows;
}

export function getClient(db: Database, id: number): Client | null {
  prepareClients(db);
  return (db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as Row | undefined) ?? null;
}

/** يحفظ الجهة — والاسم لا يتكرّر: «مدرسة الرافدين» مرّتين تفرّقان طلباتها بين ملفّين. */
export function saveClient(db: Database, input: ClientInput): Client {
  prepareClients(db);
  const name = input.name.trim();
  if (!name) throw new Error('اسم الجهة مطلوب');
  const dup = db
    .prepare('SELECT id FROM authorities WHERE search_fold = ? AND id != ?')
    .get(normalizeFold(name), input.id ?? -1) as { id: number } | undefined;
  if (dup) throw new Error('جهةٌ بهذا الاسم موجودة');
  const color = clean(input.color);
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('اللون يُكتب هكذا: #1f3a8a');

  const values = [
    name,
    clean(input.kind),
    clean(input.phone),
    clean(input.address),
    color,
    clean(input.notes),
    normalizeFold(name)
  ];
  let id = input.id;
  if (id) {
    db.prepare(
      'UPDATE authorities SET name = ?, kind = ?, phone = ?, address = ?, color = ?, notes = ?, search_fold = ? WHERE id = ?'
    ).run(...values, id);
  } else {
    id = Number(
      db
        .prepare(
          'INSERT INTO authorities (name, kind, phone, address, color, notes, search_fold) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(...values).lastInsertRowid
    );
  }
  return getClient(db, id)!;
}

/** شعار الجهة: يحلّ محلّ شعارها السابق، ويبقى في جدول الشعارات لتراه بقيّة الشاشات. */
export function setClientLogo(db: Database, id: number, imagePath: string): Client {
  const client = getClient(db, id);
  if (!client) throw new Error('الجهة غير موجودة');
  db.transaction(() => {
    db.prepare("DELETE FROM seals WHERE authority_id = ? AND kind = 'شعار'").run(id);
    db.prepare("INSERT INTO seals (authority_id, name, kind, image_path) VALUES (?, ?, 'شعار', ?)").run(
      id,
      client.name,
      imagePath
    );
  })();
  return getClient(db, id)!;
}

/**
 * حذف الجهة لا يحذف ما صُنع لها: الترويسات والطلبات تبقى بلا جهة (`SET NULL`)،
 * واسمها يُكتب في طلباتها المفتوحة فلا تصير «زبونًا مجهولًا».
 */
export function deleteClient(db: Database, id: number): void {
  const client = getClient(db, id);
  if (!client) return;
  db.transaction(() => {
    db.prepare('UPDATE orders SET customer = COALESCE(customer, ?) WHERE authority_id = ?').run(client.name, id);
    db.prepare('UPDATE seals SET authority_id = NULL WHERE authority_id = ?').run(id);
    db.prepare('DELETE FROM authorities WHERE id = ?').run(id);
  })();
}
