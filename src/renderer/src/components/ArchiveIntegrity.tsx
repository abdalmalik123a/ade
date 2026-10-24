/**
 * سلامة السجلّ (د٥): تُعاد بصمة كلّ كتابٍ من متنه، وسلسلة البصمات من أوّلها، وأرقام كلّ سنةٍ تُعدّ.
 * وبصمة آخر السلسلة تُكتب خارج الجهاز — من يحتفظ بها يثبت بها أنّ سجلّه كلّه لم يُمسّ حتى ذلك اليوم.
 *
 * كانت في شاشة «سجلّ التدقيق»؛ وصارت في «الإعدادات ← البيانات» (المرحلة ٣): فحصٌ يُجرى مرّةً في
 * الشهر لا ما يُقرأ كلّ يوم.
 */
import { useState } from 'react';
import type { ArchiveCheck } from '@shared/api';
import { errorText } from '../lib/errors';
import { count } from '@shared/arabic';

const nf = new Intl.NumberFormat('en-US');

export default function ArchiveIntegrity({ card, onOpenSerial }: { card: string; onOpenSerial?: (serial: string) => void }) {
  const [check, setCheck] = useState<ArchiveCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function verify() {
    setChecking(true);
    setError(null);
    try {
      setCheck(await window.diwan.documents.verify());
    } catch (e) {
      setError(errorText(e, 'تعذّر فحص السجلّ'));
    } finally {
      setChecking(false);
    }
  }

  const sound = check && check.problems.length === 0;

  return (
    <section className={card} data-integrity="">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex flex-col">
          {/* مرساةٌ في فهرس الإعدادات كبقيّة أقسامها (البند ٢٠). */}
          <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs" data-settings-section="سلامة السجلّ" style={{ scrollMarginTop: 136 }}>
            <span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
            سلامة السجلّ
          </h2>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            تُعاد بصمة كل كتابٍ من متنه، وسلسلة البصمات من أوّلها، وتُعدّ أرقام كل سنة
          </span>
        </div>
        <button
          className="h-10 px-space-md btn-act font-label-md text-label-md font-semibold flex items-center gap-space-xs disabled:opacity-50"
          data-act="verify-archive"
          type="button"
          disabled={checking}
          onClick={() => void verify()}
        >
          <span className="material-symbols-outlined text-[18px]">fact_check</span>
          {checking ? 'يفحص...' : 'تحقّق من سلامة السجلّ'}
        </button>
      </div>

      {error && <span className="font-label-sm text-label-sm text-error">{error}</span>}
      {check && (
        <div
          className={`p-space-sm rounded-card flex flex-col gap-space-xs font-label-md text-label-md ${
            sound ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-error-container text-on-error-container'
          }`}
          data-check-result={sound ? 'ok' : 'problems'}
        >
          <span className="font-semibold">
            {sound
              ? `السجلّ سليم: فُحص ${count(check.checked, 'كتاب')} — كلٌّ ببصمة متنه، والسلسلة متّصلة، ولا رقم غائب.`
              : `فُحص ${count(check.checked, 'كتاب')}، ووُجد ${nf.format(check.problems.length)} مما يُسأل عنه:`}
          </span>
          {!sound && (
            <ul className="list-disc pr-5 flex flex-col gap-0.5">
              {check.problems.map((p, i) => (
                <li key={i}>
                  <button className="font-mono underline" type="button" onClick={() => p.id !== null && onOpenSerial?.(p.serial)}>
                    {p.serial}
                  </button>{' '}
                  — {p.text}
                </li>
              ))}
            </ul>
          )}
          {check.head && (
            <div className="flex flex-wrap items-center gap-space-xs font-label-sm text-label-sm">
              <span>بصمة آخر السلسلة — اكتبها خارج الجهاز، فتثبت بها سجلّك حتى اليوم:</span>
              <span className="font-mono break-all" data-chain-head="">
                {check.head}
              </span>
              <button
                className="underline"
                type="button"
                onClick={() => {
                  void window.diwan.ui.copyText(check.head ?? '');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? 'نُسخت' : 'انسخها'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
