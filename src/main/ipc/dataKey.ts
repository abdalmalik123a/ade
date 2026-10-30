/**
 * رمز استرداد بيانات المكتب في البرنامج (D237): يُعرض أوّل مرّةٍ حتى يقرّ المكتب بحفظه، ويُحفظ ملفًّا،
 * وتعرضه الإعدادات بعد تأكيد، ويُستبدل برمزٍ جديد يُبطل القديم. ولا يُكتب في سجلّ الأخطاء ولا في تقرير المشكلة.
 */
import { writeFileSync } from 'node:fs';
import { BrowserWindow } from 'electron';
import { text } from '@shared/bridgeGuards';
import { dataDir, getDb } from '../db';
import { windowsProtector } from '../dataKeyBoot';
import { acknowledge, currentKey, hasKeys, needsAcknowledge, renewCode, storedCode } from '../services/dataKey';
import { logAudit } from '../services/documents';
import { sealProgress } from '../services/storeCrypt';
import { handleChecked } from './checked';
import { pickSavePath } from './files';

export function registerDataKeyIpc(): void {
  handleChecked('dataKey:pending', {}, () => (hasKeys(dataDir()) && needsAcknowledge(dataDir()) ? storedCode(dataDir(), windowsProtector()) : null));
  handleChecked('dataKey:acknowledge', {}, () => {
    acknowledge(dataDir());
    return true;
  });
  handleChecked('dataKey:show', {}, () => (hasKeys(dataDir()) ? storedCode(dataDir(), windowsProtector()) : null));
  /** تقدّم تشفير ما كُتب قبل D238 — شريطٌ صغير في الواجهة ما دام جاريًا. */
  handleChecked('dataKey:sealProgress', {}, () => sealProgress());
  handleChecked('dataKey:renew', {}, () => {
    const key = currentKey();
    if (!key) throw new Error('لا مفتاح لبيانات المكتب في هذه الجلسة');
    const code = renewCode(dataDir(), key, windowsProtector());
    logAudit(getDb(), 'backup', 'renewRecoveryCode', 'أُنشئ رمز استرداد جديد وأُبطل القديم');
    return code;
  });
  handleChecked('dataKey:save', { code: text(64) }, async ({ code }, e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const path = await pickSavePath(win, { title: 'احفظ رمز الاسترداد', defaultName: 'رمز-استرداد-ديوان.txt', filterName: 'نص', ext: 'txt' });
    if (!path) return null;
    writeFileSync(
      path,
      '﻿رمز استرداد بيانات المكتب — ديوان\r\n\r\n' +
        `${code}\r\n\r\n` +
        'يفتح بيانات المكتب إن أُعيد تنصيب ويندوز أو تغيّر الحساب. احفظه بعيدًا عن هذا الحاسوب (ورقةٌ مطبوعة أو هاتف)، ولا ترسله لأحد.\r\n',
      'utf8'
    );
    return path;
  });
}
