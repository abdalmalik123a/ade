/**
 * محرّر التصاميم مجموعًا: كلّ خطّافٍ في ملفّه بعمله (DESIGNS.md ٠٫٣ و٣٫٢)، وهنا يُركَّب بعضها على بعض بترتيب ما يحتاجه
 * كلٌّ من غيره — ومنه تأخذ الشاشة ولوحاتها ما تعرضه. ولا حسابَ هنا.
 */
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../kit/useToast';
import { screenGeometry } from './kit';
import { useCanvasSides } from './useCanvasSides';
import { useCanvasElements } from './useCanvasElements';
import { useCanvasPointer } from './useCanvasPointer';
import { useDesignTools } from './useDesignTools';
import { useDesignKeys } from './useDesignKeys';
import { useBackDesign, useDesignDoc } from './useDesignDoc';
import { useDesignLibrary } from './useDesignLibrary';
import { useDesignDraft } from './useDesignDraft';
import { useDesignSources } from './useDesignSources';
import { useBatchCards, useBatchState } from './useDesignBatch';
import { useDesignOutput } from './useDesignOutput';
import { useOrderFill } from './useOrderFill';

/**
 * ما تُفتح به الشاشة من غيرها: تصميمُ طلبٍ بقائمته، أو المعرضُ على جهة.
 * و`key` يتغيّر مع كل طلب — فيُفتح ثانيةً ولو كان الطلب نفسه.
 */
export type DesignRequest = {
  key: number;
  templateId?: number;
  batchText?: string | null;
  clientId?: number;
  /** الطلب الذي فُتح منه التصميم — فإذا طُبع صار الطلب «جاهزًا للتسليم» (د٨)؛ وكمّيته نسخُه إن لم تكن قائمة (٣٫٥). */
  order?: { id: number; title: string; quantity?: number | null };
  /** «المكتبة ← استورد ← تصميم من Photoshop أو PDF»: يُسأل عن الملف حين تُفتح (المرحلة ٥). */
  action?: 'import';
  /** مسودّةُ تصميمٍ لم يُحفظ من «قيد العمل» (DESIGNS.md ٠٫٦). */
  draftId?: number;
};

export type DesignsScreenProps = {
  request?: DesignRequest | null;
  onChanged?: () => void;
};

export function useDesignEditor({ request, onChanged }: DesignsScreenProps) {
  const { toast, say } = useToast(3400);
  const [busy, setBusy] = useState(false);
  /** المعرض أولًا: يبدأ المكتب من «لمن التصميم؟» لا من لوحةٍ فارغة. */
  const [view, setView] = useState<'gallery' | 'editor'>('gallery');
  const [preview, setPreview] = useState(false);
  const [rulers, setRulers] = useState(true);
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(0.5);
  /** «ملء الشاشة»: يزيد فيعيد المكتبُ (Stage) قياسَ التكبير. */
  const [fitKey, setFitKey] = useState(0);
  const zoomBy = useCallback((f: number) => setZoom((z) => Math.min(3, Math.max(0.15, Math.round(z * f * 100) / 100))), []);
  const [title, setTitle] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [copies, setCopies] = useState(1);
  const [clipartModalOpen, setClipartModalOpen] = useState(false);
  const [newBlankModalOpen, setNewBlankModalOpen] = useState(false);
  /** الطلب الذي تُطبع له هذه الدفعة — ما دام التصميم تصميمَه. */
  const [linkedOrder, setLinkedOrder] = useState<{ id: number; title: string; templateId: number | null } | null>(null);

  const sides = useCanvasSides();
  const { canvas, apply } = sides;
  const els = useCanvasElements(canvas, apply);
  const batch = useBatchState();
  const back = useBackDesign();
  const docs = useDesignDoc({
    history: sides.history, backHistory: sides.backHistory, backDoc: back.backDoc, title, batchMap: batch.batchMap,
    activeSide: sides.activeSide, canvas, values, preview, batchRows: batch.batchRows
  });
  const geometry = screenGeometry(canvas);
  const pointer = useCanvasPointer({ canvas, apply, patchElement: els.patchElement, selection: els.selection, setSelection: els.setSelection, pushPast: sides.pushPast, zoom, geometry });
  const tools = useDesignTools({ add: els.add, pointAt: pointer.pointAt, zoom, geometry, activeSide: sides.activeSide, view });
  useDesignKeys({
    canvas, selection: els.selection, setSelection: els.setSelection, apply, undo: sides.undo, redo: sides.redo,
    duplicateSelected: els.duplicateSelected, removeSelected: els.removeSelected, selectAll: els.selectAll, copy: els.copy, cut: els.cut,
    paste: els.paste, group: els.group, ungroup: els.ungroup, layer: els.layer
  });
  const [designId, setDesignId] = useState<number | null>(null);
  const draft = useDesignDraft({ doc: docs.doc, title, values, designId, say, onChanged });
  const library = useDesignLibrary({
    say, onChanged, setBusy, doc: docs.doc, canvas, title, setTitle, designId, setDesignId, beginSession: draft.beginSession, markSaved: draft.markSaved,
    setHistory: sides.setHistory, setBackHistory: sides.setBackHistory, setActiveSide: sides.setActiveSide, setValues, setBatchMap: batch.setBatchMap,
    setSelection: els.setSelection, setView
  });
  const sources = useDesignSources({
    say, canvas, apply, add: els.add, title, setTitle, setHistory: sides.setHistory, setBackHistory: sides.setBackHistory,
    setActiveSide: sides.setActiveSide, setValues, setSelection: els.setSelection, setDesignId, setBatchMap: batch.setBatchMap, setView,
    beginSession: draft.beginSession
  });
  const cards = useBatchCards({ doc: docs.doc, values, copies, batchRows: batch.batchRows });
  // الطلب وملفّ الجهة يملآن التصميم (٣٫٥).
  const order = useOrderFill({
    doc: docs.doc, values, setValues, setCopies, say, learned: cards.learned, pickFromGallery: sources.pickFromGallery,
    seedBatch: (text) => {
      batch.setBatchSeed(text);
      batch.setBatchPhotos([]);
      batch.setBatchKey((k) => k + 1);
    }
  });
  const output = useDesignOutput({
    canvas, doc: docs.doc, effectiveBackDoc: docs.effectiveBackDoc, cards: cards.cards, batchRows: batch.batchRows, unsureCount: cards.unsureBatch.length,
    title, designId, linkedOrder, say, onChanged, setBusy, afterReview: cards.afterReview, setAfterReview: cards.setAfterReview
  });

  /**
   * فُتحت الشاشة من طلب: تصميمه بقائمته في الدفعة — فيراجع المكتب الأوراق ويطبع.
   * ومن ملف جهة: المعرض عليها (يتولّاه المعرض نفسه).
   */
  useEffect(() => {
    if (!request) return;
    // وطلبٌ بلا تصميم (٣٫٥): التصميم الجديد من المعرض له ما لم يُحفظ — `templateId` عدمٌ كرقم التصميم غير المحفوظ.
    setLinkedOrder(request.order ? { ...request.order, templateId: request.templateId ?? null } : null);
    if (request.draftId) {
      void library.resumeDraft(request.draftId);
    } else if (request.templateId) {
      // قائمة الطلب في الدفعة، وجهته تملأ حقوله، وكمّيته نسخه (٣٫٥).
      void library.openDesign(request.templateId).then(() =>
        order.openedFromOrder({ clientId: request.clientId, batchText: request.batchText, quantity: request.order?.quantity })
      );
    } else {
      order.galleryForOrder(request.order ? { batchText: request.batchText, quantity: request.order.quantity } : null);
      setView('gallery');
      if (request.action === 'import') void sources.importDesign(true);
    }
    // مرّةً لكلّ طلبٍ بمفتاحه: `library` و`order` و`sources` كائناتٌ تتجدّد كلّ رسم
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.key]);

  return {
    request, onChanged, toast, say, busy, view, setView, preview, setPreview, grid, setGrid, rulers, setRulers, zoom, setZoom, title, setTitle, values, setValues,
    copies, setCopies, clipartModalOpen, setClipartModalOpen, newBlankModalOpen, setNewBlankModalOpen, geometry, designId, setDesignId,
    fitKey, zoomFit: () => setFitKey((k) => k + 1), zoomBy,
    draftSavedAt: draft.draftSavedAt,
    ...sides, ...els, ...batch, ...back, ...docs, ...pointer, ...tools, ...library, ...sources, ...cards, ...output,
    pickFromGallery: order.pickFromGallery, fillFromClient: order.fillNow,
    // تصميمٌ محفوظ يُفتح من المعرض ليس من الطلب: نسخه لا تبقى كمّية الطلب.
    openDesign: (id: number) => {
      order.leaveOrder();
      return library.openDesign(id);
    }
  };
}

export type DesignEditor = ReturnType<typeof useDesignEditor>;
