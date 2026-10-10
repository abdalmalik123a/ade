/**
 * «املأ الحقول» — واحدًا بيد، أو قائمةً كاملة في «دفعة» تحته (وما في القائمة يغلب ما يُكتب هنا).
 * وحقل الصورة يُختار صورةً لا يُكتب نصًّا، وحقل التاريخ يُكتب بتقويمه (٣٫٤): ميلاديًّا أو هجريًّا أو بالاثنين — يُحفظ في التصميم
 * ويُطبَّق على كلّ بطاقةٍ في الدفعة.
 */
import { isChoiceKey } from '@shared/gender';
import { isDateField, type DocField } from '@shared/doc';
import { CALENDAR_LABEL, dateValueIn, type Calendar } from '@shared/dates';
import DateTools from '../../components/DateTools';
import type { DesignEditor } from '../editor/useDesignEditor';

const INPUT = 'h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface';

/** حقل التاريخ: تقويمه (و«كما كُتب» يتركه)، واليوم أو تاريخٌ من التقويم، وما يُطبع إن خالف ما كُتب. */
function DateField({ ed, f }: { ed: DesignEditor; f: DocField }) {
  const value = ed.values[f.key] ?? '';
  const calendars = ed.doc.canvas?.calendars ?? {};
  const calendar = calendars[f.key];
  const printed = calendar && value.trim() ? dateValueIn(value, calendar) : value;
  const setCalendar = (c: Calendar | '') => {
    const { [f.key]: _drop, ...rest } = calendars;
    const next = c ? { ...rest, [f.key]: c } : rest;
    ed.apply({ ...ed.canvas, calendars: Object.keys(next).length ? next : undefined });
  };
  return (
    <label className="flex flex-col gap-1" data-date-field={f.key}>
      <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
        {f.label}
        <span className="flex-1" />
        <select
          className="h-6 px-1 rounded bg-surface-container-low text-on-surface-variant cursor-pointer disabled:opacity-50"
          data-calendar-of={f.key}
          disabled={ed.activeSide !== 'front'}
          title="بأيّ تقويمٍ يُطبع التاريخ — هنا وفي كلّ بطاقةٍ من الدفعة"
          value={calendar ?? ''}
          onChange={(e) => setCalendar(e.target.value as Calendar | '')}
        >
          <option value="">كما كُتب</option>
          {(Object.keys(CALENDAR_LABEL) as Calendar[]).map((c) => (
            <option key={c} value={c}>
              {CALENDAR_LABEL[c]}
            </option>
          ))}
        </select>
      </span>
      <span className="flex items-center gap-1">
        <input className={`${INPUT} flex-1 min-w-0`} data-value={f.key} value={value} onChange={(e) => ed.setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
        {/* يُكتب ميلاديًّا يُقرأ — والتقويم المختار يكتبه عند الطباعة. */}
        <DateTools calendar="gregorian" onPick={(t) => ed.setValues((v) => ({ ...v, [f.key]: t }))} />
      </span>
      {printed !== value && (
        <span className="font-label-sm text-label-sm text-secondary" data-date-printed={f.key}>
          يُطبع: {printed}
        </span>
      )}
    </label>
  );
}

export default function FillPanel({ ed }: { ed: DesignEditor }) {
  const { doc, values, setValues, imageKeys, batchRows } = ed;
  if (doc.fields.length === 0) return null;
  return (
    <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm">
      <h2 className="font-body-md text-body-md text-on-surface font-semibold">
        {batchRows.length ? 'ما يشترك فيه الجميع — والقائمة تغلبه' : `املأ الحقول (${doc.fields.length})`}
      </h2>
      {doc.fields
        .filter((f) => !isChoiceKey(f.key))
        .map((f) =>
          imageKeys.includes(f.key) ? (
            <div key={f.key} className="flex items-center gap-space-sm">
              {values[f.key] ? (
                <img alt="" className="w-12 h-14 object-cover rounded border border-outline-variant" src={`diwan://store/${values[f.key]}`} />
              ) : (
                <span className="w-12 h-14 rounded border border-dashed border-outline-variant flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">person</span>
                </span>
              )}
              <button
                className="h-9 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-md text-label-md text-on-surface"
                data-photo={f.key}
                type="button"
                onClick={() => void window.diwan.files.pickImage('photos').then((src) => src && setValues((v) => ({ ...v, [f.key]: src })))}
              >
                {values[f.key] ? `غيّر ${f.label}` : `اختر ${f.label}`}
              </button>
            </div>
          ) : isDateField(f) ? (
            <DateField key={f.key} ed={ed} f={f} />
          ) : (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant">{f.label}</span>
              <input className={INPUT} data-value={f.key} value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            </label>
          )
        )}
    </div>
  );
}
