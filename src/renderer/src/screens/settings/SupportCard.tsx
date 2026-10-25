/**
 * «مشكلة في البرنامج؟» في الإعدادات (البند ٣٢): من هنا يُحفظ تقرير المشكلة متى شاء المكتب — لا حين يظهر خطأٌ وحده
 * (ذلك زرٌّ في شريط الأخطاء). والتقرير نفسه في `components/ProblemReportDialog`.
 * و«افحص الجهاز» (S34، D186): خمسة أسطرٍ بعلامة — والأسطر نفسها في التقرير.
 */
import { useState } from 'react';
import type { DiagnoseRow } from '@shared/api';
import ProblemReportDialog from '../../components/ProblemReportDialog';

type Props = {
  card: string;
  title: (icon: string, text: string) => JSX.Element;
};

const LOOK: Record<DiagnoseRow['level'], { icon: string; tone: string; label: string }> = {
  ok: { icon: 'check_circle', tone: 'text-primary', label: 'سليم' },
  warn: { icon: 'warning', tone: 'text-tertiary', label: 'انتبه' },
  bad: { icon: 'error', tone: 'text-error', label: 'لا يعمل' }
};

export default function SupportCard({ card, title }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DiagnoseRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const diagnose = async () => {
    setBusy(true);
    try {
      setRows(await window.diwan.ui.diagnose());
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={card} data-support="">
      {title('support_agent', 'مشكلة في البرنامج؟')}
      <p className="font-body-sm text-body-sm text-on-surface leading-7">
        احفظ تقرير المشكلة وأرسله إلى المطوّر بواتساب: فيه ما تكتبه عمّا حدث، ورقم الإصدار، وأخطاء البرنامج الأخيرة، وتشخيص الجهاز — ولا شيء من
        سجلّ المكتب ولا أسماء الزبائن.
      </p>
      <div className="flex flex-wrap gap-space-xs">
        <button
          className="h-10 px-space-md rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md flex items-center gap-1"
          data-act="open-problem-report"
          type="button"
          onClick={() => setOpen(true)}
        >
          <span className="material-symbols-outlined text-[18px]">support_agent</span>
          أرسل تقرير المشكلة
        </button>
        <button
          className="h-10 px-space-md rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md flex items-center gap-1 disabled:opacity-40"
          data-act="diagnose"
          disabled={busy}
          type="button"
          onClick={() => void diagnose()}
        >
          <span className="material-symbols-outlined text-[18px]">stethoscope</span>
          {busy ? 'يفحص…' : 'افحص الجهاز'}
        </button>
      </div>
      {rows && (
        <ul className="flex flex-col gap-space-xs" data-diagnostics="">
          {rows.map((r) => (
            <li key={r.key} className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface leading-6" data-diagnose={r.key} data-level={r.level}>
              <span className={`material-symbols-outlined text-[18px] mt-0.5 ${LOOK[r.level].tone}`} aria-label={LOOK[r.level].label}>
                {LOOK[r.level].icon}
              </span>
              <span>
                <span className="font-semibold">{r.title}:</span> {r.text}
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && <ProblemReportDialog onClose={() => setOpen(false)} />}
    </section>
  );
}
