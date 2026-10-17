/**
 * التصاميم المحفوظة: القائمة، والحفظ (ونسخةً)، والفتح، والحذف — وما يصلح ظهرًا للبطاقة المفتوحة. ومسودّة تصميمٍ لم يُحفظ
 * تُستأنف هنا كما يُفتح المحفوظ (`useDesignDraft`).
 */
import { useCallback, useEffect, useState } from 'react';
import type { TemplateSummary } from '@shared/api';
import type { Doc } from '@shared/doc';
import { localStamp } from '@shared/dates';
import { normalizeCanvas, type Canvas, type TextElement } from '@shared/canvas';
import { startCanvasHistory, type CanvasHistory } from '@shared/canvasEdit';
import { isDesignDraft, readDesignDraft } from '@shared/design/draft';
import { errorText } from '../../lib/errors';
import { ask } from '../../kit/ask';
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
  designId: number | null;
  setDesignId: (id: number | null) => void;
  /** جلسةٌ جديدة قبل أن يُبدَّل ما في اللوحة — و`draftId` مسودّةٌ تُستأنف (`useDesignDraft`). */
  beginSession: (draftId?: number) => void;
  markSaved: () => void;
  setHistory: (h: CanvasHistory) => void;
  setBackHistory: (h: CanvasHistory | null) => void;
  setActiveSide: (side: Side) => void;
  setValues: (values: Record<string, string>) => void;
  setBatchMap: (map: Record<string, string | null>) => void;
  setSelection: (ids: string[]) => void;
  setView: (view: 'gallery' | 'editor') => void;
};

export function useDesignLibrary(i: Inputs) {
  const { say, onChanged, setBusy, doc, canvas, title, setTitle, designId, setDesignId } = i;
  const [designs, setDesigns] = useState<TemplateSummary[]>([]);

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
        i.markSaved();
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
    // الناقص ضوابطُ حالٍ ثابتة (`setDesignId` و`setTitle` و`i.setBatchMap`) — لا قيمةٌ تُقرأ قديمة
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [designId, loadDesigns, onChanged, say]
  );

  /** يضع تصميمًا في اللوحة بجلسةٍ جديدة — محفوظًا أو من مسودّته. */
  const show = (loaded: Doc, id: number | null, values: Record<string, string>, draftId?: number) => {
    i.beginSession(draftId);
    i.setHistory(startCanvasHistory(normalizeCanvas(loaded.canvas)));
    i.setBackHistory(loaded.backCanvas ? startCanvasHistory(normalizeCanvas(loaded.backCanvas)) : null);
    i.setActiveSide('front');
    setTitle(loaded.meta.title ?? '');
    i.setValues(values);
    i.setBatchMap(loaded.meta.batchMap ?? {});
    setDesignId(id);
    i.setSelection([]);
    i.setView('editor');
  };

  /** مسودّةُ تصميمٍ لم يُحفظ — من «قيد العمل» أو رأس المعرض: يعود كما تُرك، والكتابة بعدُ في المسودّة نفسها. */
  const resumeDraft = useCallback(
    async (draftId: number) => {
      try {
        const row = (await window.diwan.drafts.list()).find((d) => d.id === draftId);
        const draft = row ? readDesignDraft(row.valuesJson) : null;
        if (!row || !draft) {
          say('لم تُعثر على المسودّة — لعلّها حُذفت أو حُفظ تصميمها', 'warn');
          return;
        }
        show(draft.doc, row.templateId, draft.values, draftId);
        say('عاد التصميم كما تُرك — احفظه حين تنتهي');
      } catch (e) {
        say(errorText(e, 'تعذّر فتح المسودّة'), 'warn');
      }
    },
    // `show` ضوابطُ حالٍ وجلسةٌ تقرأ من مرجع (`latest`) — فلا تُقرأ قيمةٌ قديمة
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say]
  );

  const openDesign = useCallback(
    async (id: number) => {
      try {
        // للتصميم تعديلاتٌ لم تُحفظ: يُسأل أيّهما — ولا يُمحى شيء، فما لم يُختر يبقى في «قيد العمل».
        const pending = (await window.diwan.drafts.list()).find((d) => d.templateId === id && isDesignDraft(d.valuesJson));
        if (pending) {
          const answer = await ask({
            title: 'لهذا التصميم تعديلاتٌ لم تُحفظ',
            message: `آخرها ${localStamp(pending.updatedAt)}. وما لا تفتحه يبقى في «قيد العمل».`,
            choices: [
              { key: 'saved', label: 'افتح المحفوظ', tone: 'neutral' },
              { key: 'draft', label: 'أكمل التعديلات', tone: 'primary' }
            ],
            fallback: 'draft'
          });
          if (answer === 'draft') {
            await resumeDraft(pending.id);
            return;
          }
        }
        const loaded = await window.diwan.templates.doc(id);
        show(loaded, id, {});
        say('فُتح التصميم');
      } catch (e) {
        say(errorText(e, 'تعذّر فتح التصميم'), 'warn');
      }
    },
    // `show` ضوابطُ حالٍ وجلسةٌ تقرأ من مرجع (`latest`) — فلا تُقرأ قيمةٌ قديمة
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say, resumeDraft]
  );

  /** تصاميمُ محفوظة بمقاس هذه البطاقة — تصلح ظهرًا لها. */
  const sizeTag = `${canvas.size.w.toFixed(1)} × ${canvas.size.h.toFixed(1)}`;
  const backChoices = designs.filter((d) => d.id !== designId && (d.subtitle ?? '').startsWith(sizeTag));

  return { designs, loadDesigns, save, deleteDesign, openDesign, resumeDraft, backChoices };
}
