/**
 * المحرر الذكي ومعاينة A4 — data-path="smart-editor-a4-preview"
 *
 * علاماتها من stitch_/a4/code.html، وسلوكها من docs/design-behavior/a4.js:
 * ربط حيّ بين الحقول والورقة، حقن متغيرات بصيغة {الاسم}، تكبير محصور بين 45% و160%،
 * وورقة عرضها 794px = 210mm عند 96 نقطة/إنش.
 *
 * لا شيء مبرمَج: الترويسة من إعدادات المكتب، والنموذج من المكتبة، والمواطن من السجل،
 * والختم والتوقيع صورتان يرفعهما المكتب. قبل ذلك الورقة بيضاء — وهذا هو الصواب.
 *
 * الإصدار يجري في نداء واحد إلى العملية الرئيسية: هي تحجز رقم الصادر وتحسب البصمة
 * وترسم رمز التحقق وتحقنها في مواضعها المحجوزة داخل الورقة. ولذلك تُرسَل الورقة
 * بعلامات {{DIWAN_…}} بدل القيم — فلا يُحرق رقمُ صادرٍ على كتاب لم يصدر.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import type {
  CitizenDetail,
  DocumentDetail,
  IssueOutcome,
  OfficeSettings,
  PrinterInfo,
  Seal,
  TemplateSummary
} from '@shared/api';
import { FINGERPRINT_SLOT, QR_SLOT, SERIAL_SLOT } from '@shared/api';
import { formatGregorian, formatHijri } from '@shared/dates';
import {
  emptyLayout,
  isLayoutEmpty,
  mmToPx,
  normalizeLayout,
  type Letterhead,
  type LetterheadLayout
} from '@shared/letterhead';
import { qrSvg } from '@shared/qr';
import {
  defaultFields,
  fieldByRole,
  toField,
  tokenFromLabel,
  uniqueToken,
  FIELD_GROUPS,
  type CatalogField,
  type LetterField
} from '@shared/letterFields';
import { errorText } from '../lib/errors';
import LetterheadView from '../components/LetterheadView';
import LetterheadDesigner from '../components/LetterheadDesigner';

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.6;
const SHEET_WIDTH = 794;
const AUTOSAVE_MS = 4000;

const COPY_KINDS = ['نسخة أصلية', 'نسخة مصدقة', 'نسخة مختومة'];

const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : undefined);

type Fields = {
  serial: string;
  dateGreg: string;
  dateHijri: string;
  subject: string;
  docType: string;
  body: string;
  copiesTo: string;
  signerName: string;
  signerRole: string;
};

const EMPTY: Fields = {
  serial: '',
  dateGreg: '',
  dateHijri: '',
  subject: '',
  docType: '',
  body: '',
  copiesTo: '',
  signerName: '',
  signerRole: ''
};

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * حقن المتغيّرات: نفس الصيغة التي يستعملها التصميم — {الاسم} لا [الاسم].
 * والأسماء تأتي من حقول الكتاب نفسها، فما يضيفه المكتب يصير متغيّرًا في متنه.
 */
function injectTokens(body: string, f: Fields, fields: LetterField[]): string {
  const map = new Map<string, string>([
    ['{رقم_الصادر}', f.serial],
    ['{التاريخ_الميلادي}', f.dateGreg],
    ['{التاريخ_الهجري}', f.dateHijri]
  ]);
  for (const field of fields) map.set(`{${field.token}}`, field.value);

  let out = escape(body);
  for (const [token, value] of map) {
    if (!value) continue;
    out = out
      .split(escape(token))
      .join(
        `<span class="font-bold text-black underline underline-offset-4 decoration-1">${escape(value)}</span>`
      );
  }
  return out.replace(/\n/g, '<br/>');
}

export type EditorHandle = {
  saveDraft: () => void;
  exportPdf: () => void;
  print: () => void;
};

type Props = {
  templateId?: number | null;
  citizenId?: number | null;
  draftId?: number | null;
  documentId?: number | null;
  printer: PrinterInfo | null;
  onStatus?: (status: { transaction: string | null; busy: boolean; exporting: boolean }) => void;
  onIssued?: () => void;
};

function EditorScreen(
  {
    templateId = null,
    citizenId = null,
    draftId = null,
    documentId = null,
    printer,
    onStatus,
    onIssued
  }: Props,
  ref: React.Ref<EditorHandle>
) {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [letterheadId, setLetterheadId] = useState<number | null>(null);
  /** ترويسة هذا الكتاب: نسخة تُحرَّر معه، لا إحالة إلى ترويسة محفوظة.
   *  فالترويسة تختلف من كتاب إلى كتاب ومن دائرة إلى أخرى. */
  const [layout, setLayout] = useState<LetterheadLayout>(emptyLayout());
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [saveLayoutOpen, setSaveLayoutOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [seals, setSeals] = useState<Seal[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<number | null>(templateId);
  /** ملف المواطن المرتبط بالكتاب: يأتي مع فتح الشاشة، أو يُختار بـF2.
   *  الكتاب قد يصدر لمن لا ملفّ له، فيبقى فارغًا والاسم يُحفظ نصًّا. */
  const [linkedCitizen, setLinkedCitizen] = useState<number | null>(citizenId);
  const [f, setF] = useState<Fields>(EMPTY);
  /** حقول صاحب العلاقة: يضيف المكتب ويحذف، ولكل حقل وسمٌ يُحقن في المتن. */
  const [fields, setFields] = useState<LetterField[]>(defaultFields);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const [showStamp, setShowStamp] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showWatermark, setShowWatermark] = useState(false);
  const [stampId, setStampId] = useState<number | null>(null);
  const [signatureId, setSignatureId] = useState<number | null>(null);

  const [draft, setDraft] = useState<number | null>(draftId);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issued, setIssued] = useState<IssueOutcome | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);

  useEffect(() => {
    void (async () => {
      const [s, lhs, tpls, sl] = await Promise.all([
        window.diwan.settings.get(),
        window.diwan.letterheads.list(),
        window.diwan.templates.list(),
        window.diwan.seals.list()
      ]);
      setSettings(s);
      setLetterheads(lhs);
      const initial = lhs.find((x) => x.isDefault) ?? lhs[0] ?? null;
      setLetterheadId(initial?.id ?? null);
      if (initial) setLayout(normalizeLayout(initial.layout));
      setTemplates(tpls);
      setSeals(sl);
      setStampId(sl.find((x) => x.kind === 'ختم')?.id ?? null);
      setSignatureId(sl.find((x) => x.kind === 'توقيع')?.id ?? null);
    })();
  }, []);

  const setFieldValue = useCallback((id: string, value: string) => {
    dirty.current = true;
    setFields((prev) => prev.map((x) => (x.id === id ? { ...x, value } : x)));
  }, []);

  const addField = useCallback((catalog: CatalogField) => {
    dirty.current = true;
    setFields((prev) => [...prev, toField({ ...catalog, token: uniqueToken(catalog.token, prev) })]);
  }, []);

  const removeField = useCallback((id: string) => {
    dirty.current = true;
    setFields((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const set = useCallback((patch: Partial<Fields>) => {
    dirty.current = true;
    setError(null);
    setF((prev) => ({ ...prev, ...patch }));
  }, []);

  // استيراد مواطن قادم من سجل المواطنين (زرّ «إدراج في محرر الكتب»).
  useEffect(() => {
    if (citizenId === null) return;
    setLinkedCitizen(citizenId);
    void window.diwan.citizens.get(citizenId).then((c) => {
      if (c) fillFromCitizen(c as unknown as Record<string, unknown>);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citizenId]);

  /** يملأ ما له مصدرٌ في ملف المواطن، ويترك ما كتبه الموظف بيده إن كان مملوءًا. */
  function fillFromCitizen(citizen: Record<string, unknown>) {
    dirty.current = true;
    setFields((prev) =>
      prev.map((field) => {
        if (!field.source) return field;
        const value = citizen[field.source];
        return typeof value === 'string' && value ? { ...field, value } : field;
      })
    );
  }

  // فتح مسودة محفوظة: تعود بحقولها كما تُركت.
  useEffect(() => {
    if (draftId === null) return;
    void window.diwan.drafts.list().then((rows) => {
      const row = rows.find((d) => d.id === draftId);
      if (!row) return;
      setDraft(row.id);
      setActiveTemplate(row.templateId);
      setLinkedCitizen(row.citizenId);
      try {
        const values = JSON.parse(row.valuesJson) as Partial<Fields> & {
          __letterhead?: unknown;
          __fields?: LetterField[];
        };
        const { __letterhead, __fields, ...rest } = values;
        setF({ ...EMPTY, ...rest });
        if (Array.isArray(__fields) && __fields.length) setFields(__fields);
        if (__letterhead) setLayout(normalizeLayout(__letterhead));
      } catch {
        setError('تعذّرت قراءة قيم المسودة — فُتحت فارغة');
      }
      dirty.current = false;
    });
  }, [draftId]);

  /** كتاب صادر يُفتح في المحرر: نسخة قابلة للتعديل تصدر برقم جديد.
   *  الكتاب الأصل يبقى في الأرشيف كما صدر — بصمته تمنع تعديله في مكانه. */
  useEffect(() => {
    if (documentId === null) return;
    void window.diwan.documents.get(documentId).then((doc: DocumentDetail | null) => {
      if (!doc) return;
      setActiveTemplate(doc.templateId);
      setLinkedCitizen(doc.citizenId);
      try {
        const values = JSON.parse(doc.valuesJson) as Partial<Fields> & {
          __letterhead?: unknown;
          __fields?: LetterField[];
        };
        const { __letterhead, __fields, ...rest } = values;
        setF({ ...EMPTY, ...rest, serial: '' });
        if (Array.isArray(__fields) && __fields.length) setFields(__fields);
        if (__letterhead) setLayout(normalizeLayout(__letterhead));
      } catch {
        setF(EMPTY);
      }
      setToast(`نسخة عن ${doc.serial} — تصدر برقم صادر جديد`);
      dirty.current = true;
    });
  }, [documentId]);

  const letterhead = letterheads.find((x) => x.id === letterheadId) ?? null;

  /** اختيار ترويسة من المكتبة ينسخها إلى الكتاب؛ وما يُعدَّل بعدها يخصّ الكتاب وحده. */
  function useLetterhead(id: number | null) {
    setLetterheadId(id);
    setLayoutDirty(false);
    const found = letterheads.find((x) => x.id === id);
    setLayout(found ? normalizeLayout(found.layout) : emptyLayout());
  }

  function editLayout(next: LetterheadLayout) {
    setLayout(next);
    setLayoutDirty(true);
    dirty.current = true;
  }

  /** حفظ ترويسة الكتاب في المكتبة: تحديثًا لمحفوظة، أو باسم جديد. */
  async function storeLayout(name: string, asNew: boolean) {
    const saved = await window.diwan.letterheads.save({
      id: asNew ? null : letterheadId,
      name: name.trim() || 'ترويسة بلا اسم',
      authorityId: letterhead?.authorityId ?? null,
      layout
    });
    const list = await window.diwan.letterheads.list();
    setLetterheads(list);
    setLetterheadId(saved.id);
    setLayoutDirty(false);
    setSaveLayoutOpen(false);
    setToast(asNew ? `حُفظت الترويسة «${saved.name}» في المكتبة` : 'حُدّثت الترويسة المحفوظة');
  }
  const template = templates.find((t) => t.id === activeTemplate) ?? null;
  const stamp = seals.find((s) => s.id === stampId) ?? null;
  const signature = seals.find((s) => s.id === signatureId) ?? null;
  const crest = seals.find((s) => s.kind === 'شعار') ?? null;

  const transaction = f.subject || template?.title || null;

  useEffect(() => {
    onStatus?.({ transaction, busy, exporting });
  }, [transaction, busy, exporting, onStatus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function loadTemplate(id: number | null) {
    setActiveTemplate(id);
    const t = templates.find((x) => x.id === id);
    if (t) set({ body: t.bodyHtml, subject: t.subjectLine ?? '', docType: t.title });
  }

  async function generateSerial() {
    if (!settings) return;
    const serial = await window.diwan.documents.peekSerial(
      settings.serialPrefix,
      settings.serialYear
    );
    set({ serial });
  }

  function stampToday() {
    const now = new Date();
    set({ dateGreg: formatGregorian(now), dateHijri: formatHijri(now) });
  }

  function insertToken(token: string) {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = f.body.slice(0, start) + token + f.body.slice(end);
    set({ body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  function fitZoom() {
    const desk = deskRef.current;
    if (!desk) return;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (desk.clientWidth - 64) / SHEET_WIDTH)));
  }

  /**
   * علامات الورقة كما ستُطبع. عند الإصدار تُستبدل القيم المؤقتة بمواضع محجوزة
   * تملؤها العملية الرئيسية داخل معاملة الإصدار نفسها.
   */
  const sheetHtml = useCallback((forIssue: boolean): string => {
    const node = sheetRef.current?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return '';
    node.style.transform = '';
    if (forIssue) {
      node.querySelectorAll('[data-slot="serial"]').forEach((el) => {
        el.textContent = SERIAL_SLOT;
      });
      node.querySelectorAll('[data-slot="fingerprint"]').forEach((el) => {
        el.textContent = FINGERPRINT_SLOT;
      });
      const qr = node.querySelector('[data-slot="qr"]');
      if (qr) qr.innerHTML = QR_SLOT;
    }
    return node.outerHTML;
  }, []);

  const citizenName = fieldByRole(fields, 'name');
  const destination = fieldByRole(fields, 'destination');
  const purpose = fieldByRole(fields, 'purpose');
  const nationalId = fieldByRole(fields, 'nationalId');

  const hasContent = citizenName.length > 0 || f.body.trim().length > 0;
  const sheetName = f.serial || f.subject || citizenName || 'كتاب';

  // ── المسودات: حفظ يدوي وحفظ تلقائي ──────────────────────────────────
  const saveDraft = useCallback(
    async (silent: boolean) => {
      if (!hasContent) {
        if (!silent) setError('لا تُحفظ مسودة فارغة — اكتب الاسم أو المتن أولًا');
        return;
      }
      setSaving(true);
      try {
        const id = await window.diwan.drafts.save({
          id: draft,
          templateId: activeTemplate,
          citizenId: linkedCitizen,
          title: f.subject || citizenName || 'مسودة بلا عنوان',
          values: {
            ...(f as unknown as Record<string, string>),
            __letterhead: JSON.stringify(layout),
            __fields: JSON.stringify(fields)
          },
          bodyHtml: f.body
        });
        setDraft(id);
        setSavedAt(new Date());
        dirty.current = false;
        if (!silent) setToast('حُفظت المسودة');
      } catch (e) {
        setError(errorText(e, 'تعذّر إتمام العملية'));
      } finally {
        setSaving(false);
      }
    },
    [activeTemplate, linkedCitizen, draft, f, fields, hasContent, layout]
  );

  useEffect(() => {
    if (!dirty.current || !hasContent) return;
    const timer = setTimeout(() => void saveDraft(true), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [f, hasContent, saveDraft]);

  // ── الإخراج ─────────────────────────────────────────────────────────
  async function exportPdf() {
    setExporting(true);
    setError(null);
    try {
      const path = await window.diwan.output.savePdf({
        sheetHtml: sheetHtml(false),
        suggestedName: sheetName
      });
      if (path) setToast(`حُفظ PDF: ${path}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر إتمام العملية'));
    } finally {
      setExporting(false);
    }
  }

  async function exportWord() {
    setExporting(true);
    setError(null);
    try {
      const path = await window.diwan.output.saveDocx({
        sheetHtml: sheetHtml(false),
        suggestedName: sheetName,
        title: f.subject || f.docType || 'كتاب رسمي'
      });
      if (path) setToast(`حُفظ مستند Word: ${path}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر إتمام العملية'));
    } finally {
      setExporting(false);
    }
  }

  async function exportPng() {
    setExporting(true);
    setError(null);
    try {
      const path = await window.diwan.output.savePng300({
        sheetHtml: sheetHtml(false),
        suggestedName: sheetName
      });
      if (path) setToast(`حُفظت صورة بدقة 300 نقطة/إنش: ${path}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر إتمام العملية'));
    } finally {
      setExporting(false);
    }
  }

  /** الإصدار: يفتح حوار النسخ والرسوم، فالطباعة تستهلك رقم صادر ولا تُستأنف. */
  function requestIssue() {
    if (!citizenName) {
      setError('لا يصدر كتاب بلا اسم صاحب العلاقة');
      return;
    }
    if (!f.body.trim()) {
      setError('لا يصدر كتاب بلا متن');
      return;
    }
    setError(null);
    setIssueOpen(true);
  }

  async function issue(opts: { copies: number; copyKind: string; fee: number; print: boolean }) {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await window.diwan.documents.issue(
        {
          sheetHtml: sheetHtml(true),
          templateId: activeTemplate,
          citizenId: linkedCitizen,
          authorityId: letterhead?.authorityId ?? null,
          citizenName,
          nationalId: nationalId || null,
          docType: f.docType.trim() || template?.title || null,
          destination: destination || null,
          purpose: purpose || null,
          values: {
            ...(f as unknown as Record<string, string>),
            __letterhead: JSON.stringify(layout),
            __fields: JSON.stringify(fields)
          },
          copies: opts.copies,
          copyKind: opts.copyKind,
          fee: opts.fee,
          gregorianDate: f.dateGreg || formatGregorian(new Date()),
          hijriDate: f.dateHijri || null,
          operator: settings.operatorName || null,
          printer: printer?.name ?? null,
          serialPrefix: settings.serialPrefix,
          serialYear: settings.serialYear
        },
        opts.print
      );

      setIssued(outcome);
      setIssueOpen(false);
      set({ serial: outcome.serial });
      dirty.current = false;
      if (draft !== null) {
        await window.diwan.drafts.delete(draft);
        setDraft(null);
      }
      onIssued?.();

      if (outcome.archiveError) {
        setError(
          `صدر الكتاب برقم ${outcome.serial}، لكن نسخته PDF لم تُحفظ في الأرشيف ` +
            `(${outcome.archiveError}) — متنه محفوظ في السجل، ويمكن حفظ نسخته من شاشة الأرشيف.`
        );
      } else if (outcome.printed === 'failed') {
        setError(
          `صدر الكتاب برقم ${outcome.serial} وقُيّد في الأرشيف، لكن الطباعة لم تتم` +
            (outcome.printError ? ` (${outcome.printError})` : '') +
            ' — أعِد طباعته من سجل الأرشيف.'
        );
      }
    } catch (e) {
      setError(errorText(e, 'تعذّر إتمام العملية'));
    } finally {
      setBusy(false);
    }
  }

  /** طباعة الورقة الجارية بلا إصدار — للمراجعة قبل استهلاك رقم صادر. */
  async function printDraftSheet() {
    setBusy(true);
    setError(null);
    try {
      const result = await window.diwan.output.print({
        sheetHtml: sheetHtml(false),
        printer: printer?.name ?? null,
        copies: 1,
        silent: false
      });
      if (!result.ok && result.reason) setError(`تعذّرت الطباعة: ${result.reason}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر إتمام العملية'));
    } finally {
      setBusy(false);
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      saveDraft: () => void saveDraft(false),
      exportPdf: () => void exportPdf(),
      print: () => requestIssue()
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saveDraft, f, settings, printer, activeTemplate, letterhead]
  );

  // اختصارات المحرر: F2 استيراد مواطن، Ctrl+S حفظ مسودة.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setPickerOpen(true);
      }
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void saveDraft(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveDraft]);

  const rendered = useMemo(() => injectTokens(f.body, f, fields), [f, fields]);
  const copiesTo = f.copiesTo.split('\n').map((l) => l.trim()).filter(Boolean);

  /** المتغيّرات المتاحة: ما يعرّفه النموذج المحمَّل، أو لا شيء قبل تحميله. */
  const tokens = template?.variables.map((v) => `{${v}}`) ?? [];

  /** حجم الوثيقة كما يعرضه شريط الحالة في التصميم — من علاماتها الفعلية. */
  const sizeKb = Math.max(1, Math.round(new Blob([rendered + f.body]).size / 102.4) / 10);

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-surface">
        {/* لوح الإدخال */}
        <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 h-full flex flex-col bg-surface-container-lowest shadow-[0_10px_30px_rgba(11,28,48,0.06)] z-20 overflow-hidden">
          <div className="p-space-md bg-surface-container-low flex flex-col gap-space-sm shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="p-1 rounded-lg bg-primary-container text-on-primary">
                  <span className="material-symbols-outlined text-[18px]">auto_stories</span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  محرر الكتب الرسمية الذكي
                </span>
              </div>
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                مزامنة فورية
              </span>
            </div>

            <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                  النموذج الرسمي النشط
                </label>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  مكتبة النماذج (Ctrl+M)
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                <select
                  className="flex-1 h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                  value={activeTemplate ?? ''}
                  onChange={(e) => loadTemplate(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">
                    {templates.length === 0 ? '— لا نماذج في المكتبة بعد —' : '— اختر نموذجًا —'}
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <button
                  className="h-9 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors"
                  title="استيراد سريع من سجل المواطنين"
                  type="button"
                  onClick={() => setPickerOpen(true)}
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">
                    person_search
                  </span>
                  <span>استيراد (F2)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-space-md space-y-space-md">
            {error && (
              <div className="flex items-start gap-space-xs p-space-sm rounded-lg bg-error-container text-on-error-container font-label-md text-label-md">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span className="flex-1">{error}</span>
                <button
                  className="material-symbols-outlined text-[16px]"
                  type="button"
                  onClick={() => setError(null)}
                >
                  close
                </button>
              </div>
            )}
            {toast && (
              <div className="flex items-start gap-space-xs p-space-sm rounded-lg bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md">
                <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
                <span className="flex-1 break-all">{toast}</span>
              </div>
            )}

            {/* القسم الأول: الترويسة */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    account_balance
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    ترويسة الجهة الإدارية
                  </h3>
                </div>
                {layoutDirty && (
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold">
                    خاصّة بهذا الكتاب
                  </span>
                )}
              </div>

              <div className="flex items-center gap-space-xs">
                <select
                  className="flex-1 h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                  value={letterheadId ?? ''}
                  onChange={(e) => useLetterhead(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">
                    {letterheads.length === 0 ? '— لا ترويسة محفوظة بعد —' : '— بلا ترويسة —'}
                  </option>
                  {letterheads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  className="h-9 px-2.5 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm flex items-center gap-1"
                  type="button"
                  onClick={() => setDesignerOpen(true)}
                >
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  تحرير الترويسة
                </button>
              </div>

              <div className="flex items-center justify-between gap-space-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {isLayoutEmpty(layout)
                    ? 'الورقة بلا ترويسة — حرّرها لتظهر أعلى الكتاب'
                    : `${layout.columns === 1 ? 'قسم واحد' : layout.columns === 2 ? 'قسمان' : 'ثلاثة أقسام'} · ${layout.sections
                        .slice(0, layout.columns)
                        .reduce((n, sec) => n + sec.blocks.length, 0)} عنصرًا`}
                </span>
                <button
                  className="font-label-sm text-label-sm text-secondary font-semibold hover:underline disabled:opacity-40 disabled:no-underline"
                  type="button"
                  disabled={isLayoutEmpty(layout)}
                  onClick={() => setSaveLayoutOpen(true)}
                >
                  حفظ في المكتبة
                </button>
              </div>
            </section>

            {/* القسم الثاني: سجل الصادر والتاريخ */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">123</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    سجل الصادر والتأريخ الرسمي
                  </h3>
                </div>
                <button
                  className="font-label-sm text-label-sm text-secondary font-semibold flex items-center gap-1 hover:underline"
                  type="button"
                  onClick={() => void generateSerial()}
                >
                  <span className="material-symbols-outlined text-[16px]">autorenew</span>
                  <span>توليد متسلسل</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-space-sm">
                <Field label="رقم الصادر" required>
                  <input
                    className={inputCls}
                    id="inputSerial"
                    type="text"
                    value={f.serial}
                    placeholder="—"
                    onChange={(e) => set({ serial: e.target.value })}
                  />
                </Field>
                <Field label="التاريخ الميلادي">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.dateGreg}
                    placeholder="—"
                    onChange={(e) => set({ dateGreg: e.target.value })}
                  />
                </Field>
                <Field label="التاريخ الهجري">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.dateHijri}
                    placeholder="—"
                    onChange={(e) => set({ dateHijri: e.target.value })}
                  />
                </Field>
              </div>
              <button
                className="w-full h-8 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors"
                type="button"
                onClick={stampToday}
              >
                ختم تاريخ اليوم (ميلادي وهجري)
              </button>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                العدد والتاريخ يظهران في الترويسة لا في متن الكتاب، وإظهارهما اختياري —
                من «تحرير الترويسة». والكتاب يُقيَّد في الأرشيف برقمه على كل حال، والرقم
                المعروض هنا اطّلاعٌ يُحجز النهائيُّ منه لحظة الإصدار.
              </p>
            </section>

            {/* القسم الثالث: صاحب العلاقة — حقول يبنيها المكتب */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    بيانات صاحب العلاقة
                  </h3>
                </div>
                <button
                  className="h-8 px-space-sm rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1 shadow-sm"
                  type="button"
                  onClick={() => setFieldPickerOpen(true)}
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>إضافة حقل</span>
                </button>
              </div>

              {fields.length === 0 ? (
                <div className="py-space-md rounded-lg border border-dashed border-outline-variant flex flex-col items-center gap-space-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[24px]">person_add</span>
                  <span className="font-label-md text-label-md">لا حقول في هذا الكتاب</span>
                  <span className="font-label-sm text-label-sm">أضف ما تطلبه المعاملة</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-space-sm">
                  {fields.map((field) => (
                    <div key={field.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="font-label-sm text-label-sm text-on-surface-variant truncate">
                          {field.label} {field.role === 'name' && <span className="text-error">*</span>}
                        </label>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            className="px-1 rounded font-mono text-[10px] text-secondary hover:bg-surface-container-high"
                            title={`إدراج {${field.token}} في المتن`}
                            type="button"
                            onClick={() => insertToken(`{${field.token}}`)}
                          >
                            {'{'}
                            {field.token}
                            {'}'}
                          </button>
                          <button
                            className="w-5 h-5 rounded flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container"
                            title="حذف الحقل من هذا الكتاب"
                            type="button"
                            onClick={() => removeField(field.id)}
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          className={`${inputCls} ${field.role === 'nationalId' ? 'font-mono' : ''}`}
                          type="text"
                          value={field.value}
                          placeholder="—"
                          onChange={(e) => setFieldValue(field.id, e.target.value)}
                        />
                        {field.date && (
                          <button
                            className="h-9 px-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant"
                            title="ختم تاريخ اليوم"
                            type="button"
                            onClick={() => setFieldValue(field.id, formatGregorian(new Date()))}
                          >
                            <span className="material-symbols-outlined text-[16px]">event</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    className="min-h-[4.5rem] rounded-lg border border-dashed border-outline-variant hover:border-secondary hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors flex flex-col items-center justify-center gap-0.5 px-space-xs"
                    type="button"
                    onClick={() => setFieldPickerOpen(true)}
                  >
                    <span className="material-symbols-outlined text-[20px] text-secondary">
                      add_circle
                    </span>
                    <span className="font-label-md text-label-md font-semibold">إضافة حقل</span>
                    <span className="font-label-sm text-label-sm text-center leading-tight">
                      من معاملات التربية والجنسية والجوازات، أو حقل تسمّيه بنفسك
                    </span>
                  </button>
                </div>
              )}
            </section>

            {/* القسم الرابع: المتن والمتغيرات */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    text_fields
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    منطوق الكتاب والمتغيرات
                  </h3>
                </div>
              </div>

              {tokens.length > 0 && (
                <div className="flex flex-wrap items-center gap-space-xs">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    حقن سريع:
                  </span>
                  {tokens.map((t) => (
                    <button
                      key={t}
                      className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-label-sm text-label-sm hover:bg-secondary-fixed transition-colors"
                      type="button"
                      onClick={() => insertToken(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-space-sm">
                <Field label="سطر الموضوع (م /)">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.subject}
                    placeholder="—"
                    onChange={(e) => set({ subject: e.target.value })}
                  />
                </Field>
                <Field label="نوع الوثيقة (للسجل)">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.docType}
                    placeholder={template?.title ?? '—'}
                    onChange={(e) => set({ docType: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="المتن الرسمي">
                <textarea
                  ref={bodyRef}
                  className="w-full p-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md leading-relaxed focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                  rows={7}
                  value={f.body}
                  placeholder={
                    templates.length === 0
                      ? 'اكتب المتن هنا، أو أنشئ نموذجًا في المكتبة لتحميله'
                      : 'اختر نموذجًا من الأعلى أو اكتب المتن هنا'
                  }
                  onChange={(e) => set({ body: e.target.value })}
                />
              </Field>

              <Field label="نسخة منه إلى (سطر لكل جهة)">
                <textarea
                  className="w-full p-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                  rows={3}
                  value={f.copiesTo}
                  placeholder="—"
                  onChange={(e) => set({ copiesTo: e.target.value })}
                />
              </Field>
            </section>

            {/* القسم الخامس: التوقيع والأختام */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    verified
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    التخويل والأختام الرقمية
                  </h3>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  المصادقة الرسمية
                </span>
              </div>
              <div className="grid grid-cols-2 gap-space-sm">
                <Field label="الموقّع والمخوّل بالتوقيع">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.signerName}
                    placeholder="—"
                    onChange={(e) => set({ signerName: e.target.value })}
                  />
                </Field>
                <Field label="المنصب الإداري">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.signerRole}
                    placeholder="—"
                    onChange={(e) => set({ signerRole: e.target.value })}
                  />
                </Field>
              </div>

              <div className="pt-space-xs flex flex-col gap-space-sm bg-surface-container-low p-space-sm rounded-lg">
                <div className="flex items-center justify-between gap-space-sm">
                  <Toggle
                    checked={showStamp}
                    onChange={setShowStamp}
                    disabled={seals.length === 0}
                    label="إظهار الختم الرسمي"
                  />
                  <Toggle checked={showBarcode} onChange={setShowBarcode} label="رمز التحقق (QR)" />
                  <Toggle
                    checked={showWatermark}
                    onChange={setShowWatermark}
                    label="علامة مائية"
                  />
                </div>

                {seals.length === 0 ? (
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    لا ختم ولا توقيع مرفوع — ارفعهما من «إعدادات الترويسة والأختام»
                  </span>
                ) : (
                  <div className="grid grid-cols-2 gap-space-sm">
                    <Field label="الختم المستعمل">
                      <select
                        className={inputCls}
                        value={stampId ?? ''}
                        onChange={(e) => setStampId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">— بلا ختم —</option>
                        {seals.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="صورة التوقيع">
                      <select
                        className={inputCls}
                        value={signatureId ?? ''}
                        onChange={(e) =>
                          setSignatureId(e.target.value ? Number(e.target.value) : null)
                        }
                      >
                        <option value="">— بلا توقيع —</option>
                        {seals.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* شريط الحالة: الحفظ التلقائي وحجم الوثيقة — كما في التصميم */}
          <div className="p-space-sm px-space-md bg-surface-container-low flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm shrink-0">
            <div className="flex items-center gap-1">
              <span
                className={`material-symbols-outlined text-[16px] ${
                  saving ? 'animate-spin text-on-surface-variant' : 'text-secondary'
                }`}
              >
                {saving ? 'progress_activity' : savedAt ? 'cloud_done' : 'cloud_off'}
              </span>
              <span>
                {saving
                  ? 'الحفظ التلقائي: يحفظ الآن...'
                  : savedAt
                    ? `الحفظ التلقائي: حُفظت ${savedAt.toLocaleTimeString('ar-IQ', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}`
                    : hasContent
                      ? 'الحفظ التلقائي: لم تُحفظ بعد'
                      : 'الحفظ التلقائي: لا مسودة'}
              </span>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="font-mono text-on-surface font-semibold">{sizeKb} KB</span>
              <span>
                | كود الوثيقة: {template?.code ?? (f.serial ? f.serial : 'لم يُحدَّد بعد')}
              </span>
            </div>
          </div>
        </div>

        {/* منضدة الورق */}
        <div className="flex-1 h-full flex flex-col overflow-hidden bg-surface-dim/40">
          <div className="h-14 shrink-0 px-space-md flex items-center justify-between bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-space-sm">
              <button
                className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
                title="تصغير"
                type="button"
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))}
              >
                <span className="material-symbols-outlined text-[18px]">zoom_out</span>
              </button>
              <span className="font-label-md text-label-md text-on-surface font-semibold tabular w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
                title="تكبير"
                type="button"
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}
              >
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
              <button
                className="px-space-sm h-8 rounded text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm transition-colors"
                type="button"
                onClick={fitZoom}
              >
                ملاءمة العرض
              </button>
              <span className="hidden sm:flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[16px]">aspect_ratio</span>
                قياس المعاينة: ISO 216 (A4 — 210×297mm)
              </span>
            </div>

            <div className="flex items-center gap-space-xs">
              <button
                className="h-9 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                type="button"
                disabled={exporting || busy}
                onClick={() => void exportWord()}
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  description
                </span>
                <span className="hidden md:inline">تصدير Word (.docx)</span>
              </button>
              <button
                className="h-9 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                type="button"
                disabled={exporting || busy}
                onClick={() => void exportPng()}
              >
                <span className="material-symbols-outlined text-[16px] text-error">
                  picture_as_pdf
                </span>
                <span className="hidden md:inline">
                  {exporting ? 'جاري التصدير 300DPI...' : 'تصدير بدقة عالية (300 DPI)'}
                </span>
              </button>
              <button
                className="h-9 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                type="button"
                disabled={busy}
                title="طباعة الورقة للمراجعة — بلا رقم صادر وبلا قيد في الأرشيف"
                onClick={() => void printDraftSheet()}
              >
                <span className="material-symbols-outlined text-[16px]">preview</span>
                <span className="hidden lg:inline">طباعة تجريبية</span>
              </button>
              <button
                className="h-9 px-space-md rounded-lg bg-primary text-on-primary hover:bg-surface-tint font-label-md text-label-md font-semibold flex items-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
                type="button"
                disabled={busy}
                onClick={requestIssue}
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>{busy ? 'يصدر الكتاب...' : 'إصدار وطباعة الورقة الرسمية'}</span>
              </button>
            </div>
          </div>

          <div ref={deskRef} className="flex-1 overflow-auto flex flex-col items-center py-space-xl">
            <div
              ref={sheetRef}
              className="a4-sheet print-sheet bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] shrink-0 relative"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              {showWatermark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                  {crest ? (
                    <img
                      alt=""
                      src={storeUrl(crest.imagePath)}
                      style={{ width: 420, opacity: 0.06 }}
                    />
                  ) : (
                    <span
                      className="font-headline-xl text-on-surface opacity-[0.12] select-none"
                      style={{ fontSize: '96px', transform: 'rotate(-30deg)' }}
                    >
                      مسودة
                    </span>
                  )}
                </div>
              )}

              <div
                className="relative flex flex-col min-h-[1123px]"
                style={{
                  paddingTop: mmToPx(layout.margins.top),
                  paddingRight: mmToPx(layout.margins.right),
                  paddingBottom: mmToPx(layout.margins.bottom),
                  paddingLeft: mmToPx(layout.margins.left)
                }}
              >
                {/* الترويسة كما بناها المكتب لهذا الكتاب */}
                <LetterheadView
                  layout={layout}
                  registryValues={{ serial: f.serial, date: f.dateGreg }}
                  resolve={(value) =>
                    injectTokens(value, f, fields).replace(/<[^>]+>/g, '') || value
                  }
                />

                {/* المرسل إليه والموضوع */}
                <div className="mt-space-lg space-y-space-md">
                  {destination && (
                    <div className="font-bold text-on-surface" style={{ fontSize: '15px' }}>
                      إلى / {destination}
                    </div>
                  )}
                  {f.subject && (
                    <div
                      className="font-bold text-on-surface text-center underline underline-offset-8"
                      style={{ fontSize: '15px' }}
                    >
                      م / {f.subject}
                    </div>
                  )}
                </div>

                {/* المتن */}
                <div
                  className="mt-space-lg text-on-surface"
                  style={{ fontSize: '14px', lineHeight: 2, textAlign: 'justify' }}
                  dangerouslySetInnerHTML={{ __html: rendered }}
                />

                {/* التوقيع والأختام */}
                {(f.signerName || f.signerRole || (showStamp && stamp) || showBarcode) && (
                  <div className="mt-space-xl flex items-end justify-between">
                    <div className="flex flex-col items-center gap-1 min-w-[80px]">
                      {showBarcode && (
                        <>
                          <div
                            className="bg-surface-container-lowest p-1"
                            data-slot="qr"
                            dangerouslySetInnerHTML={{
                              __html: qrSvg(f.serial || 'معاينة — لم يصدر بعد', 64)
                            }}
                          />
                          <span
                            className="font-mono text-on-surface-variant"
                            style={{ fontSize: '8px' }}
                            data-slot="fingerprint"
                          >
                            بصمة التوثيق تُختم عند الإصدار
                          </span>
                        </>
                      )}
                    </div>

                    {showStamp && stamp?.imagePath && (
                      <img
                        alt=""
                        src={storeUrl(stamp.imagePath)}
                        style={{ width: 130, transform: 'rotate(-8deg)', opacity: 0.9 }}
                      />
                    )}

                    <div className="flex flex-col items-center gap-1 min-w-[150px]">
                      {signature?.imagePath && (
                        <img alt="" src={storeUrl(signature.imagePath)} style={{ width: 140 }} />
                      )}
                      {f.signerName && (
                        <span className="font-bold text-on-surface" style={{ fontSize: '14px' }}>
                          {f.signerName}
                        </span>
                      )}
                      {f.signerRole && (
                        <span
                          className="text-on-surface-variant text-center"
                          style={{ fontSize: '12px' }}
                        >
                          {f.signerRole}
                        </span>
                      )}

                    </div>
                  </div>
                )}

                {/* نسخة منه إلى، وسطر الطابع */}
                <div className="mt-auto pt-space-lg">
                  {copiesTo.length > 0 && (
                    <div
                      className="pt-space-sm border-t border-outline-variant text-on-surface-variant"
                      style={{ fontSize: '11px', lineHeight: 1.9 }}
                    >
                      <div className="font-bold text-on-surface mb-0.5">نسخة منه إلى:</div>
                      <ul className="list-disc list-inside">
                        {copiesTo.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {settings?.operatorName && (
                    <div
                      className="mt-space-sm flex items-center justify-between text-on-surface-variant font-mono"
                      style={{ fontSize: '10px' }}
                    >
                      <span>طُبع بواسطة: {settings.operatorName}</span>
                      <span>{settings.officeName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <CitizenPicker
          onClose={() => setPickerOpen(false)}
          onPick={(c) => {
            setLinkedCitizen(c.id);
            fillFromCitizen(c as unknown as Record<string, unknown>);
            setPickerOpen(false);
          }}
        />
      )}

      {fieldPickerOpen && (
        <FieldPicker
          existing={fields}
          onClose={() => setFieldPickerOpen(false)}
          onPick={(catalog) => {
            addField(catalog);
            setFieldPickerOpen(false);
          }}
        />
      )}

      {designerOpen && (
        <Modal title="ترويسة هذا الكتاب" onClose={() => setDesignerOpen(false)}>
          <div className="max-h-[70vh] overflow-y-auto">
            <LetterheadDesigner layout={layout} onChange={editLayout} showPageOptions />
          </div>
          <div className="flex items-center justify-between pt-space-md">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              التعديل يخصّ هذا الكتاب. لإبقائه لكتب أخرى احفظه في المكتبة.
            </span>
            <button
              className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold"
              type="button"
              onClick={() => setDesignerOpen(false)}
            >
              تم
            </button>
          </div>
        </Modal>
      )}

      {saveLayoutOpen && (
        <SaveLayoutDialog
          current={letterhead}
          onClose={() => setSaveLayoutOpen(false)}
          onSave={(name, asNew) => void storeLayout(name, asNew)}
        />
      )}

      {issueOpen && (
        <IssueDialog
          serial={f.serial}
          name={citizenName}
          printerName={printer?.displayName ?? null}
          busy={busy}
          onClose={() => setIssueOpen(false)}
          onIssue={(opts) => void issue(opts)}
        />
      )}

      {issued && (
        <IssuedDialog
          outcome={issued}
          onClose={() => setIssued(null)}
          onReprint={async () => {
            await window.diwan.documents.reprint([issued.id], 1);
          }}
          onExport={async () => {
            const path = await window.diwan.documents.exportPdf(issued.id);
            if (path) setToast(`حُفظ PDF: ${path}`);
          }}
        />
      )}
    </main>
  );
}

export default forwardRef(EditorScreen);

const inputCls =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-label-sm text-label-sm text-on-surface-variant">
        {label} {required && <span className="text-error">*</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-space-xs ${
        disabled ? 'opacity-40' : 'cursor-pointer'
      } select-none`}
    >
      <input
        className="w-4 h-4 accent-secondary"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="font-label-sm text-label-sm text-on-surface font-medium">{label}</span>
    </label>
  );
}

/** استيراد سريع من سجل المواطنين — F2، والبحث متساهل مع الهمزة. */
function CitizenPicker({
  onClose,
  onPick
}: {
  onClose: () => void;
  onPick: (c: CitizenDetail) => void;
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<
    { id: number; fullName: string; nationalId: string | null; jobTitle: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void window.diwan.citizens.list({ query, limit: 40 }).then((list) => {
        if (!live) return;
        setRows(list);
        setLoading(false);
      });
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  async function pick(id: number) {
    const c = await window.diwan.citizens.get(id);
    if (c) onPick(c);
  }

  return (
    <Modal title="استيراد من سجل المواطنين" onClose={onClose}>
      <input
        autoFocus
        className={inputCls}
        placeholder="ابحث بالاسم أو الرقم الوطني أو الهاتف..."
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-space-sm max-h-[50vh] overflow-y-auto divide-y divide-outline-variant">
        {loading ? (
          <div className="py-space-lg text-center text-on-surface-variant font-label-md text-label-md">
            جارٍ البحث...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-space-lg flex flex-col items-center gap-space-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[32px]">person_off</span>
            <span className="font-label-md text-label-md">
              {query ? 'لا مواطن بهذا البحث' : 'سجل المواطنين فارغ'}
            </span>
          </div>
        ) : (
          rows.map((r) => (
            <button
              key={r.id}
              className="w-full text-right py-space-sm px-space-xs hover:bg-surface-container-high transition-colors flex items-center justify-between"
              type="button"
              onClick={() => void pick(r.id)}
            >
              <div className="flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface font-bold">
                  {r.fullName}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {r.jobTitle ?? '—'}
                </span>
              </div>
              <span className="font-mono font-label-sm text-label-sm text-on-surface-variant">
                {r.nationalId ?? ''}
              </span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

/**
 * إضافة حقل: من كتالوج المعاملات الرسمية، أو حقل يسمّيه المكتب بنفسه.
 * الكتالوج اقتراح لا إلزام — والحذف متاح من البطاقة نفسها.
 */
function FieldPicker({
  existing,
  onClose,
  onPick
}: {
  existing: LetterField[];
  onClose: () => void;
  onPick: (field: CatalogField) => void;
}) {
  const [query, setQuery] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  const term = query.trim();
  const groups = FIELD_GROUPS.map((group) => ({
    ...group,
    fields: group.fields.filter(
      (field) => !term || field.label.includes(term) || field.token.includes(term)
    )
  })).filter((group) => group.fields.length > 0);

  const used = new Set(existing.map((f) => f.label));

  return (
    <Modal title="إضافة حقل إلى الكتاب" onClose={onClose}>
      <div className="space-y-space-md">
        <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            حقل تسمّيه بنفسك — يظهر فارغًا، ويصير وسمًا في المتن
          </span>
          <div className="flex items-center gap-space-xs">
            <input
              autoFocus
              className={inputCls}
              placeholder="مثال: رقم الإضبارة"
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customLabel.trim()) {
                  onPick({ label: customLabel.trim(), token: tokenFromLabel(customLabel) });
                }
              }}
            />
            <button
              className="h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
              type="button"
              disabled={!customLabel.trim()}
              onClick={() => onPick({ label: customLabel.trim(), token: tokenFromLabel(customLabel) })}
            >
              إضافة
            </button>
          </div>
        </div>

        <input
          className={inputCls}
          placeholder="ابحث في حقول المعاملات الرسمية..."
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="max-h-[45vh] overflow-y-auto space-y-space-md">
          {groups.length === 0 ? (
            <div className="py-space-lg text-center text-on-surface-variant font-label-md text-label-md">
              لا حقل بهذا الاسم — أضفه حقلًا مخصّصًا من الأعلى
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.name} className="space-y-space-xs">
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-label-lg text-label-lg text-on-surface font-bold">
                    {group.name}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {group.hint}
                  </span>
                </div>
                <div className="flex flex-wrap gap-space-xs">
                  {group.fields.map((field) => (
                    <button
                      key={field.token}
                      className={`h-8 px-space-sm rounded-lg font-label-sm text-label-sm transition-colors ${
                        used.has(field.label)
                          ? 'bg-surface-container text-on-surface-variant'
                          : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface'
                      }`}
                      type="button"
                      onClick={() => onPick(field)}
                    >
                      {field.label}
                      {used.has(field.label) && ' ✓'}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

/** حفظ ترويسة الكتاب في المكتبة: تحديثًا للمحفوظة أو باسم جديد. */
function SaveLayoutDialog({
  current,
  onClose,
  onSave
}: {
  current: Letterhead | null;
  onClose: () => void;
  onSave: (name: string, asNew: boolean) => void;
}) {
  const [name, setName] = useState(current?.name ?? '');

  return (
    <Modal title="حفظ الترويسة في المكتبة" onClose={onClose}>
      <div className="space-y-space-md">
        <Field label="اسم الترويسة">
          <input
            autoFocus
            className={inputCls}
            placeholder="مثال: مديرية تربية بغداد / الرصافة الأولى"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="flex items-center justify-end gap-space-sm">
          <button
            className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
            type="button"
            onClick={onClose}
          >
            تراجع
          </button>
          {current && (
            <button
              className="h-10 px-space-md rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md"
              type="button"
              onClick={() => onSave(name || current.name, false)}
            >
              تحديث «{current.name}»
            </button>
          )}
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-50"
            type="button"
            disabled={!name.trim()}
            onClick={() => onSave(name, true)}
          >
            حفظ باسم جديد
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** حوار الإصدار: النسخ والرسوم — الأعمدة التي يعرضها سجل الأرشيف. */
function IssueDialog({
  serial,
  name,
  printerName,
  busy,
  onClose,
  onIssue
}: {
  serial: string;
  name: string;
  printerName: string | null;
  busy: boolean;
  onClose: () => void;
  onIssue: (opts: { copies: number; copyKind: string; fee: number; print: boolean }) => void;
}) {
  const [copies, setCopies] = useState(1);
  const [copyKind, setCopyKind] = useState(COPY_KINDS[0]!);
  const [fee, setFee] = useState(0);

  return (
    <Modal title="إصدار الكتاب الرسمي" onClose={onClose}>
      <div className="space-y-space-md">
        <div className="p-space-sm rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
          يُحجز رقم الصادر الآن ويُقيَّد الكتاب في الأرشيف ببصمته. الرقم لا يُلغى بعد
          الإصدار.
          <div className="mt-1 text-on-surface">
            صاحب العلاقة: <span className="font-bold">{name}</span>
            {serial && (
              <>
                {' · '}الرقم المتوقَّع: <span className="font-mono">{serial}</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-space-sm">
          <Field label="عدد النسخ">
            <input
              className={inputCls}
              min={1}
              type="number"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="نوع النسخة">
            <select
              className={inputCls}
              value={copyKind}
              onChange={(e) => setCopyKind(e.target.value)}
            >
              {COPY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الرسوم (د.ع)">
            <input
              className={inputCls}
              min={0}
              step={250}
              type="number"
              value={fee}
              onChange={(e) => setFee(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>

        <div className="font-label-sm text-label-sm text-on-surface-variant">
          {printerName ? (
            <>
              الطباعة إلى: <span className="text-on-surface font-semibold">{printerName}</span>
            </>
          ) : (
            'لم تُختر طابعة — سيفتح حوار الطباعة في النظام'
          )}
        </div>

        <div className="flex items-center justify-end gap-space-sm pt-space-xs">
          <button
            className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
            type="button"
            onClick={onClose}
          >
            تراجع
          </button>
          <button
            className="h-10 px-space-md rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={() => onIssue({ copies, copyKind, fee, print: false })}
          >
            إصدار وقيد بلا طباعة
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={() => onIssue({ copies, copyKind, fee, print: true })}
          >
            {busy ? 'يصدر...' : 'إصدار وطباعة'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function IssuedDialog({
  outcome,
  onClose,
  onReprint,
  onExport
}: {
  outcome: IssueOutcome;
  onClose: () => void;
  onReprint: () => Promise<void>;
  onExport: () => Promise<void>;
}) {
  return (
    <Modal title="صدر الكتاب" onClose={onClose}>
      <div className="space-y-space-md">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-[32px] text-secondary">verified</span>
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md text-on-surface font-mono">
              {outcome.serial}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {outcome.printed === 'ok'
                ? 'أُرسل إلى الطابعة وقُيّد في سجل الصادر'
                : outcome.printed === 'skipped'
                  ? 'قُيّد في سجل الصادر بلا طباعة'
                  : 'قُيّد في سجل الصادر — الطباعة لم تتم'}
            </span>
          </div>
        </div>

        <div className="p-space-sm rounded-lg bg-surface-container-low">
          <div className="font-label-sm text-label-sm text-on-surface-variant mb-1">
            بصمة التوثيق (SHA-256)
          </div>
          <div className="font-mono text-body-sm break-all text-on-surface">{outcome.sha256}</div>
        </div>

        <div className="flex items-center justify-end gap-space-sm">
          <button
            className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
            type="button"
            onClick={() => void onExport()}
          >
            حفظ PDF
          </button>
          <button
            className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
            type="button"
            onClick={() => void onReprint()}
          >
            طباعة نسخة أخرى
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold"
            type="button"
            onClick={onClose}
          >
            تم
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
          <button
            className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="p-space-md">{children}</div>
      </div>
    </div>
  );
}
