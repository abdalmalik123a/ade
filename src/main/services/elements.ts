/**
 * مكتبة العناصر في القاعدة والمخزن (DESIGNS.md ٣٫٧ و٠٫٨): SVG يُعقَّم (`shared/design/svgClean.ts`) فيُحفظ نظيفًا لا كما
 * جاء، وPNG يُفحص (توقيعه وأبعاده) — ثم يُنسخ إلى المخزن ببصمته فينتقل في النسخة الاحتياطية، ويُفهرس بصنفه.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import { normalizeCategory, type ElementCategory, type ElementImport, type LibraryElement } from '@shared/design/elements';
import { cleanSvg, SVG_MAX } from '@shared/design/svgClean';
import { storeDir } from '../db';
import { imageMeta } from './imageSize';
import { unreferenced } from './storeRefs';

/** أكبر صورةٍ نقطية تُقبل عنصرًا. */
const PNG_MAX = 15 * 1024 * 1024;

type Row = { id: number; name: string; category: string; kind: string; file: string; width: number; height: number; created_at: string };

const asElement = (r: Row): LibraryElement => ({
  id: r.id,
  name: r.name,
  category: normalizeCategory(r.category),
  kind: r.kind === 'png' ? 'png' : 'svg',
  file: r.file,
  width: r.width,
  height: r.height,
  createdAt: r.created_at
});

export function listElements(db: Database): LibraryElement[] {
  return (db.prepare('SELECT * FROM elements ORDER BY category, name, id').all() as Row[]).map(asElement);
}

/** يفحص الملفّ (ويعقّم الـSVG) ويحفظه — والملفّ نفسه (البصمة نفسها) لا يُكرَّر بل يُعاد صنفه واسمه. */
export function importElement(db: Database, path: string, category: ElementCategory): LibraryElement {
  const ext = extname(path).toLowerCase();
  const name = basename(path, extname(path)).trim().slice(0, 80) || 'عنصر';
  let bytes: Buffer;
  let kind: 'svg' | 'png';
  let width: number;
  let height: number;

  if (ext === '.svg') {
    if (statSync(path).size > SVG_MAX) throw new Error('الرسمة أكبر من ٥ ميغابايت');
    const clean = cleanSvg(readFileSync(path, 'utf8'));
    bytes = Buffer.from(clean.svg, 'utf8');
    ({ width, height } = clean);
    kind = 'svg';
  } else if (ext === '.png') {
    if (statSync(path).size > PNG_MAX) throw new Error('الصورة أكبر من ١٥ ميغابايت');
    bytes = readFileSync(path);
    const meta = imageMeta(bytes);
    if (!meta || meta.format !== 'png') throw new Error('ليست صورة PNG سليمة');
    ({ width, height } = meta);
    kind = 'png';
  } else {
    throw new Error('العناصر SVG أو PNG');
  }

  const file = `elements/${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}.${kind}`;
  const target = join(storeDir('elements'), basename(file));
  if (!existsSync(target)) writeFileSync(target, bytes);
  db.prepare(
    `INSERT INTO elements (name, category, kind, file, width, height) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (file) DO UPDATE SET name = excluded.name, category = excluded.category`
  ).run(name, category, kind, file, width, height);
  return asElement(db.prepare('SELECT * FROM elements WHERE file = ?').get(file) as Row);
}

/** ملفّاتٌ كثيرة: ما فسد منها يُقال باسمه وسببه، ولا يمنع غيره. */
export function importElements(db: Database, paths: string[], category: unknown): ElementImport {
  const out: ElementImport = { added: [], errors: [] };
  for (const path of paths) {
    try {
      out.added.push(importElement(db, path, normalizeCategory(category)));
    } catch (e) {
      out.errors.push({ name: basename(path), reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** يحذف العنصر من المكتبة — وملفّه من المخزن إن لم يستعمله تصميم (فلا يكسر حذفُه تصميمًا). */
export function removeElement(db: Database, id: number): void {
  const row = db.prepare('SELECT file FROM elements WHERE id = ?').get(id) as { file: string } | undefined;
  if (!row) return;
  db.prepare('DELETE FROM elements WHERE id = ?').run(id);
  for (const rel of unreferenced(db, [row.file])) rmSync(join(storeDir(), rel), { force: true });
}
