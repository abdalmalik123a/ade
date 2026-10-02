/**
 * حزمة المحتوى (خطة Production، ٤٫٣): ما يبنيه المكتب ويصلح لمكتبٍ آخر — النماذج (الكتب والأسئلة
 * والتصاميم) والترويسات والكليشات، ومعها صورها من المخزن — في ملفٍّ واحد يُستورد.
 *
 * **بلا بيانات الناس**: لا مواطنون ولا مستمسكات ولا كتبٌ صادرة ولا مسودات (فيها قيمٌ كُتبت لأصحابها).
 * وصورةٌ في مجلّدات الناس من المخزن (المستمسكات والصور الشخصية والكتب الصادرة) لا تُحزم ولو أشار إليها
 * شيء، ولا تُكتب من حزمةٍ ولو حملتها.
 *
 * **والمكرّر يُعرف بمعرّفه** (`uuid`، FOUNDATION §٣): ما في المكتب بمعرّفه يُترك كما هو، ولا يُضاف
 * ثانيةً — فحزمةٌ تُستورد مرّتين لا تُكرّر شيئًا، ونموذجٌ عدّله المكتب لا تمحو تعديله حزمةٌ قديمة.
 * والجديد يُضاف بمعرّفه نفسه، فتُعرف قطعةُ الحزمة في كلّ مكتبٍ استوردها.
 *
 * وبها يُسلَّم ما يُعدّ للمكاتب لاحقًا من نماذج (ملفّ المستندات الموعود بدل العقود المحذوفة).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import type { ContentCounts, ContentImportResult } from '@shared/api';
import type { Doc } from '@shared/doc';
import type { LetterheadLayout } from '@shared/letterhead';
import type { TemplateVariable } from '@shared/template';
import { saveClip } from './clips';
import { saveLetterhead } from './letterheads';
import { isCodeTaken, saveTemplate } from './templates';
import { ZipWriter, extractEntry, fileSink, readZipIndex, safeInnerPath } from './zip';

const NAME = 'diwan-content.json';
const FORMAT = 1;
/** مجلّدات الناس في المخزن — لا تخرج في حزمة ولا تدخل منها. */
const PEOPLE = new Set(['attachments', 'photos', 'documents']);
/** مسار ملفٍّ في المخزن كما يُكتب في الوثائق والترويسات: `مجلّد/بصمة.امتداد`. */
const STORE_REF = /\b([a-z][a-z0-9-]{0,31})\/([0-9a-f]{16,64}\.[a-z0-9]{1,5})\b/g;

type PackLetterhead = { uuid: string; name: string; category: string | null; layout: unknown };
type PackTemplate = {
  uuid: string;
  code: string | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  subjectLine: string | null;
  bodyHtml: string;
  doc: unknown;
  letterheadUuid: string | null;
  variables: TemplateVariable[];
};
type PackClip = { uuid: string; title: string; body: string; category: string | null; direction: string | null };

export type ContentPackage = {
  app: 'diwan';
  kind: 'content';
  format: number;
  appVersion: string;
  createdAt: string;
  letterheads: PackLetterhead[];
  templates: PackTemplate[];
  clips: PackClip[];
};

/** ما في المكتب من محتوى — وصور المخزن التي يشير إليها وهي موجودة. */
export function collectContent(db: Database, storeRoot: string, appVersion: string, now = new Date()): { pkg: ContentPackage; files: string[] } {
  const letterheads = (
    db.prepare('SELECT uuid, name, category, layout_json AS layout FROM letterheads WHERE uuid IS NOT NULL ORDER BY id').all() as {
      uuid: string;
      name: string;
      category: string | null;
      layout: string;
    }[]
  ).map((r) => ({ uuid: r.uuid, name: r.name, category: r.category, layout: JSON.parse(r.layout) as unknown }));

  const varsOf = db.prepare('SELECT token, label, source, required FROM template_variables WHERE template_id = ? ORDER BY sort_order');
  const templates = (
    db
      .prepare(
        `SELECT t.id, t.uuid, t.code, t.title, t.subtitle, t.category, t.subject_line AS subjectLine,
                t.body_html AS bodyHtml, t.doc_json AS docJson, l.uuid AS letterheadUuid
         FROM templates t LEFT JOIN letterheads l ON l.id = t.letterhead_id
         WHERE t.uuid IS NOT NULL ORDER BY t.id`
      )
      .all() as (Omit<PackTemplate, 'doc' | 'variables'> & { id: number; docJson: string | null })[]
  ).map(({ id, docJson, ...t }) => ({
    ...t,
    doc: docJson ? (JSON.parse(docJson) as unknown) : null,
    variables: (varsOf.all(id) as { token: string; label: string | null; source: string | null; required: number }[]).map((v) => ({
      token: v.token,
      label: v.label ?? v.token,
      source: v.source ?? 'manual',
      required: v.required === 1
    })) as TemplateVariable[]
  }));

  const clips = db
    .prepare('SELECT uuid, title, body, category, direction FROM clips WHERE uuid IS NOT NULL ORDER BY id')
    .all() as PackClip[];

  const pkg: ContentPackage = { app: 'diwan', kind: 'content', format: FORMAT, appVersion, createdAt: now.toISOString(), letterheads, templates, clips };
  const files = new Set<string>();
  for (const m of JSON.stringify(pkg).matchAll(STORE_REF)) {
    const rel = `${m[1]}/${m[2]}`;
    if (!PEOPLE.has(m[1]!) && existsSync(join(storeRoot, rel))) files.add(rel);
  }
  return { pkg, files: [...files].sort() };
}

/** تُكتب الحزمة إلى `target` — إلى اسمٍ جانبيّ ثم تُنقل. */
export async function exportContent(target: string, db: Database, storeRoot: string, appVersion: string): Promise<ContentCounts> {
  const { pkg, files } = collectContent(db, storeRoot, appVersion);
  if (!pkg.templates.length && !pkg.letterheads.length && !pkg.clips.length) throw new Error('لا محتوى في المكتب بعد — لا نماذج ولا ترويسات ولا كليشات');
  const part = `${target}.part`;
  const sink = await fileSink(part);
  try {
    const zip = new ZipWriter(sink);
    await zip.addBuffer(NAME, Buffer.from(JSON.stringify(pkg)));
    for (const rel of files) await zip.addFile(`store/${rel}`, join(storeRoot, rel), false);
    await zip.finish();
    await sink.close();
  } catch (e) {
    await sink.close().catch(() => undefined);
    rmSync(part, { force: true });
    throw e;
  }
  if (existsSync(target)) rmSync(target);
  renameSync(part, target);
  return { templates: pkg.templates.length, letterheads: pkg.letterheads.length, clips: pkg.clips.length, files: files.length };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const uuidOk = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{8,64}$/i.test(v);

/** يقرأ الحزمة ويضيف ما ليس في المكتب بمعرّفه — وصورها إلى المخزن. */
export async function importContent(
  path: string,
  db: Database,
  storeRoot: string,
  workDir: string
): Promise<Omit<ContentImportResult, 'path'>> {
  let entries;
  try {
    entries = await readZipIndex(path);
  } catch {
    throw new Error('الملف ليس حزمة محتوى من ديوان');
  }
  const head = entries.find((e) => e.name === NAME);
  if (!head) throw new Error('الملف ليس حزمة محتوى من ديوان');
  mkdirSync(workDir, { recursive: true });
  const temp = join(workDir, `content-${process.pid}-${Date.now()}.json`);
  let pkg: ContentPackage;
  try {
    await extractEntry(path, head, temp);
    pkg = JSON.parse(readFileSync(temp, 'utf8')) as ContentPackage;
  } catch {
    throw new Error('حزمة المحتوى معطوبة');
  } finally {
    rmSync(temp, { force: true });
  }
  if (pkg?.app !== 'diwan' || pkg.kind !== 'content') throw new Error('الملف ليس حزمة محتوى من ديوان');
  // صيغةٌ أحدث مما يعرفه هذا الإصدار لا تُقرأ نصف قراءة.
  if (typeof pkg.format !== 'number' || pkg.format > FORMAT) {
    throw new Error(`الحزمة من إصدارٍ أحدث (${String(pkg.appVersion)}) — حدّث البرنامج ثم استوردها`);
  }

  // الصور أوّلًا: باسم بصمتها، فما وُجد منها هو هو ولا يُكتب فوقه.
  let files = 0;
  for (const e of entries) {
    if (!e.name.startsWith('store/') || e.name.endsWith('/')) continue;
    const rel = e.name.slice(6);
    if (!safeInnerPath(rel) || PEOPLE.has(rel.split('/')[0]!)) continue;
    const file = join(storeRoot, rel);
    if (existsSync(file)) continue;
    mkdirSync(dirname(file), { recursive: true });
    await extractEntry(path, e, file);
    files++;
  }

  const added = { templates: 0, letterheads: 0, clips: 0, files };
  const existing = { templates: 0, letterheads: 0, clips: 0 };
  const idOf = (table: 'letterheads' | 'templates' | 'clips', uuid: string) =>
    (db.prepare(`SELECT id FROM ${table} WHERE uuid = ?`).get(uuid) as { id: number } | undefined)?.id ?? null;
  const setUuid = (table: 'letterheads' | 'templates' | 'clips', id: number, uuid: string) =>
    db.prepare(`UPDATE ${table} SET uuid = ? WHERE id = ?`).run(uuid, id);

  db.transaction(() => {
    for (const l of Array.isArray(pkg.letterheads) ? pkg.letterheads : []) {
      if (!uuidOk(l?.uuid) || !str(l.name) || !l.layout || typeof l.layout !== 'object') continue;
      if (idOf('letterheads', l.uuid) !== null) {
        existing.letterheads++;
        continue;
      }
      const saved = saveLetterhead(db, { id: null, name: l.name, authorityId: null, layout: l.layout as LetterheadLayout, category: str(l.category) });
      setUuid('letterheads', saved.id, l.uuid);
      added.letterheads++;
    }
    for (const t of Array.isArray(pkg.templates) ? pkg.templates : []) {
      if (!uuidOk(t?.uuid) || !str(t.title)) continue;
      if (idOf('templates', t.uuid) !== null) {
        existing.templates++;
        continue;
      }
      // كودٌ يستعمله نموذجٌ في هذا المكتب يُترك: النموذج يُضاف بلا كود ولا يُرفض.
      const code = str(t.code);
      const saved = saveTemplate(db, {
        id: null,
        code: code && !isCodeTaken(db, code, null) ? code : null,
        title: t.title,
        subtitle: str(t.subtitle),
        category: str(t.category),
        subjectLine: str(t.subjectLine),
        bodyHtml: typeof t.bodyHtml === 'string' ? t.bodyHtml : '',
        letterheadId: uuidOk(t.letterheadUuid) ? idOf('letterheads', t.letterheadUuid) : null,
        variables: Array.isArray(t.variables) ? t.variables.filter((v) => typeof v?.token === 'string') : [],
        doc: t.doc && typeof t.doc === 'object' ? (t.doc as Doc) : null
      });
      setUuid('templates', saved.id, t.uuid);
      added.templates++;
    }
    for (const c of Array.isArray(pkg.clips) ? pkg.clips : []) {
      if (!uuidOk(c?.uuid) || !str(c.title) || !str(c.body)) continue;
      if (idOf('clips', c.uuid) !== null) {
        existing.clips++;
        continue;
      }
      const direction = c.direction === 'up' || c.direction === 'down' || c.direction === 'peer' ? c.direction : null;
      const saved = saveClip(db, { id: null, title: c.title, body: c.body, category: str(c.category), direction });
      setUuid('clips', saved.id, c.uuid);
      added.clips++;
    }
  })();
  return { added, existing };
}
