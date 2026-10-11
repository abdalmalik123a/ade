/**
 * نوافذ محرّر الكتاب: «اطبع الكتاب» و«صدر الكتاب»، وحفظ الترويسة في المكتبة، و«اجعله نموذجًا».
 *
 * كانت في `EditorScreen.tsx` حتى بلغ سقفه، فنُقلت كما هي (محادثة «محرّر الكتاب»، البند ٤) — والشاشة تملك حالها وتفتحها.
 */
import { useEffect, useState } from 'react';
import type { IssueOutcome } from '@shared/api';
import type { Letterhead } from '@shared/letterhead';
import { countIn } from '@shared/arabic';

const COPY_KINDS = ['نسخة أصلية', 'نسخة مصدقة', 'نسخة مختومة'];

export const inputCls =
  'w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

export function SaveLayoutDialog({ current, onClose, onSave }: { current: Letterhead | null; onClose: () => void; onSave: (name: string, asNew: boolean) => void }) {
  const [name, setName] = useState(current?.name ?? '');
  return (
    <Modal title="حفظ الترويسة في المكتبة" onClose={onClose}>
      <div className="flex flex-col gap-space-md">
        <input autoFocus className={inputCls} placeholder="مثال: مديرية تربية بغداد / الرصافة الأولى" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex items-center justify-end gap-space-sm">
          <button className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
            تراجع
          </button>
          {current && (
            <button className="h-10 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={() => onSave(name || current.name, false)}>
              تحديث «{current.name}»
            </button>
          )}
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-50"
            disabled={!name.trim()}
            type="button"
            onClick={() => onSave(name, true)}
          >
            حفظ باسم جديد
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function AsTemplateDialog({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (title: string) => void }) {
  const [title, setTitle] = useState(initial);
  return (
    <Modal title="اجعله نموذجًا في المكتبة" onClose={onClose}>
      <div className="flex flex-col gap-space-md">
        <p className="font-label-md text-label-md text-on-surface-variant">
          يُحفظ الكتاب نموذجًا بترويسته وحقوله فارغةً — لا بقيم هذا الزبون — فيُملأ مرارًا من الشبّاك.
        </p>
        <input autoFocus className={inputCls} data-template-title="" placeholder="عنوان النموذج" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex items-center justify-end gap-space-sm">
          <button className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
            تراجع
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-50"
            data-act="save-as-template"
            disabled={!title.trim()}
            type="button"
            onClick={() => onSave(title.trim())}
          >
            احفظه نموذجًا
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** حوار الإصدار: عدد النسخ ونوعها. (والمال صامت: §١) و«اطبع» بعدد أوراقه: الصفحات × النسخ (UI.md ٦). */
export function IssueDialog({
  number,
  name,
  pages,
  printerName,
  busy,
  onClose,
  onIssue
}: {
  number: string;
  name: string;
  /** صفحات الكتاب كما تُطبع — أو لا قياس بعد. */
  pages: number | null;
  printerName: string | null;
  busy: boolean;
  onClose: () => void;
  onIssue: (opts: { copies: number; copyKind: string; print: boolean }) => void;
}) {
  const [copies, setCopies] = useState(1);
  const [copyKind, setCopyKind] = useState(COPY_KINDS[0]!);
  return (
    <Modal title="اطبع الكتاب" onClose={onClose}>
      <div className="flex flex-col gap-space-md">
        <div className="p-space-sm rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
          يُحفظ الكتاب في السجلّ تلقائيًّا برقمٍ داخلي وبصمة — والرقم للسجلّ وحده، لا يُطبع على الكتاب ولا يُلغى بعد الحفظ.
          <div className="mt-1 text-on-surface">
            صاحب العلاقة: <span className="font-bold">{name}</span>
            {number && (
              <>
                {' · '}العدد على الكتاب: <span className="font-mono">{number}</span>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">عدد النسخ</span>
            <input className={inputCls} min={1} type="number" value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">نوع النسخة</span>
            <select className={inputCls} value={copyKind} onChange={(e) => setCopyKind(e.target.value)}>
              {COPY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="font-label-sm text-label-sm text-on-surface-variant">
          {printerName ? (
            <>
              الطباعة إلى: <span className="text-on-surface font-semibold">{printerName}</span>
            </>
          ) : (
            'تُختار الطابعة عند الطبع'
          )}
        </div>
        <div className="flex items-center justify-end gap-space-sm">
          <button className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
            تراجع
          </button>
          <button
            className="h-10 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high font-label-md text-label-md disabled:opacity-50"
            data-act="issue-no-print"
            disabled={busy}
            type="button"
            onClick={() => onIssue({ copies, copyKind, print: false })}
          >
            احفظ بلا طباعة
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-50"
            disabled={busy}
            type="button"
            onClick={() => onIssue({ copies, copyKind, print: true })}
          >
            {busy ? 'يُطبع…' : pages ? `اطبع ${countIn(pages * copies, 'ورقة')}` : 'اطبع'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function IssuedDialog({
  outcome,
  repeated,
  onSaveClip,
  onRejectClip,
  onClose,
  onReprint,
  onExport
}: {
  outcome: IssueOutcome;
  repeated: { text: string; count: number }[];
  onSaveClip: (text: string) => Promise<void>;
  onRejectClip: (text: string) => void;
  onClose: () => void;
  onReprint: () => Promise<void>;
  onExport: () => Promise<void>;
}) {
  return (
    <Modal title="صدر الكتاب" onClose={onClose}>
      <div className="flex flex-col gap-space-md" data-issued="">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-[32px] text-secondary">verified</span>
          <span className="flex flex-col">
            <span className="font-headline-md text-headline-md text-on-surface font-mono">{outcome.serial}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {outcome.printed === 'ok'
                ? 'أُرسل إلى الطابعة وقُيّد في الأرشيف'
                : outcome.printed === 'skipped'
                  ? 'قُيّد في الأرشيف بلا طباعة'
                  : 'قُيّد في الأرشيف — الطباعة لم تتم'}
            </span>
            <span className="font-mono font-label-sm text-label-sm text-on-surface-variant" title={outcome.sha256}>
              البصمة: {outcome.sha256.slice(0, 16)}…
            </span>
          </span>
        </div>
        {repeated.map((r) => (
          <div key={r.text} className="p-space-sm rounded-lg bg-secondary-fixed/60 flex flex-col gap-space-xs" data-repeated-clip="">
            <span className="font-label-md text-label-md text-on-surface">
              كتبتَ هذه الفقرة في {r.count} كتب — احفظها كليشة تُدرج بضغطة؟
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant line-clamp-2">«{r.text}»</span>
            <div className="flex gap-space-xs">
              <button
                className="h-8 px-3 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md"
                data-act="repeated-save"
                type="button"
                onClick={() => void onSaveClip(r.text)}
              >
                احفظها كليشة
              </button>
              <button
                className="h-8 px-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
                data-act="repeated-reject"
                type="button"
                onClick={() => onRejectClip(r.text)}
              >
                لا
              </button>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-end gap-space-sm">
          <button className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={() => void onExport()}>
            حفظ PDF
          </button>
          <button className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={() => void onReprint()}>
            طباعة نسخة أخرى
          </button>
          <button className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold" type="button" onClick={onClose}>
            تم
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-space-lg">
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-lg overflow-hidden">
        <div className="h-12 px-space-md flex items-center justify-between bg-surface-container-low">
          <span className="font-headline-sm text-headline-sm text-on-surface">{title}</span>
          <button className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" type="button" onClick={onClose}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="p-space-md">{children}</div>
      </div>
    </div>
  );
}
