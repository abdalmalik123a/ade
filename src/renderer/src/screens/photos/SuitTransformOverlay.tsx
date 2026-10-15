/**
 * إطار التعديل الحر للقاط على لوحة الكانفاس (Suit Bounding Box Transform Overlay)
 *
 * يوفر مقابض بصرية مباشرة:
 * - التحريك بالسحب من الوسط (Move).
 * - التكبير والتصغير المتناسب من الزوايا الأربع (Uniform Scale).
 * - التوسيع والتضييق الأفقي المستقل من المقبضين الأيمن والأيسر (Non-uniform scaleX).
 * - التطويل والتقصير الرأسي المستقل من المقبض السفلي (Non-uniform scaleY).
 * - مقبض التدوير العلوي المتصل بذراع لتدوير القاط بزاوية حرة (Rotate).
 */
import { useMemo } from 'react';
import type { Worn } from './photoShared';
import type { Size } from '@shared/photoSheet';

export type HandleType = 'center' | 'nw' | 'ne' | 'sw' | 'se' | 'e' | 'w' | 's' | 'rot';

export type SuitBoxGeometry = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
  k: number;
};

export function getSuitBoxGeometry(
  worn: Worn,
  natural: Size,
  box: { left: number; top: number; width: number; height: number }
): SuitBoxGeometry {
  const k = box.width / natural.w;
  const { suit, at } = worn;
  const sx = (at.scaleX ?? 1) * at.scale * k;
  const sy = (at.scaleY ?? 1) * at.scale * k;

  const cx = box.left + at.x * k;
  const cy = box.top + at.y * k;
  const w = suit.img.naturalWidth * sx;
  const h = suit.img.naturalHeight * sy;
  const anchorX = suit.anchor.cx * sx;
  const anchorY = suit.anchor.cy * sy;

  // مركز صندوق البدلة بالنسبة لنقطة الارتكاز (anchor)
  const relCx = w / 2 - anchorX;
  const relCy = h / 2 - anchorY;

  const rad = (at.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const finalCx = cx + relCx * cos - relCy * sin;
  const finalCy = cy + relCx * sin + relCy * cos;

  return {
    cx: finalCx,
    cy: finalCy,
    w,
    h,
    angle: at.angle,
    k
  };
}

type Props = {
  worn: Worn | null;
  natural: Size | null;
  box: { left: number; top: number; width: number; height: number } | null;
  active: boolean;
  onHandleDown: (e: React.MouseEvent, handle: HandleType) => void;
};

export default function SuitTransformOverlay({ worn, natural, box, active, onHandleDown }: Props) {
  const geom = useMemo(() => {
    if (!worn || !natural || !box) return null;
    return getSuitBoxGeometry(worn, natural, box);
  }, [worn, natural, box]);

  if (!worn || !geom || !active) return null;

  const { cx, cy, w, h, angle } = geom;

  const handleStyle =
    'absolute w-3.5 h-3.5 bg-white border-2 border-primary rounded-sm shadow-md pointer-events-auto hover:scale-125 transition-transform z-20';

  return (
    <div
      className="absolute pointer-events-none select-none z-10"
      style={{
        left: cx,
        top: cy,
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        transformOrigin: 'center center'
      }}
    >
      {/* إطار الحدود المتقطع */}
      <div
        className="absolute inset-0 border-2 border-dashed border-primary/90 pointer-events-auto cursor-move bg-primary/5 hover:bg-primary/10 transition-colors"
        onMouseDown={(e) => onHandleDown(e, 'center')}
        title="اسحب لنقل القاط"
      />

      {/* خط وذراع التدوير العلوي */}
      <div className="absolute left-1/2 -top-6 -translate-x-1/2 w-0.5 h-6 bg-primary" />
      <div
        className="absolute left-1/2 -top-8 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md pointer-events-auto cursor-crosshair hover:scale-125 transition-transform z-20"
        onMouseDown={(e) => onHandleDown(e, 'rot')}
        title="اسحب لتدوير القاط"
      />

      {/* مقابض الزوايا (تكبير/تصغير متناسب) */}
      <div
        className={`${handleStyle} -top-1.5 -left-1.5 cursor-nwse-resize`}
        onMouseDown={(e) => onHandleDown(e, 'nw')}
        title="تكبير/تصغير متناسب"
      />
      <div
        className={`${handleStyle} -top-1.5 -right-1.5 cursor-nesw-resize`}
        onMouseDown={(e) => onHandleDown(e, 'ne')}
        title="تكبير/تصغير متناسب"
      />
      <div
        className={`${handleStyle} -bottom-1.5 -left-1.5 cursor-nesw-resize`}
        onMouseDown={(e) => onHandleDown(e, 'sw')}
        title="تكبير/تصغير متناسب"
      />
      <div
        className={`${handleStyle} -bottom-1.5 -right-1.5 cursor-nwse-resize`}
        onMouseDown={(e) => onHandleDown(e, 'se')}
        title="تكبير/تصغير متناسب"
      />

      {/* المقابض الجانبية (توسيع/تضييق الكتف scaleX) */}
      <div
        className={`${handleStyle} top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize`}
        onMouseDown={(e) => onHandleDown(e, 'w')}
        title="توسيع/تضييق الكتف (مقياس أفقي)"
      />
      <div
        className={`${handleStyle} top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize`}
        onMouseDown={(e) => onHandleDown(e, 'e')}
        title="توسيع/تضييق الكتف (مقياس أفقي)"
      />

      {/* المقبض السفلي (تطويل/تقصير القاط scaleY) */}
      <div
        className={`${handleStyle} -bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize`}
        onMouseDown={(e) => onHandleDown(e, 's')}
        title="تطويل/تقصير القاط (مقياس رأسي)"
      />
    </div>
  );
}
