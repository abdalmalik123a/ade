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
import type { CitizenDetail, DocumentDetail, IssueOutcome, OfficeSettings, TemplateSummary } from '@shared/api';
import { formatGregorian, formatHijri } from '@shared/dates';
import { normalizeFold } from '@shared/arabic';
import { docText, emptyDoc, makeField, pageMm, paragraph, type Doc, type DocField } from '@shared/doc';
import { emptyLayout, isLayoutEmpty, normalizeLayout, asksLetterNumber, resolveLayout, type Letterhead, type LetterheadLayout } from '@shared/letterhead';
import type { CatalogField } from '@shared/letterFields';
import { derivedWords, amountWordsField, wordsForField } from '@shared/tafqeet';
import { GENDER_KEY, docHasChoices, guessGender, type Gender } from '@shared/gender';
import { useLearnedGenders } from '../lib/useLearnedGenders';
import { docSpelling } from '@shared/spelling';
import { fieldHints } from '@shared/fieldHints';
import { NO_REGISTRY, draftTitle, letterChecks, letterValues, nameFieldOf, readSavedLetter, sampleValues, type Registry } from '@shared/letterDraft';
import { isCombo, shortcut } from '@shared/shortcuts';
import { errorText } from '../lib/errors';
import type { HeadChoice } from '../components/PageEditor';
import type { EditorApi } from '../components/editorKit';
import { printedPages } from '../components/pageFlow';
import LetterheadView from '../components/LetterheadView';
import LetterheadDesigner from '../components/LetterheadDesigner';
import LetterSheet, { gapAfter } from '../components/LetterSheet';
import { onBeforeClose } from '../lib/beforeClose';
import { confirmAction } from '../kit/ask';
import { choosePrinter } from '../lib/printChoice';
import { describeRole } from '@shared/printRoles';
import { AsTemplateDialog, IssueDialog, IssuedDialog, Modal, SaveLayoutDialog } from './EditorDialogs';
import { CitizenPicker, FieldPicker } from './EditorPickers';
import TemplateSection from './editor/TemplateSection';
import RegistrySection from './editor/RegistrySection';
import ValuesSection from './editor/ValuesSection';
import ChecksSection from './editor/ChecksSection';
import PrintBar from './editor/PrintBar';
import SheetArea from './editor/SheetArea';

const AUTOSAVE_MS = 4000;
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
  onStatus?: (status: { transaction: string | null; busy: boolean; exporting: boolean }) => void;
  onIssued?: () => void;
  /** غادر الموظف المحرّر وما كتبه مسودّةٌ في «قيد العمل» — فيُقال له ذلك ويُفتح بضغطة (البند ١٠). */
  onLeave?: (draft: { id: number; title: string }) => void;
};

function EditorScreen(
  { templateId = null, citizenId = null, draftId = null, documentId = null, onStatus, onIssued, onLeave }: Props,
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

  const api = useRef<EditorApi | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const dirty = useRef(false);
  /** الورقة كما جاءت من نموذجٍ أو مسودّةٍ — فما يختلف عنها كتبه الموظف بيده (ج٣). */
  const baseDoc = useRef<Doc | null>(null);

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
  /** `keepMargins`: نموذجٌ يُفتح بهوامشه المحفوظة — فلا تطمسها هوامش ترويسته. */
  function applyLetterhead(found: Letterhead | null, blank = false, keepMargins = false) {
    setLetterheadId(found?.id ?? null);
    setLayoutDirty(false);
    const next = found ? normalizeLayout(found.layout) : emptyLayout();
    setLayout(next);
    if (found && !keepMargins && (blank || !docText(doc).trim())) {
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
    const opened = tdoc ?? blankLetter();
    baseDoc.current = opened;
    setDoc(opened);
    setDocType(detail.title);
    if (detail.letterheadId) {
      // القائمة تُجلب هنا لا من حالة الشاشة: تُنادى هذه الدالّة من أوّل تصيير وحالتها فارغة،
      // فكان النموذج المربوط بترويسةٍ يُفتح بلا رأس الجهة (مراجعة ٧ ت١).
      const lhs = await window.diwan.letterheads.list();
      applyLetterhead(lhs.find((l) => l.id === detail.letterheadId) ?? null, false, true);
    }
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
    baseDoc.current = saved.doc;
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

  /**
   * الاسم مكتوبٌ في الكتاب نفسه («…بأن السيدة زينب علي حسن…»): يُقترح لصاحب العلاقة بضغطة، فلا يُكتب مرّتين (البند ٩).
   * بكاشف الاسم الذي يقترح خانة «الاسم» في المصمّم (`fieldHints`) — حين لا خانة للاسم على الورقة ولم يُكتب بعد. اقتراحٌ لا قرار.
   */
  const ownerHints = useMemo(
    () => (nameField || owner.trim() ? [] : fieldHints(doc).flatMap((h) => (h.kind === 'name' ? [h.text] : [])).slice(0, 3)),
    [doc, nameField, owner]
  );
  const takeOwner = (name: string) => {
    dirty.current = true;
    setError(null);
    setOwner(name);
  };

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
    // الصفحات بمحاكاة الطابعة نفسها التي يعرض بها المحرّر صفحاته (`pageFlow.ts`) — لا بقسمة
    // الارتفاع: تلك لا ترى فاصل الصفحة ولا السطر الذي ينزل وحده.
    const bottomMm = doc.pageSetup.pageNumbers ? Math.max(m.bottom, 14) : m.bottom;
    setMeasure({
      headRatio: head ? head.getBoundingClientRect().height / pagePx : null,
      pages: body
        ? printedPages(sheet, body, {
            pageW: page.w * MM_PX,
            pageH: pagePx,
            top: m.top * MM_PX,
            bottom: bottomMm * MM_PX,
            head: doc.pageSetup.repeatLetterhead ? head : null
          })
        : null
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
  /** كُتب على الورقة شيءٌ بيد الموظف: متنٌ عُدِّل، أو قيمٌ مُلئت، أو صاحب علاقة. */
  const edited = hasContent && (doc !== baseDoc.current || Object.values(values).some((v) => v.trim()) || ownerName !== '');

  /**
   * نموذجٌ آخر من القائمة أو من البحث يحلّ محلّ الورقة (ج٣): كان يمحو الكتاب ويكتب فوق مسودّته بعد ثوانٍ بلا سؤال.
   * فإن كُتب على الورقة شيءٌ سُئل الموظف أوّلًا. (والنموذج الذي يُفتح من المكتبة على ورقةٍ لم يُكتب عليها لا يسأل.)
   */
  async function switchTemplate(id: number | null) {
    if (id !== null && edited) {
      const ok = await confirmAction({
        title: 'استبدال الكتاب الحالي بنموذجٍ آخر؟',
        message: 'يُمحى ما كُتب على هذه الورقة، وتُكتب فوق مسودّتها.',
        confirm: 'استبدله',
        danger: true
      });
      if (!ok) return;
    }
    await loadTemplate(id);
  }
  const savedLetter = () => ({ doc, values, registry, layout, docType, owner });
  const draftName = draftTitle({ docType, owner: ownerName, doc, values });
  /** المسودّة الحاضرة — تُقرأ بعد أن تُفكّ الشاشة عند المغادرة، فلا تنتظر رسمًا. */
  const draftRef = useRef<number | null>(draftId);
  draftRef.current = draft;
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
          title: draftName,
          values: letterValues(savedLetter()),
          bodyHtml: docText(doc, values)
        });
        setDraft(id);
        draftRef.current = id;
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
    [hasContent, draft, activeTemplate, linkedCitizen, draftName, doc, values, registry, layout, owner]
  );

  useEffect(() => {
    if (!dirty.current || !hasContent) return;
    const timer = setTimeout(() => void saveDraft(true), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [doc, values, registry, hasContent, saveDraft]);

  /**
   * ما لم يُحفظ بعد يُحفظ عند مغادرة المحرّر وعند إغلاق البرنامج (خطة Production، ١٫٥).
   *
   * مؤقّت الحفظ يُعاد مع كلّ حرف ويُلغى مع الشاشة، فكان ما كُتب منذ آخر توقّفٍ عن الكتابة يضيع
   * بنقرةٍ على الشريط — بلا تنبيه. والحفظ هنا هو الحفظ التلقائيّ نفسه. وكان صامتًا: ما كُتب في «قيد العمل» ولا يعرف الموظف
   * ذلك، فيظنّه ضاع (البند ١٠) — فالمغادرة تقول أين صار، بعنوانه، ويُفتح منها بضغطة (`onLeave`).
   */
  const flushDraft = useRef<() => Promise<void>>(async () => undefined);
  flushDraft.current = async () => {
    if (dirty.current && hasContent) await saveDraft(true);
  };
  const leave = useRef({ draftName, onLeave });
  leave.current = { draftName, onLeave };
  useEffect(() => {
    const unregister = onBeforeClose(() => flushDraft.current());
    return () => {
      unregister();
      const { draftName: left, onLeave: told } = leave.current;
      void flushDraft.current().then(() => draftRef.current !== null && told?.({ id: draftRef.current, title: left }));
    };
  }, []);

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
    // الطابعة قبل الإصدار: تُقيَّد مع الكتاب، وإلغاء السؤال لا يُصدر شيئًا.
    const pick = opts.print ? await choosePrinter('documents', { allowSystem: true }) : null;
    if (opts.print && !pick) return;
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
          printer: pick?.printer ?? null,
          printDialog: pick?.system ?? false,
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
      setError(errorText(e, 'تعذّر الطبع'));
    } finally {
      setBusy(false);
    }
  }

  /** طباعة للمراجعة — بلا قيدٍ في الأرشيف. */
  async function printDraftSheet() {
    const pick = await choosePrinter('documents', { allowSystem: true });
    if (!pick) return;
    setBusy(true);
    try {
      const r = await window.diwan.output.print({ sheetHtml: sheetHtml(), printer: pick.printer, copies: 1, silent: !pick.system, page: pageOf() });
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
    [saveDraft, checks, settings]
  );

  // Ctrl+S حفظ مسودة — بموضع المفتاح فتعمل واللوحة عربية. و«هات الزبون» زرٌّ بلا اختصار (ن١٥).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isCombo(e, shortcut('save').combo)) {
        e.preventDefault();
        void saveDraft(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveDraft]);

  /** شريط الورقة: رسمية من المكتبة، أو أسطرٌ في أعلى الورقة، أو بلا (ن١٧). */
  const headChoice: HeadChoice = {
    mode: headLayout ? 'formal' : doc.pageSetup.letterheadMode === 'lines' ? 'lines' : 'none',
    letterheads: letterheads.map((l) => ({ id: l.id, name: l.name })),
    letterheadId,
    onChoose: (c) => {
      applyLetterhead(c.mode === 'formal' ? (letterheads.find((l) => l.id === c.id) ?? null) : null);
      setDoc((d) => ({ ...d, pageSetup: { ...d.pageSetup, letterheadMode: c.mode === 'formal' ? 'print' : c.mode } }));
    },
    // الخطّ تحت الترويسة الرسمية من نسخة الكتاب منها — ورأسٌ من ورقة خطّه في كتله.
    divider:
      headLayout && !layout.sheet?.length
        ? {
            on: layout.divider,
            set: (on) => {
              setLayout((l) => ({ ...l, divider: on }));
              setLayoutDirty(true);
              dirty.current = true;
            }
          }
        : undefined,
    onEdit: () => setDesignerOpen(true)
  };

  // ── الواجهة ──────────────────────────────────────────────────────────
  const head = headLayout ? (
    <div className={gapAfter(headLayout) ? 'mb-space-md' : ''}>
      <LetterheadView layout={headLayout} registryValues={regValues} resolve={resolveHead} />
    </div>
  ) : null;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-screen="editor">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* ── اللوح: ما يُعمل عليه بالترتيب ─────────────────────────── */}
        <aside className="w-[400px] shrink-0 h-full flex flex-col bg-surface-container-low" data-editor-panel="">
          <div className="flex-1 min-h-0 overflow-y-auto p-space-md flex flex-col gap-space-md" data-editor-steps="">
            {/* ١ — النموذج والترويسة */}
            <TemplateSection
              activeTemplate={activeTemplate}
              switchTemplate={switchTemplate}
              templates={templates}
              letterheadId={letterheadId}
              applyLetterhead={applyLetterhead}
              letterheads={letterheads}
              setDesignerOpen={setDesignerOpen}
              layoutDirty={layoutDirty}
              layout={layout}
              setSaveLayoutOpen={setSaveLayoutOpen}
              docType={docType}
              dirty={dirty}
              setDocType={setDocType}
              doc={doc}
              setDoc={setDoc}
            />

            {/* ٢ — العدد والتاريخ والصفحة */}
            <RegistrySection
              registry={registry}
              setReg={setReg}
              stampToday={stampToday}
              doc={doc}
              setDoc={setDoc}
            />

            {/* ٣ — القيم */}
            <ValuesSection
              setPickerOpen={setPickerOpen}
              nameField={nameField}
              owner={owner}
              dirty={dirty}
              setOwner={setOwner}
              ownerHints={ownerHints}
              takeOwner={takeOwner}
              needsGender={needsGender}
              values={values}
              setGenderByHand={setGenderByHand}
              setValue={setValue}
              doc={doc}
              setDoc={setDoc}
              named={named}
              api={api}
              writeWords={writeWords}
              setFieldPickerOpen={setFieldPickerOpen}
            />

            {/* ٤ — قبل الطبع */}
            <ChecksSection
              checks={checks}
              ownerHints={ownerHints}
              takeOwner={takeOwner}
              setSpellOpen={setSpellOpen}
              setGenderByHand={setGenderByHand}
              setValue={setValue}
              spellOpen={spellOpen}
              spelling={spelling}
              setDoc={setDoc}
            />
          </div>

          {/*
           * «اطبع» ظاهرٌ أبدًا (البند ٤، UI.md ٦): كان في آخر اللوح فيختفي تحت حافّة شاشة ١٣٦٦×٧٦٨، ويبقى «طباعة تجريبية» في
           * أعلى الورقة — وهي لا تُحفظ في السجلّ، فيخرج كتابٌ بلا أثر. فصار «اطبع» في أسفل اللوح لا يمرّ مع ما فوقه، والتجريبية
           * تحته أصغر ومكتوبٌ عليها ذلك. ورسائل الخطأ والنجاح معه: تُرى أينما وقف التمرير.
           */}
          <PrintBar
            error={error}
            setError={setError}
            toast={toast}
            busy={busy}
            requestIssue={requestIssue}
            blocked={blocked}
            measure={measure}
            printDraftSheet={printDraftSheet}
            saving={saving}
            savedAt={savedAt}
            hasContent={hasContent}
          />
        </aside>

        {/* ── الورقة ─────────────────────────────────────────────────── */}
        <SheetArea
          view={view}
          setView={setView}
          trial={trial}
          setTrial={setTrial}
          tool={tool}
          setTool={setTool}
          saveDraft={saveDraft}
          setTemplateOpen={setTemplateOpen}
          exporting={exporting}
          busy={busy}
          exportWord={exportWord}
          exportPdf={exportPdf}
          exportPng={exportPng}
          doc={doc}
          templates={templates}
          setDoc={setDoc}
          switchTemplate={switchTemplate}
          api={api}
          clips={clips}
          headChoice={headChoice}
          head={head}
          effective={effective}
          headLayout={headLayout}
          shown={shown}
          regValues={regValues}
          resolveHead={resolveHead}
        />
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
          pages={measure.pages}
          printerName={settings ? describeRole(settings.printRoles.documents) : null}
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
            const pick = await choosePrinter('documents');
            if (pick) await window.diwan.documents.reprint([issued.id], 1, pick.printer);
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
