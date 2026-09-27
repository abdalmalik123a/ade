/**
 * «البيانات والنسخ الاحتياطية» في الإعدادات (د١).
 *
 * خذ نسخة — مشفّرةً بكلمة مرورٍ إن شئت — واسترجع نسخة بعد أن ترى ما فيها. والاسترجاع
 * يحلّ محلّ بيانات هذا الجهاز كلّها، فيُقال ذلك بصراحة، وما كان يُنقل جانبًا لا يُحذف.
 */
import { useState } from 'react';
import type { BackupSummary } from '@shared/api';
import { BACKUP_REMIND_DAYS, daysSince, sinceText } from '@shared/dates';
import { errorText } from '../lib/errors';

const nf = new Intl.NumberFormat('en-US');
const input =
  'h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

export default function BackupPanel({
  lastBackupAt,
  card,
  title,
  onBackedUp
}: {
  lastBackupAt: string | null;
  card: string;
  title: React.ReactNode;
  onBackedUp: (at: string) => void;
}) {
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  // الاسترجاع: الملف، ثم كلمته إن كان مشفّرًا، ثم ما فيه، ثم الموافقة.
  const [picked, setPicked] = useState<{ path: string; encrypted: boolean } | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [summary, setSummary] = useState<BackupSummary | null>(null);

  const stale = !lastBackupAt || daysSince(lastBackupAt) >= BACKUP_REMIND_DAYS;
  const mismatch = encrypt && confirm.length > 0 && password !== confirm;
  const canCreate = !encrypt || (password.length >= 4 && password === confirm);

  async function create() {
    setBusy('create');
    setNote(null);
    try {
      const r = await window.diwan.backup.create(encrypt ? password : null);
      if (r) {
        onBackedUp(new Date().toISOString());
        setNote({ text: `حُفظت نسخة ${r.encrypted ? 'مشفّرة ' : ''}(${(r.bytes / 1024 / 1024).toFixed(1)} م.ب): ${r.path}`, tone: 'ok' });
        setPassword('');
        setConfirm('');
      }
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّرت النسخة الاحتياطية'), tone: 'warn' });
    } finally {
      setBusy(null);
    }
  }

  async function pick() {
    setNote(null);
    setSummary(null);
    setRestorePassword('');
    const p = await window.diwan.backup.pick();
    setPicked(p);
    if (p && !p.encrypted) await inspect(p.path, null);
  }

  async function inspect(path: string, pw: string | null) {
    setBusy('inspect');
    try {
      setSummary(await window.diwan.backup.inspect(path, pw));
      setNote(null);
    } catch (e) {
      setSummary(null);
      setNote({ text: errorText(e, 'تعذّر فحص النسخة'), tone: 'warn' });
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    if (!picked) return;
    setBusy('restore');
    try {
      const r = await window.diwan.backup.restore(picked.path, picked.encrypted ? restorePassword : null);
      setNote({ text: `استُرجعت النسخة — وما كان على الجهاز حُفظ في: ${r.aside}. تُعاد الشاشة الآن…`, tone: 'ok' });
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّر الاسترجاع — بقي الجهاز كما كان'), tone: 'warn' });
      setBusy(null);
    }
  }

  return (
    <section className={card} data-backup-panel="">
      {title}
      <p className={`font-label-md text-label-md ${stale ? 'text-error font-semibold' : 'text-on-surface-variant'}`} data-last-backup="">
        آخر نسخة احتياطية: {sinceText(lastBackupAt)}
        {stale && ' — خذ نسخةً الآن واحفظها خارج هذا الجهاز'}
      </p>

      {/* خذ نسخة */}
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
          <span className={`font-label-sm text-label-sm ${mismatch ? 'text-error' : 'text-on-surface-variant'}`}>
            {mismatch ? 'الكلمتان لا تتطابقان' : 'لا تُحفظ الكلمة في أي مكان: من نسيها لا تُفتح نسخته أبدًا. وأربعة أحرفٍ أقلّها.'}
          </span>
        </div>
      )}
      <button
        className="h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs disabled:opacity-40"
        data-act="backup-create"
        type="button"
        disabled={busy !== null || !canCreate}
        onClick={() => void create()}
      >
        <span className="material-symbols-outlined text-[18px]">backup</span>
        {busy === 'create' ? 'ينسخ...' : 'خذ نسخة احتياطية الآن'}
      </button>

      {/* استرجع نسخة */}
      <div className="pt-space-sm border-t border-outline-variant/40 flex flex-col gap-space-xs">
        <button
          className="h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-space-xs disabled:opacity-40"
          data-act="backup-pick"
          type="button"
          disabled={busy !== null}
          onClick={() => void pick()}
        >
          <span className="material-symbols-outlined text-[18px]">settings_backup_restore</span>
          استرجع نسخة احتياطية…
        </button>
        {picked?.encrypted && !summary && (
          <div className="flex gap-space-xs">
            <input
              className={`${input} flex-1`}
              data-restore-password=""
              placeholder="كلمة مرور النسخة"
              type="password"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
            />
            <button
              className="h-9 px-3 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-40"
              data-act="backup-inspect"
              type="button"
              disabled={!restorePassword || busy !== null}
              onClick={() => void inspect(picked.path, restorePassword)}
            >
              افحصها
            </button>
          </div>
        )}
        {summary && picked && (
          <div
            className={`p-space-sm rounded-lg flex flex-col gap-space-xs font-label-md text-label-md ${
              summary.ok ? 'bg-surface-container-low text-on-surface' : 'bg-error-container text-on-error-container'
            }`}
            data-backup-summary=""
          >
            <span className="font-semibold">
              {summary.ok ? 'النسخة سليمة' : `النسخة لا تجتاز الفحص (${summary.integrity})`}: {nf.format(summary.documents)} كتابًا ·{' '}
              {nf.format(summary.citizens)} مواطنًا · {nf.format(summary.templates)} نموذجًا · {nf.format(summary.files)} ملفًّا
              {summary.lastIssuedAt ? ` — آخر كتابٍ فيها ${summary.lastIssuedAt.slice(0, 16)}` : ''}
            </span>
            {summary.ok && (
              <>
                <span className="text-error">
                  تحلّ محلّ بيانات هذا الجهاز كلّها. وما عليه الآن يُنقل جانبًا إلى مجلّدٍ في بيانات المكتب — لا يُحذف.
                </span>
                <button
                  className="h-9 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold disabled:opacity-40"
                  data-act="backup-restore"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void restore()}
                >
                  {busy === 'restore' ? 'يسترجع...' : 'استرجعها مكان بيانات هذا الجهاز'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {note && (
        <p className={`font-label-sm text-label-sm break-all ${note.tone === 'ok' ? 'text-secondary' : 'text-error'}`} data-backup-note="">
          {note.text}
        </p>
      )}
    </section>
  );
}
