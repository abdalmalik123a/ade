/**
 * «توقّفت الطباعة عند الورقة ٢٤ من ٤٥ — أتستأنف؟»
 *
 * يظهر في الإقلاع إن بقيت دفعةٌ لم تكتمل (انقطعت الكهرباء، أو أُغلق البرنامج
 * والطابعة تعمل). والرقم المعروض ما **أُرسل** إلى الطابعة، لا ما خرج منها:
 * ما في ذاكرة الطابعة ضاع مع الكهرباء — فيكتب الموظف آخر ورقةٍ في الدرج،
 * ويُستأنف من التي تليها بالأوراق نفسها التي راجعها.
 */
import { useEffect, useState } from 'react';
import type { PendingPrintJob } from '@shared/api';

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

export default function ResumePrintDialog() {
  const [jobs, setJobs] = useState<PendingPrintJob[]>([]);
  const [lastOut, setLastOut] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void window.diwan.output.pendingJobs().then((list) => {
      setJobs(list);
      setLastOut(list[0]?.sent ?? 0);
    });
  }, []);

  const job = jobs[0];
  if (!job) return null;

  const next = () => {
    const rest = jobs.slice(1);
    setJobs(rest);
    setLastOut(rest[0]?.sent ?? 0);
    setNote(null);
  };

  async function resume() {
    setBusy(true);
    const off = window.diwan.output.onPrintProgress((p) => setNote(`يُطبع… ${toIndic(p.sent)} من ${toIndic(p.total)}`));
    try {
      const out = await window.diwan.output.resumeJob(job!.id, lastOut);
      if (out.ok) next();
      else {
        setNote(`توقّفت ثانيةً بعد ${toIndic(out.sent)} من ${toIndic(out.total)}${out.reason ? ` — ${out.reason}` : ''}`);
        setLastOut(out.sent);
      }
    } finally {
      off();
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50" data-resume-print="">
      <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest shadow-2xl p-space-lg flex flex-col gap-space-md">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-[28px] text-error">print_error</span>
          <span className="font-headline-sm text-headline-sm text-on-surface">طباعةٌ لم تكتمل</span>
        </div>
        <p className="font-body-md text-body-md text-on-surface leading-7">
          توقّفت طباعة «{job.label}» على «{job.printer}» عند الورقة <b>{toIndic(job.sent)}</b> من{' '}
          <b>{toIndic(job.total)}</b>.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md text-on-surface-variant">
            آخر ورقةٍ خرجت فعلًا (انظر في درج الطابعة — ما كان في ذاكرتها ضاع)
          </span>
          <input
            className="h-10 w-28 px-3 rounded-lg bg-surface-container-low text-on-surface text-center tabular font-label-md text-label-md"
            data-act="last-out"
            max={job.total}
            min={0}
            type="number"
            value={lastOut}
            onChange={(e) => setLastOut(Math.max(0, Math.min(job.total, Number(e.target.value) || 0)))}
          />
        </label>
        {note && <span className="font-label-md text-label-md text-on-surface-variant">{note}</span>}
        <div className="flex items-center gap-space-sm justify-end">
          <button
            className="h-10 px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
            disabled={busy}
            type="button"
            onClick={() => setJobs([])}
          >
            لاحقًا
          </button>
          <button
            className="h-10 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
            data-act="discard-job"
            disabled={busy}
            type="button"
            onClick={() => void window.diwan.output.discardJob(job.id).then(next)}
          >
            تجاهلها
          </button>
          <button
            className="h-10 px-5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
            data-act="resume-job"
            disabled={busy || lastOut >= job.total}
            type="button"
            onClick={() => void resume()}
          >
            استأنف من الورقة {toIndic(lastOut + 1)}
          </button>
        </div>
      </div>
    </div>
  );
}
