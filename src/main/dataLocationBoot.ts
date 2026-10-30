/**
 * إقلاع مجلّد البيانات (D236، ر190 §١): يُحلّ أين بيانات المكتب قبل أن يُفتح منها شيء.
 *
 * - لا مؤشّر: يسأل المكتب أوّل مرّة ويقترح مكانًا خارج AppData، وينقل ما في `userData/data` إليه، ثم يكتب المؤشّر —
 *   بعد نجاح النقل وحده. وإن تعثّر النقل عمل ديوان هذه المرّة من المكان القديم، وسأل في التشغيل التالي.
 * - مؤشّرٌ مجلّده غائب (قرصٌ نُزع أو أُعيدت تسميته): يقول ذلك ويطلب إيصاله أو مكانه الجديد — **ولا يُنشئ سجلًّا فارغًا**.
 * - نقلٌ طلبه المكتب من الإعدادات: يجري هنا والقاعدة مغلقة.
 *
 * وتحت المِقْود (`DIWAN_TEST_DATA_CHOICE`): غيابه يُبقي `userData/data` بلا سؤال فلا تتغيّر السيناريوهات القائمة،
 * وقيمته مسارٌ يُختار كأنّ المكتب اختاره، و`quit` جواب «أغلق ديوان».
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { app, dialog } from 'electron';
import { setDataDir } from './db';
import { logError } from './errorLog';
import {
  checkChoice,
  clearPendingMove,
  dirBytes,
  hasData,
  legacyDataDir,
  moveData,
  readPendingMove,
  readPointer,
  suggestDataDir,
  writePointer,
  type Disk,
  type Pointer
} from './services/dataLocation';

/** أقراص الجهاز وأنواعها — مرّةً عند السؤال؛ وتعذُّرها لا يمنع الاختيار (يُقترح قرص النظام). */
export function listDisks(): Disk[] {
  if (process.platform !== 'win32') return [];
  try {
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_LogicalDisk | ForEach-Object { "$($_.DeviceID)|$($_.DriveType)" }'],
      { encoding: 'utf8', timeout: 8000, windowsHide: true }
    );
    return out
      .split(/\r?\n/)
      .map((line) => line.trim().split('|'))
      .filter(([id, type]) => /^[A-Z]:$/i.test(id ?? '') && /^\d+$/.test(type ?? ''))
      .map(([id, type]) => ({ id: id!, type: Number(type) }));
  } catch (e) {
    logError('dataLocation:disks', e);
    return [];
  }
}

const gb = (bytes: number): string => `${(bytes / 1024 ** 3).toFixed(bytes < 1024 ** 3 ? 2 : 1)} غيغابايت`;

/** يسأل حتى يختار المكتب مكانًا مقبولًا أو يغلق — ويعيد المجلّد الذي تُحفظ فيه البيانات فعلًا. */
function askFirstPlace(userData: string, answer: string | undefined, carrying: boolean): string | null {
  const disks = listDisks();
  const ctx = { userData, disks, env: process.env };
  if (answer !== undefined) {
    if (answer === 'quit') return null;
    const check = checkChoice(answer, ctx);
    return check.error ? null : check.target;
  }
  const suggestion = suggestDataDir(disks, process.env['SystemDrive'] ?? 'C:');
  for (;;) {
    const button = dialog.showMessageBoxSync({
      type: 'question',
      title: 'مكان بيانات المكتب',
      message: 'أين يحفظ ديوان سجلّ المكتب؟',
      detail:
        'يحفظ ديوان القاعدة والمستمسكات والصور والترخيص في مجلّدٍ واحد تختاره الآن، ولا يُمحى إن أُزيل البرنامج.\n\n' +
        `المقترح: ${suggestion}\n\n` +
        'اختر قرصًا ثابتًا في هذا الحاسوب — لا فلاشة ولا مجلّد OneDrive أو شبكة.' +
        (carrying ? '\nوبيانات ديوان الحالية تُنقل إليه كما هي.' : ''),
      buttons: ['احفظه في المقترح', 'اختر مجلّدًا آخر…', 'أغلق ديوان'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    });
    if (button === 2) return null;
    let path = suggestion;
    if (button === 1) {
      const picked = dialog.showOpenDialogSync({ title: 'اختر مجلّد بيانات المكتب', properties: ['openDirectory', 'createDirectory'] });
      if (!picked?.[0]) continue;
      path = picked[0];
    }
    const check = checkChoice(path, ctx);
    if (check.error) {
      dialog.showMessageBoxSync({ type: 'warning', title: 'مكان بيانات المكتب', message: check.error, buttons: ['اختر غيره'], noLink: true });
      continue;
    }
    if (check.warning) {
      const keep = dialog.showMessageBoxSync({
        type: 'warning',
        title: 'مكان بيانات المكتب',
        message: check.warning,
        detail: check.target,
        buttons: ['اختر غيره', 'احفظه هنا على أيّ حال'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (keep !== 1) continue;
    }
    return check.target;
  }
}

/**
 * ينقل البيانات إلى `target` ويكتب المؤشّر بعد النجاح؛ ومجلّدٌ فيه بيانات ديوانٍ أصلًا يُفتح كما هو ولا يُنقل إليه شيء.
 * وإن تعثّر النقل بقيت البيانات في مكانها وأُعيد `null`.
 */
async function settle(userData: string, from: string, target: string, asides: string[], quiet: boolean): Promise<Pointer | null> {
  if (hasData(target)) {
    if (hasData(from) && !quiet) {
      dialog.showMessageBoxSync({
        type: 'info',
        title: 'مكان بيانات المكتب',
        message: 'في المجلّد المختار بيانات ديوان، فتُفتح هي.',
        detail: `وما كان في المكان السابق بقي كما هو: ${from}`,
        buttons: ['حسنًا'],
        noLink: true
      });
    }
    const pointer = { path: target, asides };
    writePointer(userData, pointer);
    return pointer;
  }
  const abort = new AbortController();
  if (hasData(from) && !quiet) {
    void dialog.showMessageBox({
      type: 'info',
      title: 'نقل بيانات المكتب',
      message: 'يُنقل سجلّ المكتب إلى مكانه الجديد…',
      detail: `من: ${from}\nإلى: ${target}\nالحجم: ${gb(dirBytes(from))}\n\nلا تطفئ الحاسوب حتى يُفتح ديوان.`,
      buttons: ['حسنًا'],
      noLink: true,
      signal: abort.signal
    });
  }
  try {
    const moved = await moveData(from, target);
    const pointer = { path: target, asides: moved.aside ? [...asides, moved.aside] : asides };
    writePointer(userData, pointer);
    return pointer;
  } catch (e) {
    logError('dataLocation:move', e);
    if (!quiet) {
      dialog.showErrorBox(
        'تعذّر نقل بيانات المكتب',
        `${e instanceof Error ? e.message : String(e)}\n\nبقيت البيانات في مكانها (${from}) ولم يُحذف منها شيء.`
      );
    }
    return null;
  } finally {
    abort.abort();
  }
}

/** مجلّدٌ غاب: يُنتظر أو يُختار مكانه الجديد (فيه بياناته)، ولا يُنشأ غيره. */
function findMissing(userData: string, pointer: Pointer, answer: string | undefined): Pointer | null {
  let current = pointer;
  while (!existsSync(current.path)) {
    const button =
      answer === 'quit'
        ? 2
        : answer !== undefined
          ? 1
          : dialog.showMessageBoxSync({
              type: 'warning',
              title: 'مجلّد البيانات غير موجود',
              message: 'لم يجد ديوان مجلّد بيانات المكتب.',
              detail:
                `المكان: ${current.path}\n\n` +
                'إن كان على قرصٍ أو فلاشة فأوصله ثم «أعد المحاولة»، أو اختر مكانه إن نقلته. ولن يُنشئ ديوان سجلًّا فارغًا في مكانٍ آخر.',
              buttons: ['أعد المحاولة', 'اختر مكانه الجديد…', 'أغلق ديوان'],
              defaultId: 0,
              cancelId: 2,
              noLink: true
            });
    if (button === 2) return null;
    if (button !== 1) continue;
    const picked = answer !== undefined ? [answer] : dialog.showOpenDialogSync({ title: 'أين مجلّد بيانات المكتب الآن؟', properties: ['openDirectory'] });
    const path = picked?.[0];
    if (path && hasData(path)) {
      current = { ...current, path };
      writePointer(userData, current);
    } else if (answer !== undefined) {
      return null;
    } else if (path) {
      dialog.showMessageBoxSync({ type: 'warning', title: 'مجلّد البيانات', message: 'لا بيانات ديوان في هذا المجلّد.', detail: 'اختر المجلّد الذي فيه diwan.db.', buttons: ['حسنًا'], noLink: true });
    }
  }
  return current;
}

/** يُحلّ مجلّد البيانات ويُضبط لـ`dataDir()` — و`false`: أغلق ديوان (اختار المكتب الإغلاق). */
export async function ensureDataLocation(): Promise<boolean> {
  const userData = app.getPath('userData');
  const legacy = legacyDataDir(userData);
  const answer = __DIWAN_TEST_DOORS__ ? process.env['DIWAN_TEST_DATA_CHOICE'] : undefined;
  let pointer = readPointer(userData);
  if (!pointer && __DIWAN_TEST_DOORS__ && answer === undefined) {
    // تحت المِقْود بلا جواب: المكان القديم بلا سؤال — ونقلٌ طُلب من الإعدادات يجري منه.
    if (!readPendingMove(userData)) {
      setDataDir(legacy);
      return true;
    }
    pointer = { path: legacy, asides: [] };
  }
  if (!pointer) {
    const target = askFirstPlace(userData, answer, hasData(legacy));
    if (!target) return false;
    pointer = await settle(userData, legacy, target, [], answer !== undefined);
    if (!pointer) {
      // النقل تعثّر: يعمل ديوان هذه المرّة من المكان القديم، ويُسأل المكتب في التشغيل التالي.
      setDataDir(legacy);
      return true;
    }
  }
  const found = findMissing(userData, pointer, answer);
  if (!found) return false;
  pointer = found;
  const pending = readPendingMove(userData);
  if (pending) {
    clearPendingMove(userData);
    pointer = (await settle(userData, pointer.path, pending, pointer.asides, false)) ?? pointer;
  }
  setDataDir(pointer.path);
  return true;
}
