/**
 * الجدول المقروء قبل أن يوضع (٣٫٤): كلّ عمودٍ بعنوانه وأوّل قيمه وما فهمه ديوان منه — والموظّف يصحّح ما أخطأ فيه، ثمّ يضعه.
 */
import { toIndic } from '@shared/arabic';
import { isoDate } from '@shared/dates';
import { TIME_TITLES, type ColumnRole } from '@shared/design/timetable';
import type { Imsakiya } from './useImsakiya';

const SELECT = 'h-8 px-1 rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface';
const DAY_ROLES: [ColumnRole, string][] = [
  ['skip', 'اتركه'],
  ['weekday', 'يوم الأسبوع'],
  ['hijri', 'يوم رمضان'],
  ['gregorian', 'التاريخ الميلادي']
];

export default function ImsakiyaColumns({ m }: { m: Imsakiya }) {
  const p = m.pending;
  if (!p) return null;
  const times = p.table.columns.filter((c) => c.role === 'time').length;
  return (
    <div className="rounded-lg border border-secondary/40 bg-surface-container-low p-space-sm space-y-space-sm" data-imsakiya-columns="">
      <p className="font-label-sm text-label-sm text-on-surface">
        من «{p.from}»: <b className="tabular">{toIndic(p.table.rows.length)}</b> يومًا و<b className="tabular">{toIndic(times)}</b> أوقات — راجع ما فهمه ديوان من كلّ عمود
      </p>
      {!p.table.headed && <p className="font-label-sm text-label-sm text-error">الجدول بلا عناوين — سُمّيت الأوقات بترتيب اليوم، فتأكّد من كلّ عمود</p>}
      <div className="space-y-1 max-h-64 overflow-auto">
        {p.table.columns.map((c, i) => {
          const sample = p.table.rows.find((r) => r[i]?.trim())?.[i] ?? '';
          const value = c.role === 'time' ? `time:${c.title}` : c.role;
          const custom = c.role === 'time' && !(TIME_TITLES as readonly string[]).includes(c.title);
          return (
            <div key={i} className="flex items-center gap-space-sm" data-imsakiya-column={i}>
              <span className="flex-1 min-w-0 truncate font-label-sm text-label-sm text-on-surface-variant" title={c.header}>
                {c.header || `عمود ${toIndic(i + 1)}`} <span className="tabular text-on-surface">({sample || '—'})</span>
              </span>
              <select
                className={SELECT}
                value={value}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.startsWith('time:')) m.setColumn(i, 'time', v.slice(5));
                  else m.setColumn(i, v as ColumnRole);
                }}
              >
                {DAY_ROLES.map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
                {custom && <option value={`time:${c.title}`}>{c.title}</option>}
                {TIME_TITLES.map((t) => (
                  <option key={t} value={`time:${t}`}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {m.start && <p className="font-label-sm text-label-sm text-on-surface-variant">أوّل رمضان من الجدول: <span className="tabular">{isoDate(m.start)}</span></p>}
      {m.clash && <p className="font-label-sm text-label-sm text-error">{m.clash}</p>}
      <div className="flex gap-space-sm">
        <button
          className="flex-1 h-9 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold"
          data-act="imsakiya-place"
          type="button"
          onClick={m.place}
        >
          ضع الأوقات في الإمساكية
        </button>
        <button className="h-9 px-space-md rounded-lg bg-surface-container-high font-label-md text-label-md text-on-surface" type="button" onClick={() => m.setPending(null)}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
