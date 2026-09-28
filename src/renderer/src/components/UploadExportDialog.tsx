/**
 * «صدّر للرفع» — مستمسكات المواطن ملفًّا لكلّ واحدٍ منها بحدّ خانة الرفع (تعميق الموجود ٤).
 *
 * استمارات أور تطلب كلّ مستمسكٍ في خانته (١٢٥ استمارة تفصل وجهَي البطاقة)، ولكلّ خانةٍ حدّها.
 * فيُختار ما يُرفع، ويُحفظ كلٌّ صورةً JPEG دون الحدّ، مرقَّمةً بترتيبها ومسمّاةً بنوعها —
 * «١ - البطاقة الوطنية - الوجه» — فيُرفع واحدًا واحدًا بلا بحثٍ ولا تصغيرٍ في موقعٍ آخر.
 */
import { useState } from 'react';
import type { Attachment } from '@shared/api';
import { SIZE_LIMITS, sizeText } from '@shared/pdfEdit';
import { errorText } from '../lib/errors';
import { fitJpeg, rememberLimit, savedLimit } from '../lib/fitImage';

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

export default function UploadExportDialog({
  attachments,
  owner,
  onClose,
  onDone
}: {
  attachments: Attachment[];
  owner: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  // الصور وحدها: ملف PDF مستمسكًا يُصغَّر من «ملفات PDF».
  const images = attachments.filter((a) => (a.fileFormat ?? '').toUpperCase() !== 'PDF');
  const [chosen, setChosen] = useState<number[]>(() => images.map((a) => a.id));
  // بلا حدٍّ محفوظٍ من قبل: ١ ميغا — يوافق ٩٩٪ من خانات أور.
  const [limit, setLimitState] = useState(() => savedLimit(1_000_000) || 1_000_000);
  const [gray, setGray] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setLimit = (bytes: number) => {
    setLimitState(bytes);
    rememberLimit(bytes);
  };
  const toggle = (id: number) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  // بترتيب الاختيار: الموظف يختار بترتيب خانات الاستمارة.
  const ordered = chosen.map((id) => images.find((a) => a.id === id)).filter(Boolean) as Attachment[];
  const short = owner.trim().split(/\s+/).slice(0, 2).join(' ');

  async function exportAll() {
    setError(null);
    try {
      const out: { name: string; bytes: Uint8Array }[] = [];
      for (const [k, a] of ordered.entries()) {
        setBusy(`يُصغَّر «${a.docType}» (${toIndic(k + 1)} من ${toIndic(ordered.length)})…`);
        const res = await fetch(`diwan://store/${a.filePath}`);
        if (!res.ok) throw new Error(`«${a.docType}»: ملفّه غير موجود في المخزن`);
        const fit = await fitJpeg(await res.blob(), limit, gray);
        if ('smallest' in fit) throw new Error(`«${a.docType}» لم يبلغ ${sizeText(limit)} — أصغر ما بلغه ${sizeText(fit.smallest)}`);
        out.push({ name: `${k + 1} - ${a.docType}${short ? ` - ${short}` : ''}`, bytes: new Uint8Array(await fit.blob.arrayBuffer()) });
      }
      setBusy('يُحفظ…');
      const saved = await window.diwan.pdf.saveImages(out);
      if (saved) onDone(`حُفظت ${toIndic(saved.files.length)} صورة في ${saved.folder} — كلٌّ دون ${sizeText(limit)}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر التصدير'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50" data-upload-export="" onClick={onClose}>
      <div className="w-[640px] max-h-[82vh] rounded-2xl bg-surface-container-lowest p-space-md flex flex-col gap-space-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-headline-sm text-headline-sm">المستمسكات للرفع — ملفٌّ لكلّ واحد</h2>
        <p className="font-label-md text-label-md text-on-surface-variant">
          اختر بترتيب خانات الاستمارة: يُحفظ كلٌّ صورةً دون الحدّ، مرقّمةً ومسمّاةً بنوعها — فتُرفع واحدةً واحدة.
        </p>
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-space-xs">
          {images.map((a) => {
            const n = chosen.indexOf(a.id);
            return (
              <button
                key={a.id}
                className={`relative rounded-lg border-2 p-1 flex flex-col gap-1 text-right ${n >= 0 ? 'border-secondary' : 'border-outline-variant opacity-60'}`}
                data-upload-item={a.id}
                type="button"
                onClick={() => toggle(a.id)}
              >
                <img alt="" className="w-full aspect-[1.6/1] object-cover rounded bg-surface-container-high" src={`diwan://store/${a.filePath}`} />
                <span className="font-label-sm text-label-sm truncate">{a.docType}</span>
                {n >= 0 && <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-secondary text-on-secondary text-[12px] flex items-center justify-center">{toIndic(n + 1)}</span>}
              </button>
            );
          })}
          {images.length < attachments.length && (
            <p className="col-span-3 font-label-sm text-label-sm text-on-surface-variant">ما كان ملفّ PDF يُصغَّر من «ملفات PDF».</p>
          )}
        </div>
        <div className="flex items-center gap-space-sm font-label-md text-label-md">
          <label className="flex items-center gap-1">
            حدّ الخانة
            <select className="h-9 min-w-[6.5rem] px-1 rounded-lg bg-surface-container-low border border-outline-variant" data-upload-limit="" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {SIZE_LIMITS.map((l) => (
                <option key={l.bytes} value={l.bytes}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <input checked={gray} data-upload-gray="" type="checkbox" onChange={(e) => setGray(e.target.checked)} />
            أبيض وأسود
          </label>
        </div>
        {error && <p className="font-label-md text-label-md text-error">{error}</p>}
        <div className="flex justify-end gap-space-sm">
          <button className="h-10 px-space-md rounded-lg font-label-md text-label-md" type="button" onClick={onClose}>
            إلغاء
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold disabled:opacity-40"
            data-act="upload-export-go"
            disabled={!ordered.length || busy !== null}
            type="button"
            onClick={() => void exportAll()}
          >
            {busy ?? `احفظ ${toIndic(ordered.length)} في مجلّد`}
          </button>
        </div>
      </div>
    </div>
  );
}
