/**
 * مجلّد بيانات المكتب يختاره المكتب (D236، ر190 §١) — خارج AppData.
 *
 * حزمة MSIX تحوّل ما يُكتب جديدًا تحت AppData إلى مكانٍ خاصٍّ بها وتمحوه عند إزالة البرنامج
 * (`docs/research/STORAGE-PROTECTION.md` §٣)؛ وكانت القاعدة والمخزن والترخيص في `userData/data`.
 * فيختار المكتب مجلّدًا أوّل مرّة، ويُحفظ مساره في مؤشّرٍ صغير تحت `userData` — المؤشّر وحده: إن مُحي
 * مع البرنامج سُئل المكتب ثانيةً فاختار المجلّد نفسه فوُجدت بياناته فيه.
 *
 * لا electron هنا (يُختبر بلا برنامج): الحوارات في `main/dataLocationBoot.ts`. ولا حذف لبيانات المكتب:
 * النقل إلى قرصٍ آخر نسخٌ ثم تحقّق، ويبقى القديم جانبًا باسم `…-before-move-<وقت>` يحذفه المكتب بيده.
 */
import { cp, rename, rm } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { isInside } from './localPaths';

export const POINTER_NAME = 'data-location.json';
export const PENDING_MOVE_NAME = 'pending-move.json';
/** اسمٌ لاتينيّ للمجلّد المقترح: بعض الأدوات الخارجية تتعثّر بالمسار العربيّ. */
export const SUGGESTED_NAME = 'DiwanData';
export const DB_NAME = 'diwan.db';

export interface Pointer {
  path: string;
  /** ما بقي جانبًا بعد كلّ نقلٍ إلى قرصٍ آخر — يُعرض في الإعدادات ويُحذف يدويًّا. */
  asides: string[];
}

/** المكان القديم (قبل D236): `userData/data`. */
export const legacyDataDir = (userData: string): string => join(userData, 'data');

export const hasData = (dir: string): boolean => existsSync(join(dir, DB_NAME));

export function readPointer(userData: string): Pointer | null {
  try {
    const raw = JSON.parse(readFileSync(join(userData, POINTER_NAME), 'utf8')) as Partial<Pointer>;
    if (typeof raw.path !== 'string' || !isAbsolute(raw.path)) return null;
    const asides = Array.isArray(raw.asides) ? raw.asides.filter((a): a is string => typeof a === 'string' && isAbsolute(a)) : [];
    return { path: raw.path, asides };
  } catch {
    return null;
  }
}

/** يُكتب بعد نجاح النقل وحده، وكتابةً تامّة (ملفٌّ مؤقّت ثم إعادة تسمية): مؤشّرٌ مبتور لا يُضلّ الإقلاع. */
export function writePointer(userData: string, pointer: Pointer): void {
  mkdirSync(userData, { recursive: true });
  const file = join(userData, POINTER_NAME);
  writeFileSync(`${file}.tmp`, JSON.stringify(pointer, null, 2), 'utf8');
  renameSync(`${file}.tmp`, file);
}

/** نقلٌ طلبه المكتب من الإعدادات، يجري في الإقلاع التالي قبل أن تُفتح القاعدة. */
export function readPendingMove(userData: string): string | null {
  try {
    const raw = JSON.parse(readFileSync(join(userData, PENDING_MOVE_NAME), 'utf8')) as { to?: unknown };
    return typeof raw.to === 'string' && isAbsolute(raw.to) ? raw.to : null;
  } catch {
    return null;
  }
}

export function writePendingMove(userData: string, to: string): void {
  writeFileSync(join(userData, PENDING_MOVE_NAME), JSON.stringify({ to }), 'utf8');
}

export function clearPendingMove(userData: string): void {
  rmSync(join(userData, PENDING_MOVE_NAME), { force: true });
}

/** قرصٌ كما يقرؤه `Win32_LogicalDisk`: ٢ منقول، ٣ ثابت، ٤ شبكة. */
export interface Disk {
  id: string;
  type: number;
}

/** أوّل قرصٍ ثابتٍ غير قرص النظام، وإلا قرص النظام — وفي جذره `DiwanData`. */
export function suggestDataDir(disks: Disk[], systemDrive: string): string {
  const sys = systemDrive.toUpperCase().replace(/\\$/, '');
  const other = disks
    .filter((d) => d.type === 3 && d.id.toUpperCase() !== sys)
    .map((d) => d.id.toUpperCase())
    .sort()[0];
  return `${other ?? sys}\\${SUGGESTED_NAME}`;
}

export interface ChoiceContext {
  userData: string;
  disks: Disk[];
  /** متغيّرات البيئة التي تدلّ على AppData وOneDrive وProgram Files وWindows. */
  env: Record<string, string | undefined>;
}

export interface ChoiceCheck {
  /** المجلّد الذي تُحفظ فيه البيانات فعلًا: مجلّدٌ فيه ملفّاتٌ غير ديوان يُوضع داخله `DiwanData`. */
  target: string;
  error?: string;
  warning?: string;
}

const diskOf = (path: string, disks: Disk[]): Disk | undefined => {
  const root = parse(resolve(path)).root.replace(/\\$/, '').toUpperCase();
  return disks.find((d) => d.id.toUpperCase() === root);
};

export function checkChoice(path: string, ctx: ChoiceContext): ChoiceCheck {
  if (!path || !isAbsolute(path)) return { target: path, error: 'اختر مجلّدًا بمساره الكامل.' };
  if (/^[\\/]{2}/.test(path) || diskOf(path, ctx.disks)?.type === 4) {
    return { target: path, error: 'لا يُحفظ سجلّ المكتب في مجلّد شبكة: إن انقطعت الشبكة تعطّل العمل وقد تتلف القاعدة. اختر قرصًا في هذا الحاسوب.' };
  }
  const env = ctx.env;
  const appData = [ctx.userData, env['APPDATA'], env['LOCALAPPDATA']].filter((p): p is string => !!p);
  if (appData.some((root) => isInside(root, path))) {
    return { target: path, error: 'هذا المجلّد داخل بيانات البرامج (AppData)، وقد يُمحى مع البرنامج. اختر مجلّدًا آخر.' };
  }
  const system = [env['ProgramFiles'], env['ProgramFiles(x86)'], env['SystemRoot'] ?? env['windir']].filter((p): p is string => !!p);
  if (system.some((root) => isInside(root, path))) {
    return { target: path, error: 'هذا مجلّدٌ للنظام أو للبرامج لا يكتب فيه ديوان. اختر مجلّدًا آخر.' };
  }
  let target = path;
  if (existsSync(path) && !hasData(path)) {
    try {
      if (readdirSync(path).length > 0) target = join(path, SUGGESTED_NAME);
    } catch {
      return { target: path, error: 'تعذّرت قراءة هذا المجلّد. اختر مجلّدًا آخر.' };
    }
  }
  const oneDrive = [env['OneDrive'], env['OneDriveConsumer'], env['OneDriveCommercial']].filter((p): p is string => !!p);
  if (oneDrive.some((root) => isInside(root, target))) {
    return { target, warning: 'هذا المجلّد يزامنه OneDrive: قد يرفع مستمسكات الزبائن إلى الإنترنت، ومزامنة القاعدة وهي مفتوحة قد تتلفها.' };
  }
  if (diskOf(target, ctx.disks)?.type === 2) {
    return { target, warning: 'هذا قرصٌ منقول (فلاشة): إن نُزع والبرنامج يعمل تعطّل العمل، وإن ضاع ضاع السجلّ. الأسلم قرصٌ ثابت.' };
  }
  return { target };
}

/** الملفّات وأحجامها نسبيًّا — للتحقّق من النسخ قبل أن يُعتمد. */
function inventory(root: string): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (dir: string): void => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile()) out.set(relative(root, full), statSync(full).size);
    }
  };
  walk(root);
  return out;
}

export function integrityOf(dbFile: string): string {
  const db = new Database(dbFile, { readonly: true, fileMustExist: true });
  try {
    return String(db.pragma('integrity_check', { simple: true }));
  } finally {
    db.close();
  }
}

export interface MoveResult {
  /** نُقل شيء (وإلا كان المصدر فارغًا فأُنشئ المجلّد وحده). */
  moved: boolean;
  /** المصدر القديم جانبًا بعد نسخٍ إلى قرصٍ آخر. */
  aside?: string;
}

const stamp = (d: Date): string => d.toISOString().replace(/[:.]/g, '-').slice(0, 19);

const emptyDir = (dir: string): boolean => existsSync(dir) && readdirSync(dir).length === 0;

/**
 * ينقل مجلّد البيانات من `from` إلى `to`. لا يكتب فوق بيانات ديوانٍ في الهدف، ولا يمسّ المصدر قبل أن يُتحقّق
 * من النسخة: القرص نفسه ← إعادة تسمية (لحظية)؛ وغيره ← نسخٌ إلى `<to>.partial` ثم مطابقة الملفّات وأحجامها
 * وسلامة القاعدة، ثم يصير الهدف، ويُسمّى المصدر `<from>-before-move-<وقت>`. نسخٌ انقطع يُعاد من أوّله.
 */
export async function moveData(
  from: string,
  to: string,
  deps: { integrity?: (dbFile: string) => string; now?: () => Date; sameDisk?: boolean } = {}
): Promise<MoveResult> {
  const integrity = deps.integrity ?? integrityOf;
  if (resolve(from).toLowerCase() === resolve(to).toLowerCase()) return { moved: false };
  if (hasData(to)) throw new Error(`في ${to} بيانات ديوانٍ أخرى — لا يُكتب فوقها`);
  if (existsSync(to) && !emptyDir(to)) throw new Error(`المجلّد ${to} ليس فارغًا`);
  if (!existsSync(from) || emptyDir(from)) {
    mkdirSync(to, { recursive: true });
    return { moved: false };
  }
  mkdirSync(dirname(to), { recursive: true });
  const sameDisk = deps.sameDisk ?? parse(resolve(from)).root.toLowerCase() === parse(resolve(to)).root.toLowerCase();
  if (sameDisk) {
    try {
      if (existsSync(to)) rmdirSync(to);
      await rename(from, to);
      return { moved: true };
    } catch {
      // ملفٌّ ممسوك أو قرصٌ مركّب: يُنسخ كما بين قرصين.
    }
  }
  const partial = `${to}.partial`;
  await rm(partial, { recursive: true, force: true }); // نسخةٌ سابقة لم تكتمل — والمصدر سليم
  await cp(from, partial, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
  const want = inventory(from);
  const got = inventory(partial);
  const missing = [...want].filter(([rel, size]) => got.get(rel) !== size).map(([rel]) => rel);
  if (missing.length > 0) throw new Error(`لم يُنسخ ${missing.length} ملفًّا كما هو (أوّلها ${missing[0]}) — بقيت البيانات في مكانها`);
  if (existsSync(join(partial, DB_NAME))) {
    const check = integrity(join(partial, DB_NAME));
    if (check !== 'ok') throw new Error(`القاعدة المنسوخة لا تجتاز فحص السلامة (${check}) — بقيت البيانات في مكانها`);
  }
  if (existsSync(to)) rmdirSync(to);
  await rename(partial, to);
  const aside = `${from}-before-move-${stamp((deps.now ?? (() => new Date()))())}`;
  await rename(from, aside);
  return { moved: true, aside };
}

/**
 * ينقل البيانات إلى `target` ثم يكتب المؤشّر — **بعد نجاح النقل وحده**: نقلٌ تعثّر يُبقي المؤشّر كما كان والبيانات في مكانها.
 * ومجلّدٌ فيه بيانات ديوانٍ أصلًا يُعتمد كما هو ولا يُنقل إليه شيء.
 */
export async function relocate(
  userData: string,
  from: string,
  target: string,
  asides: string[],
  deps: Parameters<typeof moveData>[2] = {}
): Promise<Pointer & { adopted: boolean }> {
  if (hasData(target)) {
    writePointer(userData, { path: target, asides });
    return { path: target, asides, adopted: true };
  }
  const moved = await moveData(from, target, deps);
  const pointer = { path: target, asides: moved.aside ? [...asides, moved.aside] : asides };
  writePointer(userData, pointer);
  return { ...pointer, adopted: false };
}

/** حجم مجلّدٍ جانبيّ للعرض — وما تعذّرت قراءته صفر. */
export function dirBytes(dir: string): number {
  try {
    let total = 0;
    for (const size of inventory(dir).values()) total += size;
    return total;
  } catch {
    return 0;
  }
}
