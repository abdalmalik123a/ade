/**
 * الشبّاك — الشاشة اليومية، والزبون واقف.
 *
 * ثلاث خطوات لا غير: **اختر** البطاقات، ثم **املأ** ورقة إدخال واحدة فيها
 * اتحادُ ما تطلبه المختارات بلا تكرار — الاسم يُكتب مرّة فيملأ الخمس — ثم
 * **راجع** الأوراق مملوءةً ورقةً ورقة، ثم اطبع.
 *
 * والطباعة قرارٌ بعد المراجعة لا نتيجة تلقائية. وتُقيَّد الأوراق **معاملةً
 * واحدة** لزبون واحد، لكل ورقة رقم صادرها وبصمتها.
 *
 * ولا أداة تصميم هنا: من أراد أن يبني استمارة فمكانه الورشة.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mergeFields, pageMm, type Doc, type DocField } from '@shared/doc';
import { renderDocHtml, watermarkHtml } from '@shared/docHtml';
import { asksLetterNumber, normalizeLayout, type Letterhead, type LetterheadLayout } from '@shared/letterhead';
import type {
  CitizenInput,
  OfficeSettings,
  PrinterInfo,
  TemplateDetail,
  TemplateSummary,
  TransactionSheet
} from '@shared/api';
import { formatGregorian, formatHijri } from '@shared/dates';
import LetterheadView from '../components/LetterheadView';
import WhatsAppPasteDialog from './WhatsAppPasteDialog';
import { valuesFromMessage } from '@shared/whatsappParser';
import { derivedWords } from '@shared/tafqeet';
import { GENDER_KEY, docHasChoices, guessGender, isChoiceKey } from '@shared/gender';
import { applySpelling, docSpelling, spellingIssues, type SpellIssue } from '@shared/spelling';
import SpellingPanel from '../components/SpellingPanel';
import { isCombo, shortcut } from '@shared/shortcuts';

type Step = 'pick' | 'fill' | 'review';

/**
 * الفراغ فاصلٌ عن الترويسة المبنيّة. وبلا ترويسة يُنزل الورقة كلّها عن موضعها
 * في Word — وكذا رأسٌ فُصل من ورقة: فراغه معه في كتله.
 */
function gapAfter(layout: LetterheadLayout | null): boolean {
  return Boolean(layout && !layout.sheet?.length);
}

/**
 * ورقة الإصدار بمقاس الوثيقة وهوامشها — كما رُسمت في المصمّم.
 *
 * كانت ٢٠ ملم ثابتة، وملف Word بهوامش ١٢٫٧ يلتفّ سطره حينها في غير موضعه.
 * والنمط مضمَّنٌ لا صنفًا: الورقة تُنسخ علاماتٍ إلى نافذة الطباعة، والعلامة
 * المائية تحتاج ورقةً «relative/isolate» لتقع خلف المتن.
 */
function sheetStyle(doc: Doc): React.CSSProperties {
  const page = pageMm(doc.pageSetup);
  const m = doc.pageSetup.margins;
  return {
    width: `${page.w}mm`,
    minHeight: `${page.h}mm`,
    paddingTop: `${m.top}mm`,
    paddingRight: `${m.right}mm`,
    paddingBottom: `${m.bottom}mm`,
    paddingLeft: `${m.left}mm`,
    position: 'relative',
    isolation: 'isolate'
  };
}

type Loaded = {
  summary: TemplateSummary;
  detail: TemplateDetail;
  doc: Doc;
  layout: LetterheadLayout | null;
};

export type ServiceScreenProps = {
  printer: PrinterInfo | null;
  onIssued?: () => void;
  /**
   * الشبّاك لا يُهدم حين يُترك: يبقى مركّبًا مخفيًّا فتبقى المعاملة كما تُركت —
   * كان الموظف يذهب إلى «المواطنين» ليتحقّق من رقمٍ فيعود إلى شاشةٍ فارغة.
   * و`active` يقول أهو المعروض: فيُعاد تحميل النماذج عند العودة، ولا يستجيب
   * لاختصاراته وهو مخفيّ.
   */
  active?: boolean;
  /** «كرّره» من الأرشيف: نماذج معاملةٍ صدرت وقيمها — تُفتح نسخةً جديدة للتعديل. */
  repeat?: RepeatRequest | null;
};

export type RepeatRequest = { key: number; serial: string; templateIds: number[]; values: Record<string, string> };

/** معاملةٌ معلّقة: زبونٌ ذهب ليجلب مستمسكًا، والمكتب يخدم غيره حتى يعود. */
type Parked = {
  key: number;
  label: string;
  step: Step;
  picked: number[];
  loaded: Loaded[];
  values: Record<string, string>;
  letterNo: string;
  citizenId: number | null;
  merge: boolean;
  names: string;
  valuesOnly: boolean;
  genderByHand: boolean;
};

const STEPS: { key: Step; label: string; hint: string }[] = [
  { key: 'pick', label: 'اختر', hint: 'ما يطلبه الزبون' },
  { key: 'fill', label: 'املأ', hint: 'مرّةً واحدة للجميع' },
  { key: 'review', label: 'راجع', hint: 'ثم اطبع' }
];

export default function ServiceScreen({ printer, onIssued, active = true, repeat = null }: ServiceScreenProps) {
  const [step, setStep] = useState<Step>('pick');
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  /** العدد على الكتاب كما أعطاه الزبون — وفارغًا تكتبه الجهة بيدها. لا رقم المكتب (§١). */
  const [letterNo, setLetterNo] = useState('');
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [citizenId, setCitizenId] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);

  // F2 في خطوة «املأ»: ما يعرفه البرنامج عن المواطن — كما يعلن زرّه (§١).
  useEffect(() => {
    if (step !== 'fill' || !active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isCombo(e, shortcut('citizen').combo)) {
        e.preventDefault();
        setPicker(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, active]);
  /** رسالة الزبون من واتساب تُلصق كما هي فتتوزّع على الحقول. */
  const [pasteOpen, setPasteOpen] = useState(false);
  /** استمارةٌ مطبوعةٌ مسبقًا في الطابعة: تُطبع القيم وحدها في فراغاتها. */
  const [valuesOnly, setValuesOnly] = useState(false);
  /** الدمج: سطرٌ لكل اسم، ولكلٍّ معاملتُه وأوراقُه. */
  const [merge, setMerge] = useState(false);
  const [names, setNames] = useState('');

  const sheets = useRef(new Map<number, HTMLDivElement | null>());
  const toastTimer = useRef<number | null>(null);

  /**
   * رسالةٌ تُعرض ثوانيَ ثم تختفي.
   *
   * ويُلغى مؤقّت السابقة أولًا — وإلا محا مؤقّتٌ قديم رسالةً جديدة بعد لحظة
   * من ظهورها، فيظنّ الموظف أن الإصدار لم يقل شيئًا.
   */
  const say = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  // النماذج والترويسات والإعدادات تُقرأ عند كل عودةٍ إلى الشبّاك — فما أُضيف في
  // المكتبة يظهر — والمعاملة الجارية لا تُمسّ.
  useEffect(() => {
    if (!active) return;
    void (async () => {
      const [list, cats, lhs, s] = await Promise.all([
        window.diwan.templates.list(null),
        window.diwan.templates.categories(),
        window.diwan.letterheads.list(),
        window.diwan.settings.get()
      ]);
      setItems(list);
      setCategories(cats);
      setLetterheads(lhs);
      setSettings(s);
    })();
  }, [active]);

  const topFavorites = useMemo(() => {
    return [...items].sort((a, b) => b.printCount - a.printCount).slice(0, 4);
  }, [items]);

  const shown = useMemo(() => {
    let res = items;
    if (activeCategory) {
      res = res.filter((t) => t.category === activeCategory);
    }
    const q = query.trim();
    if (q) {
      res = res.filter((t) => `${t.title} ${t.subtitle ?? ''} ${t.category ?? ''}`.includes(q));
    }
    return res;
  }, [items, activeCategory, query]);

  /** الحقول التي تُعرض: اتحاد ما تطلبه المختارات، بلا تكرار. */
  const fields: DocField[] = useMemo(() => mergeFields(loaded.map((l) => l.doc)), [loaded]);

  /**
   * القيم كما تُطبع: ما كتبه الموظف، وحقولُ «الكتابة» الفارغة مملوءةً من أرقامها —
   * «الدرجة» ٩٥ تكتب «خمس وتسعون درجة»، و«المبلغ» يُفقَّط. وما كُتب باليد يغلب.
   */
  const keys = useMemo(() => fields.map((f) => f.key), [fields]);

  /** أفي الأوراق المختارة «{الطالب|الطالبة}»؟ فيُسأل عن الجنس — ويُقترح من الاسم. */
  const needsGender = useMemo(() => loaded.some((l) => docHasChoices(l.doc)), [loaded]);
  /** اختاره الموظف بيده؟ فلا يغيّره الاقتراح بعدها. */
  const [genderByHand, setGenderByHand] = useState(false);
  const asPrinted = useCallback((v: Record<string, string>) => derivedWords(v, keys), [keys]);
  const effective = useMemo(() => asPrinted(values), [asPrinted, values]);

  const toggle = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** تحميل تفاصيل المختارات مرّة عند الانتقال — لا مع كل ضغطة. */
  async function goFill(ids: number[] = picked) {
    setBusy(true);
    try {
      const details = await Promise.all(ids.map((id) => window.diwan.templates.get(id)));
      const next: Loaded[] = [];
      for (const detail of details) {
        if (!detail) continue;
        // الملخّص من القائمة، وإلا من التفاصيل نفسها — نموذجٌ مُكرَّر قد لا يكون فيها.
        const summary =
          items.find((t) => t.id === detail.id) ?? { ...detail, variables: detail.variables.map((v) => v.token) };
        const lh = letterheads.find((x) => x.id === detail.letterheadId) ?? null;
        next.push({
          summary,
          detail,
          doc: await window.diwan.templates.doc(detail.id),
          layout: lh ? normalizeLayout(lh.layout) : null
        });
      }
      setLoaded(next);
      setStep('fill');
    } catch {
      say('تعذّر تحميل النماذج', 'warn');
    } finally {
      setBusy(false);
    }
  }

  /** F2: ما يعرفه البرنامج عن المواطن يملأ ما يطابقه من الحقول. */
  async function useCitizen(id: number) {
    const citizen = (await window.diwan.citizens.get(id)) as Record<string, unknown> | null;
    if (!citizen) return;
    setCitizenId(id);
    setValues((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (!f.source) continue;
        const raw = citizen[f.source];
        // ما كتبه الموظف بيده لا يُطمس.
        if (typeof raw === 'string' && raw.trim() && !next[f.key]?.trim()) next[f.key] = raw;
      }
      const name = citizen.fullName;
      const byRole = fields.find((f) => f.role === 'name');
      if (byRole && typeof name === 'string' && !next[byRole.key]?.trim()) next[byRole.key] = name;
      return next;
    });
    setPicker(false);
    say('استُوردت بيانات المواطن');
  }

  const byRole = (role: DocField['role']) => {
    const f = fields.find((x) => x.role === role);
    return f ? (values[f.key]?.trim() ?? '') : '';
  };

  /** اسم صاحب العلاقة: من حقلٍ بدوره، وإلا من أول حقل مملوء. */
  // وخانةُ «{الطالب|الطالبة}» ليست حقلًا يُملأ، فلا تُعدّ أوّلَ الحقول.
  const firstField = fields.find((f) => f.source === 'fullName') ?? fields.find((f) => !isChoiceKey(f.key));
  const citizenName =
    byRole('name') || values[firstField?.key ?? '']?.trim() || '';

  const missing = fields.filter((f) => f.required && !isChoiceKey(f.key) && !values[f.key]?.trim());

  /** رأس الورقة: تاريخ اليوم، والعدد كما أعطاه الزبون — وفارغًا فراغٌ منقوط للجهة. */
  const registry = { number: letterNo.trim(), date: formatGregorian(new Date()) };
  const printsRegistry = loaded.some((l) => asksLetterNumber(l.layout));

  /**
   * حقول الترويسة التلقائية: التاريخان، والعدد على الكتاب، وما سواها من قيم
   * المعاملة. وما لا قيمة له يُطبع فارغًا — لا وسمًا بين قوسين على الورق.
   */
  const resolveHead = (text: string): string =>
    text.replace(/\{([^{}]+)\}/g, (_m, raw: string) => {
      const key = raw.trim();
      if (key === 'رقم_الصادر') return letterNo.trim();
      if (key === 'التاريخ_الميلادي') return formatGregorian(new Date());
      if (key === 'التاريخ_الهجري') return formatHijri(new Date());
      return values[key] ?? values[key.replace(/_/g, ' ')] ?? '';
    });

  // الجنس يُقترح من الاسم ما لم يختره الموظف — وهو ظاهرٌ يُقلب بضغطة.
  useEffect(() => {
    if (!needsGender || genderByHand || !citizenName) return;
    const guess = guessGender(citizenName);
    if (guess && values[GENDER_KEY] !== guess.gender) setValues((prev) => ({ ...prev, [GENDER_KEY]: guess.gender }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGender, genderByHand, citizenName]);

  /** حقل الاسم: عليه يدور الدمج، وبغيره لا معنى لقائمة أسماء. */
  const nameField = fields.find((f) => f.role === 'name') ?? null;

  /** أسماء القائمة: سطرٌ لكل اسم، وتُهمل الفارغة والمكرَّرة. */
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return names
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n && !seen.has(n) && seen.add(n));
  }, [names]);

  /**
   * ورقةٌ بقيم صفٍّ بعينه.
   *
   * الترويسة واحدة لا تتبدّل فتُؤخذ من المعاينة كما رآها الموظف، والمتن وحده
   * يُعاد رسمه بالمحرّك نفسه — فورقة الاسم الثلاثين مثلُ ورقة الأول تمامًا.
   */
  const collect = useCallback((rowValues?: Record<string, string>): TransactionSheet[] => {
    const use = asPrinted(rowValues ?? values);
    return loaded.map((l) => {
      const node = sheets.current.get(l.summary.id)?.cloneNode(true) as HTMLElement | undefined;
      if (node) {
        // معاينة «القيم وحدها» صفةُ شاشة لا صفةُ كتاب: الأرشيف يقيّد الورقة كاملة.
        node.classList.remove('values-preview');
        if (rowValues) {
          const body = node.querySelector('[data-body]');
          if (body) body.innerHTML = renderDocHtml(l.doc, use, { missing: 'blank', paragraphs: 'blocks' });
        }
      }
      return {
        sheetHtml: node?.outerHTML ?? '',
        templateId: l.summary.id,
        letterheadId: l.detail.letterheadId,
        authorityId: null,
        docType: l.summary.title,
        destination: byRole('destination') || null,
        purpose: byRole('purpose') || null,
        values: use,
        copies: 1,
        copyKind: 'نسخة أصلية',
        // المال صامت (§١): العمود باقٍ في القاعدة بلا قيمة.
        fee: 0
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, values, fields, asPrinted]);

  const common = () => ({
    operator: settings?.operatorName || null,
    printer: printer?.name ?? null,
    serialPrefix: settings?.serialPrefix ?? 'م',
    serialYear: settings?.serialYear ?? new Date().getFullYear(),
    gregorianDate: formatGregorian(new Date()),
    hijriDate: null
  });

  async function issue(print: boolean) {
    if (!settings) return;
    if (merge) return issueMerged(print);
    if (!citizenName) {
      say('اكتب اسم صاحب العلاقة أولًا', 'warn');
      return;
    }
    setBusy(true);
    try {
      const out = await window.diwan.documents.issueTransaction(
        {
          ...common(),
          citizenId,
          citizenName,
          nationalId: byRole('nationalId') || null,
          sheets: collect()
        },
        print,
        valuesOnly ? 'values' : 'full'
      );
      say(`صدرت ${out.documents.length} ورقة بمعاملة واحدة — ${out.documents[0]?.serial ?? ''}`);
      onIssued?.();
      // لا ملفّ له في السجل (لم يُختر ولم يدلّ عليه رقمه)؟ يُعرض حفظه قبل أن تُمحى الحقول.
      if (out.citizenId === null) offerToRegistry(out.transactionId);
      else setNewCitizen(null);
      reset();
    } catch (e) {
      say(e instanceof Error ? e.message : 'تعذّر الإصدار', 'warn');
    } finally {
      setBusy(false);
    }
  }

  /** معاملةٌ جديدة: كل ما كُتب يُمحى، والنماذج المختارة معه. */
  function reset() {
    setStep('pick');
    setPicked([]);
    setLoaded([]);
    setValues({});
    setLetterNo('');
    setGenderByHand(false);
    setCitizenId(null);
    setNames('');
    setMerge(false);
    setValuesOnly(false);
    setAt(0);
  }

  // ── الزبون الجديد إلى السجل ───────────────────────────────────────
  /**
   * صدرت المعاملة لاسمٍ كُتب باليد لا في السجل؟ يُعرض حفظه — بما كُتب في حقوله
   * (كل حقلٍ يعرف خانته في ملف المواطن: `source`) — وتُربط كتبه به. عرضٌ لا
   * حفظٌ صامت: قد يكون زبونًا عابرًا لا يريد المكتب ملفًّا له.
   */
  const [newCitizen, setNewCitizen] = useState<{ transactionId: number; input: CitizenInput } | null>(null);

  function offerToRegistry(transactionId: number) {
    const input: CitizenInput = {
      id: null, fullName: citizenName, nationalId: null, jobTitle: null, workplace: null, employeeCode: null,
      serviceStatus: null, birthDate: null, birthPlace: null, enrollmentDept: null, address: null,
      housingCardNo: null, landmark: null, phone: null, photoPath: null, category: null, notes: null, verified: false
    };
    for (const f of fields) {
      const v = values[f.key]?.trim();
      if (!v || !f.source || !(f.source in input) || f.source === 'id' || f.source === 'verified') continue;
      (input as unknown as Record<string, string>)[f.source] = v;
    }
    input.nationalId ||= byRole('nationalId') || null;
    input.fullName = citizenName;
    setNewCitizen({ transactionId, input });
  }

  async function saveNewCitizen() {
    if (!newCitizen) return;
    try {
      const saved = await window.diwan.citizens.save(newCitizen.input);
      await window.diwan.documents.linkCitizen(newCitizen.transactionId, saved.id);
      say(`حُفظ «${saved.fullName}» في سجل المواطنين، ورُبطت به كتبه`);
      setNewCitizen(null);
    } catch (e) {
      say(e instanceof Error ? e.message : 'تعذّر الحفظ في السجل', 'warn');
    }
  }

  // ── «كرّره» من الأرشيف ─────────────────────────────────────────────
  // «اطبع لي مثل كتاب أمس وبدّل الاسم»: تُفتح نماذج تلك المعاملة بقيمها، والجارية
  // — إن كان فيها شيء — تُعلَّق لا تُمحى. والإصدار برقمٍ جديد، والأصل كما صدر.
  useEffect(() => {
    if (!repeat) return;
    if (loaded.length > 0) park();
    setPicked(repeat.templateIds);
    void goFill(repeat.templateIds).then(() => {
      setValues(repeat.values);
      say(`نسخة عن ${repeat.serial} — بدّل ما يلزم ثم أصدر، والأصل يبقى كما صدر`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat?.key]);

  // ── المعاملات المعلّقة ─────────────────────────────────────────────
  const [parked, setParked] = useState<Parked[]>([]);

  const snapshot = (): Parked => ({
    key: Date.now(),
    label: citizenName || loaded.map((l) => l.summary.title).join('، ') || 'معاملة',
    step,
    picked,
    loaded,
    values,
    letterNo,
    citizenId,
    merge,
    names,
    valuesOnly,
    genderByHand
  });

  /** تُعلَّق المعاملة كما هي، ويُفتح الشبّاك لزبونٍ آخر. */
  function park() {
    setParked((list) => [...list, snapshot()]);
    reset();
    say('عُلّقت المعاملة — تُستأنف من «معاملات معلّقة» حين يعود صاحبها');
  }

  /** تُستأنف معلّقةٌ من حيث تُركت — والجارية إن كان فيها شيء تُعلَّق مكانها. */
  function resume(key: number) {
    const p = parked.find((x) => x.key === key);
    if (!p) return;
    const current = loaded.length > 0 ? snapshot() : null;
    setParked((list) => [...list.filter((x) => x.key !== key), ...(current ? [current] : [])]);
    setStep(p.step);
    setPicked(p.picked);
    setLoaded(p.loaded);
    setValues(p.values);
    setLetterNo(p.letterNo);
    setCitizenId(p.citizenId);
    setMerge(p.merge);
    setNames(p.names);
    setValuesOnly(p.valuesOnly);
    setGenderByHand(p.genderByHand);
    setAt(0);
    say(`استُؤنفت معاملة ${p.label}`);
  }

  /** الدمج: معاملةٌ لكل اسم، والدفعة كلّها أو لا شيء. */
  async function issueMerged(print: boolean) {
    if (!settings || !nameField) return;
    if (rows.length === 0) {
      say('اكتب أسماء القائمة أولًا — سطرٌ لكل اسم', 'warn');
      return;
    }
    setBusy(true);
    try {
      const all = await window.diwan.documents.issueBatch(
        rows.map((name) => {
          const rowValues = { ...values, [nameField.key]: name };
          // ولكلّ اسمٍ في القائمة جنسُه من اسمه: «زينب» طالبةٌ و«أحمد» طالب.
          const g = needsGender ? guessGender(name)?.gender : undefined;
          if (g) rowValues[GENDER_KEY] = g;
          return {
            ...common(),
            citizenId: null,
            citizenName: name,
            nationalId: byRole('nationalId') || null,
            sheets: collect(rowValues)
          };
        }),
        print,
        valuesOnly ? 'values' : 'full'
      );
      const papers = all.reduce((n, t) => n + t.documents.length, 0);
      say(`صدرت ${papers} ورقة لـ${all.length} اسمًا — كلٌّ بمعاملته`);
      onIssued?.();
      reset();
    } catch (e) {
      say(e instanceof Error ? e.message : 'تعذّر الإصدار', 'warn');
    } finally {
      setBusy(false);
    }
  }

  /**
   * التنبيه الإملائي قبل الطباعة: ما كتبه الموظف يُصلح هنا بضغطة، وما في نصّ
   * النموذج نفسه يُقال ويُصلح في الورشة — فالشبّاك لا يعدّل النماذج.
   */
  const typedSpelling = useMemo(
    () =>
      spellingIssues(
        Object.entries(values)
          .filter(([k]) => k !== GENDER_KEY)
          .map(([, v]) => v)
          .join('\n')
      ),
    [values]
  );
  const templateSpelling = useMemo(() => {
    const merged = new Map<string, SpellIssue>();
    for (const issue of loaded.flatMap((l) => docSpelling(l.doc))) {
      const key = `${issue.word}→${issue.fix}`;
      const prev = merged.get(key);
      merged.set(key, prev ? { ...prev, count: prev.count + issue.count } : issue);
    }
    return [...merged.values()];
  }, [loaded]);

  const current = loaded[Math.min(at, loaded.length - 1)];
  /** ما يمنع الإصدار: حقلٌ إلزامي فارغ، أو دمجٌ بلا أسماء. */
  const blocked = merge ? rows.length === 0 : missing.length > 0;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-screen="service">
      <div className="h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        {/* الخطوات الثلاث */}
        <div className="shrink-0 px-space-lg py-space-sm bg-surface-container-low flex items-center gap-space-md">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-space-xs">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center font-label-md text-label-md font-bold ${
                  step === s.key
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {i + 1}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-label-lg text-label-lg text-on-surface">{s.label}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{s.hint}</span>
              </div>
              {i < STEPS.length - 1 && (
                <span className="material-symbols-outlined text-[18px] text-outline-variant mx-space-xs">
                  chevron_left
                </span>
              )}
            </div>
          ))}
          <span className="flex-1" />
          {picked.length > 0 && (
            <span className="font-label-md text-label-md text-on-surface">
              {picked.length} ورقة مختارة
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-space-lg">
          {/* ١ — اختر */}
          {step === 'pick' && (
            <div className="flex flex-col gap-space-md">
              <div className="text-center max-w-2xl mx-auto mt-space-xs mb-space-xs">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">
                  ماذا يطلب الزبون؟
                </h1>
                <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                  انقر ما يريده — واحدةً أو عدّة أوراقٍ معًا — ثم املأها مرّةً واحدة.
                </p>
              </div>
              {newCitizen && (
                <div className="p-space-sm rounded-xl bg-secondary-fixed flex flex-wrap items-center gap-space-sm" data-new-citizen="">
                  <span className="material-symbols-outlined text-[20px] text-secondary">person_add</span>
                  <span className="flex-1 font-label-md text-label-md text-on-surface">
                    «{newCitizen.input.fullName}» ليس في سجل المواطنين — أيُحفظ بما كُتب له، فتُجلب بياناته بـF2
                    في المرّة القادمة وتُربط به كتبه؟
                  </span>
                  <button
                    className="h-9 px-4 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-bold"
                    data-act="save-new-citizen"
                    type="button"
                    onClick={() => void saveNewCitizen()}
                  >
                    احفظه في السجل
                  </button>
                  <button
                    className="h-9 px-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
                    type="button"
                    onClick={() => setNewCitizen(null)}
                  >
                    لا — زبونٌ عابر
                  </button>
                </div>
              )}
              {parked.length > 0 && (
                <div className="p-space-sm rounded-xl bg-tertiary-fixed/40 flex flex-wrap items-center gap-space-xs" data-parked="">
                  <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px] text-secondary">pending_actions</span>
                    معاملات معلّقة
                  </span>
                  {parked.map((p) => (
                    <span key={p.key} className="flex items-center rounded-lg bg-surface-container-lowest overflow-hidden">
                      <button
                        className="h-9 px-3 font-label-md text-label-md text-on-surface hover:bg-surface-container-high"
                        data-act="resume"
                        type="button"
                        onClick={() => resume(p.key)}
                      >
                        {p.label} — استأنف
                      </button>
                      <button
                        className="h-9 px-2 text-on-surface-variant hover:text-error"
                        title="ألغِ المعاملة المعلّقة"
                        type="button"
                        onClick={() => setParked((list) => list.filter((x) => x.key !== p.key))}
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* الأكثر استخداماً — الوصول السريع */}
              {topFavorites.length > 0 && !query.trim() && !activeCategory && (
                <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col gap-space-xs">
                  <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-secondary font-bold px-1">
                    <span className="material-symbols-outlined text-[18px]">star</span>
                    الأكثر استخداماً في المكتب (وصول سريع)
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-space-xs">
                    {topFavorites.map((f) => {
                      const on = picked.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          className={`p-space-sm rounded-lg text-right flex items-center gap-2 transition-all ${
                            on
                              ? 'bg-primary-container text-on-primary font-bold shadow-sm'
                              : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
                          }`}
                          type="button"
                          onClick={() => toggle(f.id)}
                        >
                          <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">
                            {on ? 'check_circle' : 'bolt'}
                          </span>
                          <span className="font-label-md text-label-md truncate">{f.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-sm">
                <input
                  className="w-full max-w-md h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
                  placeholder="ابحث عن نموذج…"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                
                {/* شرائح التصنيف */}
                {categories.length > 0 && (
                  <div className="flex items-center gap-space-xs overflow-x-auto pb-1 scrollbar-none">
                    <button
                      className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm shrink-0 transition-colors ${
                        activeCategory === null
                          ? 'bg-primary-container text-on-primary font-semibold'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                      type="button"
                      onClick={() => setActiveCategory(null)}
                    >
                      الكل ({items.length})
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.name}
                        className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm shrink-0 transition-colors ${
                          activeCategory === c.name
                            ? 'bg-primary-container text-on-primary font-semibold'
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                        type="button"
                        onClick={() => setActiveCategory(c.name)}
                      >
                        {c.name} ({c.count})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {shown.length === 0 ? (
                <div className="py-space-lg text-center font-body-md text-body-md text-on-surface-variant">
                  {items.length === 0
                    ? 'المكتبة فارغة — استورد مجلد ملفاتك من الورشة'
                    : 'لا نموذج بهذا الاسم'}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-md">
                  {[...shown].sort((a, b) => b.printCount - a.printCount).map((t) => {
                    const on = picked.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        className={`relative p-space-md rounded-xl text-right flex flex-col gap-space-sm bg-surface-container-lowest border transition-all ${
                          on
                            ? 'border-secondary ring-2 ring-secondary shadow-md'
                            : 'border-outline-variant hover:border-outline hover:shadow-md'
                        }`}
                        type="button"
                        onClick={() => toggle(t.id)}
                      >
                        <span
                          className={`absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                            on ? 'bg-secondary text-on-secondary' : 'border border-outline-variant'
                          }`}
                        >
                          {on && (
                            <span className="material-symbols-outlined text-[15px]">check</span>
                          )}
                        </span>
                        <span className="w-11 h-11 rounded-lg bg-secondary-fixed text-secondary flex items-center justify-center">
                          <span className="material-symbols-outlined text-[22px]">description</span>
                        </span>
                        <span className="font-headline-sm text-headline-sm text-on-surface leading-snug">
                          {t.title}
                        </span>
                        <span className="mt-auto font-label-sm text-label-sm text-secondary font-semibold">
                          {t.category ?? 'بلا تصنيف'}
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          طُلب {t.printCount} مرّة
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ٢ — املأ */}
          {step === 'fill' && (
            <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-space-lg items-start">
              <div className="flex flex-col gap-space-md">
              <div className="flex items-center gap-space-sm">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  بيانات صاحب العلاقة
                </span>
                <span className="flex-1 font-label-sm text-label-sm text-on-surface-variant">
                  تُكتب مرّة وتملأ {loaded.length} أوراق
                </span>
                <button
                  className="h-9 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1"
                  type="button"
                  onClick={() => setPicker(true)}
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">badge</span>
                  استيراد (F2)
                </button>
                <button
                  className="h-9 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1"
                  data-act="whatsapp-paste"
                  type="button"
                  onClick={() => setPasteOpen(true)}
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">chat_paste</span>
                  لصق من واتساب
                </button>
              </div>

              {nameField && (
                <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
                  <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
                    <input
                      className="w-4 h-4 accent-secondary"
                      checked={merge}
                      type="checkbox"
                      onChange={(e) => setMerge(e.target.checked)}
                    />
                    قائمة أسماء — ورقةٌ لكل اسم
                  </label>
                  {merge && (
                    <>
                      <textarea
                        className="w-full min-h-[112px] p-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md leading-7 focus:outline-none focus:ring-1 focus:ring-secondary"
                        placeholder={'سطرٌ لكل اسم\nأحمد عادل كريم\nسالم محمود جاسم'}
                        value={names}
                        onChange={(e) => setNames(e.target.value)}
                      />
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {rows.length} اسمًا × {loaded.length} ورقة ={' '}
                        <b>{rows.length * loaded.length}</b> ورقة، لكل اسم معاملتُه.
                        وبقيّة الحقول تُملأ مرّة للجميع.
                      </span>
                    </>
                  )}
                </div>
              )}

              {printsRegistry && (
                <label className="flex flex-col gap-1" data-letter-no="">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    العدد على الكتاب — كما أعطاه الزبون، أو يُترك فارغًا تكتبه الجهة
                  </span>
                  <input
                    className="h-10 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md"
                    value={letterNo}
                    onChange={(e) => setLetterNo(e.target.value)}
                  />
                </label>
              )}

              {fields.length === 0 ? (
                <span className="font-body-md text-body-md text-on-surface-variant">
                  لا حقول في هذه النماذج — امضِ إلى المراجعة.
                </span>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                  {needsGender && (
                    <div className="md:col-span-2 flex items-center gap-space-sm" data-gender="">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        الجنس (للتذكير والتأنيث في الأوراق)
                      </span>
                      {(['ذكر', 'أنثى'] as const).map((g) => (
                        <button
                          key={g}
                          className={`h-9 px-4 rounded-lg font-label-md text-label-md ${
                            values[GENDER_KEY] === g ? 'bg-secondary text-on-secondary font-bold' : 'bg-surface-container-low text-on-surface'
                          }`}
                          data-gender-value={g}
                          type="button"
                          onClick={() => {
                            setGenderByHand(true);
                            setValues((prev) => ({ ...prev, [GENDER_KEY]: g }));
                          }}
                        >
                          {g}
                        </button>
                      ))}
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {merge ? 'وفي القائمة: لكلّ اسمٍ جنسُه من اسمه' : genderByHand ? '' : 'مقترحٌ من الاسم'}
                      </span>
                    </div>
                  )}
                  {fields
                    .filter((f) => !isChoiceKey(f.key))
                    .filter((f) => !(merge && f.key === nameField?.key))
                    .map((f) => (
                    <label key={f.key} className="flex flex-col gap-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {f.label}
                        {f.required && <span className="text-error"> *</span>}
                      </span>
                      <input
                        className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
                        type="text"
                        placeholder={effective[f.key] && !values[f.key] ? effective[f.key] : undefined}
                        value={values[f.key] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              </div>
              {/* معاينة حيّة بجانب التعبئة — عرضٌ فقط، لا تُصدَر عنها ورقة */}
              <div className="hidden lg:flex justify-center sticky top-0">
                {loaded[0] && (
                  <div style={{ zoom: 0.42 }} className="w-fit">
                    <div
                      className="a4-sheet bg-white text-black shadow-lg"
                      style={sheetStyle(loaded[0].doc)}
                    >
                      <div dangerouslySetInnerHTML={{ __html: watermarkHtml(loaded[0].doc) }} />
                      {loaded[0].layout && <LetterheadView layout={loaded[0].layout} registryValues={registry} resolve={resolveHead} />}
                      <div
                        className={`${gapAfter(loaded[0].layout) ? 'mt-space-md ' : ''}font-body-md text-body-md leading-8`}
                        dangerouslySetInnerHTML={{
                          __html: renderDocHtml(loaded[0].doc, effective, { missing: 'blank', paragraphs: 'blocks' })
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ٣ — راجع */}
          <div className={step === 'review' ? 'flex flex-col items-center gap-space-md' : 'hidden'}>
            {(typedSpelling.length > 0 || templateSpelling.length > 0) && (
              <div className="w-full max-w-3xl flex flex-col gap-space-xs">
                <SpellingPanel
                  issues={typedSpelling}
                  title="فيما كُتب في الحقول"
                  onFix={(chosen) =>
                    setValues((prev) =>
                      Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, k === GENDER_KEY ? v : applySpelling(v, chosen)]))
                    )
                  }
                />
                <SpellingPanel
                  issues={templateSpelling}
                  title="في نصّ النموذج نفسه"
                  note="يُصلح من الورشة (تدقيق إملائي في مصمّم النماذج) — فالشبّاك لا يعدّل النماذج"
                />
              </div>
            )}
            {merge && rows.length > 0 && (
              <span className="font-label-md text-label-md text-on-surface-variant">
                معاينة الاسم الأول ({rows[0]}) — وبقيّة الأسماء {rows.length - 1} مثلها
              </span>
            )}
            {loaded.length > 1 && (
              <div className="flex items-center gap-space-sm">
                <button
                  className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30"
                  disabled={at === 0}
                  type="button"
                  onClick={() => setAt((n) => n - 1)}
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
                <span className="font-label-md text-label-md text-on-surface">
                  ورقة {at + 1} من {loaded.length} — {current?.summary.title}
                </span>
                <button
                  className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30"
                  disabled={at >= loaded.length - 1}
                  type="button"
                  onClick={() => setAt((n) => n + 1)}
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
              </div>
            )}

            {loaded.map((l, i) => (
              <div key={l.summary.id} className={i === at ? '' : 'hidden'}>
                <div
                  ref={(el) => {
                    sheets.current.set(l.summary.id, el);
                  }}
                  className={`a4-sheet bg-white text-black shadow-lg ${valuesOnly ? 'values-preview' : ''}`}
                  style={sheetStyle(l.doc)}
                >
                  <div dangerouslySetInnerHTML={{ __html: watermarkHtml(l.doc) }} />
                  {l.layout && <LetterheadView layout={l.layout} registryValues={registry} resolve={resolveHead} />}
                  <div
                    className={`${gapAfter(l.layout) ? 'mt-space-md ' : ''}font-body-md text-body-md leading-8`}
                    data-body=""
                    dangerouslySetInnerHTML={{
                      __html: renderDocHtml(l.doc, effective, { missing: 'blank', paragraphs: 'blocks' })
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* شريط القرار */}
        <div className="shrink-0 px-space-lg py-space-sm bg-surface-container-low flex items-center gap-space-sm">
          {step !== 'pick' && (
            <button
              className="h-10 px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
              type="button"
              onClick={() => setStep(step === 'review' ? 'fill' : 'pick')}
            >
              رجوع
            </button>
          )}
          {step !== 'pick' && (
            <button
              className="h-10 px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md flex items-center gap-1"
              data-act="park"
              title="الزبون ذهب ليجلب مستمسكًا؟ علّقها واخدم غيره، ثم استأنفها من حيث تُركت"
              type="button"
              disabled={busy}
              onClick={park}
            >
              <span className="material-symbols-outlined text-[18px]">pause_circle</span>
              علّق المعاملة
            </button>
          )}
          {step !== 'pick' && (
            <button
              className="h-10 px-4 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container font-label-md text-label-md flex items-center gap-1"
              data-act="discard"
              title="زبونٌ عدل عن طلبه: تُمحى المعاملة ويُفتح الشبّاك نظيفًا — ولا يُقيَّد شيء"
              type="button"
              disabled={busy}
              onClick={() => {
                reset();
                say('أُلغيت المعاملة — لم يُقيَّد شيء');
              }}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              ألغِ المعاملة
            </button>
          )}
          <span className="flex-1" />

          {step === 'review' && (
            <>
              <label
                className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface cursor-pointer"
                title="الاستمارة الحكومية المطبوعة في الطابعة: تُطبع القيم وحدها في فراغاتها المنقّطة، والأرشيف يقيّد الورقة كاملة. اضبط إزاحة الطابعة من الإعدادات إن لزم."
              >
                <input
                  checked={valuesOnly}
                  className="w-4 h-4 accent-secondary"
                  data-act="values-only"
                  type="checkbox"
                  onChange={(e) => setValuesOnly(e.target.checked)}
                />
                على استمارةٍ مطبوعة — القيم وحدها
              </label>
              {merge ? (
                <span className="font-label-md text-label-md text-on-surface">
                  {rows.length * loaded.length} ورقة لـ{rows.length} اسمًا
                </span>
              ) : (
                missing.length > 0 && (
                  <span className="font-label-md text-label-md text-error">
                    {missing.length} حقلًا إلزاميًّا فارغًا
                  </span>
                )
              )}
            </>
          )}

          {step === 'pick' && (
            <button
              className="h-10 px-5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
              type="button"
              disabled={picked.length === 0 || busy}
              onClick={() => void goFill()}
            >
              املأ {picked.length > 0 ? `(${picked.length})` : ''}
            </button>
          )}
          {step === 'fill' && (
            <button
              className="h-10 px-5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
              type="button"
              disabled={busy}
              onClick={() => {
                setAt(0);
                setStep('review');
              }}
            >
              راجع الأوراق
            </button>
          )}
          {step === 'review' && (
            <>
              <button
                className="h-10 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-40"
                type="button"
                disabled={busy || blocked}
                onClick={() => void issue(false)}
              >
                أصدر بلا طباعة
              </button>
              <button
                className="h-10 px-5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
                type="button"
                disabled={busy || blocked}
                onClick={() => void issue(true)}
              >
                {busy
                  ? 'جارٍ الإصدار...'
                  : `اطبع ${merge ? rows.length * loaded.length : loaded.length} ورقة`}
              </button>
            </>
          )}
        </div>
      </div>

      {picker && <CitizenPicker onClose={() => setPicker(false)} onPick={(id) => void useCitizen(id)} />}

      <WhatsAppPasteDialog
        isOpen={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onApply={(extracted) => {
          const filled = valuesFromMessage(fields, extracted, values);
          const n = Object.keys(filled).length;
          setValues((prev) => ({ ...prev, ...filled }));
          setPasteOpen(false);
          say(n ? `مُلئ ${n} حقلًا من الرسالة — راجعها قبل الطباعة` : 'لم يطابق شيءٌ من الرسالة حقول هذه الأوراق', n ? 'ok' : 'warn');
        }}
      />

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-space-md py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${
            toast.tone === 'warn'
              ? 'bg-error-container text-on-error-container'
              : 'bg-primary-container text-on-primary'
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

/** الزبون المتكرر: يُكتب اسمه فيُستعاد ما يعرفه البرنامج عنه. */
function CitizenPicker({
  onClose,
  onPick
}: {
  onClose: () => void;
  onPick: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<{ id: number; fullName: string; nationalId: string | null }[]>(
    []
  );

  useEffect(() => {
    let alive = true;
    void window.diwan.citizens.list({ query, limit: 20 }).then((list) => {
      if (alive) setRows(list as typeof rows);
    });
    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-scrim/50">
      <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest shadow-2xl p-space-md flex flex-col gap-space-sm">
        <span className="font-headline-sm text-headline-sm text-on-surface">
          استيراد من سجل المواطنين
        </span>
        <input
          autoFocus
          className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
          placeholder="اسم المواطن أو رقمه"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
          {rows.length === 0 ? (
            <span className="py-space-md text-center font-label-md text-label-md text-on-surface-variant">
              لا ملفّ بهذا الاسم
            </span>
          ) : (
            rows.map((c) => (
              <button
                key={c.id}
                className="h-10 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface text-right font-label-md text-label-md flex items-center justify-between"
                type="button"
                onClick={() => onPick(c.id)}
              >
                <span>{c.fullName}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {c.nationalId ?? ''}
                </span>
              </button>
            ))
          )}
        </div>
        <button
          className="h-9 self-end px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
          type="button"
          onClick={onClose}
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
