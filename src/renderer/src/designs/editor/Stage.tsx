/**
 * اللوحة: الورقة مرسومةً بمقاسها وتكبيرها، والشبكة، وخطوط الإرشاد، ومقابض التحديد فوق الرسم — لا داخله، فالمطبوع
 * لا يحملها.
 */
import { useEffect, useRef } from 'react';
import { SCREEN_DPI, mmToPx } from '@shared/canvas';
import { EDGES } from './kit';
import { useCanvasPaint } from './useCanvasPaint';
import type { DesignEditor } from './useDesignEditor';

export default function Stage({ ed }: { ed: DesignEditor }) {
  const { canvas, selection, single, preview, grid, zoom, setZoom, view, guides, html, marquee } = ed;
  const { page, pxW, pxH, offset } = ed.geometry;
  const deskRef = useRef<HTMLDivElement>(null);
  const paintRef = useCanvasPaint(html, preview);

  useEffect(() => {
    const fit = () => {
      const desk = deskRef.current;
      // البطاقة تُكبَّر حتى تملأ المكتب (إلى ثلاثة أضعاف)، والشهادة تُصغَّر لتسعه.
      if (desk && desk.clientWidth) setZoom(Math.min(3, Math.max(0.15, Math.min((desk.clientWidth - 64) / page.w, (desk.clientHeight - 64) / page.h))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
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
    <div ref={deskRef} className="flex-1 overflow-auto flex items-start justify-center p-space-xl" data-desk="" onMouseLeave={ed.endDrag} onMouseMove={ed.onMove} onMouseUp={ed.endDrag}>
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

          {/* مقابضُ التحديد فوق الرسم — لا داخله، فالمطبوع لا يحملها. والمخفيّ بلا مقبض. */}
          {!preview &&
            canvas.elements.filter((el) => !el.hidden).map((el) => {
              const on = selection.includes(el.id);
              return (
                <div
                  key={el.id}
                  className={`absolute ${el.locked ? 'cursor-not-allowed' : 'cursor-move'} ${
                    on ? 'outline outline-2 outline-primary' : 'hover:outline hover:outline-1 hover:outline-outline-variant'
                  }`}
                  data-handle={el.id}
                  style={{
                    right: offset + el.box.x * pxW,
                    top: offset + el.box.y * pxH,
                    width: el.box.w * pxW,
                    height: el.box.h * pxH,
                    zIndex: 5000 + el.z,
                    // يدور مع عنصره — فالمقابض على حدوده لا على صندوقه قبل التدوير.
                    ...(el.rotate ? { transform: `rotate(${-el.rotate}deg)` } : {})
                  }}
                  onMouseDown={(e) => ed.startMove(e, el)}
                >
                  {on &&
                    !el.locked &&
                    single?.id === el.id &&
                    EDGES.map(({ edge, style, cursor }) => (
                      <div
                        key={edge}
                        className="absolute w-2 h-2 bg-surface border border-primary"
                        data-grip={edge}
                        style={{ ...style, cursor }}
                        onMouseDown={(e) => ed.startResize(e, el, edge)}
                      />
                    ))}
                  {on && !el.locked && single?.id === el.id && (
                    <div
                      className="absolute w-3 h-3 rounded-full bg-surface border-2 border-primary cursor-grab"
                      data-grip="rotate"
                      style={{ top: -20, right: '50%', transform: 'translateX(50%)' }}
                      title="أدِره — ومع Shift بخطوة ١٥°"
                      onMouseDown={(e) => ed.startRotate(e, el, e.currentTarget)}
                    />
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
