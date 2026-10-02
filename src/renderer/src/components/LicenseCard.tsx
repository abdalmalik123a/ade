/**
 * «التفعيل» في الإعدادات (خطة Production، ٦٫٢): رمز الجهاز يُنسخ ويُرسل إلى المطوّر، ومفتاحٌ يُلصق —
 * كاملٌ مدى الحياة أو تمديدٌ للمدّة التجريبية — لهذا الجهاز وحده. ولا شبكة: البرنامج يتحقّق وحده.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { LicenseStatus } from '@shared/api';
import { DEVELOPER } from '@shared/brand';
import { formatGregorian } from '@shared/dates';
import { errorText } from '../lib/errors';

/** يومٌ من المفتاح أو المدّة (YYYY-MM-DD) بتقويم المكتب: «١٥ تشرين الأول ٢٠٢٦». */
const day = (iso: string) => formatGregorian(new Date(`${iso}T12:00:00`));

export function licenseLine(s: LicenseStatus): string {
  if (s.status === 'activated') return `مفعَّل مدى الحياة${s.office ? ` — ${s.office}` : ''} (صدر المفتاح ${day(s.issued)})`;
  if (s.status === 'trial') return `نسخة تجريبية — بقي ${s.daysLeft} ${s.daysLeft === 1 ? 'يوم' : s.daysLeft <= 10 ? 'أيام' : 'يومًا'} (حتى ${day(s.lastDay)})${s.extended ? ' بتمديد' : ''}`;
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
  const tone = status.status === 'activated' ? 'text-secondary' : status.status === 'expired' ? 'text-error' : 'text-on-surface';
  return (
    <section className={card} data-license={status.status}>
      {title}
      <p className={`font-label-md text-label-md font-semibold ${tone}`} data-license-line="">
        {licenseLine(status)}
      </p>
      {status.status !== 'activated' && (
        <>
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">رمز هذا الجهاز</span>
            <code className="flex-1 px-2 py-1 rounded-lg bg-surface-container-low font-mono text-[13px] tracking-wide text-on-surface" data-device-code="" dir="ltr">
              {status.device}
            </code>
            <button
              className="h-8 px-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-sm text-label-sm"
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
            className="w-full min-h-[64px] px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-secondary"
            data-license-key=""
            dir="ltr"
            placeholder="DIWAN-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button
            className="h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold disabled:opacity-40"
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
