/** صفّ الحقل المستنتَج في مراجعة «استورد مجلدي» ودرجة ثقته — نُقلا من `ImportPlanDialog.tsx` (سقف حجمه). */
import type { Suggestion } from '@shared/doc';

export const pct = (n: number) => `${Math.round(n * 100)}٪`;

/** درجة الثقة لونًا: ما دون العتبة يُنبَّه عليه ليُراجَع. */
function ConfidenceDot({ value }: { value: number }) {
  const tone =
    value >= 0.8 ? 'bg-secondary' : value >= 0.6 ? 'bg-primary-container' : 'bg-error';
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${tone}`}
      title={`درجة الثقة ${pct(value)}`}
    />
  );
}

export function FieldRow({
  label,
  suggestion,
  onRename,
  onDrop
}: {
  label: string;
  suggestion: Suggestion<string> | undefined;
  onRename: (value: string) => void;
  onDrop: () => void;
}) {
  return (
    <div className="flex items-center gap-space-xs">
      <ConfidenceDot value={suggestion?.confidence ?? 0.5} />
      <input
        className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
        type="text"
        value={label}
        onChange={(e) => onRename(e.target.value)}
      />
      <span
        className="font-label-sm text-label-sm text-on-surface-variant truncate max-w-[9rem]"
        title={suggestion?.reason}
      >
        {suggestion?.reason}
      </span>
      <button
        className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
        title="ليس حقلًا — أعِده نقاطًا"
        type="button"
        onClick={onDrop}
      >
        <span className="material-symbols-outlined text-[16px]">backspace</span>
      </button>
    </div>
  );
}
