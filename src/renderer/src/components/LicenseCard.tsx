/**
 * «التفعيل» في الإعدادات (خطة Production، ٦٫٢): رمز الجهاز يُنسخ ويُرسل إلى المطوّر، ومفتاحٌ يُلصق —
 * كاملٌ مدى الحياة أو تمديدٌ للمدّة التجريبية — لهذا الجهاز وحده. ولا شبكة: البرنامج يتحقّق وحده.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { LicenseStatus } from '@shared/api';
import { RENEW_WARN_DAYS } from '@shared/license';
import { DEVELOPER } from '@shared/brand';
import { formatGregorian } from '@shared/dates';
import { errorText } from '../lib/errors';

/** يومٌ من المفتاح أو المدّة (YYYY-MM-DD) بتقويم المكتب: «١٥ تشرين الأول ٢٠٢٦». */
const day = (iso: string) => formatGregorian(new Date(`${iso}T12:00:00`));

const days = (n: number) => `${n} ${n === 1 ? 'يوم' : n <= 10 ? 'أيام' : 'يومًا'}`;

export function licenseLine(s: LicenseStatus): string {
  if (s.status === 'unverified') {
    return s.deviceWarning ?? 'تعذّر قراءة معرّف الجهاز — أعد المحاولة، وإن استمرّ العطل فاتّصل بالمطوّر';
  }
  if (s.status === 'activated') {
    return `${s.unverified ? 'تعذّر التحقّق من الجهاز (مهلة سماح) — ' : ''}مفعَّل مدى الحياة${s.office ? ` — ${s.office}` : ''} (صدر المفتاح ${day(s.issued)})`;
  }
  if (s.status === 'subscribed') {
    return `${s.unverified ? 'تعذّر التحقّق من الجهاز (مهلة سماح) — ' : ''}اشتراك ${s.plan === 'yearly' ? 'سنوي' : 'شهري'}${s.office ? ` — ${s.office}` : ''} حتى ${day(s.lastDay)} (بقي ${days(s.daysLeft)})`;
  }
  if (s.status === 'expired' && s.ended === 'subscription') {
    return `انتهى الاشتراك يوم ${day(s.lastDay)} — العرض والبحث والنسخ تعمل، والإصدار والطباعة تتوقّف حتى التجديد`;
  }
  if (s.status === 'trial') {
    return `${s.unverified ? 'تعذّر التحقّق من الجهاز — ' : ''}نسخة تجريبية — بقي ${s.daysLeft} ${s.daysLeft === 1 ? 'يوم' : s.daysLeft <= 10 ? 'أيام' : 'يومًا'} (حتى ${day(s.lastDay)})${s.extended ? ' بتمديد' : ''}`;
  }
  return `انتهت المدّة التجريبية يوم ${day(s.lastDay)} — العرض والبحث والنسخ تعمل، والإصدار والطباعة تتوقّف حتى التفعيل`;
}

export default function LicenseCard({ card, title, onChanged }: { card: string; title: ReactNode; onChanged?: (s: LicenseStatus) => void }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [key, setKey] = useState('');
  const [note, setNote] = useState<{ text: string; warn?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.diwan.license.status().then(setStatus).catch(() => setStatus(null));
  }, []);

  async function retryDetect() {
    setBusy(true);
    try {
      const next = await window.diwan.license.status(true);
      setStatus(next);
      onChanged?.(next);
      if (next.status !== 'unverified' && !next.unverified) {
        setNote({ text: 'تمّ التعرّف على الجهاز بنجاح' });
      } else {
        setNote({ text: 'ما زال معرّف الجهاز متعذّرًا', warn: true });
      }
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّرت المحاولة'), warn: true });
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setBusy(true);
    try {
      const next = await window.diwan.license.activate(key);
      setStatus(next);
      setKey('');
      onChanged?.(next);
      setNote({ text: next.status === 'activated' ? 'فُعّل البرنامج — شكرًا لك' : 'مُدّت المدّة التجريبية' });
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّر التفعيل'), warn: true });
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  const tone =
    status.status === 'activated'
      ? 'text-secondary'
      : status.status === 'expired' || status.status === 'unverified'
        ? 'text-error'
        : status.status === 'subscribed' && status.daysLeft <= RENEW_WARN_DAYS
          ? 'text-error'
          : 'text-on-surface';
  return (
    <section className={card} data-license={status.status}>
      {title}
      <p className={`font-label-md text-label-md font-semibold ${tone}`} data-license-line="">
        {licenseLine(status)}
      </p>
      {(status.status === 'unverified' || status.unverified) && (
        <div className="flex items-center justify-between p-2 rounded-card bg-error-container/30 text-on-error-container" data-unverified-warning="">
          <span className="font-label-sm text-label-sm">{status.deviceWarning ?? 'تعذّر قراءة معرّف الجهاز'}</span>
          <button
            className="h-8 px-3 rounded-btn bg-surface-container-high hover:bg-surface-container-highest font-label-sm text-label-sm font-semibold shrink-0"
            data-act="retry-device"
            disabled={busy}
            type="button"
            onClick={() => void retryDetect()}
          >
            أعِد المحاولة
          </button>
        </div>
      )}
      {status.status === 'subscribed' && (
        <p className="font-label-sm text-label-sm text-on-surface-variant">للتجديد: أرسل رمز الجهاز إلى المطوّر، والصق مفتاح التجديد هنا قبل يوم الانتهاء أو بعده.</p>
      )}
      {status.status !== 'activated' && (
        <>
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">رمز هذا الجهاز</span>
            <code className="flex-1 px-2 py-1 rounded-field bg-surface-container-low font-mono text-[13px] tracking-wide text-on-surface" data-device-code="" dir="ltr">
              {status.device}
            </code>
            <button
              className="h-8 px-2 rounded-btn bg-surface-container-high hover:bg-surface-container-highest font-label-sm text-label-sm"
              data-act="copy-device"
              type="button"
              onClick={() => void window.diwan.ui.copyText(status.device).then(() => setNote({ text: 'نُسخ الرمز — أرسله إلى المطوّر بواتساب' }))}
            >
              انسخ
            </button>
          </div>
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            أرسل الرمز إلى المطوّر ({DEVELOPER.nameAr}) بواتساب أو اتّصل:{' '}
            <a className="text-secondary font-semibold" dir="ltr" href={DEVELOPER.whatsapp} rel="noreferrer" target="_blank">
              {DEVELOPER.phoneDisplay}
            </a>
            ، فيصلك مفتاحٌ لهذا الجهاز وحده — الصقه هنا. ولا يحتاج البرنامج إلى الإنترنت.
          </p>
          <textarea
            className="input-field w-full min-h-[64px] px-3 py-2 text-on-surface font-mono text-[12px]"
            data-license-key=""
            dir="ltr"
            placeholder="DIWAN-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button
            className="h-10 btn-act font-label-md text-label-md font-semibold disabled:opacity-40"
            data-act="license-activate"
            disabled={busy || !key.trim()}
            type="button"
            onClick={() => void activate()}
          >
            فعّل
          </button>
        </>
      )}
      {note && (
        <p className={`font-label-sm text-label-sm ${note.warn ? 'text-error' : 'text-secondary'}`} data-license-note="">
          {note.text}
        </p>
      )}
    </section>
  );
}
