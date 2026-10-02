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
import type { TemplateSummary } from '@shared/api';
import {
  itemScore,
  listScore,
  newUuid,
  run,
  type Dir,
  type Inline,
  type ListItem,
  type Numerals
} from '@shared/doc';
import { marker, renderDocHtml } from '@shared/docHtml';
import { secondRound } from '@shared/examAnalysis';
import {
  EXAM_CATEGORY,
  EXAM_PRESETS,
  EXAM_STYLES,
  HEAD_INPUTS,
  MAX_DEPTH,
  emptyHead,
  examDoc,
  examList,
  headOf,
  newQuestion,
  paperTitle,
  questionsOf,
  VERSION_KEY,
  versionItems
} from '@shared/examPaper';
import { errorText } from '../lib/errors';
import { choosePrinter } from '../lib/printChoice';
import QuestionBankPanel from '../components/QuestionBankPanel';
import SymbolPalette from '../components/SymbolPalette';
import OmrPanel from '../components/OmrPanel';
import type { OmrSpec } from '@shared/omr';

const newOmr = (): OmrSpec => ({ questions: 20, choices: 4, idDigits: 3, key: [] });

/** رموزُ المواد: رياضياتٌ وفيزياءُ وكيمياء — تُدرج عند المؤشّر. */

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
  /** يحفظ السؤال (بفروعه) في بنك الأسئلة — للأسئلة الأمّ وحدها. */
  onBank?: (item: ListItem) => void;
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

        {depth === 0 && props.onBank && (
          <button
            className={ICON_BTN}
            data-act="bank-save"
            title="احفظه في بنك الأسئلة — بفروعه ودرجته"
            type="button"
            onClick={() => props.onBank!(item)}
          >
            <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
          </button>
        )}
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

/**
 * «الدور الثاني» من البنك (د٩): الأسئلة نفسها عددًا ودرجاتٍ، من البنك في مادّتها وصفّها،
 * لا من الدور الأول. وتُفتح ورقةً جديدة غير محفوظة — فلا تُكتب فوق ورقة الدور الأول.
 */
export function roundTwoHead(head: Record<string, string>): Record<string, string> {
  return { ...head, الدور: 'الثاني' };
}

/** نسخةٌ من سؤال البنك بمعرّفاتٍ جديدة — فلا تشترك ورقتان في عقدةٍ واحدة. */
function freshCopy(item: ListItem): ListItem {
  return {
    ...item,
    id: newUuid(),
    inlines: item.inlines.map((n) => (n.kind === 'field' ? { ...n, id: newUuid() } : n)),
    items: item.items?.map(freshCopy)
  };
}

// ── الشاشة ───────────────────────────────────────────────────────────

export type PapersScreenProps = {
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
  { onChanged }: PapersScreenProps,
  ref: React.Ref<PapersHandle>
) {
  const [head, setHead] = useState<Record<string, string>>(emptyHead);
  const [items, setItems] = useState<ListItem[]>(() => [newQuestion()]);
  const [pick, setPick] = useState<number | undefined>(undefined);
  const [dir, setDir] = useState<Dir>('rtl');
  const [numerals, setNumerals] = useState<Numerals>('arabic');
  const [answers, setAnswers] = useState(false);
  const [copies, setCopies] = useState(30);
  /** نموذجان «أ» و«ب»: الفروع بترتيبين، والنسخ تتناوب — فلا ينقل الطالب عن جاره. */
  const [versions, setVersions] = useState(false);
  const [showB, setShowB] = useState(false);
  const [paperId, setPaperId] = useState<number | null>(null);
  const [omr, setOmr] = useState<OmrSpec>(newOmr);
  const [omrOpen, setOmrOpen] = useState(false);
  /** يزيد مع كل ورقةٍ تُفتح أو تُبدأ — فتُبنى لوحة الدوائر من مفتاح الورقة الجديدة. */
  const [omrEpoch, setOmrEpoch] = useState(0);
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
    } catch (e) {
      // قائمةٌ فارغةٌ بلا خبر تُقرأ «لا أوراق محفوظة» — والقاعدة هي التي تعذّرت.
      setPapers([]);
      say(errorText(e, 'تعذّر تحميل الأوراق المحفوظة'), 'warn');
    }
  }, [say]);

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
  const build = useCallback(
    (list: ListItem[]) => {
      const body = examList(list, dir);
      if (pick) body.pick = pick;
      const built = examDoc(head, body);
      built.pageSetup = { ...built.pageSetup, numerals };
      return built;
    },
    [head, pick, dir, numerals]
  );
  const doc = useMemo(() => build(items), [build, items]);

  /** الورقة بنموذجها: «أ» الأسئلة كما كُتبت، و«ب» بفروعٍ مخلوطة. */
  const renderVersion = useCallback(
    (version: string | null) =>
      renderDocHtml(
        version === 'ب' ? build(versionItems(items)) : doc,
        version ? { ...head, [VERSION_KEY]: version } : head,
        {
          missing: 'blank',
          paragraphs: 'blocks',
          answers: answers ? 'show' : 'hide',
          numerals
        }
      ),
    [build, items, doc, head, answers, numerals]
  );

  const html = useMemo(
    () => renderVersion(versions ? (showB ? 'ب' : 'أ') : null),
    [renderVersion, versions, showB]
  );

  /** ورقةٌ بنموذجها — نسخةٌ من ورقة المعاينة، ومتنها النموذج المطلوب. */
  const versionPage = useCallback(
    (node: HTMLElement, version: string) => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.style.breakAfter = 'page';
      const body = clone.querySelector('[data-paper]');
      if (body) body.innerHTML = renderVersion(version);
      return clone.outerHTML;
    },
    [renderVersion]
  );

  /**
   * أوراق الطباعة: ورقةٌ واحدة بعدد النسخ، أو «أ» و«ب» بالتناوب — أ، ب، أ، ب —
   * فيجلس كل طالبٍ بين جارين بنموذجٍ غير نموذجه.
   */
  const sheetsFor = useCallback((): { html: string; copies: number } | null => {
    const node = sheetRef.current?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return null;
    node.style.transform = '';
    if (!versions) return { html: node.outerHTML, copies: Math.max(1, copies) };
    const a = versionPage(node, 'أ');
    const b = versionPage(node, 'ب');
    return { html: Array.from({ length: Math.max(1, copies) }, (_, i) => (i % 2 ? b : a)).join(''), copies: 1 };
  }, [versions, copies, versionPage]);

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

  /** بنك الأسئلة: يُحفظ السؤال بمادة الورقة وصفّها، ويُدرج منه بنسخةٍ جديدة. */
  const [bankOpen, setBankOpen] = useState(false);
  const [bankTick, setBankTick] = useState(0);
  const saveToBank = useCallback(
    (item: ListItem) => {
      void window.diwan.bank
        .save({ item, subject: head['المادة'] || null, grade: head['الصف'] || null })
        .then(() => {
          setBankTick((t) => t + 1);
          say(`حُفظ في بنك الأسئلة${head['المادة'] ? ` — ${head['المادة']}` : ''}`);
        })
        .catch((e: unknown) => say(e instanceof Error ? e.message : 'تعذّر الحفظ في البنك', 'warn'));
    },
    [head, say]
  );

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
        // مفتاح الدوائر يُحفظ مع الورقة ولا يغيّر صورتها.
        doc: omr.key.length ? { ...doc, meta: { ...doc.meta, omr } } : doc
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
  }, [written, paperId, title, head, doc, omr, loadPapers, onChanged, say]);

  const print = useCallback(async () => {
    const sheets = sheetsFor();
    if (!sheets) return;
    const pick = await choosePrinter('papers', { allowSystem: true });
    if (!pick) return;
    setBusy(true);
    try {
      // بلا إصدار: لا رقم صادر ولا بصمة. ثلاثون نسخةً لا تحرق ثلاثين رقمًا.
      const out = await window.diwan.output.print({
        sheetHtml: sheets.html,
        printer: pick.printer,
        copies: sheets.copies,
        silent: !pick.system
      });
      say(
        out.ok
          ? versions
            ? `أُرسلت ${copies} نسخة: «أ» و«ب» بالتناوب`
            : `أُرسلت ${copies} نسخة إلى الطابعة`
          : out.reason || 'لم تتم الطباعة',
        out.ok ? 'ok' : 'warn'
      );
    } catch (e) {
      say(errorText(e, 'تعذّرت الطباعة'), 'warn');
    } finally {
      setBusy(false);
    }
  }, [copies, versions, sheetsFor, say]);

  const exportPdf = useCallback(async () => {
    // PDF النموذجين ورقتان: «أ» ثم «ب» — للمدرّس يطبع منه ما شاء.
    const node = sheetRef.current?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return;
    node.style.transform = '';
    const html = versions ? versionPage(node, 'أ') + versionPage(node, 'ب') : node.outerHTML;
    try {
      const path = await window.diwan.output.savePdf({
        sheetHtml: html,
        suggestedName: versions ? `${title} — نموذجان` : title
      });
      if (path) say('حُفظت نسخة PDF');
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ PDF'), 'warn');
    }
  }, [title, versions, versionPage, say]);

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
        setOmr(loaded.meta.omr ?? newOmr());
        setOmrEpoch((n) => n + 1);
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
    setOmr(newOmr());
    setOmrEpoch((n) => n + 1);
    setPaperId(null);
    say('ورقة جديدة');
  }, [say]);

  /** «الدور الثاني» من البنك (د٩) — ورقةٌ جديدة لا تُكتب فوق الأولى. */
  async function secondRoundPaper() {
    const bank = await window.diwan.bank.list({ subject: head['المادة'] || null, grade: head['الصف'] || null });
    const { picks, missing } = secondRound(items, bank);
    if (!picks.length) {
      say('لا أسئلة في البنك لهذه المادة والصفّ غير أسئلة هذه الورقة — احفظ أسئلةً في البنك أولًا', 'warn');
      return;
    }
    setItems(picks.map((p) => freshCopy(p.item)));
    setHead((h) => roundTwoHead(h));
    setPaperId(null);
    for (const p of picks) void window.diwan.bank.used(p.id);
    say(
      missing.length
        ? `ورقة الدور الثاني: ${picks.length} سؤالًا من البنك — ولم يُوجد بديلٌ للسؤال ${missing.join('، ')}؛ أكمله بيدك`
        : `ورقة الدور الثاني: ${picks.length} سؤالًا من البنك بدرجاتها — احفظها باسمها`,
      missing.length ? 'warn' : 'ok'
    );
  }

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
        {/* يضيق على الشاشات الصغيرة فتبقى للمعاينة وأزرارها مساحة (خطة Production، ٣٫١). */}
        <section className="w-[clamp(440px,45%,620px)] shrink-0 overflow-auto border-l border-outline-variant bg-surface-container-low p-space-lg space-y-space-lg">
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
            {/* نماذج وزارية سريعة لتعبئة ترويسة الامتحان */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {EXAM_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="h-7 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-on-surface font-label-sm text-label-sm shrink-0 transition-colors flex items-center gap-1 shadow-sm"
                  type="button"
                  title={preset.description}
                  onClick={() => {
                    setHead((h) => {
                      const next = { ...h };
                      for (const [k, v] of Object.entries(preset.head)) {
                        if (v !== undefined) next[k] = v;
                      }
                      return next;
                    });
                  }}
                >
                  <span className="text-secondary font-bold">⚡ {preset.name}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-space-sm">
              {HEAD_INPUTS.map((input) => (
                <label
                  key={input.key}
                  className={`flex flex-col gap-1 ${
                    input.key === 'الملاحظة' || input.key === 'التمنيات' ? 'col-span-2' : ''
                  }`}
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
                  onBank={saveToBank}
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
            <button
              className="w-full h-10 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5"
              data-act="bank-open"
              type="button"
              onClick={() => setBankOpen((o) => !o)}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">inventory_2</span>
              {bankOpen ? 'أخفِ بنك الأسئلة' : 'أدرج من بنك الأسئلة'}
            </button>
            {bankOpen && (
              <QuestionBankPanel
                grade={head['الصف'] ?? ''}
                refreshKey={bankTick}
                subject={head['المادة'] ?? ''}
                onClose={() => setBankOpen(false)}
                onInsert={(q) => {
                  const fresh = freshCopy(q.item);
                  // ورقةٌ فيها سؤالٌ واحد فارغ (البداية): يحلّ المُدرَج محلّه.
                  setItems((prev) => (prev.length === 1 && !textOf(prev[0]!.inlines).trim() && !prev[0]!.items?.length ? [fresh] : [...prev, fresh]));
                  void window.diwan.bank.used(q.id);
                  say('أُدرج السؤال في آخر الورقة');
                }}
              />
            )}
            <button
              className="w-full h-10 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5"
              data-act="second-round"
              title="ورقةٌ بالبنية نفسها من أسئلة البنك التي لم تُطبع في هذا الدور"
              type="button"
              onClick={() => void secondRoundPaper()}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">autorenew</span>
              ورقة الدور الثاني من البنك
            </button>
            <button
              className="w-full h-10 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5"
              data-act="omr-open"
              type="button"
              onClick={() => setOmrOpen((o) => !o)}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">checklist</span>
              {omrOpen ? 'أخفِ تصحيح الدوائر' : 'ورقة إجابة بالدوائر وتصحيحها'}
            </button>
            {omrOpen && (
              <OmrPanel
                key={omrEpoch}
                lines={[head['المدرسة'], head['الدور']].map((l) => l?.trim() ?? '').filter(Boolean)}
                spec={omr}
                title={title}
                onSay={say}
                onSpec={setOmr}
              />
            )}
          </div>

          {/* ── الرموز ────────────────────────────────────────────── */}
          <div className="rounded-xl bg-surface-container-lowest p-space-sm">
            <div className="font-label-sm text-label-sm text-on-surface-variant mb-space-xs">
              رموزُ المواد — تُدرج عند المؤشّر
            </div>
            <SymbolPalette compact onPick={insertSymbol} />
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
          {/* يلتفّ سطرين إن ضاق — كان يُمرَّر أفقيًّا فتختفي «اطبع» و«حفظ» خلف طرف النافذة. */}
          <div className="min-h-14 px-space-lg py-space-xs flex flex-wrap items-center gap-space-sm border-b border-outline-variant bg-surface-container-lowest">
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
            <div className="flex flex-wrap items-center justify-end gap-space-sm">
              <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
                <input
                  checked={answers}
                  type="checkbox"
                  onChange={(e) => setAnswers(e.target.checked)}
                />
                ورقة المصحّح
              </label>

              <label
                className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap"
                title="الفروع بترتيبين، والنسخ تتناوب أ، ب، أ، ب — فلا ينقل الطالب عن جاره"
              >
                <input
                  checked={versions}
                  data-act="versions"
                  type="checkbox"
                  onChange={(e) => {
                    setVersions(e.target.checked);
                    setShowB(false);
                  }}
                />
                نموذجان أ و ب
              </label>
              {versions && (
                <div className="flex p-0.5 rounded-lg bg-surface-container-low" data-version-view="">
                  {['أ', 'ب'].map((v) => (
                    <button
                      key={v}
                      className={`h-7 px-3 rounded-md font-label-md text-label-md ${
                        (v === 'ب') === showB ? 'bg-primary-container text-on-primary font-semibold' : 'text-on-surface-variant'
                      }`}
                      data-version={v}
                      type="button"
                      onClick={() => setShowB(v === 'ب')}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}

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
