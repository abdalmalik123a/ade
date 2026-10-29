/** مقابض العرض مستقلة عن رسم الوثيقة ومحرر النص. */
import { EDGES } from './kit';
import TableGrips from './TableGrips';
import type { DesignEditor } from './useDesignEditor';
export default function ElementHandles({ ed, onEdit }: { ed: DesignEditor; onEdit: (id: string) => void }) {
  const { pxW, pxH, offset } = ed.geometry;
  return <div style={{ pointerEvents: ed.tool === 'select' ? undefined : 'none' }}>
          {/* مقابضُ التحديد فوق الرسم — لا داخله، فالمطبوع لا يحملها. والمخفيّ بلا مقبض. */}
          {!ed.preview &&
            ed.canvas.elements.filter((el) => !el.hidden).map((el) => {
              const on = ed.selection.includes(el.id);
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
                  // نقرتان على العنصر: يحدده مباشرة ويركز على تحرير نصه إن كان نصاً
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    ed.chooseTool('select');
                    ed.setSelection([el.id]);
                    if (el.kind === 'text' && !el.locked && !el.hidden) onEdit(el.id);
                  }}
                >
                  {on &&
                    !el.locked &&
                    ed.single?.id === el.id &&
                    EDGES.map(({ edge, style, cursor }) => (
                      <div
                        key={edge}
                        className="absolute w-2 h-2 bg-surface border border-primary"
                        data-grip={edge}
                        style={{ ...style, cursor }}
                        onMouseDown={(e) => ed.startResize(e, el, edge)}
                      />
                    ))}
                  {/* حدود الجدول تُسحب (البند ٢) — للجدول المحدَّد وحده، وغير المدار: المقابض على محاورها. */}
                  {on && !el.locked && ed.single?.id === el.id && el.kind === 'table' && !el.rotate && (
                    <TableGrips el={el} html={ed.html} onStart={(e, axis, border, start, size, sign) => ed.startTableDrag(e, el.id, axis, border, start, size, sign)} />
                  )}
                  {on && !el.locked && ed.single?.id === el.id && (
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
  </div>;
}
