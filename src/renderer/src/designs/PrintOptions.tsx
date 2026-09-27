/**
 * خيارات الورق في مراجعة الأوراق — لما يقع فعلًا في المكتب:
 *
 * - ورقة ملصقاتٍ أو كرتونٍ استُعمل نصفها: تُختار أوّل خانةٍ فارغة من شبكةٍ
 *   كهيئة الورقة (من اليمين كما تُصفّ البطاقات).
 * - بطاقةٌ تلفت في القصّ: تُكتب أرقامها («١٤» أو «٥، ١٢-١٤») فتُعاد وحدها — ومع
 *   الخانة الأولى تقع في ورقةٍ بقي فيها مكان.
 * - رزمٌ لمدرسة: عمودٌ من القائمة (الصفّ، الشعبة) تبدأ كلُّ قيمةٍ منه ورقةً
 *   جديدة تسبقها ورقةٌ فاصلة باسمها وعددها.
 */
import type { Imposition } from '@shared/imposition';

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

export default function PrintOptions({
  imp,
  total,
  startSlot,
  onStartSlot,
  pickText,
  onPickText,
  picked,
  columns,
  groupCol,
  onGroupCol
}: {
  imp: Imposition;
  total: number;
  startSlot: number;
  onStartSlot: (slot: number) => void;
  pickText: string;
  onPickText: (text: string) => void;
  /** ما فُهم من الأرقام — أو `null` إن كان الحقل فارغًا أو لا يُفهم. */
  picked: number[] | null;
  columns: string[];
  groupCol: string;
  onGroupCol: (col: string) => void;
}) {
  return (
    <section className="flex flex-col gap-space-md" data-print-options="">
      {!imp.single && (
        <div className="flex flex-col gap-space-xs">
          <span className="font-label-md text-label-md text-on-surface font-semibold">أوّل خانةٍ فارغة في الورقة</span>
          <div
            className="grid gap-1 self-start"
            dir="rtl"
            style={{ gridTemplateColumns: `repeat(${imp.cols}, 2.25rem)`, opacity: groupCol ? 0.4 : 1 }}
          >
            {Array.from({ length: imp.per }, (_, slot) => (
              <button
                key={slot}
                className={`h-8 rounded-md font-label-sm text-label-sm tabular ${
                  slot < startSlot
                    ? 'bg-surface-container-high text-on-surface-variant line-through'
                    : slot === startSlot
                      ? 'bg-secondary text-on-secondary font-bold'
                      : 'bg-surface-container text-on-surface'
                }`}
                data-slot={slot}
                disabled={Boolean(groupCol)}
                title={slot < startSlot ? 'مستعملة' : undefined}
                type="button"
                onClick={() => onStartSlot(slot)}
              >
                {toIndic(slot + 1)}
              </button>
            ))}
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {groupCol
              ? 'مع الفواصل تبدأ كلُّ مجموعةٍ ورقةً جديدة'
              : startSlot
                ? `الخانات ١–${toIndic(startSlot)} مستعملة — الورقة الأولى تُكمَل من الخانة ${toIndic(startSlot + 1)}`
                : 'لورقة ملصقاتٍ أو كرتونٍ استُعمل بعضها — اختر أوّل خانةٍ فارغة'}
          </span>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-label-md text-label-md text-on-surface font-semibold">بطاقاتٌ بعينها</span>
        <input
          className="h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface"
          data-act="pick-cards"
          placeholder="مثل: ١٤ أو ٥، ١٢-١٤"
          value={pickText}
          onChange={(e) => onPickText(e.target.value)}
        />
        <span className={`font-label-sm text-label-sm ${pickText && !picked ? 'text-error' : 'text-on-surface-variant'}`}>
          {!pickText
            ? `الكلّ (${toIndic(total)}) — أو اكتب أرقام ما تلف فيُعاد وحده`
            : picked
              ? `${toIndic(picked.length)} من ${toIndic(total)} بطاقة`
              : 'لم تُفهم الأرقام — اكتبها مفصولةً بفاصلة، والمدى بشرطة'}
        </span>
      </label>

      {columns.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md text-on-surface font-semibold">ورقةٌ فاصلة بين المجموعات</span>
          <select
            className="h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface"
            data-act="group-col"
            value={groupCol}
            onChange={(e) => onGroupCol(e.target.value)}
          >
            <option value="">بلا فواصل</option>
            {columns.map((c) => (
              <option key={c} value={c}>
                حسب «{c}»
              </option>
            ))}
          </select>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            كلّ قيمةٍ تبدأ ورقةً جديدة تسبقها ورقةٌ باسمها وعددها — فتُسلَّم الرزم مفروزة
          </span>
        </label>
      )}
    </section>
  );
}
