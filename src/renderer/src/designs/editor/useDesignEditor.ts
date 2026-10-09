/**
 * محرّر التصاميم مجموعًا: كلّ خطّافٍ في ملفّه بعمله (DESIGNS.md ٠٫٣ و٣٫٢)، وهنا يُركَّب بعضها على بعض بترتيب ما يحتاجه
 * كلٌّ من غيره — ومنه تأخذ الشاشة ولوحاتها ما تعرضه. ولا حسابَ هنا.
 */
import { useEffect, useState } from 'react';
import { useToast } from '../../kit/useToast';
import { screenGeometry } from './kit';
import { useCanvasSides } from './useCanvasSides';
import { useCanvasElements } from './useCanvasElements';
import { useCanvasPointer } from './useCanvasPointer';
import { useDesignKeys } from './useDesignKeys';
import { useBackDesign, useDesignDoc } from './useDesignDoc';
import { useDesignLibrary } from './useDesignLibrary';
import { useDesignSources } from './useDesignSources';
import { useBatchCards, useBatchState } from './useDesignBatch';
import { useDesignOutput } from './useDesignOutput';

/**
 * ما تُفتح به الشاشة من غيرها: تصميمُ طلبٍ بقائمته، أو المعرضُ على جهة.
 * و`key` يتغيّر مع كل طلب — فيُفتح ثانيةً ولو كان الطلب نفسه.
 */
export type DesignRequest = {
  key: number;
  templateId?: number;
  batchText?: string | null;
  clientId?: number;
  /** الطلب الذي فُتح منه التصميم — فإذا طُبع صار الطلب «جاهزًا للتسليم» (د٨). */
  order?: { id: number; title: string };
  /** «المكتبة ← استورد ← تصميم من Photoshop أو PDF»: يُسأل عن الملف حين تُفتح (المرحلة ٥). */
  action?: 'import';
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
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(0.5);
  const [title, setTitle] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [copies, setCopies] = useState(1);
  const [clipartModalOpen, setClipartModalOpen] = useState(false);
  const [newBlankModalOpen, setNewBlankModalOpen] = useState(false);
  /** الطلب الذي تُطبع له هذه الدفعة — ما دام التصميم تصميمَه. */
  const [linkedOrder, setLinkedOrder] = useState<{ id: number; title: string; templateId: number } | null>(null);

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
  useDesignKeys({
    canvas, selection: els.selection, setSelection: els.setSelection, apply, undo: sides.undo, redo: sides.redo,
    duplicateSelected: els.duplicateSelected, removeSelected: els.removeSelected
  });
  const library = useDesignLibrary({
    say, onChanged, setBusy, doc: docs.doc, canvas, title, setTitle, setHistory: sides.setHistory, setBackHistory: sides.setBackHistory,
    setActiveSide: sides.setActiveSide, setValues, setBatchMap: batch.setBatchMap, setSelection: els.setSelection, setView
  });
  const sources = useDesignSources({
    say, canvas, apply, add: els.add, title, setTitle, setHistory: sides.setHistory, setBackHistory: sides.setBackHistory,
    setActiveSide: sides.setActiveSide, setValues, setSelection: els.setSelection, setDesignId: library.setDesignId, setBatchMap: batch.setBatchMap, setView
  });
  const cards = useBatchCards({ doc: docs.doc, values, copies, batchRows: batch.batchRows });
  const output = useDesignOutput({
    canvas, doc: docs.doc, effectiveBackDoc: docs.effectiveBackDoc, cards: cards.cards, batchRows: batch.batchRows, unsureCount: cards.unsureBatch.length,
    title, designId: library.designId, linkedOrder, say, onChanged, setBusy, afterReview: cards.afterReview, setAfterReview: cards.setAfterReview
  });

  /**
   * فُتحت الشاشة من طلب: تصميمه بقائمته في الدفعة — فيراجع المكتب الأوراق ويطبع.
   * ومن ملف جهة: المعرض عليها (يتولّاه المعرض نفسه).
   */
  useEffect(() => {
    if (!request) return;
    setLinkedOrder(request.order && request.templateId ? { ...request.order, templateId: request.templateId } : null);
    if (request.templateId) {
      void library.openDesign(request.templateId).then(() => {
        batch.setBatchSeed(request.batchText ?? '');
        batch.setBatchPhotos([]);
        batch.setBatchKey((k) => k + 1);
      });
    } else {
      setView('gallery');
      if (request.action === 'import') void sources.importDesign();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.key]);

  return {
    request, onChanged, toast, say, busy, view, setView, preview, setPreview, grid, setGrid, zoom, setZoom, title, setTitle, values, setValues,
    copies, setCopies, clipartModalOpen, setClipartModalOpen, newBlankModalOpen, setNewBlankModalOpen, geometry,
    ...sides, ...els, ...batch, ...back, ...docs, ...pointer, ...library, ...sources, ...cards, ...output
  };
}

export type DesignEditor = ReturnType<typeof useDesignEditor>;
