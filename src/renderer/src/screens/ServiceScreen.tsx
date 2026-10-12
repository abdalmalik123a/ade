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
import { mergeFields, type DocField } from '@shared/doc';
import { normalizeFold, count, countIn } from '@shared/arabic';
import { renderDocHtml } from '@shared/docHtml';
import { asksLetterNumber, normalizeLayout, printsHijri, type Letterhead } from '@shared/letterhead';
import type {
  Attachment,
  CitizenInput,
  OfficeSettings,
  TemplateSummary,
  TransactionSheet
} from '@shared/api';
import { formatGregorian, formatHijri } from '@shared/dates';
import WhatsAppPasteDialog from './WhatsAppPasteDialog';
import { valuesFromMessage } from '@shared/whatsappParser';
import { derivedWords } from '@shared/tafqeet';
import { GENDER_KEY, docHasChoices, guessGender, isChoiceKey, unsureNames, type Gender } from '@shared/gender';
import { useLearnedGenders } from '../lib/useLearnedGenders';
import GenderReview from '../components/GenderReview';
import CitizenMultiPicker from '../components/CitizenMultiPicker';
import { docSpelling, spellingIssues, type SpellIssue } from '@shared/spelling';
import { choosePrinter } from '../lib/printChoice';
import IdSheetDialog from '../components/IdSheetDialog';
import type { CounterCard } from '@shared/counterCards';
import type { InboxOpen } from '../components/InboxPanel';
import { CitizenPicker, SchoolPicker } from './ServicePickers';
import { formValues } from '@shared/imageForm';
import { applySchool, hasSchoolFields, schoolSlotOf, schoolValues } from '@shared/schoolFile';
import type { Client } from '@shared/orders';
import { renderCanvasHtml } from '@shared/canvasHtml';
import { SCREEN_DPI } from '@shared/canvas';
import { papersWord } from '../components/OutputBar';
import type { InboxFile } from '@shared/api';
import { onBeforeClose } from '../lib/beforeClose';
import { useToast } from '../kit/useToast';
import { errorText } from '../lib/errors';
import mark from '../assets/brand/mt-mark.png';
import { CounterToast, PrintRunBar, RepeatOfBar, StepsHeader } from './service/CounterBars';
import { usePrintRun } from './service/usePrintRun';
import CounterPick from './service/CounterPick';
import CounterFill from './service/CounterFill';
import CounterReview from './service/CounterReview';
import DecisionBar from './service/DecisionBar';
import type { AfterIssue, Loaded, NewCitizen, Parked, RepeatOf, Step } from './service/types';

export type ServiceScreenProps = {
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
  /** بطاقةٌ تفتح أداةً (الصور، PDF، الأسئلة…) أو نافذة (استنساخ الهوية) — المرحلة ٢. ومعها الزبون
   * الواقف إن عُرف، فتقوله الأداة في رأسها وتحفظ في ملفّه (المرحلة ٥). */
  onOpenTool?: (target: CounterCard['target'], citizenId: number | null) => void;
  /** ملفٌّ من «الملفّات» يُفتح في أداته — ويُرفض بخطأٍ يقوله اللوح. */
  onOpenFile?: (file: InboxFile, as: InboxOpen) => Promise<void>;
  /** «افتح التفعيل» على رسالة انتهاء المدّة (د١٠): الشبّاك لا ينتقل بنفسه، فتُمرَّر من App. */
  onOpenActivation?: () => void;
  /** «استأنف» من قيد العمل: معاملةٌ معلّقة بمفتاحها (المرحلة ٣). */
  resumeRequest?: { key: number; parkedKey: number } | null;
  /** «شيءٌ آخر لنفس الزبون» من أداة: يعود الزبون، وتُملأ حقوله من ملفّه حين يُختار ما يريده. */
  customerRequest?: { key: number; citizenId: number } | null;
  /** إعدادات المكتب كما حفظها غيره (المعالج، الإعدادات) — تغيُّرها يُعيد قراءتها: بطاقات «ابدأ جاهزًا». */
  settingsKey?: unknown;
};

/** «كرّره»: نماذج كتابٍ صدر بقيمه — و`id` الكتاب الأصل، فيُبطَل إن اختار الموظف (د٤). */
export type RepeatRequest = { key: number; id: number; serial: string; templateIds: number[]; values: Record<string, string> };

/** المعاملة المعلّقة — نوعها في `service/types.ts` (وتقرؤه «قيد العمل»). */
export type { Parked } from './service/types';

export default function ServiceScreen({ onIssued, active = true, repeat = null, onOpenTool, onOpenFile, onOpenActivation, resumeRequest = null, customerRequest = null, settingsKey }: ServiceScreenProps) {
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
  const { toast, say, dismiss } = useToast(3200);
  /**
   * خطأٌ يُقال بالعربية ويبقى حتى يغلقه الموظف (د١٠): كانت رسالة الإصدار تُعرض خامًا (قد تبدأ بـ«Error invoking
   * remote method») وتختفي بعد ثلاث ثوانٍ — ورسالة انتهاء المدّة طويلة. ومعها «افتح التفعيل».
   */
  const sayError = useCallback(
    (e: unknown, fallback: string) => {
      const text = errorText(e, fallback);
      const expired = text.includes('الإعدادات ← التفعيل');
      say(
        text,
        'warn',
        expired && onOpenActivation
          ? {
              label: 'افتح التفعيل',
              run: () => {
                dismiss();
                onOpenActivation();
              }
            }
          : undefined,
        { sticky: true }
      );
    },
    [say, dismiss, onOpenActivation]
  );
  const [citizenId, setCitizenId] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  /** «هات المدرسة» (ملفّ المدارس، الموجة ٢): المدارس من «الجهات»، وما ملأه آخر اختيار — فتبديلها يبدّل قيمها. */
  const [schoolPicker, setSchoolPicker] = useState(false);
  const [schools, setSchools] = useState<Client[]>([]);
  const schoolFilled = useRef<Record<string, string>>({});

  /** رسالة الزبون من واتساب تُلصق كما هي فتتوزّع على الحقول. */
  const [pasteOpen, setPasteOpen] = useState(false);
  /** استمارةٌ مطبوعةٌ مسبقًا في الطابعة: تُطبع القيم وحدها في فراغاتها. */
  const [valuesOnly, setValuesOnly] = useState(false);
  /** النسخ عند الشبّاك (د٣): «ثلاث نسخ» ضغطةٌ واحدة لا ثلاث عمليات — والأصل ١، ويعود إليه للزبون التالي. */
  const [copies, setCopies] = useState(1);
  /**
   * «نسخة عن …» (د٤): الكتاب الأصل، و«وأبطل الأصل» — **غير مؤشَّرة افتراضيًّا** — بسببها. فإن أُشِّرت أُبطل الأصل بعد
   * نجاح إصدار هذه النسخة: كتابٌ خاطئ يُصحَّح بخطوةٍ واحدة لا بتكرارٍ ثم إبطالٍ في الأرشيف وسببٍ يُكتب مرّتين.
   */
  const [repeatOf, setRepeatOf] = useState<RepeatOf | null>(null);
  /** الدمج: سطرٌ لكل اسم، ولكلٍّ معاملتُه وأوراقُه. */
  const [merge, setMerge] = useState(false);
  const [names, setNames] = useState('');

  const sheets = useRef(new Map<number, HTMLDivElement | null>());

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
  }, [active, settingsKey]);

  const topFavorites = useMemo(() => {
    return [...items].sort((a, b) => b.printCount - a.printCount).slice(0, 4);
  }, [items]);

  const shown = useMemo(() => {
    let res = items;
    if (activeCategory) {
      res = res.filter((t) => t.category === activeCategory);
    }
    // متساهلٌ مع الهمزة والتاء المربوطة: «تاييد» تجد «تأييد».
    const q = normalizeFold(query.trim());
    if (q) {
      res = res.filter((t) => normalizeFold(`${t.title} ${t.subtitle ?? ''} ${t.category ?? ''}`).includes(q));
    }
    return res;
  }, [items, activeCategory, query]);

  /** البطاقات بترتيب عرضها: الأكثر طلبًا أولًا — وأوّل تسعٍ منها بأرقامها (د١١). */
  const ordered = useMemo(() => [...shown].sort((a, b) => b.printCount - a.printCount), [shown]);
  const searchRef = useRef<HTMLInputElement | null>(null);

  /**
   * الشبّاك بلوحة المفاتيح (د١١): الكتابة تصفّي، وEnter تملأ، وEsc تمحو البحث. والأرقام ١–٩ التي
   * كانت تختار البطاقات زالت (ن١٥): اختصارٌ لا يعرفه الموظف من Windows ولا Word.
   */
  useEffect(() => {
    if (!active || step !== 'pick') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const inSearch = target === searchRef.current;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (typing && !inSearch) return;
      if (e.key === 'Enter' && picked.length > 0) {
        e.preventDefault();
        void goFill();
        return;
      }
      if (e.key === 'Escape' && query) {
        setQuery('');
        return;
      }
      // حرفٌ يُكتب في أيّ موضع: يذهب إلى البحث.
      if (!inSearch && e.key.length === 1 && e.key.trim()) searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, picked, query]);

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
  /** ما تعلّمه المكتب من التذكير والتأنيث — ويُضاف إليه ما يُجاب هنا (ج٤). */
  const [learned, remember] = useLearnedGenders();
  /** اختيار أسماء القائمة من السجل (د١٢). */
  const [mergePicker, setMergePicker] = useState(false);
  /** أسماء القائمة التي لم يُعرف جنسها — تُسأل قبل أن تُطبع الدفعة. */
  const [genderReview, setGenderReview] = useState<{ names: string[]; print: boolean } | null>(null);
  // والاستمارة المصوّرة: المجموع يُجمع والمربّع ✓ قبل أن تُكتب الأرقام كلماتٍ (المرحلة ٤).
  const asPrinted = useCallback((v: Record<string, string>) => derivedWords(formValues(fields, v), keys), [keys, fields]);
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

  /** «ملفّ المدارس» مفعّلٌ، وفي الأوراق خانةٌ من ملفّ المدرسة — فيُعرض «هات المدرسة». */
  const schoolOn = Boolean(settings?.schoolFiles) && hasSchoolFields(fields);
  const schoolNameKey = useMemo(() => fields.find((f) => schoolSlotOf(f.key, f.source) === 'name')?.key ?? null, [fields]);
  useEffect(() => {
    if (schoolOn) void window.diwan.clients.list().then(setSchools);
  }, [schoolOn]);

  // والعام الدراسي يُكتب وحده من التاريخ (والخيار مفعّل) — في خانته الفارغة، فما كتبه الموظف لا يُمسّ.
  useEffect(() => {
    if (!settings?.schoolFiles || step !== 'fill') return;
    const year = schoolValues(fields, null, new Date());
    if (!Object.keys(year).length) return;
    setValues((prev) => {
      const missing = Object.entries(year).filter(([key]) => !prev[key]?.trim());
      return missing.length ? { ...prev, ...Object.fromEntries(missing) } : prev;
    });
  }, [fields, settings?.schoolFiles, step]);

  /** ملفّ المدرسة يملأ خاناتها — وما كتبه الموظف بيده لا يُطمس، وما ملأته مدرسةٌ سابقة يُستبدل. */
  function useSchool(school: Client, base: Record<string, string> = values, filled: Record<string, string> = schoolFilled.current) {
    const out = applySchool(base, schoolValues(fields, school, new Date()), filled);
    schoolFilled.current = out.filled;
    setValues(out.values);
    setSchoolPicker(false);
    say(`مُلئت بيانات ${school.name}`);
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
    const guess = guessGender(citizenName, learned);
    if (guess && values[GENDER_KEY] !== guess.gender) setValues((prev) => ({ ...prev, [GENDER_KEY]: guess.gender }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGender, genderByHand, citizenName, learned]);

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
          if (body)
            body.innerHTML =
              l.doc.kind === 'canvas'
                ? renderCanvasHtml(l.doc, use, { dpi: SCREEN_DPI, marks: false, missing: l.doc.meta.form ? 'hide' : 'blank' })
                : renderDocHtml(l.doc, use, { missing: 'blank', paragraphs: 'blocks' });
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
        copies,
        copyKind: 'نسخة أصلية',
        // المال صامت (§١): العمود باقٍ في القاعدة بلا قيمة.
        fee: 0
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, values, fields, asPrinted, copies]);

  const common = (printer: string | null) => ({
    operator: settings?.operatorName || null,
    printer,
    serialPrefix: settings?.serialPrefix ?? 'م',
    serialYear: settings?.serialYear ?? new Date().getFullYear(),
    gregorianDate: formatGregorian(new Date()),
    // الهجري يُقيَّد إن طبعته الترويسة — فالسجلّ يقول ما على الورقة.
    hijriDate: loaded.some((l) => printsHijri(l.layout)) ? formatHijri(new Date()) : null
  });

  async function issue(print: boolean) {
    if (!settings) return;
    if (merge) return issueMerged(print);
    if (!citizenName) {
      say('اكتب اسم صاحب العلاقة أولًا', 'warn');
      return;
    }
    // الطابعة قبل الإصدار: تُقيَّد مع الكتاب، وإلغاء السؤال لا يُصدر شيئًا.
    const pick = print ? await choosePrinter('documents') : null;
    if (print && !pick) return;
    const mode = valuesOnly ? 'values' : 'full';
    setBusy(true);
    try {
      const out = await window.diwan.documents.issueTransaction({
        ...common(pick?.printer ?? null),
        citizenId,
        citizenName,
        nationalId: byRole('nationalId') || null,
        sheets: collect()
      });
      const customer = { values: { ...values }, citizenId: out.citizenId ?? citizenId, genderByHand };
      const label = `معاملة ${citizenName} — ${out.documents[0]?.serial ?? ''}`;
      const n = copies;
      const original = repeatOf?.voidIt ? repeatOf : null;
      setAfter({
        outcome: { what: papersWithCopies(out.documents.length, n), printer: pick?.printer ?? null, serial: out.documents[0]?.serial ?? '' },
        ids: out.documents.map((d) => d.id),
        mode,
        label,
        copies: n,
        customer
      });
      onIssued?.();
      // جنسٌ حسمه الموظف لاسمٍ لم يُعرف، أو قلب فيه الاقتراح: يُحفظ فلا يُسأل عنه ثانيةً.
      const chosen = values[GENDER_KEY] as Gender | undefined;
      const guessed = guessGender(citizenName, learned);
      if (needsGender && genderByHand && chosen && (!guessed?.sure || guessed.gender !== chosen)) {
        remember([{ name: citizenName, gender: chosen }]);
      }
      // لا ملفّ له في السجل (لم يُختر ولم يدلّ عليه رقمه)؟ يُعرض حفظه قبل أن تُمحى الحقول.
      if (out.citizenId === null) offerToRegistry(out.transactionId);
      else setNewCitizen(null);
      reset();
      if (original) {
        try {
          await window.diwan.documents.void(original.id, original.reason.trim() || 'خطأ في الكتابة', settings?.operatorName || null);
          say(`صدرت النسخة الصحيحة ${out.documents[0]?.serial ?? ''}، وأُبطل الأصل ${original.serial} بسببه`);
          // وشريط ما خرج يقوله ثابتًا — فرسالة الطباعة بعده لا تمحوه.
          setAfter((a) => (a ? { ...a, outcome: { ...a.outcome, what: `${a.outcome.what} — وأُبطل الأصل ${original.serial}` } } : a));
        } catch (e) {
          // الإصدار تمّ؛ والإبطال يُقال وحده — ويُبطَل الأصل من الأرشيف.
          sayError(e, `صدرت النسخة، وتعذّر إبطال الأصل ${original.serial} — أبطله من الأرشيف`);
        }
      }
      if (pick) {
        await printIssued(out.documents.map((d) => d.id), pick.printer, mode, label, n);
      }
    } catch (e) {
      sayError(e, 'تعذّر الإصدار');
    } finally {
      setBusy(false);
    }
  }

  // ── طباعة ما صدر (خطة Production، ٢٫٣): ورقةً ورقة بسجلٍّ يُستأنف — `service/usePrintRun.ts` ──
  const { printRun, printIssued, resumePrint, dropPrint } = usePrintRun(say);

  /** «ورقتان» — أو «ورقتان × ٣ نسخ» حين تُطبع نسخ. */
  const papersWithCopies = (papers: number, n: number) => (n > 1 ? `${papersWord(papers)} × ${count(n, 'نسخة')}` : papersWord(papers));

  /** ورقة مستمسكات صاحب العلاقة (خطة Production، المرحلة ٥) — من ملفّه في السجل والزبون واقف. */
  const [idSheet, setIdSheet] = useState<{ name: string; attachments: Attachment[] } | null>(null);
  async function openIdSheet() {
    if (citizenId === null) return;
    const detail = await window.diwan.citizens.get(citizenId);
    if (detail) setIdSheet({ name: detail.fullName, attachments: detail.attachments });
  }

  /** معاملةٌ جديدة: كل ما كُتب يُمحى، والنماذج المختارة معه. */
  /**
   * ما خرج الآن (ن٩): يُقال في شريطٍ بعد الطبع — وأين خرج، وبرقمه في السجلّ — ومنه «أعد الطبع»
   * و«شيءٌ آخر لنفس الزبون» (تعود قيمه إلى ورقة الإدخال للمختار التالي).
   */
  const [after, setAfter] = useState<AfterIssue | null>(null);

  async function reprintAfter() {
    if (!after) return;
    const printer = after.outcome.printer ?? (await choosePrinter('documents'))?.printer;
    if (!printer) return;
    setAfter({ ...after, outcome: { ...after.outcome, printer } });
    await printIssued(after.ids, printer, after.mode, after.label, after.copies);
  }

  /** ما قُيِّد الآن ملفًّا للزبون (واتساب، بريد) — كلّ كتابٍ ملفّه، من السجلّ كما صدر. */
  async function pdfAfter() {
    if (!after) return;
    let saved = 0;
    for (const id of after.ids) if (await window.diwan.documents.exportPdf(id)) saved++;
    if (saved) say(saved === 1 ? 'حُفظ PDF من السجلّ كما صدر' : `حُفظت من السجلّ ${count(saved, 'ملف')} PDF`);
  }

  function sameCustomer() {
    if (!after?.customer) return;
    setValues(after.customer.values);
    setCitizenId(after.customer.citizenId);
    setGenderByHand(after.customer.genderByHand);
    setAfter(null);
    say('الزبون نفسه — اختر ما يريده بعدُ، وحقوله مملوءة');
  }

  function reset() {
    setStep('pick');
    setPicked([]);
    setLoaded([]);
    setValues({});
    schoolFilled.current = {};
    setLetterNo('');
    setGenderByHand(false);
    setCitizenId(null);
    setNames('');
    setMerge(false);
    setValuesOnly(false);
    setCopies(1);
    setRepeatOf(null);
    setAt(0);
  }

  // ── الزبون الجديد إلى السجل ───────────────────────────────────────
  /**
   * صدرت المعاملة لاسمٍ كُتب باليد لا في السجل؟ يُعرض حفظه — بما كُتب في حقوله
   * (كل حقلٍ يعرف خانته في ملف المواطن: `source`) — وتُربط كتبه به. عرضٌ لا
   * حفظٌ صامت: قد يكون زبونًا عابرًا لا يريد المكتب ملفًّا له.
   */
  const [newCitizen, setNewCitizen] = useState<NewCitizen | null>(null);

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
      say(`حُفظ «${saved.fullName}» في الزبائن، ورُبطت به كتبه`);
      setNewCitizen(null);
      // «شيءٌ آخر لنفس الزبون» بعدها يحمل ملفّه الجديد — فتعرفه الأداة التي يُفتح لها (المرحلة ٥).
      setAfter((a) => (a?.customer ? { ...a, customer: { ...a.customer, citizenId: saved.id } } : a));
    } catch (e) {
      sayError(e, 'تعذّر الحفظ في السجل');
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
      setRepeatOf({ id: repeat.id, serial: repeat.serial, voidIt: false, reason: 'خطأ في الكتابة' });
      say(`نسخة عن ${repeat.serial} — بدّل ما يلزم ثم اطبع، والأصل يبقى في السجلّ كما خرج`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat?.key]);

  // ── المعاملات المعلّقة ─────────────────────────────────────────────
  const [parked, setParkedState] = useState<Parked[]>([]);
  useEffect(() => {
    void window.diwan.service
      .parked()
      .then((list) => setParkedState(list as Parked[]))
      .catch(() => undefined);
  }, []);
  /** كلّ تغييرٍ يُحفظ في القاعدة — فالمعلّقة لا تضيع بإغلاق البرنامج ولا بانقطاع الكهرباء. */
  const setParked = (update: (list: Parked[]) => Parked[]) =>
    setParkedState((list) => {
      const next = update(list);
      void window.diwan.service.setParked(next).catch(() => say('تعذّر حفظ المعاملات المعلّقة', 'warn'));
      return next;
    });

  const snapshot = (): Parked => ({
    key: Date.now(),
    label: citizenName || loaded.map((l) => l.summary.title).join('، ') || 'معاملة',
    step,
    picked: loaded.map((l) => l.detail.id),
    values,
    letterNo,
    citizenId,
    merge,
    names,
    valuesOnly,
    genderByHand
  });

  /**
   * ما يُترك قبل أن يكتمل يصل قيد العمل وحده (ن١٤): برنامجٌ يُغلق ومعاملةٌ في وسطها — نماذجها
   * مختارة وفي ورقة الإدخال أو المراجعة — تُعلَّق قبل الإغلاق، فتنتظر صاحبها في «قيد العمل».
   */
  const closeFlush = useRef<() => unknown>(() => undefined);
  closeFlush.current = () => (loaded.length > 0 && step !== 'pick' ? window.diwan.service.setParked([...parked, snapshot()]) : undefined);
  useEffect(() => onBeforeClose(() => closeFlush.current()), []);

  /** تُعلَّق المعاملة كما هي، ويُفتح الشبّاك لزبونٍ آخر. */
  function park() {
    setParked((list) => [...list, snapshot()]);
    reset();
    say('عُلّقت المعاملة — تُستأنف من «معاملات معلّقة» حين يعود صاحبها');
  }

  /**
   * تُستأنف معلّقةٌ من حيث تُركت — والجارية إن كان فيها شيء تُعلَّق مكانها. والنماذج تُحمَّل
   * من جديد: ما حُذف منها منذ التعليق يُقال.
   */
  async function resume(key: number, from: Parked[] = parked) {
    const p = from.find((x) => x.key === key);
    if (!p) return;
    const current = loaded.length > 0 ? snapshot() : null;
    const found = (await Promise.all(p.picked.map((id) => window.diwan.templates.get(id).catch(() => null)))).filter(Boolean).length;
    if (!found) {
      say(`نماذج معاملة ${p.label} حُذفت منذ عُلّقت — لا تُستأنف`, 'warn');
      return;
    }
    // الزبون الذي عُلّقت له قد يُحذف منذ ذاك (أو يُستبدل السجلّ باسترجاع): لا يُقيَّد كتابٌ بمفتاحٍ لا وجود له
    // فيفشل القيد بخطأ قاعدةٍ لا يفهمه الموظف.
    const owner = p.citizenId === null ? null : await window.diwan.citizens.get(p.citizenId).catch(() => null);
    const ownerGone = p.citizenId !== null && !owner;
    setParked((list) => [...list.filter((x) => x.key !== key), ...(current ? [current] : [])]);
    await goFill(p.picked);
    setStep(p.step);
    setPicked(p.picked);
    setValues(p.values);
    setLetterNo(p.letterNo);
    setCitizenId(ownerGone ? null : p.citizenId);
    setMerge(p.merge);
    setNames(p.names);
    setValuesOnly(p.valuesOnly);
    setGenderByHand(p.genderByHand);
    setAt(0);
    const notes = [
      found < p.picked.length ? 'وحُذف من نماذجها ما لم يعد في المكتبة' : '',
      ownerGone ? 'والزبون الذي عُلّقت له لم يعد في السجلّ فلا تُربط به' : ''
    ].filter(Boolean);
    say(`استُؤنفت معاملة ${p.label}${notes.length ? ` — ${notes.join('، ')}` : ''}`, ownerGone ? 'warn' : 'ok');
  }

  /** آخر `resume` — فـ«تراجع» يُنادى بعد ثوانٍ، ولا يقرأ حالةً قديمة. */
  const resumeNow = useRef(resume);
  resumeNow.current = resume;

  /**
   * «ألغِ المعاملة»: تُمحى فورًا — وتبقى ثوانيَ يُتراجع عنها: زرّها ملاصقٌ لـ«علّق» وقد يُنقر بالخطأ (ج٢).
   * و«تراجع» يستأنفها بما استأنفت به المعلّقة: ما في الشبّاك الآن إن كان فيه عملٌ يُعلَّق مكانها فلا يضيع.
   */
  function discardTransaction() {
    const gone = snapshot();
    reset();
    say('أُلغيت المعاملة — لم يُقيَّد شيء', 'ok', {
      label: 'تراجع',
      run: () => {
        dismiss();
        void resumeNow.current(gone.key, [gone]);
      }
    });
  }

  /** × على معاملةٍ معلّقة: تُحذف فورًا وتعود بـ«تراجع» إلى مكانها في الصفّ. */
  function dropParked(p: Parked) {
    const index = parked.findIndex((x) => x.key === p.key);
    setParked((list) => list.filter((x) => x.key !== p.key));
    say(`أُلغيت المعاملة المعلّقة «${p.label}»`, 'ok', {
      label: 'تراجع',
      run: () => {
        dismiss();
        setParked((list) => {
          if (list.some((x) => x.key === p.key)) return list;
          const at = index < 0 ? list.length : Math.min(index, list.length);
          return [...list.slice(0, at), p, ...list.slice(at)];
        });
      }
    });
  }

  // «استأنف» من قيد العمل: القائمة من القاعدة (قد عُلّقت عند الإغلاق بعد أن قُرئت هنا) ثم الاستئناف.
  useEffect(() => {
    if (!resumeRequest) return;
    void window.diwan.service.parked().then((list) => {
      const fresh = list as Parked[];
      setParkedState(fresh);
      void resume(resumeRequest.parkedKey, fresh);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeRequest?.key]);

  // الزبون عائدًا من أداة: يبقى زبون الشبّاك، وحقول ما يختاره بعدُ تُملأ من ملفّه.
  const fillFrom = useRef<number | null>(null);
  useEffect(() => {
    if (!customerRequest) return;
    setCitizenId(customerRequest.citizenId);
    fillFrom.current = customerRequest.citizenId;
    if (step === 'fill' && fields.length) {
      fillFrom.current = null;
      void useCitizen(customerRequest.citizenId);
    } else say('الزبون نفسه — اختر ما يريده بعدُ، وحقوله تُملأ من ملفّه');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerRequest?.key]);
  useEffect(() => {
    if (step !== 'fill' || !fields.length || fillFrom.current === null) return;
    const id = fillFrom.current;
    fillFrom.current = null;
    void useCitizen(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, fields]);

  /**
   * الدمج: معاملةٌ لكل اسم، والدفعة كلّها أو لا شيء.
   *
   * ولكلّ اسمٍ جنسُه من اسمه — وما لم يُعرف يقينًا يُسأل عنه قبل الطباعة (ج٤)، فلا
   * يخرج «الطالب رسل» تخمينًا. و`decided` ما أجاب عنه الموظف للتوّ.
   */
  async function issueMerged(print: boolean, decided: Record<string, Gender> = {}) {
    if (!settings || !nameField) return;
    if (rows.length === 0) {
      say('اكتب أسماء القائمة أولًا — سطرٌ لكل اسم', 'warn');
      return;
    }
    const unsure = needsGender ? unsureNames(rows, learned, decided) : [];
    if (unsure.length > 0) {
      setGenderReview({ names: unsure, print });
      return;
    }
    const pick = print ? await choosePrinter('documents') : null;
    if (print && !pick) return;
    const mode = valuesOnly ? 'values' : 'full';
    setBusy(true);
    try {
      const all = await window.diwan.documents.issueBatch(
        rows.map((name) => {
          const rowValues = { ...values, [nameField.key]: name };
          // ولكلّ اسمٍ في القائمة جنسُه من اسمه: «زينب» طالبةٌ و«أحمد» طالب — وما سُئل عنه بجوابه.
          const g = needsGender ? (decided[name] ?? guessGender(name, learned)?.gender) : undefined;
          if (g) rowValues[GENDER_KEY] = g;
          return {
            ...common(pick?.printer ?? null),
            citizenId: null,
            citizenName: name,
            nationalId: byRole('nationalId') || null,
            sheets: collect(rowValues)
          };
        })
      );
      const papers = all.reduce((n, t) => n + t.documents.length, 0);
      const ids = all.flatMap((t) => t.documents.map((d) => d.id));
      const label = `دمج ${countIn(all.length, 'اسم')} — ${all[0]?.documents[0]?.serial ?? ''}`;
      const n = copies;
      setAfter({
        outcome: { what: `${papersWithCopies(papers, n)} — ${count(all.length, 'اسم')}`, printer: pick?.printer ?? null, serial: all[0]?.documents[0]?.serial ?? '' },
        ids,
        mode,
        label,
        copies: n,
        customer: null
      });
      onIssued?.();
      reset();
      if (pick) await printIssued(ids, pick.printer, mode, label, n);
    } catch (e) {
      sayError(e, 'تعذّر الإصدار');
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
  /**
   * الجنس لم يُعرف يقينًا من الاسم ولم يختره الموظف: يُسأل قبل الطباعة (ج٤) —
   * «ذكرٌ» صامتًا كان يُخرج «الطالب رسل».
   */
  const genderGuess = needsGender && citizenName ? guessGender(citizenName, learned) : null;
  const genderUnsure = !merge && needsGender && !genderByHand && genderGuess !== null && !genderGuess.sure;

  /** ما يمنع الإصدار: حقلٌ إلزامي فارغ، أو جنسٌ لم يُحسم، أو دمجٌ بلا أسماء. */
  const blocked = merge ? rows.length === 0 : missing.length > 0 || genderUnsure;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-screen="service">
      {/* علامة MT خافتةً في الشبّاك (المرحلة ٦) — خلف العمل، لا تُلمس ولا تُطبع. */}
      <img
        alt=""
        aria-hidden
        className="pointer-events-none select-none absolute bottom-6 left-6 w-64 opacity-[0.035] print:hidden"
        data-watermark=""
        src={mark}
      />
      <div className="h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        {/* الخطوات الثلاث */}
        <StepsHeader step={step} picked={picked} />

        <div className="flex-1 min-h-0 overflow-y-auto p-space-lg">
          {/* ١ — اختر */}
          {step === 'pick' && (
            <CounterPick
              after={after}
              setAfter={setAfter}
              reprintAfter={reprintAfter}
              pdfAfter={pdfAfter}
              sameCustomer={sameCustomer}
              settings={settings}
              query={query}
              setQuery={setQuery}
              items={items}
              categories={categories}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              topFavorites={topFavorites}
              shown={shown}
              ordered={ordered}
              picked={picked}
              toggle={toggle}
              searchRef={searchRef}
              citizenId={citizenId}
              onOpenTool={onOpenTool}
              onOpenFile={onOpenFile}
              active={active}
              step={step}
              newCitizen={newCitizen}
              setNewCitizen={setNewCitizen}
              saveNewCitizen={saveNewCitizen}
              parked={parked}
              resume={resume}
              dropParked={dropParked}
            />
          )}

          {/* ٢ — املأ */}
          {step === 'fill' && (
            <CounterFill
              loaded={loaded}
              fields={fields}
              values={values}
              setValues={setValues}
              effective={effective}
              citizenId={citizenId}
              setPicker={setPicker}
              setPasteOpen={setPasteOpen}
              openIdSheet={openIdSheet}
              nameField={nameField}
              merge={merge}
              setMerge={setMerge}
              names={names}
              setNames={setNames}
              rows={rows}
              setMergePicker={setMergePicker}
              printsRegistry={printsRegistry}
              letterNo={letterNo}
              setLetterNo={setLetterNo}
              needsGender={needsGender}
              genderByHand={genderByHand}
              setGenderByHand={setGenderByHand}
              schoolOn={schoolOn}
              setSchoolPicker={setSchoolPicker}
              schoolNameKey={schoolNameKey}
              schools={schools}
              useSchool={useSchool}
              schoolFilled={schoolFilled}
              registry={registry}
              resolveHead={resolveHead}
            />
          )}

          {/* ٣ — راجع */}
          <CounterReview
            step={step}
            typedSpelling={typedSpelling}
            templateSpelling={templateSpelling}
            setValues={setValues}
            merge={merge}
            rows={rows}
            loaded={loaded}
            at={at}
            setAt={setAt}
            current={current}
            sheets={sheets}
            valuesOnly={valuesOnly}
            effective={effective}
            registry={registry}
            resolveHead={resolveHead}
          />
        </div>

        {/* «نسخة عن …» (د٤): والأصل يبقى كما خرج — إلا أن يُختار إبطاله بسببه. */}
        {repeatOf && step !== 'pick' && !merge && <RepeatOfBar repeatOf={repeatOf} setRepeatOf={setRepeatOf} />}

        {/* شريط القرار */}
        <DecisionBar
          step={step}
          setStep={setStep}
          busy={busy}
          picked={picked}
          goFill={goFill}
          setAt={setAt}
          park={park}
          discardTransaction={discardTransaction}
          valuesOnly={valuesOnly}
          setValuesOnly={setValuesOnly}
          merge={merge}
          rows={rows}
          loaded={loaded}
          missing={missing}
          genderUnsure={genderUnsure}
          citizenName={citizenName}
          setGenderByHand={setGenderByHand}
          setValues={setValues}
          settings={settings}
          copies={copies}
          setCopies={setCopies}
          blocked={blocked}
          issue={issue}
        />
      </div>

      {picker && <CitizenPicker onClose={() => setPicker(false)} onPick={(id) => void useCitizen(id)} />}
      {schoolPicker && <SchoolPicker schools={schools} onClose={() => setSchoolPicker(false)} onPick={(s) => useSchool(s)} />}
      {schoolOn && (
        <datalist id="diwan-schools">
          {schools.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      )}

      {mergePicker && (
        <CitizenMultiPicker
          confirmLabel="أضفهم إلى القائمة"
          title="قائمة الدمج من الزبائن — ورقةٌ لكلّ اسم"
          onClose={() => setMergePicker(false)}
          onPick={(ids) => {
            setMergePicker(false);
            void window.diwan.citizens.records(ids).then((records) => {
              const have = new Set(rows);
              const added = records.map((r) => r.fullName.trim()).filter((n) => n && !have.has(n));
              setNames((prev) => [prev.trim(), ...added].filter(Boolean).join('\n'));
              say(`أُضيف من الزبائن ${count(added.length, 'اسم')}`);
            });
          }}
        />
      )}

      {genderReview && (
        <GenderReview
          learned={learned}
          names={genderReview.names}
          onCancel={() => setGenderReview(null)}
          onDone={(decisions) => {
            const print = genderReview.print;
            setGenderReview(null);
            remember(Object.entries(decisions).map(([name, gender]) => ({ name, gender })));
            void issueMerged(print, decisions);
          }}
        />
      )}

      <WhatsAppPasteDialog
        isOpen={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onApply={(extracted) => {
          const filled = valuesFromMessage(fields, extracted, values);
          const n = Object.keys(filled).length;
          setValues((prev) => ({ ...prev, ...filled }));
          setPasteOpen(false);
          say(n ? `مُلئ من الرسالة ${count(n, 'حقل')} — راجعها قبل الطباعة` : 'لم يطابق شيءٌ من الرسالة حقول هذه الأوراق', n ? 'ok' : 'warn');
        }}
      />

      {idSheet && <IdSheetDialog citizenName={idSheet.name} attachments={idSheet.attachments} onClose={() => setIdSheet(null)} />}

      {printRun && <PrintRunBar printRun={printRun} resumePrint={resumePrint} dropPrint={dropPrint} />}

      {toast && <CounterToast toast={toast} dismiss={dismiss} />}
    </main>
  );
}
