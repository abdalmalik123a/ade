/**
 * شريط تحكم الفرشاة ومعاينة المؤشر (Photoshop-like Brush Toolbar & Cursor Preview)
 *
 * يتحكم في:
 * - حجم الفرشاة (Brush Size 3..80px)
 * - نعومة الحافة (Softness / Hardness 0..1)
 * - مؤشر دائري يتبع الفأرة بالحجم الفعلي على اللوحة
 */
import { toIndic } from '@shared/arabic';

type Props = {
  brush: number;
  setBrush: React.Dispatch<React.SetStateAction<number>>;
  hardness: number;
  setHardness: React.Dispatch<React.SetStateAction<number>>;
  tool: string;
};

export default function BrushToolbar({ brush, setBrush, hardness, setHardness, tool }: Props) {
  const isBrushTool = tool === 'keep' || tool === 'remove' || tool === 'repair';
  if (!isBrushTool) return null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-surface-container-high/90 backdrop-blur border border-outline-variant shadow-sm text-on-surface"
      data-brush-toolbar=""
    >
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[18px] text-primary">brush</span>
        <span className="font-label-sm text-label-sm font-semibold">حجم الفرشاة:</span>
        <input
          className="w-24 accent-primary"
          data-act="brush-size"
          max={80}
          min={3}
          type="range"
          value={brush}
          onChange={(e) => setBrush(Number(e.target.value))}
        />
        <span className="w-8 font-label-sm text-label-sm tabular text-on-surface-variant">
          {toIndic(brush)}px
        </span>
      </div>

      <div className="h-4 w-px bg-outline-variant" />

      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[18px] text-primary">blur_on</span>
        <span className="font-label-sm text-label-sm font-semibold">نعومة الحافة:</span>
        <input
          className="w-24 accent-primary"
          data-act="brush-softness"
          max={1}
          min={0.1}
          step={0.05}
          type="range"
          value={1 - hardness}
          onChange={(e) => setHardness(Math.max(0.1, 1 - Number(e.target.value)))}
        />
        <span className="w-8 font-label-sm text-label-sm tabular text-on-surface-variant">
          {toIndic(Math.round((1 - hardness) * 100))}%
        </span>
      </div>
    </div>
  );
}
