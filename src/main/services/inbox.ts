/**
 * «الملفّات» (خطّة الترقية، المرحلة ٢ — قرار ٣ تشرين الأول، ن٨): ما وصل المكتب من كلّ مصدر —
 * التنزيلات وسطح المكتب والمستندات، وواتساب (قراءةٌ فقط)، والفلاشة حين تُوصل — في قائمةٍ واحدة
 * في الشبّاك، فلا يفتح الموظف مستكشف الملفّات ليبحث عمّا أرسله الزبون قبل دقيقة.
 *
 * قراءةٌ لا كتابة: لا يُنقل ملفٌّ ولا يُحذف ولا يُعاد تسميته. والمسارات لا تخرج إلى الواجهة: لكلّ
 * ملفٍّ معرّفٌ تعود به، فلا يُفتح بها إلا ما عُرض عليها.
 */
import { readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { basename, extname, join } from 'node:path';
import { app } from 'electron';

import type { InboxFile } from '@shared/api';

type InboxKind = InboxFile['kind'];
type InboxSource = InboxFile['source'];

export const SOURCE_LABEL: Record<InboxSource, string> = {
  downloads: 'التنزيلات',
  desktop: 'سطح المكتب',
  documents: 'المستندات',
  whatsapp: 'واتساب',
  flash: 'الفلاشة'
};

const KIND_OF: Record<string, InboxKind> = {
  '.pdf': 'pdf',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.bmp': 'image',
  '.docx': 'word'
};

/** ما وصل في الأسبوع الأخير — وما في الفلاشة كلّه، فهي أُوصلت لأجله. */
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FILES = 40;

type Dir = { source: InboxSource; path: string; depth: number; recentOnly: boolean };

/**
 * واتساب لويندوز (من المتجر) يحفظ ما يُرسل إليه في مجلّد حزمته — يُقرأ ولا يُمسّ.
 * والقديم يحفظ في التنزيلات، فيصل من هناك.
 */
async function whatsappDirs(): Promise<string[]> {
  const local = process.env['LOCALAPPDATA'];
  if (!local) return [];
  const packages = join(local, 'Packages');
  try {
    const names = await readdir(packages);
    return names.filter((n) => /WhatsAppDesktop/i.test(n)).map((n) => join(packages, n, 'LocalState', 'shared', 'transfers'));
  } catch {
    return [];
  }
}

let flashCache: { at: number; drives: string[] } | null = null;

/**
 * الأقراص القابلة للنزع (الفلاشة) — `DriveType=2` في ويندوز. يُسأل النظام مرّةً كلّ بضع ثوانٍ لا مع
 * كلّ قراءة، وبمهلة: نظامٌ بطيء لا يُوقف القائمة.
 */
function removableDrives(): Promise<string[]> {
  if (process.platform !== 'win32') return Promise.resolve([]);
  if (flashCache && Date.now() - flashCache.at < 5000) return Promise.resolve(flashCache.drives);
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', "(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2').DeviceID"],
      { timeout: 4000, windowsHide: true },
      (err, stdout) => {
        const drives = err ? [] : String(stdout).split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[A-Z]:$/.test(l)).map((l) => `${l}\\`);
        flashCache = { at: Date.now(), drives };
        resolve(drives);
      }
    );
  });
}

/**
 * المصادر. وتحت المِقْود (`DIWAN_TEST_INBOX`): مجلّداتٌ يعطيها السيناريو بدل مجلّدات الجهاز —
 * «downloads=…|whatsapp=…|flash=…» — فلا يقرأ الاختبار ملفّات صاحب الجهاز.
 */
async function sources(): Promise<Dir[]> {
  const test = __DIWAN_TEST_DOORS__ ? process.env['DIWAN_TEST_INBOX'] : undefined;
  if (test) {
    return test
      .split('|')
      .map((pair) => pair.split('='))
      .filter(([k, v]) => k && v && k in SOURCE_LABEL)
      .map(([k, v]) => ({ source: k as InboxSource, path: v!, depth: 1, recentOnly: k !== 'flash' }));
  }
  const dirs: Dir[] = [
    { source: 'downloads', path: app.getPath('downloads'), depth: 0, recentOnly: true },
    { source: 'desktop', path: app.getPath('desktop'), depth: 0, recentOnly: true },
    { source: 'documents', path: app.getPath('documents'), depth: 0, recentOnly: true }
  ];
  for (const p of await whatsappDirs()) dirs.push({ source: 'whatsapp', path: p, depth: 1, recentOnly: true });
  for (const d of await removableDrives()) dirs.push({ source: 'flash', path: d, depth: 1, recentOnly: false });
  return dirs;
}

async function walk(dir: Dir, path: string, depth: number, out: { path: string; file: Omit<InboxFile, 'id'> }[]) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return; // مجلّدٌ لا يُقرأ (صلاحيات، أو فلاشةٌ نُزعت) لا يُسقط القائمة.
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('~$')) continue;
    const full = join(path, e.name);
    if (e.isDirectory()) {
      if (depth > 0 && !/^(\$RECYCLE\.BIN|System Volume Information)$/i.test(e.name)) await walk(dir, full, depth - 1, out);
      continue;
    }
    const kind = KIND_OF[extname(e.name).toLowerCase()];
    if (!kind) continue;
    try {
      const s = await stat(full);
      if (dir.recentOnly && Date.now() - s.mtimeMs > RECENT_MS) continue;
      out.push({ path: full, file: { name: basename(full), kind, source: dir.source, modified: s.mtime.toISOString(), size: s.size } });
    } catch {
      /* ملفٌّ اختفى بين القراءتين */
    }
  }
}

/** معرّفٌ ← مسار: ما عُرض على الواجهة وحده يُفتح بمعرّفه. */
const known = new Map<string, string>();
let seq = 0;

/** يسجّل مسارًا ويعيد معرّفه — والمسار نفسه بمعرّفه نفسه ما دام البرنامج مفتوحًا. */
export function adopt(path: string): string {
  for (const [id, p] of known) if (p === path) return id;
  const id = `f${++seq}`;
  known.set(id, path);
  return id;
}

export function pathOf(id: string): string | null {
  return known.get(id) ?? null;
}

/** ما وصل، الأحدث أوّلًا. */
export async function listInbox(): Promise<InboxFile[]> {
  const found: { path: string; file: Omit<InboxFile, 'id'> }[] = [];
  for (const dir of await sources()) await walk(dir, dir.path, dir.depth, found);
  found.sort((a, b) => b.file.modified.localeCompare(a.file.modified));
  return found.slice(0, MAX_FILES).map(({ path, file }) => ({ id: adopt(path), ...file }));
}

/** ملفٌّ أُفلت على منطقة الإفلات — يُعرف نوعه ويُسجَّل، وما لا يُفتح في ديوان يُترك. */
export async function adoptDropped(paths: string[]): Promise<InboxFile[]> {
  const out: InboxFile[] = [];
  for (const path of paths) {
    const kind = KIND_OF[extname(path).toLowerCase()];
    if (!kind) continue;
    try {
      const s = await stat(path);
      if (!s.isFile()) continue;
      out.push({ id: adopt(path), name: basename(path), kind, source: 'desktop', modified: s.mtime.toISOString(), size: s.size });
    } catch {
      /* لا يُقرأ */
    }
  }
  return out;
}
