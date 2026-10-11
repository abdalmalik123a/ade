/**
 * المكتبة — data-path="templates-library-drafts"
 *
 * ما يُبنى مرّة (ن٣): النماذج بأقسامها (تصنيفات الجهات)، وورقةٌ فارغة، و«استورد» واحدٌ بطرقه كلّها —
 * Word ومجلّده، وصورة الورقة، وصورة الاستمارة، وتصميم Photoshop، وحزمة جهةٍ أو مكتب (المرحلة ٥).
 * والمسودات لا تُعرض هنا: هي في «قيد العمل» مع ما لم يكتمل. ولا نموذج مبرمَج: تبدأ المكتبة فارغة.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import ImageFormDialog from '../components/ImageFormDialog';
import ImportPlanDialog from '../components/ImportPlanDialog';
import PaperPhotoDialog from '../components/PaperPhotoDialog';
import type {
  BundledPackInfo,
  ImportChoices,
  ImportPlan,
  ImportedTemplate,
  TemplateDetail,
  TemplateStats,
  TemplateSummary
} from '@shared/api';
import { renderBody } from '@shared/template';
import type { Doc } from '@shared/doc';
import type { WordScan } from '@shared/wordLosses';
import {
  isLayoutEmpty,
  normalizeLayout, mmToPx, type Letterhead } from '@shared/letterhead';
import LetterheadView from '../components/LetterheadView';
import TemplateDesigner from './TemplateDesigner';
import { errorText } from '../lib/errors';
import { skippedLines } from '@shared/importSkipped';
import { normalizeFold, count } from '@shared/arabic';

const nf = new Intl.NumberFormat('en-US');

const SORTS = [
  { value: 'used', label: 'الأكثر استخداماً' },
  { value: 'recent', label: 'المضافة حديثاً' },
  { value: 'title', label: 'أبجدياً حسب العنوان الإداري' }
] as const;

type Toast = { text: string; tone: 'ok' | 'warn'; sticky?: boolean } | null;

/** ملفّ Word فتحه الشبّاك من «الملفّات» — مقروءًا، يُفتح في المصمّم مرّةً بمفتاحه. */
export type WordIncoming = { key: number; imported: ImportedTemplate };
let wordIncomingSeen = 0;
/** والمكتبة تُركّب من جديد كلّما فُتحت — فالطلب يُنفَّذ مرّةً لا كلّ رجوع. */
let libraryRequestSeen = 0;

type Props = {
  incoming?: WordIncoming | null;
  /** «ابدأ جاهزًا»: يُفتح الاستيراد حين تُفتح المكتبة — مجلّد Word أو حزمةٌ جاهزة (المرحلة ٥). */
  request?: { key: number; action: 'folder' | 'pack' } | null;
  /** استمارةٌ مصوّرة تُفتح في المصمّم لتُرسم فيها خاناتٌ فاتت (المرحلة ٤). */
  onOpenDesign?: (templateId: number) => void;
  onOpenInEditor?: (templateId: number) => void;
  /** «استورد ← تصميمٌ من Photoshop أو PDF»: يُفتح في التصاميم ويُسأل عن الملف هناك. */
  onImportDesign?: () => void;
  /** يُستدعى بعد كل تغيير يمسّ عدّادات الشريط الجانبي. */
  onChanged?: () => void;
};

export default function TemplatesScreen({ incoming = null, request = null, onOpenInEditor, onImportDesign, onChanged, onOpenDesign }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('used');
  /** قائمة «استورد» مفتوحة؟ */
  const [importing, setImporting] = useState(false);
  const [designer, setDesigner] = useState<{
    open: boolean;
    initial: TemplateDetail | null;
    /** ورقة Word المستوردة بتنسيقها — تُفتح كما هي. */
    doc?: Doc | null;
    /** ما في ملفّ Word ولم يُنقل إليها (الموجة ٢). */
    wordScan?: WordScan | null;
  }>({
    open: false,
    initial: null
  });
  const [zoomed, setZoomed] = useState<TemplateSummary | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportedTemplate | null>(null);
  const [paperOpen, setPaperOpen] = useState(false);
  /** خطّة «استورد مجلدي» — تُعرض للمراجعة، ولا يُحفظ منها إلا ما يُقبل. */
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [packsModal, setPacksModal] = useState(false);
  const [bundledPacks, setBundledPacks] = useState<BundledPackInfo[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const timer = useRef<number | null>(null);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok', sticky = false) => {
    setToast({ text, tone, sticky });
    if (timer.current) window.clearTimeout(timer.current);
    // وما لم يُنقل من المجلّد يبقى حتى يُغلق (هـ١): أسطرٌ تُقرأ لا تختفي بعد ثلاث ثوانٍ.
    if (!sticky) timer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const reload = useCallback(async (category: string | null) => {
    const [s, c, list, lhs] = await Promise.all([
      window.diwan.templates.stats(),
      window.diwan.templates.categories(),
      window.diwan.templates.list(category),
      window.diwan.letterheads.list()
    ]);
    setStats(s);
    setCategories(c);
    setItems(list);
    setLetterheads(lhs);
  }, []);

  useEffect(() => {
    void reload(active);
  }, [active, reload]);

  const visible = items
    .filter((t) => {
      // يتسامح مع الهمزة والتاء المربوطة: «اجازة» تجد «إجازة».
      const q = normalizeFold(query.trim());
      if (!q) return true;
      return [t.title, t.subtitle, t.code, t.category].some((v) => v && normalizeFold(v).includes(q));
    })
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'ar');
      if (sort === 'recent') return b.id - a.id;
      return b.printCount - a.printCount;
    });


  async function openDesigner(id: number | null) {
    const initial = id === null ? null : await window.diwan.templates.get(id);
    setDesigner({ open: true, initial });
  }

  /** يفتح المستورَد في المصمّم، مربوطًا بترويسة إن حُفظت. */
  function openImported(imported: ImportedTemplate, letterheadId: number | null) {
    setDesigner({
      open: true,
      initial: {
        id: 0,
        code: imported.code,
        title: imported.title,
        subtitle: imported.subtitle,
        category: imported.category,
        // في الورقة المنسّقة «م/» سطرٌ منها — وسطرُ موضوعٍ فوقها يكرّره.
        subjectLine: imported.doc ? null : imported.subjectLine,
        bodyHtml: imported.body,
        letterheadId,
        printCount: 0,
        issuedThisMonth: 0,
        variables: []
      } as unknown as TemplateDetail,
      doc: imported.doc ?? null,
      wordScan: imported.scan ?? null
    });
    // الترويسة لم تُفصل عن ورقةٍ مستوردةٍ بتنسيقها، فلا يُذكر استخراجها.
    const notes = imported.doc
      ? imported.warnings.filter((w) => !w.includes('ترويسة'))
      : imported.warnings;
    say(notes.length ? notes.join(' · ') : 'استُورد النموذج — راجعه ثم احفظ', 'ok');
  }

  /** ما قُرئ من ملفّ Word: ورقةٌ منسّقة تُفتح كما هي، وغيرها يُسأل عن ترويسته (كالاستيراد بالحوار). */
  function receive(imported: ImportedTemplate) {
    if (!imported.doc && imported.letterhead && !isLayoutEmpty(imported.letterhead)) {
      setPendingImport(imported);
      return;
    }
    openImported(imported, null);
  }

  useEffect(() => {
    if (!incoming || incoming.key === wordIncomingSeen) return;
    wordIncomingSeen = incoming.key;
    receive(incoming.imported);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.key]);

  // «ابدأ جاهزًا» من المعالج: الاستيراد يُفتح مرّةً بمفتاحه — والمكتب يختار الملف أو المجلّد.
  useEffect(() => {
    if (!request || request.key === libraryRequestSeen) return;
    libraryRequestSeen = request.key;
    if (request.action === 'folder') void importFolder();
    else void openPacksModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.key]);

  async function importTemplate() {
    setBusy(true);
    try {
      const imported = await window.diwan.templates.importFile();
      if (!imported) return;
      // ملف Word يُفتح ورقةً واحدة كما صنعه صاحبه — رأسه جزءٌ منها لا ترويسةٌ
      // تُفصل. وما ليس ورقةً منسّقة يبقى طريقه القديم: الترويسة يقرّرها المكتب.
      if (!imported.doc && imported.letterhead && !isLayoutEmpty(imported.letterhead)) {
        setPendingImport(imported);
        return;
      }
      openImported(imported, null);
    } catch (e) {
      say(errorText(e, 'تعذّر الاستيراد'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  /**
   * «استورد مجلدي»: يقرأ المجلد ويعرض ما وجده — ولا يحفظ شيئًا بعد.
   *
   * مرّةٌ واحدة في العمر يخرج بها المكتب من مئات ملفات Word إلى مكتبة حيّة.
   */
  async function importFolder() {
    setBusy(true);
    try {
      const found = await window.diwan.templates.planFolder();
      if (!found) return;
      if (found.candidates.length === 0) {
        // ومجلّدٌ ملفّاته `.doc` يُقال له ما فيه وما يُفعل (هـ١) — لا «لا ملفات Word» وهو ممتلئٌ بها.
        const left = skippedLines(found.skipped);
        say(
          (found.failed.length
            ? `لم يُقرأ أيّ ملف من ${found.failed.length}`
            : 'لا ملفات .docx في هذا المجلد') + (left.length ? ` — ${left.join(' · ')}` : ''),
          'warn',
          left.length > 0
        );
        return;
      }
      setPlan(found);
    } catch (e) {
      say(errorText(e, 'تعذّرت قراءة المجلد'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  /**
   * «كتب من ملف Excel» (الموجة ٢): برنامج مخاطباتٍ في Excel — ورقةٌ لكلّ كتاب — يُراجَع كالمجلّد ثم يُحفظ.
   */
  async function importExcel() {
    setBusy(true);
    try {
      const found = await window.diwan.templates.planExcel();
      if (!found) return;
      if (found.candidates.length === 0) {
        say(found.failed.length ? `لا ورقة فيها كتابٌ يُطبع من ${found.failed.length}` : 'لا أوراق فيها كتب', 'warn');
        return;
      }
      setPlan(found);
    } catch (e) {
      say(errorText(e, 'تعذّرت قراءة ملف Excel'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function applyPlan(edited: ImportPlan, choices: ImportChoices) {
    setBusy(true);
    try {
      const out = await window.diwan.templates.applyImport(edited, choices);
      setPlan(null);
      await reload(active);
      onChanged?.();
      // وما في المجلّد ولم يُنقل يُقال في النتيجة أيضًا (هـ١)، ويبقى حتى يُغلق — فلا يظنّ المكتب أنّ أرشيفه كلّه دخل.
      const left = skippedLines(edited.skipped);
      say(
        `حُفظت ${count(out.templates, 'بطاقة')}` +
          (out.letterheadId ? ' وترويسة واحدة للجميع' : '') +
          (out.skipped ? ` — وتُركت ${count(out.skipped, 'بطاقة')}` : '') +
          (left.length ? ` · ولم يُنقل من المجلّد: ${left.join(' · ')}` : ''),
        'ok',
        left.length > 0
      );
    } catch (e) {
      say(errorText(e, 'تعذّر الحفظ'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  /** حفظ الترويسة المستخرجة في المكتبة ثم ربط النموذج بها. */
  async function keepImportedLetterhead(imported: ImportedTemplate) {
    try {
      const saved = await window.diwan.letterheads.save({
        id: null,
        name: (imported.title || 'ترويسة مستوردة').slice(0, 60),
        authorityId: null,
        layout: imported.letterhead!
      });
      // القائمة تُحدَّث قبل فتح المصمّم، وإلا لم يجد الترويسةَ التي لتوّها حُفظت.
      setLetterheads(await window.diwan.letterheads.list());
      setPendingImport(null);
      openImported(imported, saved.id);
      say(`حُفظت الترويسة «${saved.name}» ورُبط بها النموذج`);
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ الترويسة'), 'warn');
    }
  }

  async function removeTemplate(id: number, title: string) {
    await window.diwan.templates.delete(id);
    await reload(active);
    onChanged?.();
    say('حُذف النموذج: ' + title);
  }

  /** «نسخ نموذج»: نسخة مستقلّة تُعدَّل دون المساس بالأصل — الأصل لا يُفتح أبدًا. */
  async function duplicateTemplate(id: number, title: string) {
    setBusy(true);
    try {
      const copy = await window.diwan.templates.duplicate(id);
      if (!copy) {
        say('تعذّر النسخ', 'warn');
        return;
      }
      await reload(active);
      onChanged?.();
      say(`نُسخ «${title}» — عدّل النسخة دون المساس بالأصل`);
    } catch (e) {
      say(errorText(e, 'تعذّر النسخ'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function exportOne(id: number) {
    setBusy(true);
    try {
      const path = await window.diwan.templates.export(id);
      if (path) say('صُدّر مستند Word');
    } catch (e) {
      say(errorText(e, 'تعذّر التصدير'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  /**
   * حزمة المحتوى (خطة Production، ٤٫٣): النماذج والترويسات والكليشات وصورها — بلا بيانات الناس —
   * لمكتبٍ آخر أو لجهازٍ جديد. والمكرّر يُعرف بمعرّفه فلا يُضاف ثانيةً.
   */
  async function exportContent() {
    setBusy(true);
    try {
      const r = await window.diwan.content.export();
      if (r) say(`صُدّرت حزمة المحتوى: ${count(r.templates, 'نموذج')}، ${count(r.letterheads, 'ترويسة')}، ${count(r.clips, 'كليشة')} — ${r.path}`);
    } catch (e) {
      say(errorText(e, 'تعذّر التصدير'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function importContent() {
    setBusy(true);
    try {
      const r = await window.diwan.content.import();
      if (!r) return;
      await reload(active);
      onChanged?.();
      const a = r.added;
      const had = r.existing.templates + r.existing.letterheads + r.existing.clips;
      say(
        `أُضيف: ${count(a.templates, 'نموذج')}، ${count(a.letterheads, 'ترويسة')}، ${count(a.clips, 'كليشة')}` +
          (had ? ` — و${nf.format(had)} موجودٌ في المكتب فتُرك كما هو` : '')
      );
    } catch (e) {
      say(errorText(e, 'تعذّر الاستيراد'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function openPacksModal() {
    setImporting(false);
    setPacksModal(true);
    setLoadingPacks(true);
    try {
      const list = await window.diwan.content.bundled();
      setBundledPacks(list);
    } catch (e) {
      say(errorText(e, 'تعذّر تحميل الحزم المشحونة'), 'warn');
    } finally {
      setLoadingPacks(false);
    }
  }

  async function importBundledPack(id: string) {
    setBusy(true);
    try {
      const r = await window.diwan.content.importBundled(id);
      if (!r) return;
      await reload(active);
      onChanged?.();
      try {
        const list = await window.diwan.content.bundled();
        setBundledPacks(list);
      } catch {
        setBundledPacks((prev) =>
          prev.map((p) => (p.id === id ? { ...p, imported: true } : p))
        );
      }
      const a = r.added;
      const had = r.existing.templates + r.existing.letterheads + r.existing.clips;
      say(
        `أُضيف: ${count(a.templates, 'نموذج')}، ${count(a.letterheads, 'ترويسة')}، ${count(a.clips, 'كليشة')}` +
          (had ? ` — و${nf.format(had)} موجودٌ في المكتب فتُرك كما هو` : '')
      );
    } catch (e) {
      say(errorText(e, 'تعذّر استيراد الحزمة'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFileFromModal() {
    await importContent();
    try {
      const list = await window.diwan.content.bundled();
      setBundledPacks(list);
    } catch {
      // ignore
    }
  }

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* رأس المكتبة: ورقةٌ فارغة، و«استورد» واحدٌ بطرقه كلّها (المرحلة ٥). */}
        <section className="flex flex-wrap items-center gap-space-sm" data-new-template="">
          <div className="me-auto">
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold">المكتبة</h1>
            <p className="font-label-md text-label-md text-on-surface-variant">
              ما يُبنى مرّةً ويُطبع كثيرًا — {count(stats?.activeTemplates ?? 0, 'نموذج', 'لا نماذج بعد')} بأقسام جهاتها
            </p>
          </div>
          <button
            className="h-11 px-space-lg rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold flex items-center gap-space-xs"
            data-act="new-blank"
            title="اكتب على الورقة، وظلّل ما يتغيّر واضغط F4"
            type="button"
            onClick={() => void openDesigner(null)}
          >
            <span className="material-symbols-outlined text-[20px]">note_add</span>
            ورقة فارغة
          </button>
          <div className="relative">
            <button
              aria-expanded={importing}
              className="h-11 px-space-lg rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg font-semibold flex items-center gap-space-xs shadow-[0_1px_8px_rgba(0,0,0,0.04)] disabled:opacity-50"
              data-act="import-menu"
              disabled={busy}
              type="button"
              onClick={() => setImporting((v) => !v)}
            >
              <span className="material-symbols-outlined text-[20px] text-secondary">upload_file</span>
              استورد
              <span className="material-symbols-outlined text-[18px]">expand_more</span>
            </button>
            {/* في الصفحة دائمًا ومخفيّةٌ حتى تُفتح — فالطرق تُعدّ وتُختبر بأسمائها. */}
            <div
              className={`${importing ? '' : 'hidden'} absolute z-30 top-full mt-1 end-0 w-[22rem] p-space-xs rounded-xl bg-surface-container-lowest shadow-xl border border-outline-variant`}
              data-import-menu=""
            >
              {(
                [
                  { act: 'new-word', icon: 'description', label: 'ملفّ Word', hint: 'بتنسيقه كما رُسم في Word', run: () => void importTemplate() },
                  { act: 'new-folder', icon: 'folder_open', label: 'مجلّد ملفّات Word', hint: 'ملفات المكتب كلّها دفعةً واحدة', run: () => void importFolder() },
                  { act: 'new-excel', icon: 'table_view', label: 'كتب من ملف Excel', hint: 'كلّ ورقةٍ كتاب، وبيانات المدرسة خانات', run: () => void importExcel() },
                  { act: 'new-photo', icon: 'document_scanner', label: 'صورة ورقة', hint: 'تُقرأ على هذا الجهاز — والتواقيع والأختام لا تُنقل', run: () => setPaperOpen(true) },
                  { act: 'new-form-image', icon: 'dynamic_form', label: 'صورة استمارة', hint: 'صورة الدائرة كما هي، والخانات فوقها', run: () => setFormOpen(true) },
                  { act: 'new-design-import', icon: 'layers', label: 'تصميم من Photoshop أو PDF', hint: 'شهادة أو بطاقة بطبقاتها — في التصاميم', run: () => onImportDesign?.() },
                  { act: 'content-import', icon: 'inventory_2', label: 'حزمة جهةٍ أو مكتب', hint: 'نماذج وترويسات جاهزة — ما ليس عندك يُضاف', run: () => void openPacksModal() }
                ] as const
              ).map((o) => (
                <button
                  key={o.act}
                  className="w-full px-space-sm py-1.5 rounded-lg hover:bg-surface-container-high transition-colors text-right flex items-center gap-space-sm disabled:opacity-50"
                  data-act={o.act}
                  disabled={busy}
                  type="button"
                  onClick={() => {
                    setImporting(false);
                    o.run();
                  }}
                >
                  <span className="material-symbols-outlined text-[20px] text-secondary">{o.icon}</span>
                  <span className="flex flex-col min-w-0">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">{o.label}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{o.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* الأقسام: تصنيفات الجهات — والبحث فيها يتسامح مع الهمزة */}
        <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-space-md" data-library-sections="">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-xs overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              <Chip active={active === null} onClick={() => setActive(null)}>
                الكل ({nf.format(stats?.activeTemplates ?? 0)})
              </Chip>
              {categories.map((c) => (
                <Chip key={c.name} active={active === c.name} onClick={() => setActive(c.name)}>
                  {c.name} ({nf.format(c.count)})
                </Chip>
              ))}
            </div>

            <div className="flex items-center gap-space-sm shrink-0 self-end lg:self-auto">
              <div className="relative">
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  className="h-9 w-56 pr-9 pl-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-label-sm text-label-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  placeholder="ابحث في النماذج..."
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="h-6 w-px bg-surface-container-highest" />
              <select
                className="h-9 px-space-sm bg-surface-container-low text-on-surface rounded-lg font-label-sm text-label-sm focus:outline-none cursor-pointer"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* المحتوى */}
        {visible.length === 0 ? (
          <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] py-space-xl flex flex-col items-center gap-space-sm">
            <span className="material-symbols-outlined text-[44px] text-on-surface-variant">
              library_add
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {items.length === 0 ? 'مكتبة النماذج فارغة' : 'لا نتائج مطابقة'}
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant">
              {items.length === 0
                ? 'ابدأ من «ورقة فارغة» أو «استورد» أعلاه: ملف Word، أو مجلد ملفاتك كلّه، أو حزمة جهة'
                : 'جرّب كلمة بحث أخرى أو تصنيفًا مختلفًا'}
            </span>
            {/* المكتبة الفارغة تعرض أقصر الطرق إليها في مكانها (خطة Production، ٣٫٥): مجلد ملفات المكتب كلّه. */}
            {items.length === 0 && (
              <div className="flex flex-wrap justify-center gap-space-sm pt-space-xs">
                <button
                  className="h-11 px-space-lg rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold flex items-center gap-space-xs disabled:opacity-50"
                  data-act="empty-import-folder"
                  disabled={busy}
                  type="button"
                  onClick={() => void importFolder()}
                >
                  <span className="material-symbols-outlined text-[20px]">folder_open</span>
                  استورد مجلدي
                </button>
                <button
                  className="h-11 px-space-md rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-space-xs"
                  data-act="empty-new-blank"
                  type="button"
                  onClick={() => void openDesigner(null)}
                >
                  <span className="material-symbols-outlined text-[20px]">note_add</span>
                  ورقة فارغة
                </button>
              </div>
            )}
          </section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
            {visible.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                letterheads={letterheads}
                onOpen={() => onOpenInEditor?.(t.id)}
                onEdit={() => void openDesigner(t.id)}
                onDuplicate={() => void duplicateTemplate(t.id, t.title)}
                onZoom={() => setZoomed(t)}
                onExport={() => void exportOne(t.id)}
                onDelete={() => void removeTemplate(t.id, t.title)}
              />
            ))}
          </div>
        )}

        {/* شريط التذييل */}
        <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col lg:flex-row items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] text-secondary">folder_zip</span>
            <span className="font-label-sm text-label-sm">
              مكتبة محلية بالكامل — وحزمة المحتوى تنقلها إلى جهازٍ أو مكتبٍ آخر
            </span>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
              data-act="content-export"
              title="النماذج والترويسات والكليشات وصورها في ملفٍّ واحد — بلا بيانات الناس"
              type="button"
              disabled={busy}
              onClick={() => void exportContent()}
            >
              <span className="material-symbols-outlined text-[18px]">drive_file_move</span>
              <span>صدّر حزمة المحتوى</span>
            </button>
          </div>
        </section>
      </div>

      {plan && (
        <ImportPlanDialog
          busy={busy}
          plan={plan}
          onApply={(edited, choices) => void applyPlan(edited, choices)}
          onCancel={() => setPlan(null)}
        />
      )}

      {paperOpen && (
        <PaperPhotoDialog
          onClose={() => setPaperOpen(false)}
          onOpen={({ doc, title, notes }) => {
            setPaperOpen(false);
            // يدخل المصمّم من طريق Word نفسه: ورقةٌ واحدة بتنسيقها، ورأسُها يُفصل ترويسةً إن شاء المكتب.
            openImported({ title, subtitle: null, category: null, code: null, subjectLine: null, body: '', warnings: notes, letterhead: null, doc }, null);
          }}
        />
      )}

      {pendingImport?.letterhead && (
        <div className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-[2px] flex items-center justify-center p-space-lg">
          <div className="w-full max-w-3xl bg-surface-container-lowest rounded-xl shadow-lg overflow-hidden">
            <div className="h-12 px-space-md flex items-center justify-between bg-surface-container-low">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                وُجدت ترويسة في الملف
              </span>
              <button
                className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
                type="button"
                onClick={() => {
                  const imported = pendingImport;
                  setPendingImport(null);
                  openImported(imported, null);
                }}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-space-md space-y-space-md">
              <p className="font-label-md text-label-md text-on-surface-variant">
                كتب Word غالبًا تحمل ترويسة مكتوبة نصًّا لا كترويسة صفحة، فتضيع عند
                الاستيراد. هذه ما وجدناه في أعلى الملف — احفظها لتُستعمل مع هذا النموذج
                وغيره، أو اتركها فتبقى ضمن المتن.
              </p>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-space-md">
                <LetterheadView layout={normalizeLayout(pendingImport.letterhead)} />
              </div>

              <div className="flex items-center justify-end gap-space-sm">
                <button
                  className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
                  type="button"
                  onClick={() => {
                    const imported = pendingImport;
                    setPendingImport(null);
                    openImported(imported, null);
                  }}
                >
                  لا تحفظها
                </button>
                <button
                  className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold"
                  type="button"
                  onClick={() => void keepImportedLetterhead(pendingImport)}
                >
                  احفظ الترويسة واربطها بالنموذج
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {designer.open && (
        <TemplateDesigner
          initial={designer.initial}
          initialDoc={designer.doc ?? null}
          wordScan={designer.wordScan ?? null}
          letterheads={letterheads}
          categories={categories.map((c) => c.name)}
          onClose={() => setDesigner({ open: false, initial: null })}
          onSaved={() => {
            setDesigner({ open: false, initial: null });
            void reload(active);
            onChanged?.();
            say('حُفظ النموذج');
          }}
          onDeleted={() => {
            setDesigner({ open: false, initial: null });
            void reload(active);
            onChanged?.();
            say('حُذف النموذج');
          }}
        />
      )}

      {zoomed && (
        <PreviewModal
          template={zoomed}
          letterheads={letterheads}
          onClose={() => setZoomed(null)}
          onOpen={() => {
            onOpenInEditor?.(zoomed.id);
            setZoomed(null);
          }}
        />
      )}

      <PacksModal
        open={packsModal}
        loading={loadingPacks}
        packs={bundledPacks}
        busy={busy}
        onClose={() => setPacksModal(false)}
        onImportBundled={importBundledPack}
        onImportFile={handleImportFileFromModal}
      />

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
          {toast.sticky && (
            <button
              aria-label="أغلق الرسالة"
              className="shrink-0 w-7 h-7 rounded-full hover:bg-black/10 inline-flex items-center justify-center"
              data-act="toast-close"
              title="أغلق"
              type="button"
              onClick={() => setToast(null)}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      )}
      {formOpen && (
        <ImageFormDialog
          onClose={() => setFormOpen(false)}
          onSaved={(id, edit) => {
            setFormOpen(false);
            void reload(active);
            onChanged?.();
            say('حُفظت الاستمارة في المكتبة — تُملأ من الشبّاك كأيّ نموذج', 'ok');
            if (edit) onOpenDesign?.(id);
          }}
        />
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
          ? 'px-space-md py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold shrink-0 transition-colors'
          : 'px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors'
      }
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** معاينة الورقة داخل البطاقة — بنسبة A4 كما في التصميم (1 / 1.38). */
function MiniSheet({
  template,
  letterhead,
  scale
}: {
  template: TemplateSummary;
  letterhead: Letterhead | null;
  scale: number;
}) {
  return (
    <div
      style={{
        paddingTop: mmToPx(letterhead?.layout.margins.top ?? 20) * scale,
        paddingRight: mmToPx(letterhead?.layout.margins.right ?? 20) * scale,
        paddingLeft: mmToPx(letterhead?.layout.margins.left ?? 20) * scale
      }}
    >
      {letterhead && (
        <div style={{ zoom: scale }}>
          <LetterheadView layout={normalizeLayout(letterhead.layout)} />
        </div>
      )}

      {template.subjectLine && (
        <div
          className="mt-3 text-center font-bold underline underline-offset-4 text-on-surface"
          style={{ fontSize: `${13 * scale}px` }}
        >
          م / {template.subjectLine}
        </div>
      )}

      <div
        className="mt-3 text-on-surface"
        style={{ fontSize: `${12.5 * scale}px`, lineHeight: 1.9, textAlign: 'justify' }}
        dangerouslySetInnerHTML={{ __html: renderBody(template.bodyHtml, {}) }}
      />
    </div>
  );
}

function TemplateCard({
  template,
  letterheads,
  onOpen,
  onEdit,
  onDuplicate,
  onZoom,
  onExport,
  onDelete
}: {
  template: TemplateSummary;
  letterheads: Letterhead[];
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onZoom: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);

  async function askDelete() {
    setUsage(await window.diwan.templates.usage(template.id));
    setConfirming(true);
  }

  const letterhead =
    letterheads.find((l) => l.id === template.letterheadId) ??
    letterheads.find((l) => l.isDefault) ??
    null;

  return (
    <article className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
      <div className="p-space-md flex items-start justify-between gap-space-sm">
        <div className="flex flex-col gap-space-xs min-w-0">
          <div className="flex items-center gap-space-xs">
            {template.category && (
              <span className="px-space-xs py-0.5 rounded bg-surface-container-high font-label-sm text-label-sm text-secondary font-semibold">
                {template.category}
              </span>
            )}
            {template.code && (
              <span className="font-code-sm text-code-sm text-on-surface-variant font-mono">
                CODE: {template.code}
              </span>
            )}
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
            {template.title}
          </h3>
          {template.subtitle && (
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              {template.subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-space-xs shrink-0">
          <div className="flex flex-col items-center">
            <span className="font-headline-md text-headline-md text-on-surface font-bold tabular">
              {nf.format(template.issuedThisMonth)}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant text-center">
              طبعة هذا الشهر
            </span>
          </div>
          {/* التصدير والحذف في الرأس أيضًا: البطاقة بنسبة A4 فتدفع صفّ الأزرار
              أسفل حافة الشاشة، والحذف لا يجوز أن يحتاج تمريرًا للوصول إليه. */}
          <div className="flex flex-col gap-1">
            <button
              className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
              title="صدّره مستند Word — للمشاركة والطباعة خارج المكتب"
              type="button"
              onClick={onExport}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
            </button>
            <button
              className="w-8 h-8 rounded-lg bg-surface-container-high text-error flex items-center justify-center hover:bg-error-container transition-colors"
              title="حذف النموذج"
              type="button"
              onClick={() => void askDelete()}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-space-md py-space-sm bg-surface-container-low flex justify-center items-center">
        <div className="paper w-full max-w-[310px] aspect-[1/1.38] bg-surface-container-lowest rounded shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] text-right relative overflow-hidden select-none">
          <MiniSheet template={template} letterhead={letterhead} scale={310 / 794} />
        </div>
      </div>

      {template.variables.length > 0 && (
        <div className="p-space-md flex flex-wrap items-center gap-space-xs">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            المتغيرات المحقونة:
          </span>
          {template.variables.map((v) => (
            <span
              key={v}
              className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-mono font-label-sm text-label-sm"
            >
              [{v}]
            </span>
          ))}
        </div>
      )}

      {confirming ? (
        <div className="p-space-md pt-0 mt-auto flex flex-col gap-space-xs">
          <span className="font-label-sm text-label-sm text-error text-center">
            {usage && usage > 0
              ? `صدر عن هذا النموذج ${count(usage, 'كتاب')} — تحذفه؟`
              : 'تأكيد حذف النموذج؟'}
          </span>
          <div className="flex items-center gap-space-xs">
            <button
              className="flex-1 h-9 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold"
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              نعم، احذف
            </button>
            <button
              className="flex-1 h-9 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md"
              type="button"
              onClick={() => setConfirming(false)}
            >
              تراجع
            </button>
          </div>
        </div>
      ) : (
        <div className="p-space-md pt-0 mt-auto flex items-center gap-space-xs">
          <button
            className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs transition-all"
            type="button"
            onClick={onOpen}
          >
            <span className="material-symbols-outlined text-[18px]">edit_document</span>
            <span>فتح في المحرر</span>
          </button>
          <button
            className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            title="تعديل صيغ المتغيرات"
            type="button"
            onClick={onEdit}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
          <button
            className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            title="نسخ النموذج — نسخة مستقلّة تُعدَّل دون المساس بالأصل"
            type="button"
            onClick={onDuplicate}
          >
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
          </button>
          <button
            className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            title="معاينة بالحجم الكامل A4"
            type="button"
            onClick={onZoom}
          >
            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
          </button>
          <button
            className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            title="صدّره مستند Word — للمشاركة والطباعة خارج المكتب"
            type="button"
            onClick={onExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
          </button>
          <button
            className="w-9 h-9 rounded-lg bg-surface-container-high text-error flex items-center justify-center hover:bg-error-container transition-colors"
            title="حذف النموذج"
            type="button"
            onClick={() => void askDelete()}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      )}
    </article>
  );
}

function PreviewModal({
  template,
  letterheads,
  onClose,
  onOpen
}: {
  template: TemplateSummary;
  letterheads: Letterhead[];
  onClose: () => void;
  onOpen: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const letterhead =
    letterheads.find((l) => l.id === template.letterheadId) ??
    letterheads.find((l) => l.isDefault) ??
    null;

  return (
    <div
      className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-[2px] flex flex-col items-center overflow-auto py-space-lg"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-lg shadow-2xl shrink-0"
        style={{ width: 794 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-space-md flex items-center justify-between bg-surface-container-low rounded-t-lg">
          <span className="font-headline-sm text-headline-sm text-on-surface truncate">
            {template.title}
          </span>
          <div className="flex items-center gap-space-sm">
            <button
              className="px-space-md h-8 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
              type="button"
              onClick={onOpen}
            >
              فتح في المحرر
            </button>
            <button
              className="w-8 h-8 rounded text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center"
              title="إغلاق (Esc)"
              type="button"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
        <div className="a4-sheet bg-surface-container-lowest">
          <MiniSheet template={template} letterhead={letterhead} scale={1} />
        </div>
      </div>
    </div>
  );
}

function PacksModal({
  open,
  loading,
  packs,
  busy,
  onClose,
  onImportBundled,
  onImportFile
}: {
  open: boolean;
  loading: boolean;
  packs: BundledPackInfo[];
  busy: boolean;
  onClose: () => void;
  onImportBundled: (id: string) => Promise<void>;
  onImportFile: () => Promise<void>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-[2px] flex items-center justify-center p-space-md"
      data-packs-modal=""
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-16 px-space-lg flex items-center justify-between border-b border-outline-variant bg-surface-container-low shrink-0">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[24px] text-secondary">inventory_2</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">حزم الجهات الجاهزة</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                معاملات رسمية ونماذج معتمدة — معروضة لتختار منها، ولا يُضاف شيء إلا بطلبك
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
            title="إغلاق (Esc)"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-space-lg overflow-y-auto space-y-space-md flex-1">
          {loading ? (
            <p className="text-center py-space-xl text-on-surface-variant font-body-md">جارٍ قراءة الحزم المتاحة...</p>
          ) : packs.length === 0 ? (
            <p className="text-center py-space-xl text-on-surface-variant font-body-md">لا حزم مشحونة في هذا الإصدار.</p>
          ) : (
            <div className="space-y-space-sm" data-bundled-packs-list="">
              {packs.map((p) => (
                <div
                  key={p.id}
                  className="p-space-md rounded-xl border border-outline-variant bg-surface-container-low flex flex-col gap-space-xs"
                  data-pack-card={p.id}
                >
                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-space-xs flex-wrap">
                        <span className="font-title-md text-title-md font-bold text-on-surface">{p.title}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold">
                          {p.section}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                          v{p.version}
                        </span>
                        {p.imported && (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-semibold flex items-center gap-0.5"
                            data-pack-imported={p.id}
                          >
                            <span className="material-symbols-outlined text-[14px]">check</span>
                            مستوردة
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{p.description}</p>
                    </div>
                    <button
                      className={`h-9 px-space-md rounded-lg font-label-md text-label-md font-bold shrink-0 transition-colors flex items-center gap-space-xs ${
                        p.imported
                          ? 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface'
                          : 'bg-primary-container text-on-primary hover:opacity-95'
                      }`}
                      data-act={`import-bundled-${p.id}`}
                      disabled={busy}
                      type="button"
                      onClick={() => void onImportBundled(p.id)}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {p.imported ? 'refresh' : 'download'}
                      </span>
                      {p.imported ? 'استورد ثانيةً' : 'استيراد الحزمة'}
                    </button>
                  </div>
                  <div className="flex items-center gap-space-md text-[12px] text-on-surface-variant pt-space-xs border-t border-outline-variant/50">
                    <span>{count(p.counts.templates, 'نموذج')} · {count(p.counts.clips, 'كليشة')}{p.counts.letterheads ? ` · ${count(p.counts.letterheads, 'ترويسة')}` : ''}</span>
                    <span>تحقّق المصادر: {p.verifiedOn}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-space-md border-t border-outline-variant flex items-center justify-between gap-space-md bg-surface-container-lowest p-space-sm rounded-xl">
            <div>
              <h3 className="font-label-md text-label-md font-bold text-on-surface">استيراد حزمة من ملف خارجي</h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                ملفّ حزمة ديوان صُدّر من حاسوب آخر أو أُرسل إليك
              </p>
            </div>
            <button
              className="h-9 px-space-md rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-bold shrink-0 flex items-center gap-space-xs transition-colors"
              data-act="content-import-file"
              disabled={busy}
              type="button"
              onClick={() => void onImportFile()}
            >
              <span className="material-symbols-outlined text-[18px]">file_open</span>
              من ملف...
            </button>
          </div>
        </div>

        <div className="h-14 px-space-lg flex items-center justify-end border-t border-outline-variant bg-surface-container-low shrink-0">
          <button
            className="h-9 px-space-lg rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold transition-colors"
            type="button"
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

