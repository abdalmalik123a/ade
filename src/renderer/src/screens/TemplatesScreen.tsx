/**
 * مكتبة النماذج والمسودات — data-path="templates-library-drafts"
 *
 * كل أداة في التصميم مُنفَّذة: مصمّم النماذج، مرشّحات التصنيف، مبدّل العرض
 * (شبكة A4 / سجل مسودات)، فتح في المحرر، تعديل المتغيّرات، معاينة بالحجم الكامل،
 * استيراد DOCX/XML، ونسخ احتياطي. ولا نموذج مبرمَج: تبدأ المكتبة فارغة.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import ImportPlanDialog from '../components/ImportPlanDialog';
import PaperPhotoDialog from '../components/PaperPhotoDialog';
import type {
  DraftRow,
  ImportChoices,
  ImportPlan,
  ImportedTemplate,
  TemplateDetail,
  TemplateStats,
  TemplateSummary
} from '@shared/api';
import { renderBody } from '@shared/template';
import type { Doc } from '@shared/doc';
import {
  isLayoutEmpty,
  normalizeLayout, mmToPx, type Letterhead } from '@shared/letterhead';
import LetterheadView from '../components/LetterheadView';
import TemplateDesigner from './TemplateDesigner';
import { errorText } from '../lib/errors';

const nf = new Intl.NumberFormat('en-US');

const SORTS = [
  { value: 'used', label: 'الأكثر استخداماً' },
  { value: 'recent', label: 'المضافة حديثاً' },
  { value: 'title', label: 'أبجدياً حسب العنوان الإداري' }
] as const;

type View = 'grid' | 'drafts';
type Toast = { text: string; tone: 'ok' | 'warn' } | null;

type Props = {
  onOpenInEditor?: (templateId: number) => void;
  onOpenDraft?: (draftId: number) => void;
  /** يُستدعى بعد كل تغيير يمسّ عدّادات الشريط الجانبي. */
  onChanged?: () => void;
};

export default function TemplatesScreen({ onOpenInEditor, onOpenDraft, onChanged }: Props) {
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('used');
  const [view, setView] = useState<View>('grid');
  const [designer, setDesigner] = useState<{
    open: boolean;
    initial: TemplateDetail | null;
    /** ورقة Word المستوردة بتنسيقها — تُفتح كما هي. */
    doc?: Doc | null;
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
  const timer = useRef<number | null>(null);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    setToast({ text, tone });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const reload = useCallback(async (category: string | null) => {
    const [s, c, list, d, lhs] = await Promise.all([
      window.diwan.templates.stats(),
      window.diwan.templates.categories(),
      window.diwan.templates.list(category),
      window.diwan.drafts.list(),
      window.diwan.letterheads.list()
    ]);
    setStats(s);
    setCategories(c);
    setItems(list);
    setDrafts(d);
    setLetterheads(lhs);
  }, []);

  useEffect(() => {
    void reload(active);
  }, [active, reload]);

  // Ctrl+Enter — فتح أول نموذج ظاهر في المحرر، كما يعلن التصميم على البطاقات.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter' && !designer.open) {
        const first = visible[0];
        if (first) {
          e.preventDefault();
          onOpenInEditor?.(first.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const visible = items
    .filter((t) => {
      const q = query.trim();
      if (!q) return true;
      return [t.title, t.subtitle, t.code, t.category].some((v) => v?.includes(q));
    })
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'ar');
      if (sort === 'recent') return b.id - a.id;
      return b.printCount - a.printCount;
    });

  const visibleDrafts = drafts.filter((d) => {
    const q = query.trim();
    if (!q) return true;
    return [d.title, d.templateTitle, d.citizenName].some((v) => v?.includes(q));
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
      doc: imported.doc ?? null
    });
    // الترويسة لم تُفصل عن ورقةٍ مستوردةٍ بتنسيقها، فلا يُذكر استخراجها.
    const notes = imported.doc
      ? imported.warnings.filter((w) => !w.includes('ترويسة'))
      : imported.warnings;
    say(notes.length ? notes.join(' · ') : 'استُورد النموذج — راجعه ثم احفظ', 'ok');
  }

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
        say(
          found.failed.length
            ? `لم يُقرأ أيّ ملف من ${found.failed.length}`
            : 'لا ملفات Word في هذا المجلد',
          'warn'
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

  async function applyPlan(edited: ImportPlan, choices: ImportChoices) {
    setBusy(true);
    try {
      const out = await window.diwan.templates.applyImport(edited, choices);
      setPlan(null);
      await reload(active);
      onChanged?.();
      say(
        `حُفظت ${out.templates} بطاقة` +
          (out.letterheadId ? ' وترويسة واحدة للجميع' : '') +
          (out.skipped ? ` — وتُركت ${out.skipped}` : '')
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
      if (path) say(path.endsWith('.docx') ? 'صُدّر مستند Word' : 'صُدّر النموذج — يُستورد ثانيةً');
    } catch (e) {
      say(errorText(e, 'تعذّر التصدير'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function exportLibrary() {
    setBusy(true);
    try {
      const result = await window.diwan.templates.exportLibrary();
      if (result) say('صُدّرت المكتبة: ' + nf.format(result.count) + ' نموذجًا');
    } catch (e) {
      say(errorText(e, 'تعذّر التصدير'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function restoreLibrary() {
    setBusy(true);
    try {
      const result = await window.diwan.templates.restoreLibrary();
      if (!result) return;
      await reload(active);
      onChanged?.();
      say(
        result.skipped > 0
          ? 'استُرجع ' + result.added + ' نموذجًا، وتُخطّي ' + result.skipped + ' لتكرار الكود'
          : 'استُرجع ' + result.added + ' نموذجًا'
      );
    } catch (e) {
      say(errorText(e, 'تعذّر الاسترجاع'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function backup() {
    setBusy(true);
    try {
      const path = await window.diwan.templates.backup();
      if (path) say('حُفظت النسخة الاحتياطية');
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft(id: number) {
    await window.diwan.drafts.delete(id);
    await reload(active);
    onChanged?.();
    say('حُذفت المسودة');
  }

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* المؤشرات والإجراء الرئيسي */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {[
            {
              label: 'النماذج الرسمية المعتمدة',
              value: stats?.activeTemplates ?? 0,
              unit: 'نموذجًا نافذًا',
              icon: 'verified',
              hint:
                (stats?.activeTemplates ?? 0) === 0
                  ? 'لم يُعتمد أي نموذج بعد'
                  : 'جاهزة للاستعمال في المحرر'
            },
            {
              label: 'مسودات المكتب الخاصة',
              value: stats?.drafts ?? 0,
              unit: 'مسودة',
              icon: 'edit_note',
              hint: (stats?.drafts ?? 0) === 0 ? 'لا مسودات محفوظة' : 'محفوظة محليًا'
            },
            {
              label: 'الكتب المطبوعة هذا الشهر',
              value: stats?.issuedThisMonth ?? 0,
              unit: 'كتاب رسمي',
              icon: 'print',
              hint:
                (stats?.issuedThisMonth ?? 0) === 0
                  ? 'لم يُطبع أي كتاب هذا الشهر'
                  : 'من سجل الصادر'
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
                    {nf.format(card.value)}
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary font-semibold">
                    {card.unit}
                  </span>
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

          {/* نموذجٌ جديد: طرقُه كلّها في مكانٍ واحد — ورقةٌ فارغة، وWord، والمجلد، وصورة الورقة (هـ٨). */}
          <div className="bg-primary-container text-on-primary p-space-md rounded-xl shadow-md flex flex-col gap-space-xs" data-new-template="">
            <span className="font-headline-sm text-headline-sm">نموذجٌ جديد</span>
            {(
              [
                { act: 'new-blank', icon: 'note_add', label: 'ورقة فارغة', hint: 'اكتب على الورقة، وظلّل ما يتغيّر واضغط F4', run: () => void openDesigner(null) },
                { act: 'new-word', icon: 'upload_file', label: 'استيراد نموذج من Word', hint: 'بتنسيقه كما رُسم في Word', run: () => void importTemplate() },
                { act: 'new-folder', icon: 'folder_open', label: 'استورد مجلدي', hint: 'ملفات المكتب كلّها دفعةً واحدة', run: () => void importFolder() },
                { act: 'new-photo', icon: 'document_scanner', label: 'من صورة ورقة', hint: 'تُقرأ على هذا الجهاز — والتواقيع والأختام لا تُنقل', run: () => setPaperOpen(true) }
              ] as const
            ).map((o) => (
              <button
                key={o.act}
                className="w-full px-space-sm py-1.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors text-right flex items-center gap-space-sm disabled:opacity-50"
                data-act={o.act}
                disabled={busy && o.act !== 'new-blank'}
                type="button"
                onClick={o.run}
              >
                <span className="material-symbols-outlined text-[20px] text-secondary">{o.icon}</span>
                <span className="flex flex-col min-w-0">
                  <span className="font-label-md text-label-md font-semibold">{o.label}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* المرشّحات */}
        <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-space-md">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-xs overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              <Chip
                active={active === null && view === 'grid'}
                onClick={() => {
                  setActive(null);
                  setView('grid');
                }}
              >
                الكل ({nf.format(stats?.activeTemplates ?? 0)})
              </Chip>
              {categories.map((c) => (
                <Chip
                  key={c.name}
                  active={active === c.name && view === 'grid'}
                  onClick={() => {
                    setActive(c.name);
                    setView('grid');
                  }}
                >
                  {c.name} ({nf.format(c.count)})
                </Chip>
              ))}
              <Chip active={view === 'drafts'} onClick={() => setView('drafts')}>
                مسوداتي الخاصة ({nf.format(stats?.drafts ?? 0)})
              </Chip>
            </div>

            <div className="flex items-center gap-space-sm shrink-0 self-end lg:self-auto">

              <div className="relative">
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  className="h-9 w-56 pr-9 pl-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-label-sm text-label-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  placeholder="ابحث في النماذج والمسودات..."
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center bg-surface-container-low rounded-lg p-0.5">
                <button
                  className={
                    view === 'grid'
                      ? 'px-space-sm py-1 rounded bg-surface-container-lowest text-on-surface shadow-[0_1px_4px_rgba(0,0,0,0.04)] font-label-sm text-label-sm flex items-center gap-1'
                      : 'px-space-sm py-1 rounded text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm flex items-center gap-1'
                  }
                  title="عرض الشبكة الورقية"
                  type="button"
                  onClick={() => setView('grid')}
                >
                  <span className="material-symbols-outlined text-[16px]">grid_view</span>
                  <span>A4 مصغر</span>
                </button>
                <button
                  className={
                    view === 'drafts'
                      ? 'px-space-sm py-1 rounded bg-surface-container-lowest text-on-surface shadow-[0_1px_4px_rgba(0,0,0,0.04)] font-label-sm text-label-sm flex items-center gap-1'
                      : 'px-space-sm py-1 rounded text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm flex items-center gap-1'
                  }
                  title="عرض جدولي مفصل"
                  type="button"
                  onClick={() => setView('drafts')}
                >
                  <span className="material-symbols-outlined text-[16px]">table_rows</span>
                  <span>سجل مسودات</span>
                </button>
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
        {view === 'drafts' ? (
          <DraftsTable
            drafts={visibleDrafts}
            onOpen={(id) => onOpenDraft?.(id)}
            onDelete={(id) => void deleteDraft(id)}
          />
        ) : visible.length === 0 ? (
          <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] py-space-xl flex flex-col items-center gap-space-sm">
            <span className="material-symbols-outlined text-[44px] text-on-surface-variant">
              library_add
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {items.length === 0 ? 'مكتبة النماذج فارغة' : 'لا نتائج مطابقة'}
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant">
              {items.length === 0
                ? 'ابدأ من «نموذجٌ جديد» أعلاه: ورقةٌ فارغة، أو ملف Word، أو مجلد ملفاتك كلّه'
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
              مكتبة محلية بالكامل — النماذج والمسودات محفوظة على هذا الجهاز وحده
            </span>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
              type="button"
              disabled={busy || items.length === 0}
              onClick={() => void exportLibrary()}
            >
              <span className="material-symbols-outlined text-[18px]">drive_file_move</span>
              <span>تصدير المكتبة كاملة</span>
            </button>
            <button
              className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
              type="button"
              disabled={busy}
              onClick={() => void restoreLibrary()}
            >
              <span className="material-symbols-outlined text-[18px]">restore_page</span>
              <span>استرجاع مكتبة</span>
            </button>
            <button
              className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
              type="button"
              disabled={busy}
              onClick={() => void backup()}
            >
              <span className="material-symbols-outlined text-[18px]">backup</span>
              <span>نسخ احتياطي للمسودات</span>
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
        <div className="fixed inset-0 z-50 bg-primary-container/45 backdrop-blur-[2px] flex items-center justify-center p-space-lg">
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
              title="تصدير النموذج (XML للاسترجاع أو Word للمشاركة)"
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
        <div className="w-full max-w-[310px] aspect-[1/1.38] bg-surface-container-lowest rounded shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] text-right relative overflow-hidden select-none">
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
              ? `صدر عن هذا النموذج ${nf.format(usage)} كتابًا — تحذفه؟`
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
            title="تصدير النموذج (XML للاسترجاع أو Word للمشاركة)"
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
      className="fixed inset-0 z-50 bg-primary-container/45 backdrop-blur-[2px] flex flex-col items-center overflow-auto py-space-lg"
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

function DraftsTable({
  drafts,
  onOpen,
  onDelete
}: {
  drafts: DraftRow[];
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const COLUMNS = ['عنوان المسودة', 'النموذج', 'المواطن', 'آخر تعديل', 'الإجراءات'];

  return (
    <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-space-md flex items-center justify-between">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">سجل المسودات</h3>
        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
          {nf.format(drafts.length)} مسودة
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm tracking-wider select-none">
              {COLUMNS.map((c) => (
                <th key={c} className="p-space-md font-bold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-body-sm text-body-sm text-on-surface">
            {drafts.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length}>
                  <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px]">edit_note</span>
                    <span className="font-body-md text-body-md">لا مسودات محفوظة</span>
                    <span className="font-label-sm text-label-sm">
                      احفظ مسودة من المحرر لتظهر هنا
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              drafts.map((d) => (
                <tr key={d.id} className="hover:bg-surface-container-high transition-colors">
                  <td className="p-space-md font-semibold">{d.title || '(بلا عنوان)'}</td>
                  <td className="p-space-md text-on-surface-variant">{d.templateTitle ?? '—'}</td>
                  <td className="p-space-md text-on-surface-variant">{d.citizenName ?? '—'}</td>
                  <td className="p-space-md font-mono text-label-sm text-on-surface-variant">
                    {d.updatedAt}
                  </td>
                  <td className="p-space-md">
                    <div className="flex items-center gap-1">
                      <button
                        className="px-space-sm h-8 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors font-label-sm text-label-sm flex items-center gap-1"
                        type="button"
                        onClick={() => onOpen(d.id)}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit_document</span>
                        <span>متابعة</span>
                      </button>
                      <button
                        className="w-8 h-8 rounded-lg text-error hover:bg-error-container transition-colors flex items-center justify-center"
                        title="حذف المسودة"
                        type="button"
                        onClick={() => onDelete(d.id)}
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
