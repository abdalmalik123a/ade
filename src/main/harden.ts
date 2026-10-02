/**
 * تحصين النوافذ (خطة Production، ٦٫٤) — في مكانٍ واحد لكلّ نافذةٍ تحمل الواجهة:
 *
 * - **لا تنقّل**: النافذة لا تغادر صفحة البرنامج — رابطٌ أو ملفٌّ أُفلت عليها كان يستبدلها بغيرها.
 * - **وما يُفتح خارجها** روابط الويب وحدها (`https:` و`http:`) في متصفّح الجهاز — لا `file:` ولا غيره.
 * - **ولا webview** يُلحق بها.
 * - **والصلاحيات** الكاميرا وحدها (استوديو التصوير والمستمسكات) — وما سواها يُرفض.
 * - **وواجهةٌ سقطت** (نفاد ذاكرةٍ أو عطل) تُعاد تحميلًا فلا تبقى نافذةٌ بيضاء — ويُقيَّد السبب؛ وإن تكرّر
 *   السقوط ثلاثًا في دقيقةٍ وقف الإعادة وقيل للموظف.
 */
import { app, dialog, session, shell, type BrowserWindow, type WebContents } from 'electron';
import { logError } from './errorLog';

const ALLOWED_PERMISSIONS = new Set(['media', 'clipboard-sanitized-write']);

/** يُستدعى مرّةً بعد `app.whenReady`: صلاحيات الجلسة. */
export function hardenSession(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
}

/** يفتح رابط ويبٍ في متصفّح الجهاز — وما ليس رابط ويب لا يُفتح. */
export function openExternalSafe(url: string): void {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') void shell.openExternal(u.toString());
  } catch {
    // رابطٌ فاسد لا يُفتح.
  }
}

/** نافذةٌ تحمل الواجهة: لا تنقّل، ولا نوافذ، والروابط إلى المتصفّح، والسقوط يُعاد. */
export function hardenWindow(win: BrowserWindow, label: string): void {
  const contents: WebContents = win.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });
  const home = () => contents.getURL().split('#')[0]!.split('?')[0]!;
  contents.on('will-navigate', (event, url) => {
    // الصفحة نفسها (تغيّر المرساة أو إعادة التحميل) لا تُمنع؛ وما سواها يُمنع، والويب يُفتح خارجها.
    if (url.split('#')[0]!.split('?')[0] === home()) return;
    event.preventDefault();
    openExternalSafe(url);
  });
  contents.on('will-redirect', (event, url) => {
    if (url.split('#')[0]!.split('?')[0] !== home()) event.preventDefault();
  });

  const crashes: number[] = [];
  contents.on('render-process-gone', (_e, details) => {
    logError(`render-process-gone:${label}`, new Error(`${details.reason} (${details.exitCode})`));
    if (details.reason === 'clean-exit' || win.isDestroyed()) return;
    const now = Date.now();
    crashes.push(now);
    while (crashes.length && now - crashes[0]! > 60_000) crashes.shift();
    if (crashes.length >= 3) {
      void dialog.showMessageBox({
        type: 'error',
        title: 'ديوان',
        message: 'توقّفت واجهة البرنامج ثلاث مرّاتٍ في دقيقة',
        detail: 'البيانات محفوظة. أغلق البرنامج وافتحه ثانيةً — وإن تكرّر فأرسل ملفّ سجلّ الأخطاء إلى المطوّر.'
      });
      return;
    }
    contents.reload();
  });
}
