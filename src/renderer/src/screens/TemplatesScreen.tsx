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
  ImportPlan,
  ImportedTemplate,
  TemplateDetail,
  TemplateStats,
  TemplateSummary
} from '@shared/api';
import type { Doc } from '@shared/doc';
import type { WordScan } from '@shared/wordLosses';
import {
  isLayoutEmpty,
  type Letterhead } from '@shared/letterhead';
import TemplateDesigner from './TemplateDesigner';
import { normalizeFold } from '@shared/arabic';
import { PreviewModal } from './templates/PreviewModal';
import { PacksModal } from './templates/PacksModal';
import { SORTS } from './templates/shared';
import LibraryHeader from './templates/LibraryHeader';
import LibraryFilters from './templates/LibraryFilters';
import LibraryEmpty from './templates/LibraryEmpty';
import TemplateGrid from './templates/TemplateGrid';
import LibraryFooter from './templates/LibraryFooter';
import { useTemplateImports } from './templates/useTemplateImports';
import ImportedLetterhead from './templates/ImportedLetterhead';

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

  // ── الاستيراد والتصدير والحزم وحذف النموذج وتكراره — `templates/useTemplateImports.ts` ──
  const { importFolder, openPacksModal, importTemplate, importExcel, duplicateTemplate, exportOne, removeTemplate, exportContent, applyPlan, keepImportedLetterhead, importBundledPack, handleImportFileFromModal } = useTemplateImports({
    setBusy, setPendingImport, openImported, say, setPlan, reload, active, onChanged, setLetterheads, setImporting, setPacksModal,
    setLoadingPacks, setBundledPacks
  });

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="p-space-lg flex flex-col gap-space-md">
        {/* رأس المكتبة: ورقةٌ فارغة، و«استورد» واحدٌ بطرقه كلّها (المرحلة ٥). */}
        <LibraryHeader
          stats={stats}
          openDesigner={openDesigner}
          importing={importing}
          busy={busy}
          setImporting={setImporting}
          importTemplate={importTemplate}
          importFolder={importFolder}
          importExcel={importExcel}
          setPaperOpen={setPaperOpen}
          setFormOpen={setFormOpen}
          onImportDesign={onImportDesign}
          openPacksModal={openPacksModal}
        />

        {/* الأقسام: تصنيفات الجهات — والبحث فيها يتسامح مع الهمزة */}
        <LibraryFilters
          active={active}
          setActive={setActive}
          stats={stats}
          categories={categories}
          query={query}
          setQuery={setQuery}
          sort={sort}
          setSort={setSort}
        />

        {/* المحتوى */}
        {visible.length === 0 ? (
          <LibraryEmpty
            items={items}
            busy={busy}
            importFolder={importFolder}
            openDesigner={openDesigner}
          />
        ) : (
          <TemplateGrid
            visible={visible}
            letterheads={letterheads}
            onOpenInEditor={onOpenInEditor}
            openDesigner={openDesigner}
            duplicateTemplate={duplicateTemplate}
            setZoomed={setZoomed}
            exportOne={exportOne}
            removeTemplate={removeTemplate}
          />
        )}

        {/* شريط التذييل */}
        <LibraryFooter
          busy={busy}
          exportContent={exportContent}
        />
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
        <ImportedLetterhead
          pendingImport={pendingImport}
          setPendingImport={setPendingImport}
          openImported={openImported}
          keepImportedLetterhead={keepImportedLetterhead}
        />
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

