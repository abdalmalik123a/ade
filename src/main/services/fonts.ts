/**
 * «خطوط ديوان» في القاعدة والمخزن (DESIGNS.md ٣٫٧ و٠٫٧): ما يستورده المكتب من ملفٍّ أو من خطوط Windows بضغطة — يُفحص
 * (`fontFile.ts`)، ويُنسخ إلى المخزن ببصمته فينتقل في النسخة الاحتياطية، ويُفهرس وجهًا لكلّ ملفّ. والمحزوم في البرنامج
 * نفسه (`shared/fonts`) فلا يُستورد ثانيةً.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import { bundledFont, cleanFamily, fontFaceCss, type FontImport, type ImportedFace } from '@shared/fonts';
import { storeDir } from '../db';
import { readFontInfo, withFileReader, type FontInfo } from './fontFile';
import { unreferenced } from './storeRefs';

/** عائلةٌ في خطوط Windows: وجوهها بملفّاتها، وأتكتب العربية. */
export type WindowsFamily = { family: string; faces: { path: string; weight: number; italic: boolean }[]; arabic: boolean };

type Row = { id: number; family: string; weight: number; italic: number; file: string; source: string; original_name: string; created_at: string };

const asFace = (r: Row): ImportedFace => ({
  id: r.id,
  family: r.family,
  weight: r.weight,
  italic: r.italic === 1,
  file: r.file,
  source: r.source === 'windows' ? 'windows' : 'file',
  originalName: r.original_name,
  createdAt: r.created_at
});

export function listFaces(db: Database): ImportedFace[] {
  return (db.prepare('SELECT * FROM fonts ORDER BY family, weight, italic').all() as Row[]).map(asFace);
}

/** قواعد `@font-face` للمستورد — لنافذة الإخراج (لا جسر فيها تسأل منه). */
export function importedFontCss(db: Database): string {
  try {
    return fontFaceCss(listFaces(db));
  } catch {
    return ''; // قاعدةٌ أقدم بلا الجدول — لا مستورد.
  }
}

/** يفحص ملفًّا ويستورده وجهًا — والوجه نفسه (العائلة والوزن والميل) يُستبدل ملفّه. */
export function importFace(db: Database, path: string, source: 'file' | 'windows'): ImportedFace {
  const info: FontInfo = withFileReader(path, readFontInfo);
  const family = cleanFamily(info.family);
  if (!family) throw new Error('اسم عائلة الخطّ لا يصلح');
  if (bundledFont(family)) throw new Error(`«${family}» من خطوط ديوان المحزومة أصلًا`);

  const bytes = readFileSync(path);
  const file = `fonts/${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}.${info.format}`;
  const target = join(storeDir('fonts'), basename(file));
  if (!existsSync(target)) copyFileSync(path, target);

  const before = db.prepare('SELECT file FROM fonts WHERE family = ? AND weight = ? AND italic = ?').get(family, info.weight, info.italic ? 1 : 0) as
    | { file: string }
    | undefined;
  db.prepare(
    `INSERT INTO fonts (family, weight, italic, file, source, original_name) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (family, weight, italic) DO UPDATE SET file = excluded.file, source = excluded.source,
       original_name = excluded.original_name, created_at = datetime('now')`
  ).run(family, info.weight, info.italic ? 1 : 0, file, source, basename(path));
  if (before && before.file !== file) forget(db, [before.file]);

  const row = db.prepare('SELECT * FROM fonts WHERE family = ? AND weight = ? AND italic = ?').get(family, info.weight, info.italic ? 1 : 0) as Row;
  return asFace(row);
}

/** ملفّاتٌ كثيرة: ما فسد منها يُقال باسمه وسببه، ولا يمنع غيره. */
export function importFaces(db: Database, paths: string[], source: 'file' | 'windows'): FontImport {
  const out: FontImport = { added: [], errors: [] };
  for (const path of paths) {
    try {
      out.added.push(importFace(db, path, source));
    } catch (e) {
      out.errors.push({ name: basename(path), reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** يحذف عائلةً مستوردة كلّها — وملفّاتها من المخزن إن لم يبقَ لها مرجع. */
export function removeFamily(db: Database, family: string): void {
  const files = (db.prepare('SELECT file FROM fonts WHERE family = ?').all(cleanFamily(family)) as { file: string }[]).map((r) => r.file);
  db.prepare('DELETE FROM fonts WHERE family = ?').run(cleanFamily(family));
  forget(db, files);
}

function forget(db: Database, files: string[]): void {
  for (const rel of unreferenced(db, files)) rmSync(join(storeDir(), rel), { force: true });
}

/**
 * مجلّدا خطوط Windows: للجهاز كلّه، ولهذا المستخدم (ما ثُبّت بلا صلاحية المدير). وتحت المِقْود
 * (`DIWAN_TEST_WINDOWS_FONTS`) مجلّدٌ واحد يُعدّه السيناريو — فلا يتعلّق الاختبار بما ثُبّت على الجهاز.
 */
function windowsFontDirs(): string[] {
  const test = __DIWAN_TEST_DOORS__ ? process.env['DIWAN_TEST_WINDOWS_FONTS'] : undefined;
  if (test) return [test];
  const dirs = [join(process.env['WINDIR'] ?? 'C:\\Windows', 'Fonts')];
  if (process.env['LOCALAPPDATA']) dirs.push(join(process.env['LOCALAPPDATA'], 'Microsoft', 'Windows', 'Fonts'));
  return dirs;
}

let scanned: WindowsFamily[] | null = null;

/** خطوط Windows بعائلاتها — تُقرأ رؤوس ملفّاتها مرّةً في الجلسة. */
export function windowsFamilies(): WindowsFamily[] {
  if (scanned) return scanned;
  const byFamily = new Map<string, WindowsFamily>();
  for (const dir of windowsFontDirs()) {
    let names: string[] = [];
    try {
      names = readdirSync(dir).filter((n) => /\.(ttf|otf)$/i.test(n));
    } catch {
      continue;
    }
    for (const name of names) {
      const path = join(dir, name);
      try {
        const info = withFileReader(path, readFontInfo);
        const family = cleanFamily(info.family);
        if (!family) continue;
        const key = family.toLowerCase();
        const entry = byFamily.get(key) ?? { family, faces: [], arabic: false };
        if (!entry.faces.some((f) => f.weight === info.weight && f.italic === info.italic)) entry.faces.push({ path, weight: info.weight, italic: info.italic });
        entry.arabic ||= info.arabic;
        byFamily.set(key, entry);
      } catch {
        // ملفٌّ لا يُقرأ يُتخطّى — لا يُسقط القائمة.
      }
    }
  }
  scanned = [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family));
  return scanned;
}

/** عائلةٌ من خطوط Windows بضغطة: وجوهها كلّها (العادي والعريض والمائل). */
export function importWindowsFamily(db: Database, family: string): FontImport {
  const wanted = cleanFamily(family).toLowerCase();
  const entry = windowsFamilies().find((f) => f.family.toLowerCase() === wanted);
  if (!entry) return { added: [], errors: [{ name: family, reason: 'ليس في خطوط Windows على هذا الجهاز' }] };
  return importFaces(db, entry.faces.map((f) => f.path), 'windows');
}
