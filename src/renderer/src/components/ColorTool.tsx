/**
 * لون النصّ في المحرّر (محادثة «محرّر الكتاب»، البند ٣): ألوان Word العشرة القياسية و«تلقائي» (الأسود) — لما حُدِّد، أو لما
 * سيُكتب. والزرّ لا يسرق التحديد من الورقة، والقائمة تُغلق بالضغط خارجها وبـEscape.
 */
import { useState } from 'react';
import { useEscape } from '../kit/useEscape';

/** ألوان Word القياسية بأسمائها كما تُقال. */
export const TEXT_COLORS: { hex: string; name: string }[] = [
  { hex: '#c00000', name: 'أحمر داكن' },
  { hex: '#ff0000', name: 'أحمر' },
  { hex: '#ffc000', name: 'برتقالي' },
  { hex: '#ffff00', name: 'أصفر' },
  { hex: '#92d050', name: 'أخضر فاتح' },
  { hex: '#00b050', name: 'أخضر' },
  { hex: '#00b0f0', name: 'أزرق فاتح' },
  { hex: '#0070c0', name: 'أزرق' },
  { hex: '#002060', name: 'كحلي' },
  { hex: '#7030a0', name: 'بنفسجي' }
];

export default function ColorTool({ value, onPick }: { value: string | null; onPick: (hex: string | null) => void }) {
  const [open, setOpen] = useState(false);
  useEscape(() => setOpen(false), open);
  const pick = (hex: string | null) => {
    setOpen(false);
    onPick(hex);
  };
  return (
    <span className="relative inline-flex">
      <button
        className={`h-8 min-w-[2rem] px-1.5 rounded-btn flex flex-col items-center justify-center transition-colors ${open ? 'bg-secondary-fixed text-secondary' : 'text-on-surface hover:bg-surface-container-high'}`}
        data-act="text-color"
        title="لون النصّ"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="material-symbols-outlined text-[18px] leading-none">format_color_text</span>
        <span className="w-4 h-[3px] rounded-sm" style={{ background: value ?? '#000000' }} />
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-20" onMouseDown={(e) => (e.preventDefault(), setOpen(false))} />
          <span className="absolute top-full mt-1 start-0 z-30 p-space-xs rounded-card bg-surface-container-lowest shadow-soft border border-outline-variant/50 flex flex-col gap-space-xs" data-color-menu="">
            <button
              className="h-7 px-2 rounded font-label-sm text-label-sm text-on-surface hover:bg-surface-container-high flex items-center gap-1.5"
              data-color=""
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(null)}
            >
              <span className="w-4 h-4 rounded-sm bg-black" />
              تلقائي (أسود)
            </button>
            <span className="grid grid-cols-5 gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  className={`w-6 h-6 rounded-sm border ${value === c.hex ? 'border-on-surface ring-2 ring-secondary' : 'border-outline-variant/60'}`}
                  data-color={c.hex}
                  style={{ background: c.hex }}
                  title={c.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c.hex)}
                />
              ))}
            </span>
          </span>
        </>
      )}
    </span>
  );
}
