/**
 * لمحات المعرض (DESIGNS.md ٠٫٩): النوع بهويّة الجهة حيًّا بعيّنته، والتصميم المحفوظ بشكله — بمحرّك الرسم نفسه.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { canvasPx, SCREEN_DPI } from '@shared/canvas';
import { renderCanvasHtml } from '@shared/canvasHtml';
import { fitCanvasText } from '@shared/design/fit';
import { inlineBarcodes } from '@shared/design/imposition';
import { buildDoc, sampleValues, type Brand, type KindSpec, type Palette } from '@shared/design/kit';
import { freshImsakiya } from '@shared/design/imsakiya';

export function Thumb({
  kind,
  style,
  palette,
  brand,
  width,
  height
}: {
  kind: KindSpec;
  style: string;
  palette: Palette;
  brand: Brand;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { html, px } = useMemo(() => {
    const built = buildDoc({ kind: kind.key, style, palette, brand });
    const doc = { ...built, canvas: freshImsakiya(built.canvas!) };
    return {
      html: inlineBarcodes(renderCanvasHtml(doc, sampleValues(brand), { dpi: SCREEN_DPI, marks: false, missing: 'blank' })),
      px: canvasPx(doc.canvas!, SCREEN_DPI)
    };
  }, [kind, style, palette, brand]);
  const scale = Math.min(width / px.w, height / px.h);

  // القياس بعد الرسم وبعد الخطوط — فالاسم الطويل يصغر في اللمحة كما يصغر في الطباعة.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    fitCanvasText(root);
    void document.fonts.ready.then(() => ref.current && fitCanvasText(ref.current));
  }, [html]);

  return (
    <div className="shrink-0 overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgba(15,23,42,0.12),0_8px_24px_-6px_rgba(15,23,42,0.25)]" style={{ width: px.w * scale, height: px.h * scale }}>
      <div
        ref={ref}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ width: px.w, height: px.h, transform: `scale(${scale})`, transformOrigin: 'top right' }}
      />
    </div>
  );
}

/**
 * لمحةُ تصميمٍ محفوظ — بمحرّك الرسم نفسه، فيُعرف التصميم بشكله لا باسمه وحده.
 * وتُحمَّل حين تظهر البطاقة، والحقول فيها فراغاتٌ كما تخرج قبل الملء.
 */
export function SavedThumb({ id, width, height }: { id: number; width: number; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ html: string; w: number; h: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void window.diwan.templates
      .doc(id)
      .then((doc) => {
        if (!alive || !doc?.canvas) return;
        const px = canvasPx(doc.canvas, SCREEN_DPI);
        setView({
          html: inlineBarcodes(renderCanvasHtml(doc, {}, { dpi: SCREEN_DPI, marks: false, missing: 'blank' })),
          w: px.w,
          h: px.h
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id]);

  useLayoutEffect(() => {
    if (ref.current) fitCanvasText(ref.current);
  }, [view]);

  if (!view) return <span className="material-symbols-outlined text-[28px] text-on-surface-variant/50">draw</span>;
  const scale = Math.min(width / view.w, height / view.h);
  return (
    <div className="shrink-0 overflow-hidden rounded-[3px] shadow-sm" style={{ width: view.w * scale, height: view.h * scale }}>
      <div
        ref={ref}
        dangerouslySetInnerHTML={{ __html: view.html }}
        style={{ width: view.w, height: view.h, transform: `scale(${scale})`, transformOrigin: 'top right' }}
      />
    </div>
  );
}
