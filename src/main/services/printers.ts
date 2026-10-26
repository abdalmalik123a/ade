/**
 * طابعات ويندوز كما تراها نافذة البرنامج — لقائمة «الطابعة» ولـ«تشخيص الجهاز» (D186، نُقلت من `ipc/index.ts` كما هي).
 *
 * والافتراضية والمنقطعة على ويندوز **من سجلّه نفسه** (D192): Electron 44 يعطي هناك `options` فارغة، ومفاتيحها (`printer-is-default`
 * و`printer-state`) لـCUPS في لينكس وماك — فكانت لا افتراضية أبدًا ولا «غير جاهزة» أبدًا. ويُقرأ السجلّ بـ`reg export` إلى ملفٍّ مؤقّت:
 * يكتبه UTF-16 فيبقى الاسم العربي كما هو، و`reg query` يكتب بترميز الطرفية.
 */
import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WebContents } from 'electron';
import type { PrinterInfo } from '@shared/api';

/** قيمة `Device` فيه: «الاسم,winspool,المنفذ» لافتراضية المستخدم. */
const DEVICE_KEY = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows';
/** مفتاحٌ لكلّ طابعةٍ محلّية باسمها، وفيه `Attributes`. وطابعات الشبكة ليست فيه: تُعدّ مستعدّة. */
const PRINTERS_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers';
const PRINTERS_PREFIX = `${PRINTERS_KEY.replace(/^HKLM/, 'HKEY_LOCAL_MACHINE')}\\`.toLowerCase();
/** `PRINTER_ATTRIBUTE_WORK_OFFLINE`: ويندوز يراها «دون اتّصال». */
const WORK_OFFLINE = 0x400;

export type WindowsPrinterState = { defaultName: string | null; offline: ReadonlySet<string> };

/** من نصّ `.reg` (ما يكتبه `reg export`): اسم الافتراضية — ما قبل «,winspool,…» — أو null. */
export function defaultFromReg(text: string): string | null {
  const m = /^"Device"="((?:[^"\\]|\\.)*)"\s*$/m.exec(text);
  if (!m) return null;
  const value = m[1]!.replace(/\\(.)/g, '$1');
  const at = value.search(/,winspool,[^,]*$/i);
  const name = (at >= 0 ? value.slice(0, at) : value.split(',')[0]!).trim();
  return name || null;
}

/** ومنه أسماء الطابعات المحلّية (مفتاحٌ واحدٌ تحت `Printers`) التي فيها البتّ «دون اتّصال» — بأحرفٍ صغيرة. */
export function offlineFromReg(text: string): Set<string> {
  const offline = new Set<string>();
  let name: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('[')) {
      const key = line.slice(1, line.lastIndexOf(']'));
      const rest = key.toLowerCase().startsWith(PRINTERS_PREFIX) ? key.slice(PRINTERS_PREFIX.length) : '';
      name = rest && !rest.includes('\\') ? rest.toLowerCase() : null;
      continue;
    }
    const m = name ? /^"Attributes"=dword:([0-9a-f]{1,8})\s*$/i.exec(line) : null;
    if (m && parseInt(m[1]!, 16) & WORK_OFFLINE) offline.add(name!);
  }
  return offline;
}

let seq = 0;
/** يصدّر المفتاح إلى ملفٍّ مؤقّت ويقرؤه ثم يمحوه — و'' إن تعذّر (فيبقى ما يعطيه Electron). */
function exportKey(key: string): Promise<string> {
  const file = join(tmpdir(), `diwan-printers-${process.pid}-${++seq}.reg`);
  return new Promise((done) => {
    execFile('reg', ['export', key, file, '/y'], { windowsHide: true, timeout: 3000 }, (err) => {
      void (err ? Promise.resolve('') : readFile(file).then((b) => b.toString('utf16le'), () => ''))
        .then((text) => rm(file, { force: true }).then(() => text, () => text))
        .then(done);
    });
  });
}

/** افتراضية ويندوز ومنقطعاته — مرّةً لكلّ قائمة. */
export async function readWindowsPrinters(): Promise<WindowsPrinterState> {
  const [device, printers] = await Promise.all([exportKey(DEVICE_KEY), exportKey(PRINTERS_KEY)]);
  return { defaultName: defaultFromReg(device), offline: offlineFromReg(printers) };
}

export async function listPrinters(
  contents: Pick<WebContents, 'getPrintersAsync'>,
  readWindows: (() => Promise<WindowsPrinterState>) | null = process.platform === 'win32' ? readWindowsPrinters : null
): Promise<PrinterInfo[]> {
  const [printers, win] = await Promise.all([contents.getPrintersAsync(), readWindows?.() ?? null]);
  const def = win?.defaultName?.toLowerCase() ?? null;
  return printers.map((p) => {
    const options = (p.options ?? {}) as Record<string, unknown>;
    const flag = (key: string) => String(options[key] ?? '').toLowerCase();
    // CUPS يعرض الحالة في printer-state: 3 = مستعدة.
    const state = flag('printer-state');
    return {
      name: p.name,
      displayName: p.displayName,
      description: p.description ?? '',
      isDefault: def !== null ? p.name.toLowerCase() === def : flag('printer-is-default') === 'true' || flag('is-default') === 'true',
      ready: win ? !win.offline.has(p.name.toLowerCase()) : state === '' || state === '3'
    };
  });
}
