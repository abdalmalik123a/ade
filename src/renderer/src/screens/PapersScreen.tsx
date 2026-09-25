/**
 * الأسئلة — قسمٌ قائمٌ بذاته، لا فرعٌ من مكتبة الكتب.
 *
 * ورقة الامتحان لا تُبنى كما يُبنى الكتاب: لا كليشة ولا شبّاك ولا رقم صادر،
 * ولا محرّرَ كتلٍ يُدرج فيه المدرّس فقرةً ثم يبحث عن مكانها. فالرأس هنا **ثابت**
 * لا يُحرَّر — تُملأ متغيّراته في خانات، والثابت يبقى ثابتًا. والمتنُ يُركَّب على
 * الترتيب الذي يكتب به المدرّس فعلًا:
 *
 *     سؤالٌ ← درجتُه ← نصُّه ← [+ فرع] ← سؤالٌ ثانٍ ← ...
 *
 * والترقيم يُحسب عند الرسم لا يُكتب، فحذفُ سؤالٍ يعيد ترقيم ما بعده وحده —
 * وهذا أكثر ما يكسر ورقة Word عند كل تعديل.
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
import type { PrinterInfo, TemplateSummary } from '@shared/api';
import {
  itemScore,
  listScore,
  run,
  type Dir,
  type Inline,
  type ListItem,
  type Numerals
} from '@shared/doc';
import { marker, renderDocHtml } from '@shared/docHtml';
import {
  EXAM_CATEGORY,
  EXAM_STYLES,
  HEAD_INPUTS,
  MAX_DEPTH,
  emptyHead,
  examDoc,
  examList,
  headOf,
  newQuestion,
  paperTitle,
  questionsOf
} from '@shared/examPaper';
import { errorText } from '../lib/errors';

/** رموزُ المواد: رياضياتٌ وفيزياءُ وكيمياء — تُدرج عند المؤشّر. */
const SYMBOLS = [
  '√',
  '∑',
  '∫',
  '≤',
  '≥',
  '≠',
  '±',
  '×',
  '÷',
  '°',
  '∞',
  'π',
  '⁰',
  '¹',
  '²',
  '³',
  '₁',
  '₂',
  '₃',
  '→',
  '⇌',
  'Δ',
  'λ',
  'μ',
  'Ω',
  '½',
  '¼',
  '¾'
];

const SHEET_WIDTH = 794;

type Toast = { text: string; tone: 'ok' | 'warn' } | null;

// ── شجرة الأسئلة: تحويلاتٌ خالصة ─────────────────────────────────────

function mapTree(items: ListItem[], id: string, fn: (it: ListItem) => ListItem | null): ListItem[] {
  return items.flatMap((it) => {
    if (it.id === id) {
      const next = fn(it);
      return next ? [next] : [];
    }
    if (!it.items?.length) return [it];
    return [{ ...it, items: mapTree(it.items, id, fn) }];
  });
}

/** يزيح عنصرًا بين إخوته — ولا يقفز بين المستويات. */
function moveIn(items: ListItem[], id: string, step: -1 | 1): ListItem[] {
  const at = items.findIndex((it) => it.id === id);
  if (at >= 0) {
    const to = at + step;
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(at, 1);
    next.splice(to, 0, moved!);
    return next;
  }
  return items.map((it) => (it.items?.length ? { ...it, items: moveIn(it.items, id, step) } : it));
}

const textOf = (inlines: Inline[]): string =>
  inlines.map((n) => (n.kind === 'run' ? n.text : n.kind === 'break' ? '\n' : '')).join('');

const inlinesOf = (text: string): Inline[] =>
  text
    .split('\n')
    .flatMap((line, i): Inline[] => (i ? [{ kind: 'break' }, run(line)] : [run(line)]))
    .filter((n) => n.kind !== 'run' || n.text.length > 0);

/** كل عنصرٍ في الشجرة — لعدّ الأسئلة والتحقّق من نصوصها. */
function flatten(items: ListItem[]): ListItem[] {
  return items.flatMap((it) => [it, ...(it.items?.length ? flatten(it.items) : [])]);
}

// ── السؤال الواحد ────────────────────────────────────────────────────

type NodeProps = {
  item: ListItem;
  index: number;
  depth: number;
  numerals: Numerals;
  answers: boolean;
  dir: Dir;
  onPatch: (id: string, patch: Partial<ListItem>) => void;
  onBranch: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, step: -1 | 1) => void;
  onFocusInput: (el: HTMLTextAreaElement | HTMLInputElement) => void;
};

const NUM_INPUT =
  'w-16 h-8 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular font-label-md text-label-md text-on-surface';
const ICON_BTN =
  'w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors flex items-center justify-center';

function QuestionNode(props: NodeProps) {
  const { item, index, depth, numerals, answers, dir, onPatch } = props;
  const kids = item.items ?? [];
  const style = EXAM_STYLES[Math.min(depth, EXAM_STYLES.length - 1)] ?? 'number';
  const head = marker(style, index, numerals);
  const computed = itemScore(item);
  const canBranch = depth + 1 < MAX_DEPTH;

  return (
    <div
      className={`rounded-xl border border-outline-variant bg-surface-container-lowest p-space-sm space-y-space-xs ${
        depth ? 'mr-space-lg' : ''
      }`}
      data-question={depth === 0 ? 'root' : 'branch'}
    >
      {/* الترتيب كما يكتبه المدرّس: العلامة، ثم الدرجة، ثم النصّ. */}
      <div className="flex items-center gap-space-sm">
        <span className="min-w-12 font-label-lg text-label-lg font-bold text-primary tabular">
          {head}
        </span>

        <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
          الدرجة
          <input
            className={NUM_INPUT}
            inputMode="numeric"
            title="درجة السؤال"
            value={item.score ?? ''}
            placeholder={kids.length ? String(computed) : '—'}
            onFocus={(e) => props.onFocusInput(e.currentTarget)}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, '');
              onPatch(item.id, { score: raw === '' ? undefined : Number(raw) });
            }}
          />
        </label>

        {kids.length > 1 && (
          <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
            أجب عن
            <input
              className={NUM_INPUT}
              inputMode="numeric"
              title="أجب عن ن من فروعه فقط"
              value={item.pick ?? ''}
              placeholder="الكل"
              onFocus={(e) => props.onFocusInput(e.currentTarget)}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, '');
                onPatch(item.id, {
                  pick: raw === '' ? undefined : Number(raw)
                });
              }}
            />
            من فروعه
          </label>
        )}

        <div className="flex-1" />

        <button
          className={ICON_BTN}
          title="ارفع"
          type="button"
          onClick={() => props.onMove(item.id, -1)}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
        </button>
        <button
          className={ICON_BTN}
          title="أنزل"
          type="button"
          onClick={() => props.onMove(item.id, 1)}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
        </button>
        <button
          className={ICON_BTN}
          title="احذف"
          type="button"
          onClick={() => props.onRemove(item.id)}
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>

      <textarea
        className="w-full min-h-[44px] px-space-sm py-1.5 rounded-lg bg-surface-container-low border border-outline-variant font-body-md text-body-md text-on-surface resize-y"
        dir={dir}
        data-question-text={item.id}
        placeholder={depth === 0 ? 'نصّ السؤال' : 'نصّ الفرع'}
        value={textOf(item.inlines)}
        rows={1}
        onFocus={(e) => props.onFocusInput(e.currentTarget)}
        onChange={(e) => onPatch(item.id, { inlines: inlinesOf(e.target.value) })}
      />

      {answers && (
        <input
          className="w-full h-9 px-space-sm rounded-lg bg-surface-container-low border border-dashed border-outline-variant font-body-sm text-body-sm text-on-surface"
          dir={dir}
          data-answer={item.id}
          placeholder="الإجابة النموذجية — تظهر في ورقة المصحّح وحدها"
          value={textOf(item.answer ?? [])}
          onFocus={(e) => props.onFocusInput(e.currentTarget)}
          onChange={(e) => {
            const text = e.target.value;
            onPatch(item.id, { answer: text ? inlinesOf(text) : undefined });
          }}
        />
      )}

      {kids.length > 0 && (
        <div className="space-y-space-xs pt-space-xs">
          {kids.map((kid, i) => (
            <QuestionNode {...props} key={kid.id} item={kid} index={i} depth={depth + 1} />
          ))}
        </div>
      )}

      {canBranch && (
        <button
          className="h-8 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1 transition-colors"
          title="أضف فرعًا"
          type="button"
          onClick={() => props.onBranch(item.id)}
        >
          <span className="material-symbols-outlined text-[16px]">subdirectory_arrow_left</span>
          <span>أضف فرعًا</span>
        </button>
      )}
    </div>
  );
}

// ── الشاشة ───────────────────────────────────────────────────────────

export type PapersScreenProps = {
  printer: PrinterInfo | null;
  onChanged?: () => void;
};

/**
 * ما يناديه الشريط العلوي.
 *
 * أزراره كانت تقفز بالمدرّس إلى محرّر الكتب — يضغط «طباعة» فيجد نفسه في كتابٍ
 * رسمي. فالشاشة تُعرِّف ما تفعله بنفسها، والشريط ينادي المعروض.
 */
export type PapersHandle = {
  print: () => void;
  save: () => void;
  exportPdf: () => void;
};

function PapersScreenInner(
  { printer, onChanged }: PapersScreenProps,
  ref: React.Ref<PapersHandle>
) {
  const [head, setHead] = useState<Record<string, string>>(emptyHead);
  const [items, setItems] = useState<ListItem[]>(() => [newQuestion()]);
  const [pick, setPick] = useState<number | undefined>(undefined);
  const [dir, setDir] = useState<Dir>('rtl');
  const [numerals, setNumerals] = useState<Numerals>('arabic');
  const [answers, setAnswers] = useState(false);
  const [copies, setCopies] = useState(30);
  const [paperId, setPaperId] = useState<number | null>(null);
  const [papers, setPapers] = useState<TemplateSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [zoom, setZoom] = useState(0.68);

  const sheetRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const focused = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const toastTimer = useRef<number | null>(null);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadPapers = useCallback(async () => {
    try {
      setPapers(await window.diwan.templates.list(null, 'print-only'));
    } catch {
      setPapers([]);
    }
  }, []);

  useEffect(() => {
    void loadPapers();
  }, [loadPapers]);

  useEffect(() => {
    const fit = () => {
      const desk = deskRef.current;
      if (desk) setZoom(Math.min(1, Math.max(0.4, (desk.clientWidth - 48) / SHEET_WIDTH)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // ── الورقة: مشتقّةٌ من القيم والأسئلة، لا محرَّرةٌ كتلةً كتلة ────────
  const doc = useMemo(() => {
    const list = examList(items, dir);
    if (pick) list.pick = pick;
    const built = examDoc(head, list);
    built.pageSetup = { ...built.pageSetup, numerals };
    return built;
  }, [head, items, pick, dir, numerals]);

  const html = useMemo(
    () =>
      renderDocHtml(doc, head, {
        missing: 'blank',
        paragraphs: 'blocks',
        answers: answers ? 'show' : 'hide',
        numerals
      }),
    [doc, head, answers, numerals]
  );

  const total = useMemo(() => {
    const list = questionsOf(doc);
    return list ? listScore(list) : 0;
  }, [doc]);

  const written = useMemo(() => flatten(items).filter((it) => textOf(it.inlines).trim()), [items]);
  const title = paperTitle(head);

  // ── تحريرُ الشجرة ──────────────────────────────────────────────────
  const patchItem = useCallback((id: string, patch: Partial<ListItem>) => {
    setItems((prev) => mapTree(prev, id, (it) => ({ ...it, ...patch })));
  }, []);

  const branch = useCallback((id: string) => {
    setItems((prev) =>
      mapTree(prev, id, (it) => ({
        ...it,
        items: [...(it.items ?? []), newQuestion()]
      }))
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = mapTree(prev, id, () => null);
      // لا تبقى ورقةٌ بلا سؤال — وإلا اختفى المؤلِّف ولا سبيل إلى إعادته.
      return next.length ? next : [newQuestion()];
    });
  }, []);

  const move = useCallback((id: string, step: -1 | 1) => {
    setItems((prev) => moveIn(prev, id, step));
  }, []);

  const addQuestion = useCallback(() => {
    const fresh = newQuestion();
    setItems((prev) => [...prev, fresh]);
    window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>(`[data-question-text="${fresh.id}"]`)?.focus();
    }, 0);
  }, []);

  /** الرمز يُدرج عند المؤشّر في آخر خانةٍ لمسها المدرّس — لا في آخر السطر. */
  const insertSymbol = useCallback(
    (sym: string) => {
      const el = focused.current;
      if (!el) {
        say('المس خانة السؤال أولًا ثم اختر الرمز', 'warn');
        return;
      }
      const at = el.selectionStart ?? el.value.length;
      const to = el.selectionEnd ?? at;
      const setter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(el, el.value.slice(0, at) + sym + el.value.slice(to));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.focus();
      el.selectionStart = el.selectionEnd = at + sym.length;
    },
    [say]
  );

  // ── الحفظ والطباعة ─────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!written.length) {
      say('اكتب نصّ سؤالٍ واحدٍ على الأقل قبل الحفظ', 'warn');
      return;
    }
    setBusy(true);
    try {
      const saved = await window.diwan.templates.save({
        id: paperId,
        code: null,
        title,
        subtitle: head['المدرسة']?.trim() || null,
        category: EXAM_CATEGORY,
        subjectLine: null,
        bodyHtml: written.map((it) => textOf(it.inlines)).join('\n'),
        letterheadId: null,
        variables: [],
        doc
      });
      setPaperId(saved.id);
      await loadPapers();
      onChanged?.();
      say('حُفظت الورقة في قسم الأسئلة');
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ الورقة'), 'warn');
    } finally {
      setBusy(false);
    }
  }, [written, paperId, title, head, doc, loadPapers, onChanged, say]);

  const print = useCallback(async () => {
    const node = sheetRef.current?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return;
    node.style.transform = '';
    setBusy(true);
    try {
      // بلا إصدار: لا رقم صادر ولا بصمة. ثلاثون نسخةً لا تحرق ثلاثين رقمًا.
      const out = await window.diwan.output.print({
        sheetHtml: node.outerHTML,
        printer: printer?.name ?? null,
        copies: Math.max(1, copies),
        silent: false
      });
      say(
        out.ok ? `أُرسلت ${copies} نسخة إلى الطابعة` : out.reason || 'لم تتم الطباعة',
        out.ok ? 'ok' : 'warn'
      );
    } catch (e) {
      say(errorText(e, 'تعذّرت الطباعة'), 'warn');
    } finally {
      setBusy(false);
    }
  }, [printer, copies, say]);

  const exportPdf = useCallback(async () => {
    const node = sheetRef.current?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return;
    node.style.transform = '';
    try {
      const path = await window.diwan.output.savePdf({
        sheetHtml: node.outerHTML,
        suggestedName: title
      });
      if (path) say('حُفظت نسخة PDF');
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ PDF'), 'warn');
    }
  }, [title, say]);

  const openPaper = useCallback(
    async (id: number) => {
      try {
        const loaded = await window.diwan.templates.doc(id);
        const list = questionsOf(loaded);
        setHead(headOf(loaded));
        setItems(list?.items.length ? list.items : [newQuestion()]);
        setPick(list?.pick);
        setDir(list?.dir === 'ltr' ? 'ltr' : 'rtl');
        setNumerals(loaded.pageSetup.numerals);
        setPaperId(id);
        say('فُتحت الورقة');
      } catch (e) {
        say(errorText(e, 'تعذّر فتح الورقة'), 'warn');
      }
    },
    [say]
  );

  const fresh = useCallback(() => {
    setHead(emptyHead());
    setItems([newQuestion()]);
    setPick(undefined);
    setPaperId(null);
    say('ورقة جديدة');
  }, [say]);

  useImperativeHandle(
    ref,
    () => ({
      print: () => void print(),
      save: () => void save(),
      exportPdf: () => void exportPdf()
    }),
    [print, save, exportPdf]
  );

  const margins = doc.pageSetup.margins;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ── المؤلِّف ─────────────────────────────────────────────── */}
        <section className="w-[620px] shrink-0 overflow-auto border-l border-outline-variant bg-surface-container-low p-space-lg space-y-space-lg">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                الأسئلة
              </h1>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                ورقةٌ تُطبع ولا تُقيَّد — لا رقم صادر ولا بصمة
              </p>
            </div>
            <button
              className="h-9 px-space-md rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5"
              type="button"
              onClick={fresh}
            >
              <span className="material-symbols-outlined text-[18px]">note_add</span>
              ورقة جديدة
            </button>
          </header>

          {/* ── الرأس الثابت ──────────────────────────────────────── */}
          <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-primary text-[20px]">lock</span>
                <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
                  الرأس ثابت (تعبئة تلقائية)
                </h2>
              </div>
            </div>
            {/* نماذج سريعة لتعبئة ترويسة الامتحان */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[
                {
                  label: 'نصف السنة',
                  data: { 'نوع الامتحان': 'نصف السنة', 'الدور': '', 'الملاحظة': 'أجب عن 5 أسئلة فقط (لكل سؤال 20 درجة)' }
                },
                {
                  label: 'نهائي — الدور الأول',
                  data: { 'نوع الامتحان': 'النهائي (الدور الأول)', 'الدور': 'الأول', 'الملاحظة': 'أجب عن جميع الأسئلة' }
                },
                {
                  label: 'امتحان شهري',
                  data: { 'نوع الامتحان': 'الشهر الأول', 'الدور': '', 'الملاحظة': 'الزمن ساعة واحدة' }
                }
              ].map((preset) => (
                <button
                  key={preset.label}
                  className="h-7 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-on-surface font-label-sm text-label-sm shrink-0 transition-colors"
                  type="button"
                  onClick={() => setHead((h) => ({ ...h, ...preset.data }))}
                >
                  ⚡ {preset.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-space-sm">
              {HEAD_INPUTS.map((input) => (
                <label
                  key={input.key}
                  className={`flex flex-col gap-1 ${input.key === 'الملاحظة' ? 'col-span-2' : ''}`}
                >
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {input.label}
                  </span>
                  <input
                    className="h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-body-sm text-body-sm text-on-surface"
                    data-head={input.key}
                    placeholder={input.hint}
                    value={head[input.key] ?? ''}
                    onFocus={(e) => (focused.current = e.currentTarget)}
                    onChange={(e) => setHead((h) => ({ ...h, [input.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* ── المتن ─────────────────────────────────────────────── */}
          <div className="space-y-space-sm">
            {/* ضبطُ المتن حيث يُكتب المتن — لا في شريط المعاينة. */}
            <div className="flex items-center gap-space-sm flex-wrap">
              <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">الأسئلة</h2>
              <div className="flex-1" />
              <select
                className="h-8 px-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant font-label-sm text-label-sm text-on-surface"
                title="أرقام الترقيم"
                value={numerals}
                onChange={(e) => setNumerals(e.target.value as Numerals)}
              >
                <option value="arabic">1 2 3</option>
                <option value="indic">١ ٢ ٣</option>
              </select>
              <select
                className="h-8 px-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant font-label-sm text-label-sm text-on-surface"
                title="اتجاه المتن"
                value={dir}
                onChange={(e) => setDir(e.target.value as Dir)}
              >
                <option value="rtl">من اليمين</option>
                <option value="ltr">من اليسار</option>
              </select>
              <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
                أجب عن
                <input
                  className={NUM_INPUT}
                  inputMode="numeric"
                  title="أجب عن ن أسئلة فقط"
                  value={pick ?? ''}
                  placeholder="الكل"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, '');
                    setPick(raw === '' ? undefined : Number(raw));
                  }}
                />
                أسئلة فقط
              </label>
            </div>

            <div className="space-y-space-sm">
              {items.map((item, i) => (
                <QuestionNode
                  key={item.id}
                  item={item}
                  index={i}
                  depth={0}
                  dir={dir}
                  numerals={numerals}
                  answers={answers}
                  onPatch={patchItem}
                  onBranch={branch}
                  onRemove={remove}
                  onMove={move}
                  onFocusInput={(el) => (focused.current = el)}
                />
              ))}
            </div>

            <button
              className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-1.5 shadow-md"
              type="button"
              onClick={addQuestion}
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              أضف سؤالًا
            </button>
          </div>

          {/* ── الرموز ────────────────────────────────────────────── */}
          <div className="rounded-xl bg-surface-container-lowest p-space-sm">
            <div className="font-label-sm text-label-sm text-on-surface-variant mb-space-xs">
              رموزُ المواد — تُدرج عند المؤشّر
            </div>
            <div className="flex flex-wrap gap-1">
              {SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  className="w-8 h-8 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface font-body-md text-body-md"
                  title={`أدرج ${sym}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertSymbol(sym)}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          {/* ── الأوراق المحفوظة ──────────────────────────────────── */}
          {papers.length > 0 && (
            <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-xs">
              <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
                أوراقٌ محفوظة ({papers.length})
              </h2>
              {papers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg px-space-sm py-1.5 hover:bg-surface-container-high"
                >
                  <button
                    className="text-right flex-1 font-body-sm text-body-sm text-on-surface"
                    type="button"
                    onClick={() => void openPaper(p.id)}
                  >
                    {p.title}
                    {p.subtitle && <span className="text-on-surface-variant"> — {p.subtitle}</span>}
                  </button>
                  <button
                    className={ICON_BTN}
                    title="احذف الورقة"
                    type="button"
                    onClick={async () => {
                      await window.diwan.templates.delete(p.id);
                      if (paperId === p.id) setPaperId(null);
                      await loadPapers();
                      onChanged?.();
                      say('حُذفت الورقة');
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── المعاينة ─────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col min-w-0">
          <div className="h-14 px-space-lg flex items-center gap-space-sm border-b border-outline-variant bg-surface-container-lowest overflow-x-auto">
            <span
              className={`px-space-sm py-0.5 rounded-full font-label-sm text-label-sm font-bold shrink-0 whitespace-nowrap ${
                total === 100
                  ? 'bg-secondary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
              data-total
            >
              المجموع {total}
              {total !== 100 && ' — لم يبلغ المئة'}
            </span>

            <div className="flex-1" />
            <div className="flex items-center gap-space-sm shrink-0">
              <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
                <input
                  checked={answers}
                  type="checkbox"
                  onChange={(e) => setAnswers(e.target.checked)}
                />
                ورقة المصحّح
              </label>

              <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
                نسخ
                <input
                  className={NUM_INPUT}
                  inputMode="numeric"
                  title="عدد النسخ"
                  value={copies}
                  onChange={(e) => setCopies(Number(e.target.value.replace(/[^\d]/g, '')) || 1)}
                />
              </label>

              <button
                className="h-9 px-space-md rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
                data-act="save"
                title="احفظ ورقة الأسئلة"
                type="button"
                disabled={busy}
                onClick={() => void save()}
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                حفظ
              </button>
              <button
                className="h-9 px-space-md rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5"
                data-act="pdf"
                title="احفظ نسخة PDF"
                type="button"
                onClick={() => void exportPdf()}
              >
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                PDF
              </button>
              <button
                className="h-9 px-space-md rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-md disabled:opacity-50"
                data-act="print"
                title="اطبع الورقة بعدد النسخ — بلا إصدار"
                type="button"
                disabled={busy}
                onClick={() => void print()}
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                اطبع
              </button>
            </div>
          </div>

          <div
            ref={deskRef}
            className="flex-1 overflow-auto flex flex-col items-center py-space-lg"
          >
            <div
              ref={sheetRef}
              className="a4-sheet print-sheet bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] shrink-0"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center'
              }}
            >
              <div
                className="text-black font-body-md text-body-md leading-relaxed"
                dir={dir}
                data-paper
                dangerouslySetInnerHTML={{ __html: html }}
                style={{
                  padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`
                }}
              />
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${
            toast.tone === 'ok' ? 'bg-secondary text-on-primary' : 'bg-error text-on-error'
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

const PapersScreen = forwardRef(PapersScreenInner);
export default PapersScreen;
