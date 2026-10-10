/**
 * إطار القصّ فوق المعاينة (DESIGNS.md ٢٫٢): ما خارجه معتم، ويُسحب من داخله ليتحرّك ومن زواياه ليكبر ويصغر — وبنسبةٍ
 * مقفلة إن اختيرت (مربّع، ٤:٣…). كلّه نِسَبٌ من الإطار، فيصلح للمعاينة المصغَّرة وللحفظ بالمقاس الكامل.
 */
import { useRef } from 'react';
import { normalizeCrop, type CropRect } from '@shared/photoEdit';

type Drag = { kind: 'move' | 'nw' | 'ne' | 'sw' | 'se'; x: number; y: number; start: CropRect };

export default function CropOverlay({ crop, ratio, frame, onChange }: { crop: CropRect; ratio: number | null; frame: { w: number; h: number }; onChange: (c: CropRect) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);

  const begin = (kind: Drag['kind']) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    drag.current = { kind, x: e.clientX, y: e.clientY, start: crop };
  };
  const move = (e: React.MouseEvent) => {
    const d = drag.current;
    const r = box.current?.getBoundingClientRect();
    if (!d || !r) return;
    const dx = (e.clientX - d.x) / r.width;
    const dy = (e.clientY - d.y) / r.height;
    const s = d.start;
    if (d.kind === 'move') {
      onChange(normalizeCrop({ ...s, x: s.x + dx, y: s.y + dy }));
      return;
    }
    // الزاوية المسحوبة تتحرّك، والمقابلة لها ثابتة.
    const left = d.kind === 'nw' || d.kind === 'sw';
    const top = d.kind === 'nw' || d.kind === 'ne';
    let w = Math.max(0.1, left ? s.w - dx : s.w + dx);
    let h = Math.max(0.1, top ? s.h - dy : s.h + dy);
    if (ratio) {
      // النسبة بمقاس الإطار الحقيقيّ لا بنِسَبه: عرضٌ/ارتفاع = ratio.
      const k = frame.w / frame.h;
      h = Math.min(h, (w * k) / ratio);
      w = (h * ratio) / k;
    }
    w = Math.min(w, left ? s.x + s.w : 1 - s.x);
    h = Math.min(h, top ? s.y + s.h : 1 - s.y);
    onChange(normalizeCrop({ x: left ? s.x + s.w - w : s.x, y: top ? s.y + s.h - h : s.y, w, h }));
  };
  const end = () => (drag.current = null);
  const corner = (kind: 'nw' | 'ne' | 'sw' | 'se', style: React.CSSProperties) => (
    <span className="absolute w-3.5 h-3.5 rounded-sm bg-white border-2 border-primary" data-crop-corner={kind} style={{ ...style, cursor: kind === 'nw' || kind === 'se' ? 'nwse-resize' : 'nesw-resize' }} onMouseDown={begin(kind)} />
  );

  return (
    <div ref={box} className="absolute inset-0" data-crop="" onMouseLeave={end} onMouseMove={move} onMouseUp={end}>
      <div
        className="absolute border-2 border-white cursor-move"
        data-crop-box=""
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%`, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
        onMouseDown={begin('move')}
      >
        {corner('nw', { left: -7, top: -7 })}
        {corner('ne', { right: -7, top: -7 })}
        {corner('sw', { left: -7, bottom: -7 })}
        {corner('se', { right: -7, bottom: -7 })}
      </div>
    </div>
  );
}
