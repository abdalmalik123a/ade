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
import type { Attachment, CitizenDetail, CitizenStats, CitizenSummary, PrinterInfo, ScannerDevice } from '@shared/api';
import CitizenForm from './CitizenForm';
import IdDuplexDialog from './IdDuplexDialog';
import DeskewModal from './DeskewModal';
import CameraCapture from '../components/CameraCapture';
import MultiCardDialog from '../components/MultiCardDialog';
import { readMrz } from '@shared/mrz';
import { errorText } from '../lib/errors';
import { isCombo, shortcut } from '@shared/shortcuts';

const nf = new Intl.NumberFormat('en-US');
const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : undefined);

type Toast = { text: string; tone: 'ok' | 'warn' } | null;

type Props = {
  onInsertIntoEditor?: (citizenId: number) => void;
  onChanged?: () => void;
  printer?: PrinterInfo | null;
  /** ملفٌّ يُفتح من خارج الشاشة — مواطنٌ وُجد في البحث الشامل. `key` يعيد فتحه ولو تكرّر. */
  focus?: { key: number; citizenId: number } | null;
};

export default function CitizensScreen({ onInsertIntoEditor, onChanged, printer, focus = null }: Props) {
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
  const [ocrPanel, setOcrPanel] = useState<{ attachment: Attachment; text: string; confidence: number } | null>(null);
  const [idDuplexOpen, setIdDuplexOpen] = useState(false);
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

  // F2 — إضافة ملف مواطن، كما يعلن التصميم على الزرّ.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isCombo(e, shortcut('new-citizen').combo) && !form.open) {
        e.preventDefault();
        setForm({ open: true, initial: null });
      }
      if (isCombo(e, shortcut('to-editor').combo) && detail && !form.open) {
        e.preventDefault();
        onInsertIntoEditor?.(detail.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [form.open, detail, onInsertIntoEditor]);

  async function withBusy<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    try {
      return await fn();
    } catch (e) {
      say(errorText(e, 'تعذّر تنفيذ العملية'), 'warn');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function checkScanner() {
    const found = await withBusy('scanner', () => window.diwan.scanner.list());
    if (found === null) return;
    setScanners(found);
    say(
      found.length === 0
        ? 'لا يوجد ماسح ضوئي موصول بهذا الجهاز'
        : `الماسح متصل: ${found.map((d) => d.name).join('، ')}`,
      found.length === 0 ? 'warn' : 'ok'
    );
  }

  async function afterCitizenChange(id: number | null) {
    await reloadList();
    await reloadDetail(id);
    onChanged?.();
  }

  async function removeCitizen() {
    if (!detail) return;
    await window.diwan.citizens.delete(detail.id);
    setConfirmDelete(null);
    const list = await reloadList();
    const next = list[0]?.id ?? null;
    setSelectedId(next);
    await reloadDetail(next);
    onChanged?.();
    say('حُذف ملف المواطن');
  }

  async function scan(docType: string) {
    if (!detail) return;
    const created = await withBusy('scan', () =>
      window.diwan.attachments.scan(detail.id, docType, 600)
    );
    if (created) {
      await reloadDetail(detail.id);
      await reloadList();
      say('اكتمل المسح الضوئي بدقة 600');
    }
  }

  async function importAttachment(docType: string) {
    if (!detail) return;
    const created = await withBusy('import', () =>
      window.diwan.attachments.importFile(detail.id, docType)
    );
    if (created) {
      await reloadDetail(detail.id);
      await reloadList();
      say('أُدرج المستمسك');
    }
  }

  async function runOcr(a: Attachment) {
    const result = await withBusy(`ocr-${a.id}`, () => window.diwan.attachments.ocr(a.id));
    if (result) {
      await reloadDetail(detail?.id ?? null);
      setOcrPanel({ attachment: a, text: result.text, confidence: result.confidence });
      say(`استُخرج النصّ بدقة ${Math.round(result.confidence * 100)}%`);
    }
  }

  const field = (v: string | null) => v || '—';

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* الترويسة والإجراءات */}
        <section className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              سجل المواطنين والمستمسكات الرسمية
            </h2>
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-secondary">shield</span>
              <span className="font-label-sm text-label-sm">
                أرشيف محلي مؤمّن — لا تغادر بيانات المواطن هذا الجهاز
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] disabled:opacity-40"
              type="button"
              disabled={busy === 'scanner'}
              onClick={() => void checkScanner()}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">
                document_scanner
              </span>
              <span>فحص الماسح الضوئي (WIA)</span>
              {scanners !== null && (
                <span
                  className={
                    scanners.length > 0
                      ? 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-fixed text-on-secondary-fixed'
                      : 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-container-high text-on-surface-variant'
                  }
                >
                  {scanners.length > 0 ? 'متصل' : 'غير متصل'}
                </span>
              )}
            </button>
            <button
              className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-lowest text-primary hover:bg-surface-container-high transition-colors font-label-md text-label-md font-semibold shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
              type="button"
              title="طباعة واستنساخ الهويات والبطاقات بمقاس 1:1 الحقيقي على ورقة A4"
              onClick={() => setIdDuplexOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px]">badge</span>
              <span>استنساخ هوية 1:1 (وجه وظهر)</span>
            </button>
            <button
              className="flex items-center gap-space-xs px-space-lg h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold transition-all"
              type="button"
              onClick={() => setForm({ open: true, initial: null })}
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>إضافة ملف مواطن</span>
              <span className="font-code-sm text-code-sm opacity-70">F2</span>
            </button>
          </div>
        </section>

        {/* المؤشرات */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {[
            {
              label: 'الملفات المسجلة النشطة',
              value: nf.format(stats?.activeFiles ?? 0),
              unit: 'ملف',
              icon: 'folder_shared',
              hint:
                (stats?.activeFiles ?? 0) === 0
                  ? 'لم يُسجَّل أي مواطن بعد'
                  : `${nf.format(stats?.verifiedFiles ?? 0)} موثّق رسميًا`
            },
            {
              label: 'المستمسكات المؤرشفة',
              value: nf.format(stats?.attachments ?? 0),
              unit: 'مستمسك',
              icon: 'inventory_2',
              hint:
                (stats?.attachments ?? 0) === 0 ? 'لم يُمسح أي مستمسك بعد' : 'محفوظة محليًا'
            },
            {
              label: 'دقة استخراج النصوص OCR',
              value:
                stats?.ocrAccuracy === null || stats?.ocrAccuracy === undefined
                  ? '—'
                  : `${(stats.ocrAccuracy * 100).toFixed(1)}%`,
              unit: '',
              icon: 'document_scanner',
              hint: ocrReady
                ? stats?.ocrAccuracy == null
                  ? 'تُقاس بعد أول استخراج'
                  : 'متوسط الملفات المستخرَجة'
                : 'بيانات التعرّف غير مثبّتة'
            },
            {
              label: 'الكتب الصادرة هذا الشهر',
              value: nf.format(stats?.issuedThisMonth ?? 0),
              unit: 'كتاب',
              icon: 'history_edu',
              hint:
                (stats?.issuedThisMonth ?? 0) === 0 ? 'لم يصدر أي كتاب هذا الشهر' : 'من سجل الصادر'
            }
          ].map((card) => (
            <div
              key={card.label}
              className="bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center justify-between"
            >
              <div className="flex flex-col gap-space-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold tracking-wide">
                  {card.label}
                </span>
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight tabular">
                    {card.value}
                  </span>
                  {card.unit && (
                    <span className="font-label-sm text-label-sm text-secondary font-semibold">
                      {card.unit}
                    </span>
                  )}
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {card.hint}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container shadow-sm">
                <span className="material-symbols-outlined text-[24px]">{card.icon}</span>
              </div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-space-md items-start">
          {/* ملف المواطن */}
          <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] p-space-md flex flex-col gap-space-md">
            {detail === null ? (
              <div className="py-space-xl flex flex-col items-center gap-space-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[44px]">badge</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  لم يُفتح أي ملف
                </span>
                <span className="font-label-md text-label-md">
                  أضف ملف مواطن أو اختر واحدًا من الدليل
                </span>
                <button
                  className="mt-space-sm px-space-lg h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                  type="button"
                  onClick={() => setForm({ open: true, initial: null })}
                >
                  + إضافة ملف مواطن
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-space-md">
                  <div className="flex items-center gap-space-md">
                    <div className="w-16 h-20 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center">
                      {detail.photoPath ? (
                        <img
                          alt=""
                          className="w-full h-full object-cover"
                          src={storeUrl(detail.photoPath)}
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                          person
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-space-xs">
                      <h3 className="font-headline-md text-headline-md text-on-surface">
                        {detail.fullName}
                      </h3>
                      <div className="flex items-center gap-space-xs flex-wrap">
                        {detail.verified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-secondary font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                            موثّق ومعتمد رسميًا
                          </span>
                        )}
                        {detail.category && (
                          <span className="px-2 py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant">
                            {detail.category}
                          </span>
                        )}
                        {detail.employeeCode && (
                          <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                            {detail.employeeCode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-space-xs">
                    <button
                      className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold transition-all"
                      type="button"
                      onClick={() => onInsertIntoEditor?.(detail.id)}
                    >
                      <span className="material-symbols-outlined text-[18px]">output</span>
                      <span>إدراج في محرر الكتب</span>
                      <span className="font-code-sm text-code-sm opacity-70">Ctrl+Enter</span>
                    </button>
                    <button
                      className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-md text-label-md transition-colors"
                      data-act="fill-card"
                      title="بطاقة التعبئة: نافذةٌ صغيرة فوق المتصفّح — الاسم مفرَّقًا والأرقام بصيغها، والنقر ينسخ"
                      type="button"
                      onClick={() => void window.diwan.fillCard.open(detail.id)}
                    >
                      <span className="material-symbols-outlined text-[18px]">content_paste</span>
                      <span>بطاقة التعبئة</span>
                    </button>
                    <button
                      className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
                      title="تعديل بيانات المواطن"
                      type="button"
                      onClick={() => setForm({ open: true, initial: detail })}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors disabled:opacity-40"
                      title="تصدير السجل كملف Excel"
                      type="button"
                      disabled={busy === 'excel'}
                      onClick={() =>
                        void withBusy('excel', async () => {
                          const path = await window.diwan.citizens.exportExcel(detail.id);
                          if (path) say('صُدّر سجل المواطن');
                        })
                      }
                    >
                      <span className="material-symbols-outlined text-[18px]">table_view</span>
                    </button>
                    <button
                      className="w-9 h-9 rounded-lg bg-surface-container-high text-error flex items-center justify-center hover:bg-error-container transition-colors"
                      title="حذف ملف المواطن"
                      type="button"
                      onClick={() =>
                        void (async () => {
                          const usage = await window.diwan.citizens.usage(detail.id);
                          setConfirmDelete({ usage });
                        })()
                      }
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>

                {confirmDelete && (
                  <div className="rounded-lg bg-error-container p-space-md flex items-center justify-between gap-space-md">
                    <span className="font-label-md text-label-md text-on-error-container">
                      {confirmDelete.usage > 0
                        ? `صدر باسم هذا المواطن ${nf.format(confirmDelete.usage)} كتابًا. حذف الملف يبقي الكتب في الأرشيف لكن يفكّ ارتباطها. تحذف؟`
                        : 'يُحذف الملف ومستمسكاته نهائيًا. تأكيد؟'}
                    </span>
                    <div className="flex items-center gap-space-xs shrink-0">
                      <button
                        className="px-space-md h-9 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold"
                        type="button"
                        onClick={() => void removeCitizen()}
                      >
                        نعم، احذف
                      </button>
                      <button
                        className="px-space-md h-9 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md"
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                      >
                        تراجع
                      </button>
                    </div>
                  </div>
                )}

                {/* الحقول */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-space-sm">
                  {(
                    [
                      ['الرقم الوطني الموحد', detail.nationalId],
                      ['العنوان الوظيفي والدرجة', detail.jobTitle],
                      ['دائرة الانتساب الرسمية', detail.enrollmentDept],
                      ['تاريخ ومحل الولادة', [detail.birthDate, detail.birthPlace].filter(Boolean).join(' - ') || null],
                      ['رقم بطاقة السكن', detail.housingCardNo],
                      ['المحلة والزقاق والدار', detail.address],
                      ['أقرب نقطة دالة', detail.landmark],
                      ['رقم هاتف الاتصال', detail.phone]
                    ] as [string, string | null][]
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg bg-surface-container-low p-space-sm flex items-start justify-between gap-space-xs group"
                    >
                      <div className="flex flex-col gap-space-xs min-w-0">
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {label}
                        </span>
                        <span className="font-label-md text-label-md text-on-surface font-semibold break-words">
                          {field(value)}
                        </span>
                      </div>
                      {value && (
                        <button
                          className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0"
                          title="نسخ"
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(value);
                            say('نُسخ إلى الحافظة');
                          }}
                        >
                          <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* خزنة المستمسكات */}
                <div className="flex flex-col gap-space-sm pt-space-xs">
                  <div className="flex items-center justify-between flex-wrap gap-space-sm">
                    <div className="flex flex-col">
                      <h4 className="font-headline-sm text-headline-sm text-on-surface">
                        خزنة المستمسكات الرسمية الممسوحة ضوئياً
                      </h4>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {detail.attachments.length === 0
                          ? 'لا مستمسكات لهذا الملف'
                          : `${nf.format(detail.attachments.length)} وثائق مؤرشفة`}
                      </span>
                    </div>
                    <div className="flex items-center gap-space-xs">
                      <button
                        className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
                        type="button"
                        disabled={busy === 'import'}
                        onClick={() => void importAttachment('')}
                      >
                        <span className="material-symbols-outlined text-[18px]">folder_open</span>
                        <span>استعراض من الحاسوب</span>
                      </button>
                      <button
                        className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
                        data-act="camera-attachment"
                        title="صوّر المستمسك بكاميرا الحاسوب — ثم يُسوّى ويُقوَّم كالمسح"
                        type="button"
                        onClick={() => setCameraOpen(true)}
                      >
                        <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                        <span>التقط بالكاميرا</span>
                      </button>
                      <button
                        className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
                        data-act="multi-card"
                        title="عدّة بطاقاتٍ على الزجاج معًا: تُعرف كلٌّ وتُقصّ، ويُطابَق ظهرها بوجهها"
                        type="button"
                        onClick={() => setMultiOpen(true)}
                      >
                        <span className="material-symbols-outlined text-[18px]">view_module</span>
                        <span>عدّة بطاقات بمسحة</span>
                      </button>
                      <button
                        className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
                        type="button"
                        disabled={detail.attachments.length === 0 || busy === 'zip'}
                        onClick={() =>
                          void withBusy('zip', async () => {
                            const r = await window.diwan.attachments.exportZip(detail.id);
                            if (r) say(`صُدّرت ${nf.format(r.count)} مستمسكات في حزمة`);
                          })
                        }
                      >
                        <span className="material-symbols-outlined text-[18px]">photo_library</span>
                        <span>تصدير الكل ZIP</span>
                      </button>
                      <button
                        className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold hover:bg-secondary-container/80 transition-all shadow-sm"
                        type="button"
                        title="طباعة واستنساخ مستمسكات المواطن بوجهين 1:1"
                        onClick={() => setIdDuplexOpen(true)}
                      >
                        <span className="material-symbols-outlined text-[18px]">badge</span>
                        <span>طباعة هوية وجه وظهر 1:1</span>
                      </button>
                      <button
                        className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold transition-all disabled:opacity-40"
                        type="button"
                        disabled={busy === 'scan'}
                        onClick={() => void scan('')}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {busy === 'scan' ? 'hourglass_top' : 'scanner'}
                        </span>
                        <span>{busy === 'scan' ? 'جارٍ المسح...' : 'مسح ضوئي فوري'}</span>
                      </button>
                    </div>
                  </div>

                  {detail.attachments.length === 0 ? (
                    <div className="py-space-lg rounded-lg border border-dashed border-outline-variant flex flex-col items-center gap-space-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                      <span className="font-label-md text-label-md">
                        امسح المستمسك ضوئيًا أو استورده من الحاسوب
                      </span>
                      <span className="font-label-sm text-label-sm">
                        يُحفظ داخل التطبيق ببصمة SHA-256
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
                      {detail.attachments.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-lg bg-surface-container-low overflow-hidden flex flex-col"
                        >
                          <button
                            className="w-full aspect-[1.6/1] bg-surface-container-high overflow-hidden"
                            type="button"
                            title="معاينة بكامل الشاشة"
                            onClick={() => setPreview(a)}
                          >
                            <img
                              alt={a.docType}
                              className="w-full h-full object-cover"
                              src={storeUrl(a.filePath)}
                            />
                          </button>
                          <div className="p-space-sm flex flex-col gap-space-xs">
                            <input
                              className="w-full h-7 px-1 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
                              value={a.docType}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDetail((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        attachments: prev.attachments.map((x) =>
                                          x.id === a.id ? { ...x, docType: v } : x
                                        )
                                      }
                                    : prev
                                );
                              }}
                              onBlur={(e) =>
                                void window.diwan.attachments.rename(a.id, e.target.value)
                              }
                            />
                            <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
                              <span>
                                {a.fileFormat ?? ''}
                                {a.dpi ? ` · DPI ${a.dpi}` : ''}
                              </span>
                              {a.ocrAccuracy !== null && (
                                <span className="text-secondary font-semibold">
                                  OCR {Math.round(a.ocrAccuracy * 100)}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5">
                              <IconBtn
                                icon="visibility"
                                title="معاينة بكامل الشاشة"
                                onClick={() => setPreview(a)}
                              />
                              <IconBtn
                                icon="crop_free"
                                title="إزالة الميلان والتسوية (De-skew)"
                                onClick={() => setDeskewAttachment(a)}
                              />
                              <IconBtn
                                icon={busy === `ocr-${a.id}` ? 'hourglass_top' : 'raw_on'}
                                title={
                                  ocrReady
                                    ? 'استخراج النصوص OCR'
                                    : 'بيانات التعرّف غير مثبّتة'
                                }
                                disabled={!ocrReady || busy === `ocr-${a.id}`}
                                onClick={() => void runOcr(a)}
                              />
                              <IconBtn
                                icon="print"
                                title="طباعة فورية ملونة"
                                onClick={() =>
                                  void withBusy(`print-${a.id}`, () =>
                                    window.diwan.attachments.print(a.id)
                                  )
                                }
                              />
                              <IconBtn
                                icon="content_copy"
                                title="نسخ إلى الحافظة"
                                onClick={() =>
                                  void withBusy(`copy-${a.id}`, async () => {
                                    const ok = await window.diwan.attachments.copyToClipboard(a.id);
                                    say(ok ? 'نُسخت الصورة' : 'تعذّر النسخ', ok ? 'ok' : 'warn');
                                  })
                                }
                              />
                              <IconBtn
                                icon="delete"
                                title="حذف المستمسك"
                                tone="error"
                                onClick={() =>
                                  void withBusy(`del-${a.id}`, async () => {
                                    await window.diwan.attachments.delete(a.id);
                                    await reloadDetail(detail.id);
                                    await reloadList();
                                    say('حُذف المستمسك');
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* كتب المواطن الصادرة */}
                <div className="flex flex-col gap-space-sm pt-space-xs">
                  <h4 className="font-headline-sm text-headline-sm text-on-surface">
                    سجل المعاملات والكتب الإدارية الصادرة للمواطن
                  </h4>
                  {detail.documents.length === 0 ? (
                    <div className="py-space-lg rounded-lg border border-dashed border-outline-variant flex flex-col items-center gap-space-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[28px]">history_edu</span>
                      <span className="font-label-md text-label-md">
                        لم يصدر أي كتاب لهذا المواطن بعد
                      </span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                            {['رقم الصادر', 'نوع الكتاب', 'الجهة', 'التاريخ', 'الإجراء'].map((c) => (
                              <th key={c} className="p-space-sm font-bold">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="font-body-sm text-body-sm">
                          {detail.documents.map((d) => (
                            <tr key={d.id} className="hover:bg-surface-container-high transition-colors">
                              <td className="p-space-sm font-mono font-bold text-secondary">
                                {d.serial}
                              </td>
                              <td className="p-space-sm">{d.docType ?? '—'}</td>
                              <td className="p-space-sm text-on-surface-variant">
                                {d.destination ?? '—'}
                              </td>
                              <td className="p-space-sm font-mono text-label-sm">{d.issuedDate}</td>
                              <td className="p-space-sm">
                                <button
                                  className="px-space-sm h-8 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-sm text-label-sm flex items-center gap-1"
                                  type="button"
                                  title="ينشئ الكتاب نفسه برقم صادر جديد وتأريخ اليوم"
                                  onClick={() => onInsertIntoEditor?.(detail.id)}
                                >
                                  <span className="material-symbols-outlined text-[16px]">replay</span>
                                  <span>تكرار المعاملة</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* دليل المواطنين */}
          <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] p-space-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">contacts</span>
                <h4 className="font-headline-sm text-headline-sm text-on-surface">
                  دليل المواطنين والموظفين
                </h4>
              </div>
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
                {nf.format(stats?.activeFiles ?? 0)} ملف
              </span>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                className="w-full h-10 pr-10 pl-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant text-body-sm font-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                placeholder="ابحث بالاسم أو الرقم الوطني..."
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-space-xs overflow-x-auto pb-1 scrollbar-none">
              <Chip active={active === null} onClick={() => setActive(null)}>
                الكل ({nf.format(stats?.activeFiles ?? 0)})
              </Chip>
              {categories.map((c) => (
                <Chip key={c.name} active={active === c.name} onClick={() => setActive(c.name)}>
                  {c.name} ({nf.format(c.count)})
                </Chip>
              ))}
            </div>

            {items.length === 0 ? (
              <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-[32px]">person_search</span>
                <span className="font-label-md text-label-md">
                  {query ? 'لا نتائج مطابقة' : 'الدليل فارغ'}
                </span>
                <span className="font-label-sm text-label-sm text-center">
                  {query ? 'جرّب اسمًا آخر' : 'أضف أول ملف مواطن ليظهر هنا'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-space-xs max-h-[560px] overflow-y-auto">
                {items.map((c) => (
                  <button
                    key={c.id}
                    className={
                      c.id === selectedId
                        ? 'text-right rounded-lg p-space-sm bg-surface-container-high border-r-2 border-secondary transition-colors'
                        : 'text-right rounded-lg p-space-sm hover:bg-surface-container-low transition-colors'
                    }
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="flex items-center gap-space-sm">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center shrink-0">
                        {c.photoPath ? (
                          <img alt="" className="w-full h-full object-cover" src={storeUrl(c.photoPath)} />
                        ) : (
                          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                            person
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-label-lg text-label-lg text-on-surface font-semibold truncate">
                          {c.fullName}
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                          {[c.jobTitle, c.workplace].filter(Boolean).join(' — ') || '—'}
                        </span>
                        {c.nationalId && (
                          <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                            ID: {c.nationalId}
                          </span>
                        )}
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                        {nf.format(c.attachmentCount)} مستمسك
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
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
        <div
          className="fixed inset-0 z-50 bg-primary-container/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-space-lg"
          onClick={() => setPreview(null)}
        >
          <div className="mb-space-sm flex items-center gap-space-md text-on-primary">
            <span className="font-headline-sm text-headline-sm">{preview.docType}</span>
            <button
              className="w-9 h-9 rounded-lg bg-surface-container-lowest text-on-surface flex items-center justify-center"
              title="إغلاق"
              type="button"
              onClick={() => setPreview(null)}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <img
            alt={preview.docType}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-surface-container-lowest"
            src={storeUrl(preview.filePath)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {ocrPanel && (
        <div
          className="fixed inset-0 z-50 bg-primary-container/45 backdrop-blur-[2px] flex items-center justify-center"
          onClick={() => setOcrPanel(null)}
        >
          <div
            className="w-[min(760px,92vw)] max-h-[80vh] rounded-xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 px-space-md flex items-center justify-between bg-surface-container-low">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                النصّ المستخرَج — {ocrPanel.attachment.docType}
              </span>
              <div className="flex items-center gap-space-sm">
                <span
                  className={
                    ocrPanel.confidence >= 0.9
                      ? 'font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold'
                      : 'font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold'
                  }
                >
                  دقة {Math.round(ocrPanel.confidence * 100)}%
                </span>
                <button
                  className="w-8 h-8 rounded text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center"
                  type="button"
                  onClick={() => setOcrPanel(null)}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="p-space-md overflow-y-auto">
              {/* ظهر البطاقة (هـ٧): سطور MRZ تُقرأ حقولًا — ولكلٍّ رقم تحقّقه */}
              {(() => {
                const mrz = readMrz(ocrPanel.text);
                if (!mrz || !detail) return null;
                const row = (label: string, value: string | null, good?: boolean) =>
                  value ? (
                    <div key={label} className="flex items-center gap-space-xs">
                      <span className="w-28 text-on-surface-variant">{label}</span>
                      <span className="font-mono text-on-surface">{value}</span>
                      {good !== undefined && (
                        <span className={good ? 'text-secondary' : 'text-error font-semibold'}>{good ? '✓' : 'رقم التحقّق لا يطابق'}</span>
                      )}
                    </div>
                  ) : null;
                const personal = [mrz.optional1, mrz.optional2].map((v) => v.replace(/\D/g, '')).find((v) => v.length === 12) ?? null;
                return (
                  <div className="mb-space-md p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1 font-label-md text-label-md" data-mrz={mrz.valid ? 'valid' : 'invalid'}>
                    <span className="font-semibold text-on-surface">
                      ظهر البطاقة (MRZ) — {mrz.valid ? 'قُرئ وتحقّقت أرقامه' : 'قُرئ، وفي بعض أرقامه خطأ قراءة — راجِعه'}
                    </span>
                    <span className="font-label-sm text-label-sm text-tertiary">تجريبي: يُعتمد بعد التحقّق ببطاقةٍ عراقية حقيقية.</span>
                    {row('رقم الوثيقة', mrz.documentNumber, mrz.checks.documentNumber)}
                    {row('الرقم الشخصي', personal)}
                    {row('الولادة', mrz.birthDate, mrz.checks.birthDate)}
                    {row('الجنس', mrz.sex)}
                    {row('النفاذ', mrz.expiryDate, mrz.checks.expiryDate)}
                    {row('الاسم (لاتيني)', [mrz.givenNames, mrz.surname].filter(Boolean).join(' '))}
                    <button
                      className="self-start mt-1 h-8 px-3 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md disabled:opacity-40"
                      data-act="mrz-fill"
                      type="button"
                      disabled={!mrz.valid}
                      title={mrz.valid ? 'تُفتح بطاقة المواطن مملوءةً — تراجعها ثم تحفظ' : 'لا يُملأ ملفٌّ من قراءةٍ لم تتحقّق'}
                      onClick={() => {
                        setOcrPanel(null);
                        setForm({
                          open: true,
                          initial: {
                            ...detail,
                            birthDate: detail.birthDate || mrz.birthDate,
                            nationalId: detail.nationalId || personal
                          }
                        });
                      }}
                    >
                      املأ ملفّه بها
                    </button>
                  </div>
                );
              })()}
              {ocrPanel.confidence < 0.9 && (
                <p className="font-label-sm text-label-sm text-error mb-space-sm">
                  الدقة دون 90% — راجع النصّ قبل اعتماده في كتاب رسمي.
                </p>
              )}
              <pre className="font-body-md text-body-md text-on-surface whitespace-pre-wrap leading-loose">
                {ocrPanel.text || 'لم يُستخرج نصّ من هذه الصورة'}
              </pre>
            </div>
            <div className="h-14 px-space-md flex items-center justify-end gap-space-sm bg-surface-container-low">
              <button
                className="px-space-md h-9 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md"
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(ocrPanel.text);
                  say('نُسخ النصّ');
                }}
              >
                نسخ النصّ
              </button>
            </div>
          </div>
        </div>
      )}

      {idDuplexOpen && (
        <IdDuplexDialog
          isOpen={true}
          onClose={() => setIdDuplexOpen(false)}
          printer={printer ?? null}
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
            say(`حُفظت ${n} صورة في مستمسكاته — كلّ بطاقةٍ بوجهها وظهرها`);
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

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={
        active
          ? 'px-space-sm py-1 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold shrink-0'
          : 'px-space-sm py-1 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm shrink-0'
      }
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function IconBtn({
  icon,
  title,
  onClick,
  disabled,
  tone
}: {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'error';
}) {
  return (
    <button
      className={
        tone === 'error'
          ? 'w-7 h-7 rounded text-error hover:bg-error-container transition-colors flex items-center justify-center disabled:opacity-30'
          : 'w-7 h-7 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center disabled:opacity-30'
      }
      title={title}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
    </button>
  );
}
