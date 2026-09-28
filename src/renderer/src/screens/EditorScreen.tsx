/**
 * محرّر الكتب — data-path="smart-editor-a4-preview"
 *
 * **التحرير على الورقة نفسها، والأدوات في الجوانب** (قرار المالك، أيلول ٢٠٢٦): يُكتب
 * الكتاب في الورقة بمحرّر الكتل الذي يؤلّف به مصمّم النماذج — جدولٌ وأعمدةٌ وخطٌّ
 * ومحاذاة وحقول (F4) — والحقل على الورقة يُظهر قيمته حيث كُتب. وفي اللوح الجانبي
 * ما يُعمل عليه بالترتيب: النموذج والترويسة، ثم العدد والتاريخ، ثم القيم، ثم
 * قائمة التحقّق فالإصدار.
 *
 * وكان المتن مربّع نصٍّ بوسوم `{…}` ومعاينةً جانبية، ونموذجٌ مستوردٌ من Word يُحمَّل
 * ظلَّه النصّي فتضيع جداوله وتنسيقه. والمسودات والكتب القديمة تُقرأ وتُرحَّل
 * (`shared/letterDraft.ts`).
 *
 * والورقة التي تُصدر وتُطبع هي `LetterSheet` نفسها التي يُصدر منها الشبّاك — فلا
 * تختلف ورقة المحرّر عن ورقة الشبّاك. ولا توقيع ولا ختم ولا رمز تحقّق: الجهة توقّع
 * وتختم بيدها. ورقم القيد للأرشيف وحده، و«العدد» على الكتاب ما أعطاه الزبون (§١).
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CitizenDetail, DocumentDetail, IssueOutcome, OfficeSettings, PrinterInfo, TemplateSummary } from '@shared/api';
import { CALENDAR_LABEL, formatGregorian, formatHijri, type Calendar } from '@shared/dates';
import { patchField } from '@shared/docEdit';
import { normalizeFold } from '@shared/arabic';
import { docText, emptyDoc, isDateField, makeField, pageMm, paragraph, type Doc, type DocField } from '@shared/doc';
import { emptyLayout, isLayoutEmpty, normalizeLayout, asksLetterNumber, resolveLayout, type Letterhead, type LetterheadLayout } from '@shared/letterhead';
import { CORE_FIELDS, FIELD_GROUPS, type CatalogField } from '@shared/letterFields';
import { derivedWords, amountWordsField, wordsForField } from '@shared/tafqeet';
import { GENDER_KEY, docHasChoices, guessGender, isChoiceKey, type Gender } from '@shared/gender';
import { useLearnedGenders } from '../lib/useLearnedGenders';
import { docSpelling, fixDocSpelling } from '@shared/spelling';
import { countInDoc, replaceInDoc } from '@shared/findReplace';
import { NO_REGISTRY, letterChecks, letterValues, nameFieldOf, readSavedLetter, sampleValues, type Registry } from '@shared/letterDraft';
import { isCombo, shortcut } from '@shared/shortcuts';
import { errorText } from '../lib/errors';
import AddressingPicker from '../components/AddressingPicker';
import DateTools from '../components/DateTools';
import DocEditor, { type DocEditorApi } from '../components/DocEditor';
import LetterheadView from '../components/LetterheadView';
import LetterheadDesigner from '../components/LetterheadDesigner';
import LetterSheet, { gapAfter } from '../components/LetterSheet';
import SpellingPanel from '../components/SpellingPanel';
import SymbolPalette from '../components/SymbolPalette';

const AUTOSAVE_MS = 4000;
const COPY_KINDS = ['نسخة أصلية', 'نسخة مصدقة', 'نسخة مختومة'];
const MM_PX = 96 / 25.4;

/** كتابٌ جديد: سطرٌ فارغ واحد — والبرنامج لا يزرع متنًا (المبدأ ١). */
function blankLetter(): Doc {
  const doc = emptyDoc();
  doc.blocks = [paragraph([])];
  return doc;
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
  { templateId = null, citizenId = null, draftId = null, documentId = null, printer, onStatus, onIssued }: Props,
  ref: React.Ref<EditorHandle>
) {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [clips, setClips] = useState<{ id: number; title: string; body: string }[]>([]);

  const [letterheadId, setLetterheadId] = useState<number | null>(null);
  /** ترويسة هذا الكتاب: نسخةٌ تُحرَّر معه، لا إحالةٌ إلى المحفوظة. */
  const [layout, setLayout] = useState<LetterheadLayout>(emptyLayout());
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [saveLayoutOpen, setSaveLayoutOpen] = useState(false);

  const [activeTemplate, setActiveTemplate] = useState<number | null>(templateId);
  const [linkedCitizen, setLinkedCitizen] = useState<number | null>(citizenId);
  const [doc, setDocState] = useState<Doc>(blankLetter);
  const [values, setValues] = useState<Record<string, string>>({});
  const [registry, setRegistry] = useState<Registry>(NO_REGISTRY);
  const [docType, setDocType] = useState('');
  /** اسم صاحب العلاقة حين لا حقل للاسم على الورقة — للأرشيف وحده. */
  const [owner, setOwner] = useState('');
  const [genderByHand, setGenderByHand] = useState(false);
  /** ما تعلّمه المكتب من التذكير والتأنيث (ج٤). */
  const [learned, remember] = useLearnedGenders();

  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [trial, setTrial] = useState(false);
  const [tool, setTool] = useState<'find' | 'symbols' | null>(null);
  const [spellOpen, setSpellOpen] = useState(false);

  const [draft, setDraft] = useState<number | null>(draftId);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [issued, setIssued] = useState<IssueOutcome | null>(null);
  /** فقراتٌ كُتبت حرفيًّا في ثلاثة كتبٍ فأكثر — يُقترح حفظها كليشة بعد الإصدار (د١٢). */
  const [repeated, setRepeated] = useState<{ text: string; count: number }[]>([]);

  const api = useRef<DocEditorApi | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const dirty = useRef(false);

  const setDoc = useCallback((next: Doc | ((d: Doc) => Doc)) => {
    dirty.current = true;
    setDocState(next);
  }, []);

  useEffect(() => {
    void (async () => {
      const [s, lhs, tpls, cl] = await Promise.all([
        window.diwan.settings.get(),
        window.diwan.letterheads.list(),
        window.diwan.templates.list(),
        window.diwan.clips.list()
      ]);
      setSettings(s);
      setLetterheads(lhs);
      setTemplates(tpls);
      setClips(cl);
      // الترويسة الافتراضية لكتابٍ جديد — ما لم يأتِ الكتاب بترويسته.
      if (templateId === null && draftId === null && documentId === null) {
        const initial = lhs.find((x) => x.isDefault) ?? null;
        if (initial) applyLetterhead(initial, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── الترويسة ─────────────────────────────────────────────────────────
  const letterhead = letterheads.find((x) => x.id === letterheadId) ?? null;

  /** ترويسةٌ من المكتبة تُنسخ إلى الكتاب؛ وكتابٌ فارغٌ يأخذ هوامشها معها. */
  function applyLetterhead(found: Letterhead | null, blank = false) {
    setLetterheadId(found?.id ?? null);
    setLayoutDirty(false);
    const next = found ? normalizeLayout(found.layout) : emptyLayout();
    setLayout(next);
    if (found && (blank || !docText(doc).trim())) {
      setDocState((d) => ({ ...d, pageSetup: { ...d.pageSetup, margins: { ...next.margins } } }));
    }
  }

  async function storeLayout(name: string, asNew: boolean) {
    const saved = await window.diwan.letterheads.save({
      id: asNew ? null : letterheadId,
      name: name.trim() || 'ترويسة بلا اسم',
      authorityId: letterhead?.authorityId ?? null,
      layout
    });
    setLetterheads(await window.diwan.letterheads.list());
    setLetterheadId(saved.id);
    setLayoutDirty(false);
    setSaveLayoutOpen(false);
    setToast(asNew ? `حُفظت الترويسة «${saved.name}» في المكتبة` : 'حُدّثت الترويسة المحفوظة');
  }

  // ── النموذج والمسودة والكتاب المكرَّر ─────────────────────────────────
  /** نموذجٌ من المكتبة يُفتح بكتله كما حُفظ — جداوله وتنسيقه — لا ظلَّه النصّي. */
  async function loadTemplate(id: number | null) {
    setActiveTemplate(id);
    if (id === null) return;
    const [detail, tdoc] = await Promise.all([window.diwan.templates.get(id), window.diwan.templates.doc(id)]);
    if (!detail) return;
    setDoc(tdoc ?? blankLetter());
    setDocType(detail.title);
    if (detail.letterheadId) applyLetterhead(letterheads.find((l) => l.id === detail.letterheadId) ?? null);
    setToast(`فُتح النموذج «${detail.title}» — اكتب على الورقة واملأ قيمه من الجانب`);
  }

  useEffect(() => {
    if (templateId !== null && letterheads !== undefined) void loadTemplate(templateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  /** ما حُفظ (مسودةً أو كتابًا صادرًا) يعود بورقته وقيمه وترويسته. */
  function restore(raw: string, keepNumber: boolean) {
    const saved = readSavedLetter(raw);
    if (!saved) {
      setError('تعذّرت قراءة الكتاب المحفوظ — فُتح فارغًا');
      return;
    }
    setDocState(saved.doc);
    setValues(saved.values);
    setRegistry(keepNumber ? saved.registry : { ...saved.registry, number: '' });
    setDocType(saved.docType);
    setOwner(saved.owner);
    if (saved.layout) setLayout(saved.layout);
  }

  useEffect(() => {
    if (draftId === null) return;
    void window.diwan.drafts.list().then((rows) => {
      const row = rows.find((d) => d.id === draftId);
      if (!row) return;
      setDraft(row.id);
      setActiveTemplate(row.templateId);
      setLinkedCitizen(row.citizenId);
      restore(row.valuesJson, true);
      dirty.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  /** «كرّره»: نسخةٌ تصدر برقمٍ جديد، والأصل في الأرشيف كما صدر. */
  useEffect(() => {
    if (documentId === null) return;
    void window.diwan.documents.get(documentId).then((d: DocumentDetail | null) => {
      if (!d) return;
      setActiveTemplate(d.templateId);
      setLinkedCitizen(d.citizenId);
      restore(d.valuesJson, false);
      setToast(`نسخة عن ${d.serial} — تصدر برقم قيدٍ جديد، والأصل كما صدر`);
      dirty.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // ── القيم ────────────────────────────────────────────────────────────
  const nameField = nameFieldOf(doc);
  const ownerName = (nameField ? values[nameField.key] : owner)?.trim() ?? '';
  const byRole = (role: DocField['role']) => {
    const f = doc.fields.find((x) => x.role === role);
    return f ? (values[f.key]?.trim() ?? '') : '';
  };
  const setValue = (key: string, value: string) => {
    dirty.current = true;
    setError(null);
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  /** F2: ما يعرفه البرنامج عن المواطن يملأ ما يطابقه — وما كُتب باليد لا يُطمس. */
  function fillFromCitizen(c: CitizenDetail) {
    const citizen = c as unknown as Record<string, unknown>;
    setLinkedCitizen(c.id);
    setValues((prev) => {
      const next = { ...prev };
      for (const f of doc.fields) {
        const raw = f.source ? citizen[f.source] : f.role === 'name' ? c.fullName : f.role === 'nationalId' ? c.nationalId : null;
        if (typeof raw === 'string' && raw.trim() && !next[f.key]?.trim()) next[f.key] = raw;
      }
      return next;
    });
    if (!nameField) setOwner(c.fullName);
    dirty.current = true;
    setToast('استُوردت بيانات المواطن');
  }

  useEffect(() => {
    if (citizenId === null) return;
    void window.diwan.citizens.get(citizenId).then((c) => c && fillFromCitizen(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citizenId, doc.fields.length]);

  /** الجنس لـ«{الطالب|الطالبة}»: مقترحٌ من الاسم ما لم يختره الموظف، ويُقلب بضغطة. */
  const needsGender = useMemo(() => docHasChoices(doc), [doc]);
  useEffect(() => {
    if (!needsGender || genderByHand || !ownerName) return;
    const g = guessGender(ownerName, learned);
    if (g && values[GENDER_KEY] !== g.gender) setValues((prev) => ({ ...prev, [GENDER_KEY]: g.gender }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGender, genderByHand, ownerName, learned]);

  const keys = useMemo(() => doc.fields.map((f) => f.key), [doc.fields]);
  /** القيم كما تُطبع: ما كُتب، وحقول «كتابةً» الفارغة من أرقامها. */
  const effective = useMemo(() => derivedWords(values, keys), [values, keys]);
  const shown = useMemo(() => (trial ? sampleValues(doc.fields, effective) : effective), [trial, doc.fields, effective]);

  /** حقول التفقيط بصيغتها: المفتاح وسمٌ، والقيمة معه. */
  const named = useMemo(
    () => doc.fields.map((f) => ({ id: f.key, token: f.key.replace(/\s+/g, '_'), label: f.label, value: values[f.key] ?? '' })),
    [doc.fields, values]
  );
  function writeWords(key: string) {
    const field = named.find((n) => n.id === key);
    if (!field) return;
    const words = wordsForField(field, named);
    if (!words) return;
    const partner = amountWordsField(field, named);
    if (partner) {
      setValue(partner.id, words);
      setToast(`كُتب «${words}» في «${partner.label}»`);
    } else {
      void window.diwan.ui.copyText(words);
      setToast('لا حقلَ «كتابة» لهذا الرقم — نُسخت كلماته، فالصقها حيث تريد');
    }
  }

  /** حقلٌ من كتالوج المعاملات: يُعرَّف ويُدرج في الورقة حيث وقف المؤشّر. */
  function addCatalogField(c: CatalogField) {
    let key = c.label;
    for (let n = 2; doc.fields.some((f) => f.key === key); n++) key = `${c.label} ${n}`;
    const f = makeField({ key, label: c.label, source: c.source ?? null, role: c.role ?? null, required: c.role === 'name', ...(c.date ? { type: 'date' as const } : {}) });
    if (api.current) api.current.insertNewField(f);
    else setDoc((d) => ({ ...d, fields: [...d.fields, f] }));
    setFieldPickerOpen(false);
    setToast(`أُدرج الحقل «${c.label}» في الورقة`);
  }

  // ── العدد والتاريخ ────────────────────────────────────────────────────
  const setReg = (patch: Partial<Registry>) => {
    dirty.current = true;
    setRegistry((r) => ({ ...r, ...patch }));
  };
  const stampToday = () => {
    const now = new Date();
    setReg({ dateGreg: formatGregorian(now), dateHijri: formatHijri(now) });
  };
  /** حقول الترويسة التلقائية — والعدد ما أعطاه الزبون لا رقم المكتب (§١). */
  const resolveHead = (text: string): string =>
    text.replace(/\{([^{}]+)\}/g, (_m, raw: string) => {
      const key = raw.trim();
      if (key === 'رقم_الصادر') return registry.number;
      if (key === 'التاريخ_الميلادي') return registry.dateGreg;
      if (key === 'التاريخ_الهجري') return registry.dateHijri;
      return shown[key] ?? shown[key.replace(/_/g, ' ')] ?? '';
    });
  /** وحقولها في الورقة التي تُطبع وتُصدَّر — بالقيم الحقيقية لا بما تعرضه المعاينة. */
  const resolvePrinted = (text: string): string =>
    text.replace(/\{([^{}]+)\}/g, (_m, raw: string) => {
      const key = raw.trim();
      if (key === 'رقم_الصادر') return registry.number;
      if (key === 'التاريخ_الميلادي') return registry.dateGreg;
      if (key === 'التاريخ_الهجري') return registry.dateHijri;
      return effective[key] ?? effective[key.replace(/_/g, ' ')] ?? '';
    });
  const headLayout = isLayoutEmpty(layout) ? null : layout;
  const regValues = { number: registry.number, date: registry.dateGreg };

  // ── القياس: ارتفاع الترويسة وعدد الصفحات، من الورقة التي تُطبع ─────────
  const [measure, setMeasure] = useState<{ headRatio: number | null; pages: number | null }>({ headRatio: null, pages: null });
  useLayoutEffect(() => {
    const sheet = printRef.current;
    if (!sheet) return;
    const page = pageMm(doc.pageSetup);
    const m = doc.pageSetup.margins;
    const pagePx = page.h * MM_PX;
    const head = sheet.querySelector<HTMLElement>('[data-letterhead]');
    const body = sheet.querySelector<HTMLElement>('[data-body]');
    const top = sheet.getBoundingClientRect().top;
    const bottom = body ? body.getBoundingClientRect().bottom - top : 0;
    const printable = (page.h - m.top - m.bottom) * MM_PX;
    setMeasure({
      headRatio: head ? head.getBoundingClientRect().height / pagePx : null,
      pages: printable > 0 ? Math.max(1, Math.ceil((bottom - m.top * MM_PX) / printable)) : null
    });
  }, [doc, shown, layout, registry]);

  const spelling = useMemo(() => docSpelling(doc), [doc]);
  const checks = useMemo(
    () =>
      letterChecks({
        doc,
        values: effective,
        owner: ownerName,
        spelling: spelling.length,
        registryPrinted: asksLetterNumber(headLayout),
        number: registry.number,
        headRatio: measure.headRatio,
        pages: measure.pages,
        genderUnsure: needsGender && !genderByHand && ownerName && guessGender(ownerName, learned)?.sure === false
          ? ownerName.trim().split(/\s+/)[0] ?? ownerName
          : null
      }),
    [doc, effective, ownerName, spelling.length, headLayout, registry.number, measure, needsGender, genderByHand, learned]
  );
  const blocked = checks.some((c) => c.level === 'block');

  // ── المسودات ─────────────────────────────────────────────────────────
  const hasContent = Boolean(docText(doc).trim() || ownerName);
  const savedLetter = () => ({ doc, values, registry, layout, docType, owner });
  const saveDraft = useCallback(
    async (silent: boolean) => {
      if (!hasContent) {
        if (!silent) setError('لا تُحفظ مسودة فارغة — اكتب في الورقة أو اسم صاحب العلاقة أولًا');
        return;
      }
      setSaving(true);
      try {
        const id = await window.diwan.drafts.save({
          id: draft,
          templateId: activeTemplate,
          citizenId: linkedCitizen,
          title: docType || ownerName || 'مسودة بلا عنوان',
          values: letterValues(savedLetter()),
          bodyHtml: docText(doc, values)
        });
        setDraft(id);
        setSavedAt(new Date());
        dirty.current = false;
        if (!silent) setToast('حُفظت المسودة');
      } catch (e) {
        setError(errorText(e, 'تعذّر حفظ المسودة'));
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasContent, draft, activeTemplate, linkedCitizen, docType, ownerName, doc, values, registry, layout, owner]
  );

  useEffect(() => {
    if (!dirty.current || !hasContent) return;
    const timer = setTimeout(() => void saveDraft(true), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [doc, values, registry, hasContent, saveDraft]);

  // ── الإخراج والإصدار ──────────────────────────────────────────────────
  /** علامات الورقة كما تُطبع — وتُقيَّد كما هي، فلا شيء يُملأ فيها بعد الإصدار. */
  const sheetHtml = () => printRef.current?.outerHTML ?? '';
  const sheetName = docType || ownerName || 'كتاب';
  const pageOf = () => pageMm(doc.pageSetup);

  async function run(label: string, work: () => Promise<string | null | undefined | void>) {
    setExporting(true);
    setError(null);
    try {
      const path = await work();
      if (path) setToast(`${label}: ${path}`);
    } catch (e) {
      setError(errorText(e, 'تعذّر إتمام العملية'));
    } finally {
      setExporting(false);
    }
  }
  const exportPdf = () => run('حُفظ PDF', () => window.diwan.output.savePdf({ sheetHtml: sheetHtml(), suggestedName: sheetName, page: pageOf() }));
  // من الوثيقة وقيمها وترويستها — فيخرج Word بجداوله وأعمدته ومحاذاته (تعميق الموجود ٩).
  const exportWord = () =>
    run('حُفظ مستند Word', () =>
      window.diwan.output.saveDocx({
        doc,
        values: effective,
        head: headLayout ? { layout: resolveLayout(headLayout, resolvePrinted), registry: regValues } : null,
        suggestedName: sheetName,
        title: docType || 'كتاب رسمي'
      })
    );
  const exportPng = () =>
    run('حُفظت صورة بدقة 300 نقطة/إنش', () => window.diwan.output.savePng300({ sheetHtml: sheetHtml(), suggestedName: sheetName, page: pageOf() }));

  /** الإصدار: قائمة التحقّق أولًا — وما يمنعه يُقال ولا يُفتح الحوار. */
  function requestIssue() {
    setTrial(false);
    const first = checks.find((c) => c.level === 'block');
    if (first) {
      setError(`لا يصدر الكتاب بعد: ${first.text}`);
      return;
    }
    setError(null);
    setIssueOpen(true);
  }

  async function issue(opts: { copies: number; copyKind: string; print: boolean }) {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await window.diwan.documents.issue(
        {
          sheetHtml: sheetHtml(),
          templateId: activeTemplate,
          citizenId: linkedCitizen,
          authorityId: letterhead?.authorityId ?? null,
          citizenName: ownerName,
          nationalId: byRole('nationalId') || null,
          docType: docType.trim() || null,
          destination: byRole('destination') || null,
          purpose: byRole('purpose') || null,
          values: letterValues(savedLetter()),
          copies: opts.copies,
          copyKind: opts.copyKind,
          fee: 0,
          gregorianDate: registry.dateGreg || formatGregorian(new Date()),
          hijriDate: registry.dateHijri || null,
          operator: settings.operatorName || null,
          printer: printer?.name ?? null,
          serialPrefix: settings.serialPrefix,
          serialYear: settings.serialYear,
          letterheadId
        },
        opts.print
      );
      setIssued(outcome);
      setIssueOpen(false);
      dirty.current = false;
      // الصياغة التي تتكرّر (لا الأسماء): فقراتُ الورقة بقيمها تُقارن بما صدر.
      void window.diwan.clips
        .repeated(docText(doc, effective).split('\n'))
        .then(setRepeated)
        .catch(() => setRepeated([]));
      // جنسٌ حسمه الموظف لاسمٍ لم يُعرف، أو قلب فيه الاقتراح: يُحفظ فلا يُسأل عنه ثانيةً.
      const chosen = values[GENDER_KEY] as Gender | undefined;
      const guessed = guessGender(ownerName, learned);
      if (needsGender && genderByHand && chosen && (!guessed?.sure || guessed.gender !== chosen)) {
        remember([{ name: ownerName, gender: chosen }]);
      }
      if (draft !== null) {
        await window.diwan.drafts.delete(draft);
        setDraft(null);
      }
      onIssued?.();
      if (outcome.archiveError) {
        setError(
          `صدر الكتاب برقم ${outcome.serial}، لكن نسخته PDF لم تُحفظ في الأرشيف (${outcome.archiveError}) — متنه محفوظ في السجل.`
        );
      } else if (outcome.printed === 'failed') {
        setError(
          `صدر الكتاب برقم ${outcome.serial} وقُيّد، لكن الطباعة لم تتم${outcome.printError ? ` (${outcome.printError})` : ''} — أعِدها من الأرشيف.`
        );
      }
    } catch (e) {
      setError(errorText(e, 'تعذّر الإصدار'));
    } finally {
      setBusy(false);
    }
  }

  /** طباعة للمراجعة — بلا قيدٍ في الأرشيف. */
  async function printDraftSheet() {
    setBusy(true);
    try {
      const r = await window.diwan.output.print({ sheetHtml: sheetHtml(), printer: printer?.name ?? null, copies: 1, silent: false, page: pageOf() });
      if (!r.ok && r.reason) setError(`تعذّرت الطباعة: ${r.reason}`);
    } catch (e) {
      setError(errorText(e, 'تعذّرت الطباعة'));
    } finally {
      setBusy(false);
    }
  }

  /** «اجعله نموذجًا»: الكتاب يصير نموذجًا في المكتبة — بحقوله فارغةً لا بقيمه (§١٠، البند ٦). */
  async function saveAsTemplate(title: string) {
    try {
      await window.diwan.templates.save({
        id: null,
        code: null,
        title,
        subtitle: null,
        category: null,
        subjectLine: null,
        bodyHtml: docText(doc),
        letterheadId,
        variables: doc.fields.map((f) => ({ token: f.key, label: f.label, source: f.source ? 'citizen' : 'manual', required: f.required })),
        doc
      });
      setTemplates(await window.diwan.templates.list());
      setTemplateOpen(false);
      setToast(`حُفظ «${title}» نموذجًا في المكتبة — يُملأ مرارًا من الشبّاك`);
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ نموذجًا'));
    }
  }

  const transaction = docType || null;
  useEffect(() => {
    onStatus?.({ transaction, busy, exporting });
  }, [transaction, busy, exporting, onStatus]);

  useImperativeHandle(
    ref,
    () => ({ saveDraft: () => void saveDraft(false), exportPdf: () => void exportPdf(), print: () => requestIssue() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saveDraft, checks, settings, printer]
  );

  // F2 استيراد مواطن، وCtrl+S حفظ مسودة — بموضع المفتاح فتعمل واللوحة عربية.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isCombo(e, shortcut('citizen').combo)) {
        e.preventDefault();
        setPickerOpen(true);
      }
      if (isCombo(e, shortcut('save').combo)) {
        e.preventDefault();
        void saveDraft(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveDraft]);

  // ── الواجهة ──────────────────────────────────────────────────────────
  const head = headLayout ? (
    <div className={gapAfter(headLayout) ? 'mb-space-md' : ''}>
      <LetterheadView layout={headLayout} registryValues={regValues} resolve={resolveHead} />
    </div>
  ) : null;

  const section = 'bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm';
  const title = (icon: string, text: string, extra?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-space-xs">
      <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-secondary text-[20px]">{icon}</span>
        {text}
      </h3>
      {extra}
    </div>
  );

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-screen="editor">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* ── اللوح: ما يُعمل عليه بالترتيب ─────────────────────────── */}
        <aside className="w-[400px] shrink-0 h-full overflow-y-auto bg-surface-container-low p-space-md flex flex-col gap-space-md" data-editor-panel="">
          {error && (
            <div className="flex items-start gap-space-xs p-space-sm rounded-lg bg-error-container text-on-error-container font-label-md text-label-md" data-editor-error="">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span className="flex-1">{error}</span>
              <button className="material-symbols-outlined text-[16px]" type="button" onClick={() => setError(null)}>
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

          {/* ١ — النموذج والترويسة */}
          <section className={section}>
            {title('article', 'النموذج والترويسة')}
            <select
              className={inputCls}
              data-editor-template=""
              value={activeTemplate ?? ''}
              onChange={(e) => void loadTemplate(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{templates.length === 0 ? '— لا نماذج في المكتبة بعد —' : '— كتابٌ جديد، أو اختر نموذجًا —'}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-space-xs">
              <select
                className={`${inputCls} flex-1`}
                value={letterheadId ?? ''}
                onChange={(e) => applyLetterhead(letterheads.find((l) => l.id === Number(e.target.value)) ?? null)}
              >
                <option value="">{letterheads.length === 0 ? '— لا ترويسة محفوظة بعد —' : '— بلا ترويسة —'}</option>
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
            <div className="flex items-center justify-between font-label-sm text-label-sm">
              <span className="text-on-surface-variant">{layoutDirty ? 'الترويسة خاصّةٌ بهذا الكتاب' : isLayoutEmpty(layout) ? 'بلا ترويسة' : 'كما في المكتبة'}</span>
              <button
                className="text-secondary font-semibold hover:underline disabled:opacity-40"
                type="button"
                disabled={isLayoutEmpty(layout)}
                onClick={() => setSaveLayoutOpen(true)}
              >
                حفظ الترويسة في المكتبة
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant">نوع الكتاب — يُقيَّد به في الأرشيف</span>
              <input className={inputCls} value={docType} placeholder="مثال: تأييد استمرار بالخدمة" onChange={(e) => (dirty.current = true, setDocType(e.target.value))} />
            </label>
            <AddressingPicker
              value={doc.meta.addressing ?? null}
              onChange={(a) => setDoc((d) => ({ ...d, meta: { ...d.meta, addressing: a ?? undefined } }))}
            />
          </section>

          {/* ٢ — العدد والتاريخ والصفحة */}
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

          {/* ٣ — القيم */}
          <section className={section} data-editor-values="">
            {title(
              'badge',
              'القيم',
              <button
                className="h-8 px-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-sm text-label-sm flex items-center gap-1"
                type="button"
                onClick={() => setPickerOpen(true)}
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">person_search</span>
                استيراد (F2)
              </button>
            )}
            {!nameField && (
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  اسم صاحب العلاقة <span className="text-error">*</span> — للأرشيف، ولا حقل له على الورقة
                </span>
                <input className={inputCls} data-editor-owner="" value={owner} onChange={(e) => (dirty.current = true, setOwner(e.target.value))} />
              </label>
            )}
            {needsGender && (
              <div className="flex items-center gap-space-xs" data-gender="">
                <span className="font-label-sm text-label-sm text-on-surface-variant">الجنس:</span>
                {(['ذكر', 'أنثى'] as const).map((g) => (
                  <button
                    key={g}
                    className={`h-8 px-3 rounded-lg font-label-sm text-label-sm ${
                      values[GENDER_KEY] === g ? 'bg-secondary text-on-secondary font-bold' : 'bg-surface-container-low text-on-surface'
                    }`}
                    type="button"
                    onClick={() => {
                      setGenderByHand(true);
                      setValue(GENDER_KEY, g);
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
            {doc.fields.filter((f) => !isChoiceKey(f.key)).length === 0 ? (
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                لا حقول على الورقة — ظلّل عبارةً في الورقة واضغط F4، أو أضف حقلًا من كتالوج المعاملات.
              </p>
            ) : (
              doc.fields
                .filter((f) => !isChoiceKey(f.key))
                .map((f) => {
                  const words = wordsForField(named.find((n) => n.id === f.key)!, named);
                  return (
                    <label key={f.key} className="flex flex-col gap-1" data-value-of={f.key}>
                      <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                        {f.label} {f.required && <span className="text-error">*</span>}
                        <span className="flex-1" />
                        {isDateField(f) && (
                          <select
                            className="h-6 px-1 rounded bg-surface-container-low text-on-surface-variant cursor-pointer"
                            data-calendar-of={f.key}
                            title="بأيّ تقويمٍ يُكتب التاريخ"
                            value={f.calendar ?? 'gregorian'}
                            onChange={(e) => setDoc((d) => patchField(d, f.key, { type: 'date', calendar: e.target.value as Calendar }))}
                          >
                            {(Object.keys(CALENDAR_LABEL) as Calendar[]).map((k) => (
                              <option key={k} value={k}>
                                {CALENDAR_LABEL[k]}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          className="text-secondary hover:underline"
                          title="أدرجه مرّةً أخرى حيث وقف المؤشّر في الورقة"
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => api.current?.insertField(f.key)}
                        >
                          + في الورقة
                        </button>
                      </span>
                      <span className="flex items-center gap-1">
                        <input className={inputCls} value={values[f.key] ?? ''} placeholder="—" onChange={(e) => setValue(f.key, e.target.value)} />
                        {words && (
                          <button
                            className="h-9 px-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-secondary shrink-0"
                            title={`كتابةً: ${words}`}
                            type="button"
                            onClick={() => writeWords(f.key)}
                          >
                            <span className="material-symbols-outlined text-[16px]">spellcheck</span>
                          </button>
                        )}
                        {isDateField(f) && <DateTools calendar={f.calendar} onPick={(t) => setValue(f.key, t)} />}
                      </span>
                    </label>
                  );
                })
            )}
            <button
              className="h-9 rounded-lg border border-dashed border-outline-variant hover:border-secondary text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center justify-center gap-1"
              data-act="add-field"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setFieldPickerOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">add_circle</span>
              أضف حقلًا من كتالوج المعاملات
            </button>
          </section>

          {/* ٤ — قبل الإصدار */}
          <section className={section} data-checks="">
            {title('fact_check', 'قبل الإصدار')}
            <ul className="flex flex-col gap-1">
              {checks.map((c, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-1 font-label-sm text-label-sm ${
                    c.level === 'block' ? 'text-error' : c.level === 'warn' ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                  data-check={c.level}
                >
                  <span className="material-symbols-outlined text-[16px] shrink-0">
                    {c.level === 'block' ? 'block' : c.level === 'warn' ? 'warning' : 'info'}
                  </span>
                  <span className="flex-1">{c.text}</span>
                  {c.act === 'spelling' && (
                    <button className="text-secondary font-semibold hover:underline" type="button" onClick={() => setSpellOpen(true)}>
                      راجعه
                    </button>
                  )}
                  {c.act === 'gender' &&
                    (['ذكر', 'أنثى'] as const).map((g) => (
                      <button
                        key={g}
                        className="text-secondary font-semibold hover:underline"
                        data-gender-choose={g}
                        type="button"
                        onClick={() => {
                          setGenderByHand(true);
                          setValue(GENDER_KEY, g);
                        }}
                      >
                        {g}
                      </button>
                    ))}
                </li>
              ))}
            </ul>
            {spellOpen && spelling.length > 0 && (
              <SpellingPanel
                issues={spelling}
                note="اقتراحاتٌ على نصّ الكتاب — اختر ما تريد، والحقول لا تُمسّ"
                onFix={(chosen) => {
                  setDoc((d) => fixDocSpelling(d, chosen));
                  setSpellOpen(false);
                }}
              />
            )}
            <button
              className="h-11 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
              data-act="issue"
              disabled={busy}
              type="button"
              onClick={requestIssue}
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              {busy ? 'يصدر الكتاب...' : blocked ? 'أصدر — بعد إكمال ما يمنع' : 'أصدر واطبع'}
            </button>
          </section>

          <div className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
            <span className={`material-symbols-outlined text-[16px] ${saving ? 'animate-spin' : 'text-secondary'}`}>
              {saving ? 'progress_activity' : savedAt ? 'cloud_done' : 'cloud_off'}
            </span>
            {saving
              ? 'تُحفظ المسودة…'
              : savedAt
                ? `حُفظت المسودة ${savedAt.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}`
                : hasContent
                  ? 'تُحفظ مسودةً تلقائيًّا بعد ثوانٍ من الكتابة'
                  : 'لا مسودة'}
          </div>
        </aside>

        {/* ── الورقة ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 h-full flex flex-col">
          <div className="h-12 shrink-0 px-space-md flex items-center gap-space-xs bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex-wrap">
            <div className="flex p-0.5 rounded-lg bg-surface-container-low">
              {(
                [
                  ['edit', 'تحرير على الورقة'],
                  ['preview', 'معاينة كما تُطبع']
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  className={`h-8 px-3 rounded-md font-label-md text-label-md ${view === v ? 'bg-primary-container text-on-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                  data-view={v}
                  type="button"
                  onClick={() => setView(v)}
                >
                  {label}
                </button>
              ))}
            </div>
            {view === 'preview' && (
              <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface cursor-pointer" title="قيمٌ طويلة للفارغ — تكشف الفراغ القصير والسطر الزائد قبل الورق">
                <input checked={trial} className="w-4 h-4 accent-secondary" data-act="trial" type="checkbox" onChange={(e) => setTrial(e.target.checked)} />
                جرّبها بقيمٍ وهمية
              </label>
            )}
            <span className="w-px h-6 bg-outline-variant/60 mx-1" />
            <button
              className={`h-9 px-2.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1 ${tool === 'find' ? 'bg-secondary-fixed' : 'hover:bg-surface-container-high'}`}
              data-act="find"
              type="button"
              onClick={() => setTool((t) => (t === 'find' ? null : 'find'))}
            >
              <span className="material-symbols-outlined text-[18px]">find_replace</span>
              بحث واستبدال
            </button>
            <button
              className={`h-9 px-2.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1 ${tool === 'symbols' ? 'bg-secondary-fixed' : 'hover:bg-surface-container-high'}`}
              data-act="symbols"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTool((t) => (t === 'symbols' ? null : 'symbols'))}
            >
              <span className="material-symbols-outlined text-[18px]">function</span>
              رموز
            </button>
            <span className="flex-1" />
            <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1" data-act="save" type="button" onClick={() => void saveDraft(false)}>
              <span className="material-symbols-outlined text-[18px]">save</span>
              حفظ مسودة
            </button>
            <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1" data-act="as-template" type="button" onClick={() => setTemplateOpen(true)}>
              <span className="material-symbols-outlined text-[18px]">library_add</span>
              اجعله نموذجًا
            </button>
            <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1 disabled:opacity-40" data-act="export-word" disabled={exporting || busy} type="button" onClick={() => void exportWord()}>
              <span className="material-symbols-outlined text-[18px] text-secondary">description</span>
              Word
            </button>
            <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1 disabled:opacity-40" data-act="export-pdf" disabled={exporting || busy} type="button" onClick={() => void exportPdf()}>
              <span className="material-symbols-outlined text-[18px] text-error">picture_as_pdf</span>
              PDF
            </button>
            <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1 disabled:opacity-40" data-act="export-png" disabled={exporting || busy} type="button" onClick={() => void exportPng()}>
              <span className="material-symbols-outlined text-[18px]">image</span>
              صورة عالية الدقّة
            </button>
            <button
              className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1 disabled:opacity-40"
              disabled={busy}
              title="طباعة للمراجعة — بلا قيدٍ في الأرشيف"
              type="button"
              onClick={() => void printDraftSheet()}
            >
              <span className="material-symbols-outlined text-[18px]">preview</span>
              طباعة تجريبية
            </button>
          </div>

          {tool === 'find' && <FindReplaceBar doc={doc} templates={templates} onChange={setDoc} onOpenTemplate={(id) => void loadTemplate(id)} />}
          {tool === 'symbols' && (
            <div className="px-space-md py-space-sm bg-surface-container-low border-b border-outline-variant/40">
              <SymbolPalette onPick={(s) => api.current?.insertText(s)} />
            </div>
          )}

          <div className="flex-1 min-h-0">
            {view === 'edit' ? (
              <DocEditor apiRef={api} aside={null} clips={clips} doc={doc} header={head} values={effective} onChange={setDoc} />
            ) : (
              <div className="h-full overflow-auto flex justify-center py-space-lg bg-surface-dim/40" data-preview="">
                <div style={{ zoom: 0.85 }} className="w-fit">
                  <LetterSheet doc={doc} layout={headLayout} values={shown} registry={regValues} resolve={resolveHead} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* الورقة التي تُصدر وتُطبع وتُقاس — مرسومةً خارج الشاشة بمقاسها الحقيقي، وبالقيم الحقيقية لا الوهمية. */}
      <div aria-hidden className="fixed top-0 pointer-events-none" style={{ left: -20000 }}>
        <LetterSheet
          doc={doc}
          layout={headLayout}
          values={effective}
          registry={regValues}
          resolve={resolvePrinted}
          sheetRef={(el) => {
            printRef.current = el;
          }}
        />
      </div>

      {pickerOpen && <CitizenPicker onClose={() => setPickerOpen(false)} onPick={(c) => (fillFromCitizen(c), setPickerOpen(false))} />}
      {fieldPickerOpen && <FieldPicker existing={doc.fields.map((f) => f.label)} onClose={() => setFieldPickerOpen(false)} onPick={addCatalogField} />}
      {designerOpen && (
        <Modal title="ترويسة هذا الكتاب" onClose={() => setDesignerOpen(false)}>
          <div className="max-h-[70vh] overflow-y-auto">
            <LetterheadDesigner
              layout={layout}
              onChange={(next) => {
                setLayout(next);
                setLayoutDirty(true);
                dirty.current = true;
              }}
              showPageOptions
            />
          </div>
          <div className="flex items-center justify-between pt-space-md">
            <span className="font-label-sm text-label-sm text-on-surface-variant">التعديل يخصّ هذا الكتاب. لإبقائه لكتب أخرى احفظه في المكتبة.</span>
            <button className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold" type="button" onClick={() => setDesignerOpen(false)}>
              تم
            </button>
          </div>
        </Modal>
      )}
      {saveLayoutOpen && <SaveLayoutDialog current={letterhead} onClose={() => setSaveLayoutOpen(false)} onSave={(n, asNew) => void storeLayout(n, asNew)} />}
      {templateOpen && <AsTemplateDialog initial={docType} onClose={() => setTemplateOpen(false)} onSave={(t) => void saveAsTemplate(t)} />}
      {issueOpen && (
        <IssueDialog
          number={registry.number}
          name={ownerName}
          printerName={printer?.displayName ?? null}
          busy={busy}
          onClose={() => setIssueOpen(false)}
          onIssue={(opts) => void issue(opts)}
        />
      )}
      {issued && (
        <IssuedDialog
          outcome={issued}
          repeated={repeated}
          onSaveClip={async (text) => {
            await window.diwan.clips.save({ id: null, title: text.slice(0, 48), body: text });
            setRepeated((r) => r.filter((x) => x.text !== text));
            setClips(await window.diwan.clips.list());
          }}
          onRejectClip={(text) => {
            // رفضٌ يُقيَّد (FOUNDATION §١٦): فلا تُقترح الفقرة نفسها ثانيةً.
            void window.diwan.learning.record({ kind: 'clip', input: normalizeFold(text).slice(0, 200), suggested: 'save', chosen: 'reject' });
            setRepeated((r) => r.filter((x) => x.text !== text));
          }}
          onClose={() => {
            setIssued(null);
            setRepeated([]);
          }}
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
  'w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

/** بحثٌ واستبدال في الكتاب — متساهلٌ مع الهمزة — وبحثٌ في نصوص المكتبة كلّها. */
function FindReplaceBar({
  doc,
  templates,
  onChange,
  onOpenTemplate
}: {
  doc: Doc;
  templates: TemplateSummary[];
  onChange: (d: Doc) => void;
  onOpenTemplate: (id: number) => void;
}) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [loose, setLoose] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const count = countInDoc(doc, find, loose);
  const inLibrary = useMemo(() => {
    if (!find.trim()) return [];
    const probe = emptyDoc();
    return templates.filter((t) => {
      probe.blocks = [paragraph([{ kind: 'run', text: `${t.title}\n${t.bodyHtml}` }])];
      return countInDoc(probe, find, loose) > 0;
    });
  }, [find, loose, templates]);
  return (
    <div className="px-space-md py-space-sm bg-surface-container-low border-b border-outline-variant/40 flex flex-col gap-space-xs" data-find="">
      <div className="flex flex-wrap items-center gap-space-xs">
        <input className={`${inputCls} w-56`} data-find-input="" placeholder="ابحث عن…" value={find} onChange={(e) => (setFind(e.target.value), setMsg(null))} />
        <input className={`${inputCls} w-56`} data-replace-input="" placeholder="واستبدل بـ…" value={replace} onChange={(e) => setReplace(e.target.value)} />
        <label className="flex items-center gap-1 font-label-sm text-label-sm cursor-pointer">
          <input checked={loose} className="w-4 h-4 accent-secondary" type="checkbox" onChange={(e) => setLoose(e.target.checked)} />
          متساهلٌ مع الهمزة
        </label>
        <span className="font-label-sm text-label-sm text-on-surface-variant" data-find-count="">
          {find.trim() ? `${count} في الكتاب` : ''}
        </span>
        <button
          className="h-9 px-3 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm disabled:opacity-40"
          data-act="replace-all"
          disabled={count === 0}
          type="button"
          onClick={() => {
            const out = replaceInDoc(doc, find, replace, loose);
            onChange(out.doc);
            setMsg(`استُبدل ${out.count} — والحقول لا تُمسّ`);
          }}
        >
          استبدل الكل
        </button>
        {msg && <span className="font-label-sm text-label-sm text-secondary">{msg}</span>}
      </div>
      {inLibrary.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 font-label-sm text-label-sm">
          <span className="text-on-surface-variant">وفي المكتبة:</span>
          {inLibrary.slice(0, 12).map((t) => (
            <button key={t.id} className="h-7 px-2 rounded-full bg-surface-container-lowest hover:bg-surface-container-high" type="button" onClick={() => onOpenTemplate(t.id)}>
              {t.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** استيراد سريع من سجل المواطنين — F2، والبحث متساهل مع الهمزة. */
function CitizenPicker({ onClose, onPick }: { onClose: () => void; onPick: (c: CitizenDetail) => void }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<{ id: number; fullName: string; nationalId: string | null; jobTitle: string | null }[]>([]);
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
  return (
    <Modal title="استيراد من سجل المواطنين" onClose={onClose}>
      <input autoFocus className={inputCls} placeholder="ابحث بالاسم أو الرقم الوطني أو الهاتف..." type="text" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mt-space-sm max-h-[50vh] overflow-y-auto divide-y divide-outline-variant">
        {loading ? (
          <div className="py-space-lg text-center text-on-surface-variant font-label-md text-label-md">جارٍ البحث...</div>
        ) : rows.length === 0 ? (
          <div className="py-space-lg text-center text-on-surface-variant font-label-md text-label-md">{query ? 'لا مواطن بهذا البحث' : 'سجل المواطنين فارغ'}</div>
        ) : (
          rows.map((r) => (
            <button
              key={r.id}
              className="w-full text-right py-space-sm px-space-xs hover:bg-surface-container-high flex items-center justify-between"
              type="button"
              onClick={() => void window.diwan.citizens.get(r.id).then((c) => c && onPick(c))}
            >
              <span className="flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface font-bold">{r.fullName}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{r.jobTitle ?? '—'}</span>
              </span>
              <span className="font-mono font-label-sm text-label-sm text-on-surface-variant">{r.nationalId ?? ''}</span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

/** حقلٌ من كتالوج المعاملات الرسمية، أو حقلٌ يسمّيه المكتب — يُدرج في الورقة حيث وقف المؤشّر. */
function FieldPicker({ existing, onClose, onPick }: { existing: string[]; onClose: () => void; onPick: (f: CatalogField) => void }) {
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  const term = query.trim();
  // صاحب العلاقة أوّلًا: الاسم والرقم الوطني والجهة والغرض — ما لا يخلو منه كتاب.
  const all = [{ name: 'صاحب العلاقة', hint: 'الاسم والرقم الوطني والجهة والغرض', fields: CORE_FIELDS }, ...FIELD_GROUPS];
  const groups = all.map((g) => ({ ...g, fields: g.fields.filter((f) => !term || f.label.includes(term)) })).filter((g) => g.fields.length > 0);
  const used = new Set(existing);
  return (
    <Modal title="أضف حقلًا إلى الكتاب" onClose={onClose}>
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center gap-space-xs">
          <input
            autoFocus
            className={inputCls}
            placeholder="حقلٌ تسمّيه بنفسك — مثال: رقم الإضبارة"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && custom.trim()) onPick({ label: custom.trim(), token: custom.trim() });
            }}
          />
          <button
            className="h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
            disabled={!custom.trim()}
            type="button"
            onClick={() => onPick({ label: custom.trim(), token: custom.trim() })}
          >
            أضف
          </button>
        </div>
        <input className={inputCls} placeholder="ابحث في حقول المعاملات الرسمية..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="max-h-[45vh] overflow-y-auto flex flex-col gap-space-md">
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col gap-space-xs">
              <span className="font-label-lg text-label-lg text-on-surface font-bold">
                {g.name} <span className="font-label-sm text-label-sm text-on-surface-variant font-normal">{g.hint}</span>
              </span>
              <div className="flex flex-wrap gap-space-xs">
                {g.fields.map((f) => (
                  <button
                    key={f.token}
                    className={`h-8 px-space-sm rounded-lg font-label-sm text-label-sm ${used.has(f.label) ? 'bg-surface-container text-on-surface-variant' : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface'}`}
                    type="button"
                    onClick={() => onPick(f)}
                  >
                    {f.label}
                    {used.has(f.label) && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function SaveLayoutDialog({ current, onClose, onSave }: { current: Letterhead | null; onClose: () => void; onSave: (name: string, asNew: boolean) => void }) {
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

function AsTemplateDialog({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (title: string) => void }) {
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

/** حوار الإصدار: عدد النسخ ونوعها. (والمال صامت: §١) */
function IssueDialog({
  number,
  name,
  printerName,
  busy,
  onClose,
  onIssue
}: {
  number: string;
  name: string;
  printerName: string | null;
  busy: boolean;
  onClose: () => void;
  onIssue: (opts: { copies: number; copyKind: string; print: boolean }) => void;
}) {
  const [copies, setCopies] = useState(1);
  const [copyKind, setCopyKind] = useState(COPY_KINDS[0]!);
  return (
    <Modal title="إصدار الكتاب" onClose={onClose}>
      <div className="flex flex-col gap-space-md">
        <div className="p-space-sm rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
          يُقيَّد الكتاب في أرشيف المكتب برقمٍ متسلسل وبصمة — والرقم للأرشيف وحده، لا يُطبع على الكتاب ولا يُلغى بعد الإصدار.
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
            'لم تُختر طابعة — سيفتح حوار الطباعة في النظام'
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
            إصدار وقيد بلا طباعة
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-50"
            disabled={busy}
            type="button"
            onClick={() => onIssue({ copies, copyKind, print: true })}
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

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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
