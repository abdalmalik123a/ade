/**
 * «البيانات والنسخ الاحتياطية» في الإعدادات (د١).
 *
 * خذ نسخة — مشفّرةً بكلمة مرورٍ إن شئت — واسترجع نسخة بعد أن ترى ما فيها. والاسترجاع
 * يحلّ محلّ بيانات هذا الجهاز كلّها، فيُقال ذلك بصراحة، وما كان يُنقل جانبًا لا يُحذف.
 */
import { useEffect, useState } from 'react';
import type { AutoBackupStatus, BackupSummary, MirrorSnapshot } from '@shared/api';
import { BACKUP_REMIND_DAYS, daysSince, sinceText } from '@shared/dates';
import { errorText } from '../lib/errors';
import BackupCreate from './BackupCreate';

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
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  // الاسترجاع: الملف (أو مجلّد النسخة التلقائية)، ثم كلمته إن كان مشفّرًا، ثم ما فيه، ثم الموافقة.
  const [picked, setPicked] = useState<{ path: string; encrypted: boolean; mirror?: boolean; snapshots?: MirrorSnapshot[] } | null>(null);
  /** نسخة القاعدة المختارة من مجلّد النسخة التلقائية — وأحدثها أوّلًا (خطة Production، ٤٫٢). */
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  // النسخة التلقائية عند الإغلاق.
  const [auto, setAuto] = useState<AutoBackupStatus | null>(null);
  const [autoEncrypt, setAutoEncrypt] = useState(false);
  const [autoPassword, setAutoPassword] = useState('');
  const [autoConfirm, setAutoConfirm] = useState('');
  const [autoKeep, setAutoKeep] = useState(10);

  useEffect(() => {
    void window.diwan.backup
      .autoGet()
      .then((s) => {
        setAuto(s);
        setAutoKeep(s.keep);
      })
      .catch(() => setAuto(null));
  }, []);

  const stale = !lastBackupAt || daysSince(lastBackupAt) >= BACKUP_REMIND_DAYS;
  const autoMismatch = autoEncrypt && autoConfirm.length > 0 && autoPassword !== autoConfirm;
  const canEnableAuto = !autoEncrypt || (autoPassword.length >= 4 && autoPassword === autoConfirm);

  /** يُختار المجلّد ثم تُفعَّل — أو يُبدَّل مجلّدها وتبقى كلمتها. */
  async function chooseAutoDir(first: boolean) {
    setNote(null);
    try {
      const dir = await window.diwan.backup.autoPickDir();
      if (!dir) return;
      const next = await window.diwan.backup.autoSet({
        dir,
        keep: autoKeep,
        ...(first ? { password: autoEncrypt ? autoPassword : null } : {})
      });
      setAuto(next);
      setAutoPassword('');
      setAutoConfirm('');
      setNote({ text: `تُؤخذ نسخةٌ تلقائية${next.encrypted ? ' مشفّرة' : ''} كلّما أُغلق البرنامج، إلى: ${dir}`, tone: 'ok' });
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّر ضبط النسخة التلقائية'), tone: 'warn' });
    }
  }

  async function runAuto() {
    setBusy('auto');
    setNote(null);
    try {
      const r = await window.diwan.backup.autoRun();
      if (r) {
        onBackedUp(new Date().toISOString());
        setNote({
          text: `أُخذت النسخة التلقائية: ${r.dbChanged ? 'القاعدة' : 'القاعدة لم تتغيّر'}، و${nf.format(r.filesCopied)} ملفًّا جديدًا (${(r.bytesCopied / 1024 / 1024).toFixed(1)} م.ب) — ${r.root}`,
          tone: 'ok'
        });
      }
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّرت النسخة التلقائية'), tone: 'warn' });
    } finally {
      setAuto(await window.diwan.backup.autoGet().catch(() => auto));
      setBusy(null);
    }
  }

  async function stopAuto() {
    setAuto(await window.diwan.backup.autoSet({ dir: null }));
    setNote({ text: 'أُوقفت النسخة التلقائية — وما أُخذ منها باقٍ في مجلّده', tone: 'ok' });
  }

  async function pick(mirror = false) {
    setNote(null);
    setSummary(null);
    setRestorePassword('');
    try {
      const p = mirror ? await window.diwan.backup.mirrorPick() : await window.diwan.backup.pick();
      const snapshots = p && 'snapshots' in p ? (p.snapshots as MirrorSnapshot[]) : undefined;
      const next = p ? { path: p.path, encrypted: p.encrypted, mirror, snapshots } : null;
      const first = next?.snapshots?.[0]?.name ?? null;
      setPicked(next);
      setSnapshot(first);
      if (next && !next.encrypted) await inspect(next, null, first);
    } catch (e) {
      setPicked(null);
      setNote({ text: errorText(e, 'تعذّر فتح النسخة'), tone: 'warn' });
    }
  }

  async function inspect(target: { path: string; mirror?: boolean }, pw: string | null, snap: string | null = snapshot) {
    setBusy('inspect');
    try {
      setSummary(target.mirror ? await window.diwan.backup.mirrorInspect(target.path, pw, snap) : await window.diwan.backup.inspect(target.path, pw));
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
      const pw = picked.encrypted ? restorePassword : null;
      const r = picked.mirror ? await window.diwan.backup.mirrorRestore(picked.path, pw, snapshot) : await window.diwan.backup.restore(picked.path, pw);
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
      <BackupCreate
        onDone={(r) => {
          onBackedUp(new Date().toISOString());
          setNote({ text: `حُفظت نسخة ${r.encrypted ? 'مشفّرة ' : ''}(${(r.bytes / 1024 / 1024).toFixed(1)} م.ب): ${r.path}`, tone: 'ok' });
        }}
        onError={(text) => setNote({ text, tone: 'warn' })}
      />

      {/* النسخة التلقائية عند الإغلاق */}
      {auto && (
        <div className="pt-space-sm border-t border-outline-variant/40 flex flex-col gap-space-xs" data-auto-backup={auto.dir ? 'on' : 'off'}>
          <span className="font-label-lg text-label-lg font-semibold text-on-surface">النسخة التلقائية عند الإغلاق</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            كلّما أُغلق البرنامج تُؤخذ إلى مجلّدٍ تختاره — فلاشةٍ أو قرصٍ آخر: القاعدة إن تغيّرت (وتُبقى آخر نسخها)، وما جدّ من المستمسكات وحده.
          </span>
          {auto.dir ? (
            <>
              <span className="font-label-md text-label-md text-on-surface break-all" data-auto-dir="">
                {auto.encrypted ? 'مشفّرة، إلى: ' : 'إلى: '}
                {auto.dir}
              </span>
              <span className={`font-label-md text-label-md ${auto.lastError ? 'text-error font-semibold' : 'text-on-surface-variant'}`} data-auto-status="">
                {auto.lastError ? `لم تُؤخذ الأخيرة: ${auto.lastError}` : `آخر نسخة تلقائية: ${sinceText(auto.lastAt)}`}
              </span>
              <div className="flex gap-space-xs">
                <button
                  className="flex-1 h-9 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-40"
                  data-act="auto-backup-run"
                  disabled={busy !== null}
                  type="button"
                  onClick={() => void runAuto()}
                >
                  {busy === 'auto' ? 'تُؤخذ...' : 'خذها الآن'}
                </button>
                <button className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md" type="button" onClick={() => void chooseAutoDir(false)}>
                  غيّر المجلّد
                </button>
                <button className="h-9 px-3 rounded-lg text-error font-label-md text-label-md hover:bg-error-container" data-act="auto-backup-stop" type="button" onClick={() => void stopAuto()}>
                  أوقفها
                </button>
              </div>
            </>
          ) : (
            <>
              {auto.canEncrypt && (
                <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
                  <input checked={autoEncrypt} className="w-4 h-4 accent-secondary" data-auto-encrypt="" type="checkbox" onChange={(e) => setAutoEncrypt(e.target.checked)} />
                  مشفّرة بكلمة مرور
                </label>
              )}
              {autoEncrypt && (
                <div className="flex flex-col gap-1">
                  <div className="flex gap-space-xs">
                    <input className={`${input} flex-1`} data-auto-password="" placeholder="كلمة المرور" type="password" value={autoPassword} onChange={(e) => setAutoPassword(e.target.value)} />
                    <input className={`${input} flex-1`} data-auto-confirm="" placeholder="أعِدها" type="password" value={autoConfirm} onChange={(e) => setAutoConfirm(e.target.value)} />
                  </div>
                  <span className={`font-label-sm text-label-sm ${autoMismatch ? 'text-error' : 'text-on-surface-variant'}`}>
                    {autoMismatch
                      ? 'الكلمتان لا تتطابقان'
                      : 'تُحفظ على هذا الجهاز مشفّرةً بحساب ويندوز لتُؤخذ النسخة وحدها. واحفظها أنت أيضًا: بها وحدها تُسترجع النسخة على جهازٍ آخر.'}
                  </span>
                </div>
              )}
              <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface">
                تُبقى آخر
                <select className={`${input} w-20`} data-auto-keep="" value={autoKeep} onChange={(e) => setAutoKeep(Number(e.target.value))}>
                  {[5, 10, 20, 30].map((n) => (
                    <option key={n} value={n}>
                      {nf.format(n)}
                    </option>
                  ))}
                </select>
                نسخٍ من القاعدة
              </label>
              <button
                className="h-9 rounded-lg bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs disabled:opacity-40"
                data-act="auto-backup-enable"
                disabled={!canEnableAuto}
                type="button"
                onClick={() => void chooseAutoDir(true)}
              >
                <span className="material-symbols-outlined text-[18px]">folder_special</span>
                اختر المجلّد وفعّلها…
              </button>
            </>
          )}
        </div>
      )}

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
        <button
          className="h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-space-xs disabled:opacity-40"
          data-act="mirror-pick"
          type="button"
          disabled={busy !== null}
          onClick={() => void pick(true)}
        >
          <span className="material-symbols-outlined text-[18px]">folder_open</span>
          استرجع من مجلّد النسخة التلقائية…
        </button>
        {picked?.mirror && picked.snapshots && picked.snapshots.length > 1 && (
          <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface">
            نسخة القاعدة
            <select
              className={`${input} flex-1`}
              data-mirror-snapshot=""
              value={snapshot ?? ''}
              onChange={(e) => {
                const next = e.target.value;
                setSnapshot(next);
                setSummary(null);
                if (!picked.encrypted || restorePassword) void inspect(picked, picked.encrypted ? restorePassword : null, next);
              }}
            >
              {picked.snapshots.map((s, i) => (
                <option key={s.name} value={s.name}>
                  {new Date(s.at).toLocaleString('ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}
                  {i === 0 ? ' — الأحدث' : ''}
                  {s.appVersion ? ` — الإصدار ${s.appVersion}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
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
              onClick={() => void inspect(picked, restorePassword)}
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
            {(summary.appVersion || summary.createdAt) && (
              <span className="text-on-surface-variant" data-backup-version="">
                {summary.createdAt ? `أُخذت ${new Date(summary.createdAt).toLocaleString('ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                {summary.appVersion ? `${summary.createdAt ? ' — ' : ''}بالإصدار ${summary.appVersion}` : ''}
              </span>
            )}
            {summary.fromNewer && (
              <span className="text-error font-semibold" data-backup-newer="">
                النسخة من إصدارٍ أحدث من هذا البرنامج — ثبّت الإصدار الأحدث ثم استرجعها، فقاعدتها قد تحمل ما لا يعرفه هذا.
              </span>
            )}
            {summary.ok && !summary.fromNewer && (
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
