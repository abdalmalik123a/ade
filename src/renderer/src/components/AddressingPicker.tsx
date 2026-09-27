/**
 * لمن يُكتب الكتاب: جهةٌ أعلى أو أدنى أو مساوية (FOUNDATION §٤ و§٦).
 *
 * يُحفظ في الوثيقة (`meta.addressing`)، فتتصدّر في قائمة `/` كليشاتُ اتجاهه:
 * «يرجى» لجهةٍ أعلى و«تنسب» لأدنى. والضغط على المختار يُلغيه — كتابٌ بلا اتجاه.
 */
import { ADDRESSING, ADDRESSING_HINT, ADDRESSING_LABEL } from '@shared/addressing';
import type { Addressing } from '@shared/api';

const SHORT: Record<Addressing, string> = { up: 'أعلى', down: 'أدنى', peer: 'مساوية' };

export default function AddressingPicker({
  value,
  onChange
}: {
  value: Addressing | null;
  onChange: (next: Addressing | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1" data-addressing="">
      <span className="font-label-sm text-label-sm text-on-surface-variant">
        إلى جهةٍ — {value ? `${ADDRESSING_LABEL[value]}: «${ADDRESSING_HINT[value]}» أولًا في الكليشات` : 'تُرتَّب بها الكليشات'}
      </span>
      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-surface-container-low">
        {ADDRESSING.map((a) => (
          <button
            key={a}
            className={`h-8 rounded-md font-label-md text-label-md transition-colors ${
              value === a ? 'bg-primary-container text-on-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
            data-addressing-value={a}
            title={`${ADDRESSING_LABEL[a]} — ${ADDRESSING_HINT[a]}`}
            type="button"
            onClick={() => onChange(value === a ? null : a)}
          >
            {SHORT[a]}
          </button>
        ))}
      </div>
    </div>
  );
}
