/**
 * «ورقة المستمسكات» كما يعمل المكتب (S47، ر180–ر182) — تحلّ محلّ «استنساخ هوية» و«الورقة المجمّعة» من مداخلهما كلّها.
 *
 * الورقة نفسها مكان العمل (`SheetPages`): «＋» ثم النوع ثم «وجهٌ واحد» أو «وجهٌ وظهر» ثم المصدر، فيُملأ الوجه ويُطلب الظهر بعده وحده؛
 * والخانة الفارغة تُملأ بالنقر، والنقر على مستمسكٍ يفتح لوحته (`DocPanel`)، وبلا تحديدٍ خيارات الورقة (`SheetOptions`). والطباعة وPDF ظاهران
 * دائمًا. والمسح عابرٌ يُحذف بالإغلاق (مراجعة ٧ ت١)، وصورة الماسح صفحةٌ كاملة فتُفتح التسوية لتُقصّ بمقاسها.
 */
import { useMemo, useState } from 'react';
import type { Attachment } from '@shared/api';
import { docSheetHtml, faceLabel, fillDocs, layoutDocs, newDoc, pageCount, startDocs, type Face, type SheetDoc } from '@shared/idDocSheet';
import { cardFilterCss } from '@shared/idCardDuplex';
import { WATERMARK_PRESETS } from '@shared/watermark';
import { count, countIn } from '@shared/arabic';
import { useTransientScans } from '../../lib/transientScans';
import { errorText } from '../../lib/errors';
import { choosePrinter } from '../../lib/printChoice';
import { useEscape } from '../../kit/useEscape';
import { useToolNav } from '../../components/ToolFrame';
import { PrinterNote } from '../../components/OutputBar';
import DeskewModal from '../DeskewModal';
import CameraCapture from '../../components/CameraCapture';
import SheetPages from './SheetPages';
import DocPanel from './DocPanel';
import SheetOptions, { type SheetLookState, type WatermarkState } from './SheetOptions';
import { AddMenu, SourcePicker } from './AddDoc';
import RectCropModal from './RectCropModal';
import { rotateRight } from './imageOps';

export const resolveUrl = (src: string) =>
  src.startsWith('data:') || src.startsWith('blob:') ? src : `diwan://store/${src.split('/').map(encodeURIComponent).join('/')}`;

type Target = { docId: string; face: Face; chain: boolean };

type Props = {
  /** «استنساخ هوية» يبدأ بالوطنية في نصفي الورقة، و«المستمسكات على ورقة» بالوطنية والسكن. */
  start: 'id-copy' | 'id-sheet';
  onClose: () => void;
  citizenName?: string;
  attachments?: Attachment[];
};

export default function IdDocsDialog({ start, onClose, citizenName, attachments = [] }: Props) {
  useEscape(onClose);
  const scanTransient = useTransientScans();
  const { printRoles } = useToolNav();
  const [docs, setDocs] = useState<SheetDoc[]>(() => fillDocs(startDocs(start), attachments));
  const [selected, setSelected] = useState<string | null>(null);
  const [look, setLookState] = useState<SheetLookState>({
    colorFilter: 'color',
    brightness: 1,
    contrast: 1,
    cutMarks: true,
    labels: false,
    fold: true,
    rounded: false,
    shadow: false,
    duplex: false
  });
  const [wm, setWmState] = useState<WatermarkState>({ on: false, to: '', text: WATERMARK_PRESETS.copy, opacity: 0.22 });
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState<Target | null>(null);
  const [deskew, setDeskew] = useState<Target | null>(null);
  const [camera, setCamera] = useState<Target | null>(null);
  /** «قصٌّ مستطيل» لوجهٍ له صورة (D199) — و«الأركان الأربعة» التسوية نفسها (`deskew`). */
  const [rectCrop, setRectCrop] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; warn?: boolean } | null>(null);

  const setLook = (patch: Partial<SheetLookState>) => setLookState((l) => ({ ...l, ...patch }));
  const setWm = (patch: Partial<WatermarkState>) => setWmState((w) => ({ ...w, ...patch }));
  const setDoc = (id: string, patch: Partial<SheetDoc>) => setDocs((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const docOf = (id: string) => docs.find((d) => d.id === id) ?? null;
  const srcOf = (t: Target | null) => {
    const d = t ? docOf(t.docId) : null;
    return d ? (t!.face === 'front' ? d.front : d.back) : null;
  };
  const setFace = (t: Target, src: string) => setDoc(t.docId, t.face === 'front' ? { front: src } : { back: src });

  const placements = useMemo(() => layoutDocs(docs, { duplex: look.duplex }), [docs, look.duplex]);
  const pages = pageCount(docs, placements, look.duplex);
  const watermark = useMemo(() => (wm.on ? { text: wm.text, opacity: wm.opacity, sizeMm: 3.4 } : null), [wm]);
  const html = useMemo(() => docSheetHtml(docs, { resolveUrl, ...look, watermark }), [docs, look, watermark]);

  /** بعد وجه مستمسكٍ يُضاف بوجهين يُطلب ظهره وحده. */
  function chainNext(t: Target) {
    const doc = docOf(t.docId);
    if (t.chain && t.face === 'front' && doc?.faces === 2 && !doc.back) setPicking({ docId: t.docId, face: 'back', chain: false });
  }

  function filled(t: Target, src: string) {
    setFace(t, src);
    chainNext(t);
  }

  async function scan(t: Target) {
    setPicking(null);
    setBusy(true);
    try {
      const src = await scanTransient(300);
      setFace(t, src);
      setDeskew(t);
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّر المسح'), warn: true });
    } finally {
      setBusy(false);
    }
  }

  async function fromFile(t: Target) {
    setPicking(null);
    const picked = await window.diwan.files.pickImage('photos');
    if (picked) filled(t, picked);
  }

  /** «دوّر ٩٠°»: الصورة الممسوحة على جنبها تُصحَّح، والخانة بمقاسها كما هي. */
  async function rotate(t: Target) {
    const src = srcOf(t);
    if (!src) return;
    setBusy(true);
    try {
      setFace(t, await rotateRight(resolveUrl(src)));
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّر التدوير'), warn: true });
    } finally {
      setBusy(false);
    }
  }

  function add(typeKey: string, faces: 1 | 2) {
    const doc = newDoc(typeKey, { faces });
    setDocs((all) => [...all, doc]);
    setAdding(false);
    setSelected(doc.id);
    setPicking({ docId: doc.id, face: 'front', chain: true });
  }

  async function print() {
    const pick = await choosePrinter('copies', { allowSystem: true });
    if (!pick) return;
    setBusy(true);
    try {
      const out = await window.diwan.output.print({
        sheetHtml: html.join(''),
        printer: pick.printer,
        copies: 1,
        silent: !pick.system,
        page: { w: 210, h: 297 },
        duplex: look.duplex
      });
      setNote(out.ok ? { text: `أُرسلت ${count(html.length, 'ورقة')} بالمقاس الحقيقي` } : { text: out.reason || 'لم تتم الطباعة', warn: true });
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
        sheetHtml: html.join(''),
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

  const current = selected ? docOf(selected) : null;
  const pickDoc = picking ? docOf(picking.docId) : null;
  const deskewDoc = deskew ? docOf(deskew.docId) : null;
  const deskewSrc = srcOf(deskew);
  const rectDoc = rectCrop ? docOf(rectCrop.docId) : null;
  const rectSrc = srcOf(rectCrop);
  const tool = 'flex-1 h-8 rounded-btn border border-outline-variant hover:bg-surface-container-high font-label-sm text-label-sm disabled:opacity-40';
  const filledCount = docs.filter((d) => d.front || d.back).length;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" data-id-sheet="">
      <div className="w-full max-w-7xl h-[94vh] flex flex-col surface-panel overflow-hidden">
        <header className="px-space-lg py-space-sm flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-secondary text-[26px]">badge</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">ورقة المستمسكات</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                كلّ مستمسكٍ بمقاسه الحقيقي بالملّم على A4 — انقره لأدواته{citizenName ? ` — ${citizenName}` : ''}
              </p>
            </div>
          </div>
          <button className="w-9 h-9 rounded-btn flex items-center justify-center hover:bg-surface-container-high" data-act="id-sheet-close" title="إغلاق" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 min-h-0 flex">
          {current ? (
            <DocPanel
              doc={current}
              resolveUrl={resolveUrl}
              scale={Math.min(1, ...placements.filter((p) => docs[p.doc]?.id === current.id).map((p) => p.scale))}
              onChange={(patch) => setDoc(current.id, patch)}
              onDelete={() => {
                setDocs((all) => all.filter((d) => d.id !== current.id));
                setSelected(null);
              }}
              onDone={() => setSelected(null)}
              onPick={(face) => setPicking({ docId: current.id, face, chain: false })}
              faceTools={(face) => (
                <div className="flex gap-1">
                  <button className={tool} data-act={`face-corners-${face}`} title="اسحب الأركان الأربعة فتُقوَّم الصورة المائلة" type="button" onClick={() => setDeskew({ docId: current.id, face, chain: false })}>
                    الأركان الأربعة
                  </button>
                  <button className={tool} data-act={`face-rect-${face}`} title="مستطيلٌ بمقابض يُسحب" type="button" onClick={() => setRectCrop({ docId: current.id, face, chain: false })}>
                    قصٌّ مستطيل
                  </button>
                  <button className={tool} data-act={`face-rotate-${face}`} disabled={busy} type="button" onClick={() => void rotate({ docId: current.id, face, chain: false })}>
                    دوّر ٩٠°
                  </button>
                </div>
              )}
            />
          ) : (
            <SheetOptions look={look} setLook={setLook} setWm={setWm} wm={wm} />
          )}
          <SheetPages
            docs={docs}
            duplex={look.duplex}
            look={{ ...look, filter: cardFilterCss(look.colorFilter, look.brightness, look.contrast), watermark }}
            pages={pages}
            placements={placements}
            resolveUrl={resolveUrl}
            selected={selected}
            onAdd={() => setAdding(true)}
            onEmpty={(docId, face) => setPicking({ docId, face, chain: true })}
            onSelect={setSelected}
          />
        </div>

        <footer className="px-space-lg py-space-sm flex items-center justify-between gap-space-sm bg-surface-container-low shrink-0">
          <span className={`font-label-sm text-label-sm ${note?.warn ? 'text-error' : 'text-secondary'}`} data-sheet-note="">
            {note?.text ?? `${count(filledCount, 'مستمسك', 'لا مستمسك بصورته بعد')} — ${count(html.length, 'ورقة', 'لا ورقة للطباعة')}`}
          </span>
          <div className="flex items-center gap-space-sm min-w-0">
            {/* الطابعة مكتوبةً قبل «اطبع» — كشريط الإخراج في كلّ أداة. */}
            <PrinterNote role="copies" roles={printRoles} />
            <button
              className="h-10 px-space-md rounded-btn bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md disabled:opacity-40"
              data-act="sheet-pdf"
              disabled={busy || html.length === 0}
              type="button"
              onClick={() => void pdf()}
            >
              حفظ PDF
            </button>
            <button
              className="h-10 px-space-lg btn-act font-label-md text-label-md font-semibold disabled:opacity-40"
              data-act="sheet-print"
              disabled={busy || html.length === 0}
              type="button"
              onClick={() => void print()}
            >
              اطبع {countIn(Math.max(1, html.length), 'ورقة')}
            </button>
          </div>
        </footer>
      </div>

      {adding && <AddMenu onAdd={add} onClose={() => setAdding(false)} />}

      {picking && pickDoc && (
        <SourcePicker
          attachments={attachments}
          busy={busy}
          face={picking.face}
          offerNoBack={picking.face === 'back' && !pickDoc.back}
          title={faceLabel(pickDoc, picking.face)}
          onAttachment={(path) => {
            setPicking(null);
            filled(picking, path);
          }}
          onCamera={() => {
            setPicking(null);
            setCamera(picking);
          }}
          onClose={() => setPicking(null)}
          onFile={() => void fromFile(picking)}
          onNoBack={() => {
            setDoc(picking.docId, { faces: 1 });
            setPicking(null);
          }}
          onScan={() => void scan(picking)}
        />
      )}

      {camera && (
        <CameraCapture
          confirmLabel="سوِّها وقوِّمها"
          title={faceLabel(docOf(camera.docId) ?? newDoc('other'), camera.face)}
          onCapture={(dataUrl) => {
            setFace(camera, dataUrl);
            setDeskew(camera);
            setCamera(null);
          }}
          onClose={() => setCamera(null)}
        />
      )}

      {deskew && deskewSrc && (
        <DeskewModal
          aspect={deskewDoc ? { w: deskewDoc.w, h: deskewDoc.h, label: deskewDoc.label } : undefined}
          isOpen={true}
          imageSrc={resolveUrl(deskewSrc)}
          onApply={(flat) => {
            setDeskew(null);
            filled(deskew, flat);
          }}
          // التسوية تنادي الإغلاق بعد الاعتماد أيضًا: فلا يُعاد هنا الأصل فوق المقوَّم — يُمضى إلى الظهر وحده.
          onClose={() => {
            setDeskew(null);
            chainNext(deskew);
          }}
        />
      )}

      {rectCrop && rectDoc && rectSrc && (
        <RectCropModal
          aspect={{ w: rectDoc.w, h: rectDoc.h, label: faceLabel(rectDoc, rectCrop.face) }}
          imageSrc={resolveUrl(rectSrc)}
          onApply={(url) => {
            setFace(rectCrop, url);
            setRectCrop(null);
          }}
          onClose={() => setRectCrop(null)}
        />
      )}
    </div>
  );
}
