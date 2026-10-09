/**
 * التصاميم المحفوظة: القائمة، والحفظ (ونسخةً)، والفتح، والحذف — وما يصلح ظهرًا للبطاقة المفتوحة.
 */
import { useCallback, useEffect, useState } from 'react';
import type { TemplateSummary } from '@shared/api';
import type { Doc } from '@shared/doc';
import { normalizeCanvas, type Canvas, type TextElement } from '@shared/canvas';
import { startCanvasHistory, type CanvasHistory } from '@shared/canvasEdit';
import { errorText } from '../../lib/errors';
import { DESIGN_CATEGORY, textOf } from './kit';
import type { Side } from './useCanvasSides';

type Inputs = {
  say: (text: string, tone?: 'ok' | 'warn') => void;
  onChanged?: () => void;
  setBusy: (busy: boolean) => void;
  doc: Doc;
  canvas: Canvas;
  title: string;
  setTitle: (title: string) => void;
  setHistory: (h: CanvasHistory) => void;
  setBackHistory: (h: CanvasHistory | null) => void;
  setActiveSide: (side: Side) => void;
  setValues: (values: Record<string, string>) => void;
  setBatchMap: (map: Record<string, string | null>) => void;
  setSelection: (ids: string[]) => void;
  setView: (view: 'gallery' | 'editor') => void;
};

export function useDesignLibrary(i: Inputs) {
  const { say, onChanged, setBusy, doc, canvas, title, setTitle } = i;
  const [designs, setDesigns] = useState<TemplateSummary[]>([]);
  const [designId, setDesignId] = useState<number | null>(null);

  const loadDesigns = useCallback(async () => {
    try {
      setDesigns(await window.diwan.templates.list(DESIGN_CATEGORY, 'print-only'));
    } catch (e) {
      // قائمةٌ فارغةٌ بلا خبر تُقرأ «لا تصاميم محفوظة» — والقاعدة هي التي تعذّرت.
      setDesigns([]);
      say(errorText(e, 'تعذّر تحميل التصاميم المحفوظة'), 'warn');
    }
  }, [say]);

  useEffect(() => {
    void loadDesigns();
  }, [loadDesigns]);

  const save = useCallback(
    async (asCopy = false) => {
      const name = title.trim();
      if (!name) {
        say('سمِّ التصميم قبل الحفظ', 'warn');
        return;
      }
      setBusy(true);
      try {
        const finalTitle = asCopy ? `${name} (نسخة)` : name;
        const saved = await window.diwan.templates.save({
          id: asCopy ? null : designId,
          code: null,
          title: finalTitle,
          subtitle: doc.meta.form ? 'استمارة مصوّرة' : `${canvas.size.w.toFixed(1)} × ${canvas.size.h.toFixed(1)} ملم`,
          // الاستمارة المصوّرة تبقى في «استمارات» تُملأ من الشبّاك — لا تنتقل إلى التصاميم (المرحلة ٤).
          category: doc.meta.form ? 'استمارات' : DESIGN_CATEGORY,
          subjectLine: null,
          bodyHtml: canvas.elements
            .filter((el): el is TextElement => el.kind === 'text')
            .map((el) => textOf(el.inlines))
            .join('\n'),
          letterheadId: null,
          variables: [],
          doc
        });
        setDesignId(saved.id);
        if (asCopy) setTitle(finalTitle);
        await loadDesigns();
        onChanged?.();
        say(asCopy ? 'حُفظت نسخة جديدة من التصميم' : designId === null ? 'حُفظ التصميم' : 'حُفظت التعديلات');
      } catch (e) {
        say(errorText(e, 'تعذّر حفظ التصميم'), 'warn');
      } finally {
        setBusy(false);
      }
    },
    [title, designId, canvas, doc, loadDesigns, onChanged, say, setBusy, setTitle]
  );

  const deleteDesign = useCallback(
    async (id: number) => {
      try {
        await window.diwan.templates.delete(id);
        if (designId === id) {
          setDesignId(null);
          i.setBatchMap({});
          setTitle('');
        }
        await loadDesigns();
        onChanged?.();
        say('تم حذف التصميم');
      } catch (e) {
        say(errorText(e, 'تعذّر حذف التصميم'), 'warn');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [designId, loadDesigns, onChanged, say]
  );

  const openDesign = useCallback(
    async (id: number) => {
      try {
        const loaded = await window.diwan.templates.doc(id);
        i.setHistory(startCanvasHistory(normalizeCanvas(loaded.canvas)));
        if (loaded.backCanvas) {
          i.setBackHistory(startCanvasHistory(normalizeCanvas(loaded.backCanvas)));
        } else {
          i.setBackHistory(null);
        }
        i.setActiveSide('front');
        setTitle(loaded.meta.title ?? '');
        i.setValues({});
        i.setBatchMap(loaded.meta.batchMap ?? {});
        setDesignId(id);
        i.setSelection([]);
        i.setView('editor');
        say('فُتح التصميم');
      } catch (e) {
        say(errorText(e, 'تعذّر فتح التصميم'), 'warn');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say]
  );

  /** تصاميمُ محفوظة بمقاس هذه البطاقة — تصلح ظهرًا لها. */
  const sizeTag = `${canvas.size.w.toFixed(1)} × ${canvas.size.h.toFixed(1)}`;
  const backChoices = designs.filter((d) => d.id !== designId && (d.subtitle ?? '').startsWith(sizeTag));

  return { designs, designId, setDesignId, save, deleteDesign, openDesign, backChoices };
}
