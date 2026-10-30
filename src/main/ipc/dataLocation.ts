/**
 * مجلّد بيانات المكتب في «الإعدادات ← البيانات» (D236): أين هو، وفتحه، ونقله إلى مكانٍ آخر في الإقلاع التالي
 * (والقاعدة مغلقة — `main/dataLocationBoot.ts`)، وما بقي جانبًا بعد نقلٍ سابق يحذفه المكتب بيده بتأكيد.
 */
import { existsSync, rmSync } from 'node:fs';
import { app, BrowserWindow, shell } from 'electron';
import type { DataLocationChoice, DataLocationInfo } from '@shared/api';
import { text } from '@shared/bridgeGuards';
import { dataDir, getDb } from '../db';
import { listDisks } from '../dataLocationBoot';
import { checkChoice, dirBytes, hasData, readPendingMove, readPointer, writePendingMove, writePointer } from '../services/dataLocation';
import { logAudit } from '../services/documents';
import { handleChecked } from './checked';
import { pickFolderPath } from './files';

const userData = (): string => app.getPath('userData');

function info(): DataLocationInfo {
  const pointer = readPointer(userData());
  return {
    path: dataDir(),
    asides: (pointer?.asides ?? []).filter((p) => existsSync(p)).map((path) => ({ path, bytes: dirBytes(path) })),
    pending: readPendingMove(userData())
  };
}

export function registerDataLocationIpc(): void {
  handleChecked('dataLocation:get', {}, () => info());
  handleChecked('dataLocation:open', {}, async () => (await shell.openPath(dataDir())) === '');

  /** يختار المكتب مكانًا ويُفحص — ولا يُنقل شيءٌ قبل «انقل». */
  handleChecked('dataLocation:pick', {}, async (_args, e): Promise<DataLocationChoice | null> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const path = await pickFolderPath(win, { title: 'اختر المكان الجديد لبيانات المكتب', buttonLabel: 'اختر هذا المجلّد' });
    if (!path) return null;
    const check = checkChoice(path, { userData: userData(), disks: listDisks(), env: process.env });
    if (!check.error && hasData(check.target)) return { ...check, error: 'في هذا المجلّد بيانات ديوانٍ أخرى — اختر مجلّدًا فارغًا.' };
    return check;
  });

  /** يُكتب النقل للإقلاع التالي؛ والواجهة تعيد تشغيل ديوان بعد أن يحفظ المكتب عمله. */
  handleChecked('dataLocation:moveTo', { target: text(1000) }, ({ target }) => {
    const check = checkChoice(target, { userData: userData(), disks: listDisks(), env: process.env });
    if (check.error || check.target !== target || hasData(target)) return false;
    writePendingMove(userData(), target);
    logAudit(getDb(), 'backup', 'dataMove', `طُلب نقل بيانات المكتب إلى ${target} عند التشغيل التالي`);
    return true;
  });

  handleChecked('dataLocation:restart', {}, () => {
    app.relaunch();
    app.quit();
    return true;
  });

  handleChecked('dataLocation:deleteAside', { path: text(1000) }, ({ path }) => {
    const pointer = readPointer(userData());
    if (!pointer || !pointer.asides.includes(path) || !existsSync(path)) return false;
    rmSync(path, { recursive: true, force: true });
    writePointer(userData(), { ...pointer, asides: pointer.asides.filter((p) => p !== path) });
    logAudit(getDb(), 'backup', 'deleteAside', `حُذف ما بقي جانبًا بعد نقل البيانات: ${path}`);
    return true;
  });
}
