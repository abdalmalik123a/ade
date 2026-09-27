/**
 * سجلّ الأخطاء (المرحلة ٧ — «لا خطأ يُبلع»).
 *
 * خطأٌ في العملية الرئيسة خارج قنوات الواجهة (مراقب مجلّد الكاميرا، مؤقّتٌ، وعدٌ لم
 * يُنتظر) كان يُظهر نافذة Electron الإنكليزية «A JavaScript error occurred» أو يمرّ
 * صامتًا. فيُكتب هنا في ملفٍّ داخل بيانات المكتب — يُرسل إلينا حين يُسأل عن عطل —
 * ويُبلَّغ به الموظف في شريط الأخطاء بالواجهة، ويبقى البرنامج يعمل.
 */
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

const MAX_BYTES = 1 << 20;

export function errorLogPath(): string {
  return join(app.getPath('userData'), 'logs', 'diwan-errors.log');
}

/** يكتب الخطأ بسطرٍ مؤرَّخٍ ومكدّسه — والسجلّ يُدوَّر عند الميغابايت فلا يكبر بلا حدّ. */
export function logError(where: string, error: unknown): void {
  try {
    const file = errorLogPath();
    mkdirSync(join(file, '..'), { recursive: true });
    try {
      if (statSync(file).size > MAX_BYTES) renameSync(file, `${file}.1`);
    } catch {
      /* لا سجلّ بعد */
    }
    const e = error instanceof Error ? error : new Error(String(error));
    appendFileSync(file, `${new Date().toISOString()} [${where}] ${e.message}\n${e.stack ?? ''}\n\n`, 'utf8');
  } catch {
    // السجلّ نفسه تعذّر (قرصٌ ممتلئ أو مجلّدٌ بلا صلاحية) — لا يُسقط البرنامج من أجله.
  }
}

/** خطأ العملية الرئيسة يُسجَّل ويُقال للموظف في الواجهة — ولا يُغلق البرنامج. */
export function installMainErrorHandlers(): void {
  const report = (where: string, error: unknown) => {
    logError(where, error);
    const message = error instanceof Error ? error.message : String(error);
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('app:error', message);
    }
  };
  process.on('uncaughtException', (e) => report('main', e));
  process.on('unhandledRejection', (e) => report('main:promise', e));
}
