/**
 * «خذ نسخة احتياطية» — مشفّرةً بكلمة مرورٍ إن شاء المكتب. في الإعدادات، وفي حوار زرّ الأرشيف
 * (خطة Production، ٤٫١): كان زرّ الأرشيف يأخذها بلا كلمةٍ ولا سؤال.
 */
import { useState } from 'react';
import { errorText } from '../lib/errors';
import { BACKUP_PASSWORD_MIN, backupPasswordProblem } from '@shared/backupPassword';

const input =
  'input-field h-9 px-3 text-on-surface font-label-md text-label-md';

export type BackupMade = { path: string; bytes: number; encrypted: boolean };

export default function BackupCreate({
  onDone,
  onError
}: {
  onDone: (made: BackupMade) => void;
  onError: (message: string) => void;
}) {
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const mismatch = encrypt && confirm.length > 0 && password !== confirm;
  // ثمانية أحرفٍ أقلّها (و٦) — والعملية الرئيسية تتحقّق أيضًا.
  const problem = encrypt && password ? backupPasswordProblem(password) : null;
  const canCreate = !encrypt || (password !== '' && !problem && password === confirm);

  async function create() {
    setBusy(true);
    try {
      const r = await window.diwan.backup.create(encrypt ? password : null);
      if (r) {
        setPassword('');
        setConfirm('');
        onDone(r);
      }
    } catch (e) {
      onError(errorText(e, 'تعذّرت النسخة الاحتياطية'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-xs" data-backup-create="">
      <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
        <input checked={encrypt} className="w-4 h-4 accent-secondary" data-backup-encrypt="" type="checkbox" onChange={(e) => setEncrypt(e.target.checked)} />
        مشفّرة بكلمة مرور — فيها صور المستمسكات وأرقام الناس
      </label>
      {encrypt && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-space-xs">
            <input className={`${input} flex-1`} data-backup-password="" placeholder="كلمة المرور" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <input className={`${input} flex-1`} data-backup-confirm="" placeholder="أعِدها" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <span className={`font-label-sm text-label-sm ${mismatch || problem ? 'text-error' : 'text-on-surface-variant'}`} data-backup-hint="">
            {mismatch ? 'الكلمتان لا تتطابقان' : problem ?? `لا تُحفظ الكلمة في أي مكان: من نسيها لا تُفتح نسخته أبدًا. و${BACKUP_PASSWORD_MIN} أحرفٍ أقلّها.`}
          </span>
        </div>
      )}
      <button
        className="h-10 btn-act font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs disabled:opacity-40"
        data-act="backup-create"
        type="button"
        disabled={busy || !canCreate}
        onClick={() => void create()}
      >
        <span className="material-symbols-outlined text-[18px]">backup</span>
        {busy ? 'ينسخ... (ملفًّا ملفًّا — قد يطول مع المستمسكات)' : 'خذ نسخة احتياطية الآن'}
      </button>
    </div>
  );
}
