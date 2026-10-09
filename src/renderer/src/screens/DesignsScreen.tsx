/**
 * التصاميم — الشهادة والهوية والملصق والدعوة.
 *
 * وهي لوحاتٌ لا وثائق متدفّقة: مقاسٌ ثابت وصفحةٌ واحدة وخلفيةٌ تملأ الورقة وعناصرُ بمواضعها. ولذلك شاشةٌ ثالثة: لا
 * الكتب ولا الأسئلة تصلح لها.
 *
 * **نصمّم ونحفظ ونملأ ونطبع** (قرار المالك ٧ تشرين الأول ٢٠٢٦ — DESIGNS.md §١): يُصمَّم هنا أو في Word أو Photoshop
 * فيُفتح هنا بمقاسه من الملف، وتُوضع فوقه حقولٌ تُملأ وتُطبع. والحقل هو الحقل نفسه، فالدمج يعمل بلا تغيير.
 *
 * والشاشة تركيبٌ فقط (DESIGNS.md ٠٫٣): الحال والعمل في خطّافات `designs/editor/*`، واللوحات في `designs/panels/*`، والحساب
 * الهندسي في `shared/canvasEdit.ts` — قواعدُ تُختبر بالأرقام.
 */
import Gallery from '../designs/Gallery';
import DraftStrip from '../designs/DraftStrip';
import ClipartModal from '../designs/ClipartModal';
import NewBlankModal from '../designs/NewBlankModal';
import { ToolHeader, ToolOutput } from '../components/ToolFrame';
import { useDesignEditor, type DesignsScreenProps } from '../designs/editor/useDesignEditor';
import EditorSidebar from '../designs/editor/EditorSidebar';
import EditorToolbar from '../designs/editor/EditorToolbar';
import Stage from '../designs/editor/Stage';
import DesignModals from '../designs/editor/DesignModals';

export type { DesignRequest, DesignsScreenProps } from '../designs/editor/useDesignEditor';

export default function DesignsScreen(props: DesignsScreenProps) {
  const ed = useDesignEditor(props);
  const { request, view, toast } = ed;
  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      {/* المعرض يبقى مركّبًا مخفيًّا: الرجوع إليه يجد الجهة واللون والنمط كما تُركت. */}
      <div className={view === 'gallery' ? 'h-[calc(100vh-4rem)] flex flex-col' : 'hidden'}>
        <div className="shrink-0 max-w-[1440px] w-full mx-auto px-space-xl pt-space-md">
          <ToolHeader bar icon="workspace_premium" title="شهادات وتصاميم" />
          <DraftStrip refreshKey={`${view}-${ed.draftSavedAt?.getTime() ?? 0}`} onResume={(id) => void ed.resumeDraft(id)} />
        </div>
        <div className="flex-1 min-h-0">
          <Gallery
            presetClient={request?.clientId ? { id: request.clientId, key: request.key } : null}
            saved={ed.designs}
            onImport={() => void ed.importDesign(true)}
            onOpenImage={() => void ed.openBackground(true)}
            onOpenSaved={(id) => void ed.openDesign(id)}
            onDeleteSaved={(id) => void ed.deleteDesign(id)}
            onPick={ed.pickFromGallery}
            onNewBlank={() => ed.setNewBlankModalOpen(true)}
          />
        </div>
      </div>

      {ed.newBlankModalOpen && <NewBlankModal isOpen={ed.newBlankModalOpen} onClose={() => ed.setNewBlankModalOpen(false)} onCreate={ed.handleCreateBlank} />}

      {ed.clipartModalOpen && <ClipartModal isOpen={ed.clipartModalOpen} onClose={() => ed.setClipartModalOpen(false)} onSelect={ed.handleSelectClipart} />}

      <div className={view === 'editor' ? 'flex h-[calc(100vh-4rem)]' : 'hidden'}>
        <EditorSidebar ed={ed} />

        {/* ── اللوحة ───────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col min-w-0">
          <EditorToolbar ed={ed} />
          <Stage ed={ed} />
          <ToolOutput
            bar
            after={ed.after}
            role="designs"
            onDismiss={() => ed.setAfter(null)}
            onReprint={ed.lastPick.current ? () => void ed.print(ed.lastPick.current!) : undefined}
          >
            <div className="flex-1" />
            <button
              className="h-9 px-space-md rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-md disabled:opacity-50"
              data-act="print"
              title="راجع الأوراق ثم اطبع — بلا إصدار"
              type="button"
              disabled={ed.busy}
              onClick={() => ed.setSheetsOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              راجع الأوراق واطبع
            </button>
          </ToolOutput>
        </section>
      </div>

      <DesignModals ed={ed} />

      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${
            toast.tone === 'ok' ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}
