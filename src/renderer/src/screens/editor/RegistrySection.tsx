/**
 * لوح المحرّر — ٢ «العدد والتاريخ والصفحة» (تقسيمه بعد ١٫٧٫٠): العدد كما أعطاه الزبون، والتاريخان، وترقيم الصفحات وتكرار الترويسة.
 */
import type { Doc } from '@shared/doc';
import type { Registry } from '@shared/letterDraft';
import { inputCls } from '../EditorDialogs';
import { section, title } from './panelUi';

type Props = {
  registry: Registry;
  setReg: (patch: Partial<Registry>) => void;
  stampToday: () => void;
  doc: Doc;
  setDoc: (next: Doc | ((d: Doc) => Doc)) => void;
};

export default function RegistrySection({
  registry,
  setReg,
  stampToday,
  doc,
  setDoc
}: Props) {
  return (
    <section className={section}>
      {title('123', 'العدد والتاريخ والصفحة')}
      <div className="grid grid-cols-3 gap-space-xs">
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">العدد</span>
          <input className={inputCls} data-editor-number="" value={registry.number} placeholder="من الزبون" onChange={(e) => setReg({ number: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">ميلادي</span>
          <input className={inputCls} value={registry.dateGreg} placeholder="—" onChange={(e) => setReg({ dateGreg: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">هجري</span>
          <input className={inputCls} value={registry.dateHijri} placeholder="—" onChange={(e) => setReg({ dateHijri: e.target.value })} />
        </label>
      </div>
      <button
        className="h-8 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm"
        type="button"
        onClick={stampToday}
      >
        تاريخ اليوم (ميلادي وهجري)
      </button>
      <div className="flex flex-wrap gap-x-space-md gap-y-1 font-label-sm text-label-sm text-on-surface">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            checked={doc.pageSetup.pageNumbers}
            className="w-4 h-4 accent-secondary"
            data-act="page-numbers"
            type="checkbox"
            onChange={(e) => setDoc((d) => ({ ...d, pageSetup: { ...d.pageSetup, pageNumbers: e.target.checked } }))}
          />
          ترقيم الصفحات
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            checked={doc.pageSetup.repeatLetterhead}
            className="w-4 h-4 accent-secondary"
            data-act="repeat-head"
            type="checkbox"
            onChange={(e) => setDoc((d) => ({ ...d, pageSetup: { ...d.pageSetup, repeatLetterhead: e.target.checked } }))}
          />
          الترويسة في كل صفحة
        </label>
      </div>
    </section>
  );
}
