/** ملفات أقسام المحتوى (S49، D208): حزمة المحتوى القائمة، مصفّاة إلى قسم واحد، بلا بيانات الناس. */
import type { Database } from 'better-sqlite3';
import type { ContentCounts } from '@shared/api';
import { designPackLevel } from '@shared/canvas';
import { SECTION_LABEL, type ContentSection } from '@shared/sealedPack';
import { collectContent, writePack, type ContentPackage } from './contentPack';

const canvas = (doc: unknown): boolean => Boolean(doc && typeof doc === 'object' && (doc as { kind?: unknown }).kind === 'canvas');

/** فحص قبل أي كتابة في importContent: لا يُمرّر قسمًا آخر أو تصميمًا في غلاف المعاملات. */
export function checkSection(pkg: ContentPackage, section: ContentSection): void {
  const { templates, clips, letterheads } = pkg;
  const fail = () => { throw new Error(`محتوى الملف لا يطابق قسم «${SECTION_LABEL[section]}» — صدّر القسم من ديوان ثم اختمه`); };
  if (!Array.isArray(templates) || !Array.isArray(clips) || !Array.isArray(letterheads)) return fail();
  if (section === 'templates') {
    if (!templates.length || clips.length || templates.some((t) => !t || canvas(t.doc))) return fail();
    const needed = new Set(templates.map((t) => t.letterheadUuid).filter(Boolean));
    const have = new Set(letterheads.map((l) => l?.uuid));
    if (letterheads.some((l) => !l || !needed.has(l.uuid)) || [...needed].some((uuid) => !have.has(uuid!))) return fail();
  } else if (section === 'clips') {
    if (!clips.length || templates.length || letterheads.length) return fail();
  } else if (!letterheads.length || templates.length || clips.length) return fail();
}

/** المعاملات تحمل ترويساتها اللازمة فقط؛ وملفات الصور لا تتسرّب من الأقسام الأخرى. */
export function collectSection(db: Database, storeRoot: string, appVersion: string, section: ContentSection) {
  const all = collectContent(db, storeRoot, appVersion);
  const templates = section === 'templates' ? all.pkg.templates.filter((t) => !canvas(t.doc)) : [];
  const needed = new Set(templates.map((t) => t.letterheadUuid));
  const pkg: ContentPackage = {
    ...all.pkg,
    templates,
    clips: section === 'clips' ? all.pkg.clips : [],
    letterheads: section === 'letterheads' ? all.pkg.letterheads : section === 'templates' ? all.pkg.letterheads.filter((l) => needed.has(l.uuid)) : [],
    format: Math.max(1, ...templates.map((t) => designPackLevel(t.doc)))
  };
  const count = pkg.templates.length + pkg.clips.length + pkg.letterheads.length;
  if (!count || (section === 'templates' && !templates.length)) throw new Error(`لا محتوى في قسم «${SECTION_LABEL[section]}» بعد`);
  checkSection(pkg, section);
  const text = JSON.stringify(pkg);
  return { pkg, files: all.files.filter((file) => text.includes(file)) };
}

export async function exportSection(target: string, db: Database, storeRoot: string, appVersion: string, section: ContentSection): Promise<ContentCounts> {
  const { pkg, files } = collectSection(db, storeRoot, appVersion, section);
  await writePack(target, pkg, files, storeRoot);
  return { templates: pkg.templates.length, letterheads: pkg.letterheads.length, clips: pkg.clips.length, files: files.length };
}
