/**
 * «النسخ السابقة» — العودة إلى نسخة أمس من نموذجٍ أو ترويسة (FOUNDATION §٣).
 *
 * الاختيار لا يكتب شيئًا: يُحمِّل النسخة في المصمّم لتُراجَع، ثم تُعتمد بالحفظ —
 * فتصير نسخةً جديدة، وما كان قبلها محفوظٌ في النسخ أيضًا. فلا يضيع شيء بالاسترجاع.
 */
import { useEffect, useState } from 'react';
import type { Revision, RevisionKind, RevisionPayloads } from '@shared/api';

/** وقت القاعدة (UTC بلا منطقة) بتوقيت الجهاز: «أمس ١٠:٣٠» أو التاريخ. */
function when(at: string): string {
  const d = new Date(`${at.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return at;
  const time = d.toLocaleTimeString('ar-IQ-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86_400_000);
  if (diff === 0) return `اليوم ${time}`;
  if (diff === 1) return `أمس ${time}`;
  return `${d.toLocaleDateString('ar-IQ-u-nu-latn')} ${time}`;
}

export default function RevisionsMenu<K extends RevisionKind>({
  kind,
  id,
  current,
  onRestore
}: {
  kind: K;
  id: number;
  /** رقم النسخة الجارية — يُعرض بجانب الزرّ. */
  current?: number;
  onRestore: (payload: RevisionPayloads[K], revision: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Revision[] | null>(null);

  useEffect(() => {
    if (!open) return;
    void window.diwan.revisions.list(kind, id).then(setList);
  }, [open, kind, id, current]);

  async function pick(revision: number) {
    const payload = await window.diwan.revisions.get(kind, id, revision);
    if (payload) onRestore(payload, revision);
    setOpen(false);
  }

  return (
    <span className="relative">
      <button
        className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
        data-act="revisions"
        title="النسخ السابقة — العودة إلى ما كان قبل التعديل"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="material-symbols-outlined text-[18px]">history</span>
        <span>النسخة {current ?? 1}</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-11 z-20 w-72 max-h-80 overflow-y-auto rounded-xl bg-surface-container-lowest shadow-xl p-space-sm flex flex-col gap-1"
          data-revisions=""
        >
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            تُحمَّل النسخة لتراجعها، وتُعتمد بالحفظ — ولا يضيع ما قبلها.
          </span>
          {list === null ? (
            <span className="font-label-sm text-label-sm text-on-surface-variant py-space-sm text-center">…</span>
          ) : list.length === 0 ? (
            <span className="font-label-sm text-label-sm text-on-surface-variant py-space-sm text-center">
              لا نسخ سابقة — لم يُعدَّل منذ حُفظ أوّل مرّة
            </span>
          ) : (
            list.map((r) => (
              <button
                key={r.revision}
                className="flex items-center justify-between gap-space-sm p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-right"
                data-revision={r.revision}
                type="button"
                onClick={() => void pick(r.revision)}
              >
                <span className="font-label-md text-label-md text-on-surface font-semibold">النسخة {r.revision}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">حتى {when(r.createdAt)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </span>
  );
}
