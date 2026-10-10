/**
 * الوثيقة مشتقّة من اللوحة، والحقول تتبعها — ورسمها للشاشة. وظهرٌ محفوظٌ يُختار للبطاقة.
 */
import { useEffect, useMemo, useState } from 'react';
import { reconcileFields, type Doc } from '@shared/doc';
import { SCREEN_DPI, canvasDoc, type Canvas } from '@shared/canvas';
import type { CanvasHistory } from '@shared/canvasEdit';
import { renderCanvasHtml } from '@shared/canvasHtml';
import { valuesInCalendars } from '@shared/dates';
import { DESIGN_CATEGORY } from './kit';
import type { Side } from './useCanvasSides';

/** ظهر البطاقة: تصميمٌ محفوظٌ بالمقاس نفسه، يُطبع خلف كل وجه. */
export function useBackDesign() {
  const [backId, setBackId] = useState<number | null>(null);
  const [backDoc, setBackDoc] = useState<Doc | null>(null);
  useEffect(() => {
    if (!backId) {
      setBackDoc(null);
      return;
    }
    void window.diwan.templates.doc(backId).then((d) => setBackDoc(d?.canvas ? d : null));
  }, [backId]);
  return { backId, setBackId, backDoc };
}

type Inputs = {
  history: CanvasHistory;
  backHistory: CanvasHistory | null;
  backDoc: Doc | null;
  title: string;
  batchMap: Record<string, string | null>;
  activeSide: Side;
  canvas: Canvas;
  values: Record<string, string>;
  preview: boolean;
  batchRows: Record<string, string>[];
};

export function useDesignDoc({ history, backHistory, backDoc, title, batchMap, activeSide, canvas, values, preview, batchRows }: Inputs) {
  const effectiveBackDoc = useMemo(() => {
    if (backHistory?.present && (backHistory.present.elements.length > 0 || backHistory.present.background.kind !== 'none')) {
      return canvasDoc(backHistory.present);
    }
    return backDoc;
  }, [backHistory, backDoc]);

  const doc: Doc = useMemo(() => {
    const built = canvasDoc(history.present, { title: title || 'تصميم', category: DESIGN_CATEGORY });
    if (backHistory?.present && (backHistory.present.elements.length > 0 || backHistory.present.background.kind !== 'none')) {
      built.backCanvas = backHistory.present;
    }
    // وحقل التاريخ بتقويمه المحفوظ في اللوحة (٣٫٤) — حقلُ تاريخٍ يُكتب به.
    const calendars = history.present.calendars ?? {};
    built.fields = reconcileFields(built).map((f) => (calendars[f.key] ? { ...f, type: 'date' as const, calendar: calendars[f.key] } : f));
    if (Object.keys(batchMap).length) built.meta = { ...built.meta, batchMap };
    return built;
  }, [history.present, backHistory, title, batchMap]);

  const html = useMemo(
    // مع دفعةٍ تُعرض بطاقة أوّل اسمٍ فيها — فيُرى الاسم الحقيقي في موضعه لا وسمُه.
    () =>
      renderCanvasHtml(activeSide === 'front' ? doc : (effectiveBackDoc ?? canvasDoc(canvas)), valuesInCalendars(batchRows[0] ? { ...values, ...batchRows[0] } : values, doc.canvas?.calendars), {
        dpi: SCREEN_DPI,
        missing: preview ? 'blank' : 'token'
      }),
    [doc, effectiveBackDoc, canvas, activeSide, values, preview, batchRows]
  );

  /** مقاسُ صورة الطالب في البطاقة بالملّم — منه يقصّ الاستوديو لقطاته. */
  const photoSize = useMemo(() => {
    const el = canvas.elements.find((e) => e.kind === 'image' && e.ref);
    return el ? { w: el.box.w * canvas.size.w, h: el.box.h * canvas.size.h } : undefined;
  }, [canvas]);

  /** حقول الصور في التصميم — تُختار صورةً لا تُكتب نصًّا. */
  const imageKeys = useMemo(() => [...new Set(canvas.elements.flatMap((el) => (el.kind === 'image' && el.ref ? [el.ref] : [])))], [canvas.elements]);

  return { doc, effectiveBackDoc, html, photoSize, imageKeys };
}
