/**
 * اللوحة: الورقة مرسومةً بمقاسها وتكبيرها، والشبكة، وخطوط الإرشاد، ومقابض التحديد فوق الرسم — لا داخله، فالمطبوع
 * لا يحملها.
 */
import { useEffect, useRef, useState } from 'react';
import { SCREEN_DPI, mmToPx } from '@shared/canvas';
import { useCanvasPaint } from './useCanvasPaint';
import ElementHandles from './ElementHandles';
import InlineTextEditor from './InlineTextEditor';
import type { DesignEditor } from './useDesignEditor';

export default function Stage({ ed }: { ed: DesignEditor }) {
  const { canvas, preview, grid, zoom, setZoom, view, guides, html, marquee } = ed;
  const { page, pxW, pxH, offset } = ed.geometry;
  const deskRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const editingEl = canvas.elements.find((el) => el.id === editing);
  useEffect(() => { setEditing(null); }, [ed.activeSide, view]);
  const paintRef = useCanvasPaint(html, preview);

  useEffect(() => {
    const fit = () => {
      const desk = deskRef.current;
      // البطاقة تُكبَّر حتى تملأ المكتب (إلى ثلاثة أضعاف)، والشهادة تُصغَّر لتسعه.
      if (desk && desk.clientWidth) setZoom(Math.min(3, Math.max(0.15, Math.min((desk.clientWidth - 64) / page.w, (desk.clientHeight - 64) / page.h))));
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (deskRef.current) observer.observe(deskRef.current, { box: 'border-box' });
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
    // والعودة من المعرض تعيد القياس: المحرّر المخفيّ عرضه صفر. و«ملء الشاشة» من الشريط يعيده (`fitKey`).
  }, [page.w, page.h, view, setZoom, ed.fitKey]);

  // Ctrl مع عجلة الفأرة يكبّر ويصغّر اللوحة لا البرنامج (DESIGNS.md ١٫٦) — مستمعٌ غير سلبيّ ليُمنع تكبير النافذة.
  useEffect(() => {
    const desk = deskRef.current;
    if (!desk) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      ed.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    desk.addEventListener('wheel', onWheel, { passive: false });
    return () => desk.removeEventListener('wheel', onWheel);
  }, [ed.zoomBy]);

  return (
    <div ref={deskRef} dir="rtl" className="flex-1 min-w-0 min-h-0 overflow-auto flex items-start justify-center p-space-lg" data-desk="" onMouseLeave={() => { ed.endDrag(); ed.cancelPlacement(); }} onMouseMove={(e) => { ed.movePlacement(e); ed.onMove(e); }} onMouseUp={(e) => { ed.finishPlacement(e); ed.endDrag(); }}>
      <div className="shrink-0" style={{ width: page.w * zoom, height: page.h * zoom }}>
        <div
          ref={ed.sheetRef}
          className="shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)]"
          data-design
          style={{
            width: page.w,
            height: page.h,
            transform: `scale(${zoom})`,
            transformOrigin: 'top right',
            position: 'relative'
          }}
          onMouseDownCapture={(e) => { if (!preview && !(e.target as HTMLElement).closest('[data-inline-editor]')) ed.startPlacement(e); }}
          onMouseDown={(e) => {
            // الضغط خارج العناصر يبدأ مستطيل التحديد (١٫٦).
            if (!(e.target as HTMLElement).closest('[data-handle]')) ed.startMarquee(e);
          }}

        >
          <div ref={paintRef} dangerouslySetInnerHTML={{ __html: html }} />

          {grid && !preview && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 4000,
                backgroundImage:
                  'linear-gradient(to right, rgba(0,0,0,.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.07) 1px, transparent 1px)',
                backgroundSize: `${mmToPx(10, SCREEN_DPI)}px ${mmToPx(10, SCREEN_DPI)}px`
              }}
            />
          )}

          {/* خطوط الإرشاد: الالتصاق يُرى، وبغيرها يبدو سحرًا. */}
          {guides.map((g, i) => (
            <div
              key={i}
              className="absolute pointer-events-none bg-primary"
              data-guide={g.axis}
              style={
                g.axis === 'x'
                  ? { right: offset + g.at * pxW, top: 0, bottom: 0, width: 1, zIndex: 9000 }
                  : { top: offset + g.at * pxH, right: 0, left: 0, height: 1, zIndex: 9000 }
              }
            />
          ))}

          {/* مستطيل التحديد وهو يُسحب. */}
          {marquee && (
            <div
              className="absolute border border-primary bg-primary/10 pointer-events-none"
              data-marquee=""
              style={{ right: offset + marquee.x * pxW, top: offset + marquee.y * pxH, width: marquee.w * pxW, height: marquee.h * pxH, zIndex: 9500 }}
            />
          )}

          <ElementHandles ed={ed} onEdit={setEditing} />
          {ed.placement && !preview && <div className="absolute border-2 border-primary bg-primary/10 pointer-events-none" data-tool-placement
            style={{ right: offset + ed.placement.x * pxW, top: offset + ed.placement.y * pxH, width: ed.placement.w * pxW, height: ed.placement.h * pxH, zIndex: 11000 }} />}
          {editingEl?.kind === 'text' && !editingEl.locked && !editingEl.hidden && !preview && <InlineTextEditor key={`${ed.activeSide}:${editingEl.id}`} el={editingEl} ed={ed} close={() => setEditing(null)} />}

        </div>
      </div>
    </div>
  );
}
