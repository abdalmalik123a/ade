/**
 * سجل المواطنين والمستمسكات — data-path="citizens-identity-records"
 *
 * كل أداة في التصميم مُنفَّذة: إضافة/تعديل/حذف الملف، بحث عربي مطبَّع،
 * خزنة المستمسكات (مسح WIA، استعراض من الحاسوب، OCR، معاينة، طباعة، نسخ،
 * تصدير ZIP)، تصدير السجل Excel، وإدراج المواطن في محرر الكتب.
 *
 * ولا مواطن مبرمَج: يبدأ الدليل فارغًا.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Attachment, CitizenDetail, CitizenStats, CitizenSummary, ScannerDevice } from '@shared/api';
import CitizenForm from './CitizenForm';
import IdDuplexDialog from './IdDuplexDialog';
import IdSheetDialog from '../components/IdSheetDialog';
import DeskewModal from './DeskewModal';
import CameraCapture from '../components/CameraCapture';
import MultiCardDialog from '../components/MultiCardDialog';
import UploadExportDialog from '../components/UploadExportDialog';
import CitizenImportDialog from '../components/CitizenImportDialog';
import type { MrzResult } from '@shared/mrz';
import { LIST_LIMITS, limitNote } from '@shared/limits';
import { errorText } from '../lib/errors';
import { choosePrinter } from '../lib/printChoice';
import { useEscape } from '../kit/useEscape';
import { count } from '@shared/arabic';
import { storeUrl, type Toast } from './citizens/shared';
import CitizensHeader from './citizens/CitizensHeader';
import CitizensStats from './citizens/CitizensStats';
import CitizenDirectory from './citizens/CitizenDirectory';
import AttachmentPreview from './citizens/AttachmentPreview';
import OcrPanel from './citizens/OcrPanel';
import CitizenFile from './citizens/CitizenFile';
import { useCitizenActions } from './citizens/useCitizenActions';

type Props = {
  onInsertIntoEditor?: (citizenId: number) => void;
  /** «كرّره» على كتابٍ صدر لهذا الزبون: نموذجه بقيمه برقمٍ جديد — كما في الأرشيف (د١). */
  onRepeatDocument?: (documentId: number) => void;
  onChanged?: () => void;
  /** ملفٌّ يُفتح من خارج الشاشة — مواطنٌ وُجد في البحث الشامل. `key` يعيد فتحه ولو تكرّر. */
  focus?: { key: number; citizenId: number } | null;
};

export default function CitizensScreen({ onInsertIntoEditor, onRepeatDocument, onChanged, focus = null }: Props) {
  const [stats, setStats] = useState<CitizenStats | null>(null);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [items, setItems] = useState<CitizenSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(focus?.citizenId ?? null);
  /** الملف المفتوح من البحث يغلب «أوّل القائمة» في التحميل الأول وحده. */
  const focusedRef = useRef<number | null>(focus?.citizenId ?? null);
  const [detail, setDetail] = useState<CitizenDetail | null>(null);
  const [form, setForm] = useState<{ open: boolean; initial: CitizenDetail | null }>({
    open: false,
    initial: null
  });
  const [scanners, setScanners] = useState<ScannerDevice[] | null>(null);
  const [ocrReady, setOcrReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ usage: number } | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);
  /** النصّ المستخرَج — أو ظهر البطاقة بقارئه الخاصّ (`mrz`، ولا دقّة له: أرقام التحقّق حَكَمُه). */
  const [ocrPanel, setOcrPanel] = useState<{ attachment: Attachment; text: string; confidence: number | null; mrz?: MrzResult | null } | null>(null);
  useEscape(() => setPreview(null), preview !== null);
  useEscape(() => setOcrPanel(null), ocrPanel !== null);
  const [idDuplexOpen, setIdDuplexOpen] = useState(false);
  /** ورقة المستمسكات المجمّعة (خطة Production، المرحلة ٥) — بمستمسكات الملف المفتوح إن كان. */
  const [idSheetOpen, setIdSheetOpen] = useState(false);
  /** «صدّر للرفع» (تعميق الموجود ٤): كلّ مستمسكٍ صورةٌ بحدّ خانة الرفع. */
  const [uploadOpen, setUploadOpen] = useState(false);
  /** استيراد الزبائن من Excel (الموجة ٢). */
  const [importOpen, setImportOpen] = useState(false);
  const [deskewAttachment, setDeskewAttachment] = useState<Attachment | null>(null);
  /** التقاطٌ بالكاميرا (ج١٢): الكاميرا مفتوحة، ثم اللقطة تُسوّى قبل أن تُحفظ. */
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraShot, setCameraShot] = useState<string | null>(null);
  /** عدّة بطاقاتٍ بمسحةٍ واحدة (هـ٢). */
  const [multiOpen, setMultiOpen] = useState(false);

  async function saveShot(dataUrl: string, docType: string) {
    if (!detail) return;
    await window.diwan.attachments.addFromDataUrl(detail.id, docType, dataUrl);
    await reloadDetail(detail.id);
    await reloadList();
    say('حُفظت اللقطة في مستمسكات المواطن');
  }
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<number | null>(null);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    setToast({ text, tone });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  /** كتابٌ صدر لهذا الزبون يُعاد طبعه كما خرج — برقمه نفسه، كما في الأرشيف (د١). */
  async function reprintDocument(id: number) {
    const pick = await choosePrinter('documents');
    if (!pick) return;
    try {
      const r = await window.diwan.documents.reprint([id], 1, pick.printer);
      if (r.printed) say('أُعيدت طباعته — وقُيّدت الطبعة في السجلّ');
      else if (r.voided) say('هذا الكتاب مُبطَل — لا يُعاد طبعه', 'warn');
      else say('تعذّرت إعادة الطباعة', 'warn');
    } catch (e) {
      say(errorText(e, 'تعذّرت إعادة الطباعة'), 'warn');
    }
  }

  const reloadList = useCallback(async () => {
    const [s, c, list] = await Promise.all([
      window.diwan.citizens.stats(),
      window.diwan.citizens.categories(),
      window.diwan.citizens.list({ query, category: active })
    ]);
    setStats(s);
    setCategories(c);
    setItems(list);
    return list;
  }, [query, active]);

  const reloadDetail = useCallback(async (id: number | null) => {
    if (id === null) {
      setDetail(null);
      return;
    }
    setDetail(await window.diwan.citizens.get(id));
  }, []);

  // مواطنٌ من البحث الشامل: يُفتح ملفّه ولو لم يكن في أوّل القائمة.
  useEffect(() => {
    if (!focus) return;
    focusedRef.current = focus.citizenId;
    setSelectedId(focus.citizenId);
  }, [focus]);

  useEffect(() => {
    void (async () => {
      const list = await reloadList();
      if (focusedRef.current !== null) {
        focusedRef.current = null;
        return;
      }
      if (list.length > 0 && !list.some((x) => x.id === selectedId)) {
        setSelectedId(list[0]!.id);
      } else if (list.length === 0) {
        setSelectedId(null);
        setDetail(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, active]);

  useEffect(() => {
    void reloadDetail(selectedId);
  }, [selectedId, reloadDetail]);

  useEffect(() => {
    void window.diwan.scanner.ocrAvailable().then(setOcrReady);
  }, []);

  // ── أفعال الملفّ والمستمسكات: الماسح والمسح والاستيراد والقراءة وظهر البطاقة والحذف — `citizens/useCitizenActions.ts` ──
  const { checkScanner, withBusy, removeCitizen, importAttachment, scan, runOcr, readBack, afterCitizenChange } = useCitizenActions({
    setBusy, say, setScanners, reloadList, reloadDetail, onChanged, detail, setConfirmDelete, setSelectedId, setOcrPanel
  });

  const field = (v: string | null) => v || '—';
  /** القائمة بلغت حدّها: يُقال ذلك فوقها لا يُظنّ أنها كلّ الملفّات. */
  const capNote = limitNote(items.length, LIST_LIMITS.citizens, 'ملف', 'اكتب الاسم أو الرقم أو اختر صنفًا لتجد غيرها');

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* الترويسة والإجراءات */}
        <CitizensHeader
          busy={busy}
          checkScanner={checkScanner}
          scanners={scanners}
          setIdDuplexOpen={setIdDuplexOpen}
          setIdSheetOpen={setIdSheetOpen}
          setImportOpen={setImportOpen}
          setForm={setForm}
        />

        {/* المؤشرات */}
        <CitizensStats
          stats={stats}
          ocrReady={ocrReady}
        />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-space-md items-start">
          {/* ملف المواطن */}
          <CitizenFile
            detail={detail}
            setForm={setForm}
            onInsertIntoEditor={onInsertIntoEditor}
            busy={busy}
            withBusy={withBusy}
            say={say}
            setConfirmDelete={setConfirmDelete}
            confirmDelete={confirmDelete}
            removeCitizen={removeCitizen}
            field={field}
            importAttachment={importAttachment}
            setCameraOpen={setCameraOpen}
            setMultiOpen={setMultiOpen}
            setUploadOpen={setUploadOpen}
            setIdDuplexOpen={setIdDuplexOpen}
            setIdSheetOpen={setIdSheetOpen}
            scan={scan}
            setPreview={setPreview}
            setDetail={setDetail}
            setDeskewAttachment={setDeskewAttachment}
            ocrReady={ocrReady}
            runOcr={runOcr}
            readBack={readBack}
            reloadDetail={reloadDetail}
            reloadList={reloadList}
            onRepeatDocument={onRepeatDocument}
            reprintDocument={reprintDocument}
          />

          {/* دليل المواطنين */}
          <CitizenDirectory
            stats={stats}
            query={query}
            setQuery={setQuery}
            active={active}
            setActive={setActive}
            categories={categories}
            items={items}
            capNote={capNote}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
          />
        </div>
      </div>

      {form.open && (
        <CitizenForm
          initial={form.initial}
          categories={categories.map((c) => c.name)}
          onClose={() => setForm({ open: false, initial: null })}
          onSaved={(id) => {
            setForm({ open: false, initial: null });
            setSelectedId(id);
            void afterCitizenChange(id);
            say('حُفظ ملف المواطن');
          }}
        />
      )}

      {preview && (
        <AttachmentPreview
          setPreview={setPreview}
          preview={preview}
        />
      )}

      {ocrPanel && (
        <OcrPanel
          setOcrPanel={setOcrPanel}
          ocrPanel={ocrPanel}
          detail={detail}
          setForm={setForm}
          say={say}
        />
      )}

      {importOpen && (
        <CitizenImportDialog
          categories={categories.map((c) => c.name)}
          onClose={() => setImportOpen(false)}
          onDone={(message) => {
            setImportOpen(false);
            say(message);
            void reloadList();
          }}
        />
      )}
      {uploadOpen && detail && (
        <UploadExportDialog
          attachments={detail.attachments}
          owner={detail.fullName}
          onClose={() => setUploadOpen(false)}
          onDone={(message) => {
            setUploadOpen(false);
            say(message);
          }}
        />
      )}

      {idSheetOpen && (
        <IdSheetDialog
          citizenName={detail?.fullName}
          attachments={detail?.attachments ?? []}
          onClose={() => setIdSheetOpen(false)}
        />
      )}

      {idDuplexOpen && (
        <IdDuplexDialog
          isOpen={true}
          onClose={() => setIdDuplexOpen(false)}
          citizenName={detail?.fullName}
          attachments={detail?.attachments ?? []}
        />
      )}

      {cameraOpen && (
        <CameraCapture
          confirmLabel="سوِّها وقوِّمها"
          secondary={{
            label: 'احفظها كما هي',
            onPick: (dataUrl) => {
              setCameraOpen(false);
              void saveShot(dataUrl, 'مستمسك بالكاميرا');
            }
          }}
          title="صوّر المستمسك — ضعه على سطحٍ داكن واملأ به الإطار"
          onCapture={(dataUrl) => {
            setCameraOpen(false);
            setCameraShot(dataUrl);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {multiOpen && detail && (
        <MultiCardDialog
          citizenId={detail.id}
          onClose={() => setMultiOpen(false)}
          onSaved={(n) => {
            setMultiOpen(false);
            void reloadDetail(detail.id).then(() => reloadList());
            say(`حُفظت ${count(n, 'صورة')} في مستمسكاته — كلّ بطاقةٍ بوجهها وظهرها`);
          }}
        />
      )}

      {cameraShot && (
        <DeskewModal
          isOpen={true}
          imageSrc={cameraShot}
          onClose={() => setCameraShot(null)}
          onApply={(dataUrl) => {
            setCameraShot(null);
            void saveShot(dataUrl, 'مستمسك بالكاميرا (مستوٍ)');
          }}
        />
      )}

      {deskewAttachment && (
        <DeskewModal
          isOpen={true}
          imageSrc={storeUrl(deskewAttachment.filePath) ?? ''}
          onClose={() => setDeskewAttachment(null)}
          onApply={(dataUrl) => {
            if (detail) {
              void (async () => {
                await window.diwan.attachments.addFromDataUrl(
                  detail.id,
                  `${deskewAttachment.docType} (مستوٍ)`,
                  dataUrl
                );
                await reloadDetail(detail.id);
                say('تمت إضافة النسخة المستوية إلى مستمسكات المواطن');
              })();
            }
            setDeskewAttachment(null);
          }}
        />
      )}

      {toast && (
        <div
          className={
            toast.tone === 'ok'
              ? 'fixed bottom-6 right-80 z-[60] px-space-lg py-space-sm rounded-lg bg-primary-container text-on-primary font-label-md text-label-md shadow-lg flex items-center gap-space-xs max-w-lg'
              : 'fixed bottom-6 right-80 z-[60] px-space-lg py-space-sm rounded-lg bg-error-container text-on-error-container font-label-md text-label-md shadow-lg flex items-center gap-space-xs max-w-lg'
          }
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.tone === 'ok' ? 'check_circle' : 'warning'}
          </span>
          <span>{toast.text}</span>
        </div>
      )}
    </main>
  );
}

