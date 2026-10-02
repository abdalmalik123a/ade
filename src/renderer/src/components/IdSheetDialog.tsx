/**
 * «ورقة المستمسكات المجمّعة» (خطة Production، المرحلة ٥): عدّة مستمسكاتٍ بمقاسها ١:١ على A4 —
 * الوطنية والسكن وجهًا وظهرًا افتراضًا — من ملفّ المواطن أو الحاسوب أو الماسح، طباعةً وPDF.
 *
 * ومن ملفّ المواطن تُملأ الخانات بمستمسكاته وحدها (`fillFromAttachments`). وصورة الماسح صفحةٌ كاملة
 * والبطاقة في ركنها، فتُفتح التسوية لتُقصّ بمقاسها قبل أن تُصفّ — كما في «صانع الهويات».
 */
import { useMemo, useState } from 'react';
import type { Attachment } from '@shared/api';
import { STANDARD_CARD_SIZES, type IdColorFilter } from '@shared/idCardDuplex';
import { defaultSlots, fillFromAttachments, idSheetHtml, type SheetSlot } from '@shared/idSheet';
import { WATERMARK_PRESETS, purposeWatermark } from '@shared/watermark';
import DeskewModal from '../screens/DeskewModal';
import { errorText } from '../lib/errors';
import { choosePrinter } from '../lib/printChoice';

const resolveUrl = (src: string) =>
  src.startsWith('data:') || src.startsWith('blob:') ? src : `diwan://store/${src.split('/').map(encodeURIComponent).join('/')}`;

const FILTERS: { key: IdColorFilter; label: string }[] = [
  { key: 'color', label: 'ملوّنة' },
  { key: 'photocopy', label: 'نسخة تصوير' },
  { key: 'grayscale', label: 'رمادية' }
];

export default function IdSheetDialog({
  onClose,
  citizenName,
  attachments = []
}: {
  onClose: () => void;
  citizenName?: string;
  attachments?: Attachment[];
}) {
  const [slots, setSlots] = useState<SheetSlot[]>(() => fillFromAttachments(defaultSlots(), attachments));
  const [colorFilter, setColorFilter] = useState<IdColorFilter>('color');
  const [cutMarks, setCutMarks] = useState(true);
  const [labels, setLabels] = useState(false);
  const [wmOn, setWmOn] = useState(false);
  const [wmText, setWmText] = useState<string>(WATERMARK_PRESETS.copy);
  const [deskew, setDeskew] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; warn?: boolean } | null>(null);

  const set = (i: number, patch: Partial<SheetSlot>) => setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const pages = useMemo(
    () =>
      idSheetHtml(slots, {
        resolveUrl,
        colorFilter,
        cutMarks,
        labels,
        watermark: wmOn ? { text: wmText, opacity: 0.22, sizeMm: 3.4 } : null
      }),
    [slots, colorFilter, cutMarks, labels, wmOn, wmText]
  );

  async function fromFile(i: number) {
    const picked = await window.diwan.files.pickImage('photos');
    if (picked) set(i, { src: picked });
  }

  async function scan(i: number) {
    setBusy(true);
    try {
      set(i, { src: await window.diwan.scanner.scanImage(300) });
      setDeskew(i);
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّر المسح'), warn: true });
    } finally {
      setBusy(false);
    }
  }

  async function print() {
    const pick = await choosePrinter('copies', { allowSystem: true });
    if (!pick) return;
    setBusy(true);
    try {
      const out = await window.diwan.output.print({
        sheetHtml: pages.join(''),
        printer: pick.printer,
        copies: 1,
        silent: !pick.system,
        page: { w: 210, h: 297 }
      });
      setNote(out.ok ? { text: `أُرسلت ${pages.length} ورقة بمقاس ١:١` } : { text: out.reason || 'لم تتم الطباعة', warn: true });
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّرت الطباعة'), warn: true });
    } finally {
      setBusy(false);
    }
  }

  async function pdf() {
    setBusy(true);
    try {
      const path = await window.diwan.output.savePdf({
        sheetHtml: pages.join(''),
        suggestedName: citizenName ? `مستمسكات - ${citizenName}` : 'ورقة المستمسكات',
        page: { w: 210, h: 297 }
      });
      if (path) setNote({ text: `حُفظت PDF: ${path}` });
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّر حفظ PDF'), warn: true });
    } finally {
      setBusy(false);
    }
  }

  const field = 'h-8 px-2 rounded-lg bg-surface text-on-surface font-label-sm text-label-sm border border-outline-variant/50';
  const small =
    'h-8 px-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" data-id-sheet="">
      <div className="w-full max-w-6xl h-[94vh] flex flex-col bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden">
        <header className="px-space-lg py-space-sm flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-secondary text-[26px]">document_scanner</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">ورقة المستمسكات المجمّعة</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                كلّ مستمسكٍ بمقاسه الحقيقي ١:١ على A4{citizenName ? ` — ${citizenName}` : ''}
              </p>
            </div>
          </div>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface-container-high" data-act="id-sheet-close" title="إغلاق" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 min-h-0 flex">
          <div className="w-[26rem] shrink-0 overflow-y-auto p-space-md flex flex-col gap-space-sm bg-surface-container-low border-l border-outline-variant/40">
            {slots.map((slot, i) => (
              <div key={slot.id} className="rounded-xl bg-surface-container-lowest p-space-sm flex gap-space-sm" data-sheet-slot={slot.id}>
                <div className="w-20 h-14 shrink-0 rounded-md bg-surface-container-high overflow-hidden flex items-center justify-center">
                  {slot.src ? (
                    <img alt="" className="w-full h-full object-cover" src={resolveUrl(slot.src)} />
                  ) : (
                    <span className="material-symbols-outlined text-on-surface-variant/40">image</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex gap-1">
                    <input className={`${field} flex-1 min-w-0`} value={slot.label} onChange={(e) => set(i, { label: e.target.value })} />
                    <button
                      className="w-8 h-8 shrink-0 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
                      title="أزل هذا المستمسك من الورقة"
                      type="button"
                      onClick={() => setSlots((all) => all.filter((_, j) => j !== i))}
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  <select className={field} value={slot.sizeKey} onChange={(e) => set(i, { sizeKey: e.target.value })}>
                    {STANDARD_CARD_SIZES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label} — {s.w}×{s.h} ملم
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-1">
                    {attachments.length > 0 && (
                      <select
                        className={`${field} flex-1 min-w-0`}
                        value=""
                        onChange={(e) => e.target.value && set(i, { src: e.target.value })}
                      >
                        <option value="">من ملفّ المواطن…</option>
                        {attachments.map((a) => (
                          <option key={a.id} value={a.filePath}>
                            {a.docType || 'مستمسك'}
                          </option>
                        ))}
                      </select>
                    )}
                    <button className={small} type="button" onClick={() => void fromFile(i)}>
                      من الحاسوب
                    </button>
                    <button className={small} data-act="sheet-scan" disabled={busy} type="button" onClick={() => void scan(i)}>
                      امسح
                    </button>
                    {slot.src && (
                      <button className={small} title="قصّ البطاقة بمقاسها وتسوية ميلها" type="button" onClick={() => setDeskew(i)}>
                        سوِّ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              className="h-9 rounded-lg border border-dashed border-outline-variant text-secondary font-label-md text-label-md hover:bg-surface-container-high"
              data-act="sheet-add"
              type="button"
              onClick={() =>
                setSlots((all) => [...all, { id: `slot-${Date.now()}`, label: 'مستمسك', sizeKey: 'id1', src: null }])
              }
            >
              + مستمسكٌ آخر
            </button>

            <div className="rounded-xl bg-surface-container-lowest p-space-sm flex flex-col gap-space-xs font-label-sm text-label-sm text-on-surface">
              <div className="flex p-0.5 rounded-lg bg-surface-container-low">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={`flex-1 h-7 rounded-md ${colorFilter === f.key ? 'bg-primary-container text-on-primary font-semibold' : 'text-on-surface-variant'}`}
                    type="button"
                    onClick={() => setColorFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-space-xs">
                <input checked={cutMarks} type="checkbox" onChange={(e) => setCutMarks(e.target.checked)} />
                حدودٌ رقيقة للقصّ
              </label>
              <label className="flex items-center gap-space-xs">
                <input checked={labels} type="checkbox" onChange={(e) => setLabels(e.target.checked)} />
                اسم المستمسك تحته
              </label>
              <label className="flex items-center gap-space-xs">
                <input checked={wmOn} type="checkbox" onChange={(e) => setWmOn(e.target.checked)} />
                علامة مائية فوق الصور
              </label>
              {wmOn && (
                <input
                  className={field}
                  placeholder="الجهة التي تُقدَّم إليها"
                  onChange={(e) => setWmText(e.target.value ? purposeWatermark(e.target.value) : WATERMARK_PRESETS.copy)}
                />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 overflow-auto bg-neutral-800 p-space-lg flex flex-wrap items-start justify-center gap-space-lg">
            {pages.length === 0 ? (
              <span className="self-center text-white/60 font-label-md text-label-md">اختر صورةً لمستمسكٍ واحدٍ على الأقلّ لتُرى الورقة</span>
            ) : (
              pages.map((html, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-white/70 font-label-sm text-label-sm">ورقة {i + 1}</span>
                  {/* المعاينة بالمقاس الحقيقي مصغّرةً: الورقة بالملّم تُصغَّر كلّها لا تُعاد حسابًا. */}
                  <div className="bg-white shadow-2xl overflow-hidden" style={{ width: '357px', height: '505px' }}>
                    <div style={{ transform: 'scale(0.4498)', transformOrigin: 'top right', width: '210mm' }} dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <footer className="px-space-lg py-space-sm flex items-center justify-between gap-space-sm bg-surface-container-low shrink-0">
          <span className={`font-label-sm text-label-sm ${note?.warn ? 'text-error' : 'text-secondary'}`} data-sheet-note="">
            {note?.text ?? `${slots.filter((s) => s.src).length} من ${slots.length} بصورها — ${pages.length} ورقة`}
          </span>
          <div className="flex gap-space-sm">
            <button
              className="h-10 px-space-md rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md disabled:opacity-40"
              data-act="sheet-pdf"
              disabled={busy || pages.length === 0}
              type="button"
              onClick={() => void pdf()}
            >
              حفظ PDF
            </button>
            <button
              className="h-10 px-space-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold disabled:opacity-40"
              data-act="sheet-print"
              disabled={busy || pages.length === 0}
              type="button"
              onClick={() => void print()}
            >
              اطبع ١:١
            </button>
          </div>
        </footer>
      </div>

      {deskew !== null && slots[deskew]?.src && (
        <DeskewModal
          isOpen={true}
          imageSrc={resolveUrl(slots[deskew]!.src!)}
          onClose={() => setDeskew(null)}
          onApply={(flat) => {
            set(deskew, { src: flat });
            setDeskew(null);
          }}
        />
      )}
    </div>
  );
}
