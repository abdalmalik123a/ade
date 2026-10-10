/**
 * «جدول الإمساكية» في المحرّر (DESIGNS.md ٣٫٤) — يظهر لتصميمٍ فيه جدول إمساكية: الأوقات من الجدول الرسمي لمدينة المكتب
 * (ملفٌّ أو لصق) لا يحسبها ديوان، وأيّامها من أوّل رمضان بالتقويم المختار، والجمعة مميّزة، والأرقام هندية أو لاتينية.
 */
import { useState } from 'react';
import { toIndic } from '@shared/arabic';
import type { TableElement } from '@shared/canvas';
import { CALENDAR_LABEL, type Calendar } from '@shared/dates';
import type { DesignEditor } from '../editor/useDesignEditor';
import ImsakiyaColumns from './ImsakiyaColumns';
import { useImsakiya } from './useImsakiya';

const BTN = 'flex-1 h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5 disabled:opacity-50';
const FIELD = 'h-8 px-1 rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface';

export default function ImsakiyaPanel({ ed, table }: { ed: DesignEditor; table: TableElement }) {
  const m = useImsakiya(ed, table);
  const [paste, setPaste] = useState('');
  const { settings, gaps } = m;
  return (
    <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm" data-imsakiya="">
      <div className="flex items-center justify-between gap-space-sm">
        <h2 className="font-body-md text-body-md text-on-surface font-semibold">جدول الإمساكية</h2>
        {gaps && (
          <span
            className={`px-2 py-0.5 rounded-full font-label-xs text-label-xs tabular ${gaps.empty ? 'bg-error-container/30 text-error' : 'bg-secondary-container text-on-secondary'}`}
            data-imsakiya-gaps={gaps.empty}
          >
            {gaps.empty === gaps.total ? 'الأوقات فارغة' : gaps.empty ? `خانات فارغة: ${toIndic(gaps.empty)}` : `${toIndic(table.rows.length)} يومًا بأوقاتها`}
          </span>
        )}
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant">الأوقات من الجدول الرسمي لمدينتك وحده — ديوان لا يحسبها ولا يخترعها.</p>

      <div className="flex gap-space-sm">
        <button className={BTN} data-act="imsakiya-file" disabled={m.reading} type="button" onClick={() => void m.fromFile()}>
          <span className="material-symbols-outlined text-[18px]">upload_file</span>
          {m.reading ? 'يُقرأ…' : 'من ملفّ (Excel أو PDF)'}
        </button>
        <button className={BTN} data-act="imsakiya-paste" type="button" onClick={() => m.setPasting(!m.pasting)}>
          <span className="material-symbols-outlined text-[18px]">content_paste</span>
          الصق الجدول
        </button>
      </div>
      {m.pasting && (
        <div className="space-y-1">
          <textarea
            className="w-full h-28 p-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
            data-imsakiya-text=""
            dir="rtl"
            placeholder="انسخ الجدول من Excel أو Word أو موقع الوقف بعناوينه، والصقه هنا"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button
            className="w-full h-8 rounded-lg bg-secondary-container text-on-secondary font-label-md text-label-md disabled:opacity-40"
            data-act="imsakiya-read"
            disabled={!paste.trim()}
            type="button"
            onClick={() => m.take('اللصق', paste)}
          >
            اقرأ الجدول
          </button>
        </div>
      )}
      <ImsakiyaColumns m={m} />

      <div className="grid grid-cols-2 gap-x-space-sm gap-y-1.5 items-center">
        <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="imsakiya-start">
          أوّل رمضان
        </label>
        <input
          className={`${FIELD} tabular`}
          data-imsakiya-start=""
          id="imsakiya-start"
          type="date"
          value={settings.start}
          onChange={(e) => e.target.value && m.update({ start: e.target.value })}
        />
        <span className="font-label-sm text-label-sm text-on-surface-variant">التاريخ في الجدول</span>
        <select className={FIELD} data-imsakiya-calendar="" value={settings.calendar} onChange={(e) => m.update({ calendar: e.target.value as Calendar })}>
          {(Object.keys(CALENDAR_LABEL) as Calendar[]).map((c) => (
            <option key={c} value={c}>
              {CALENDAR_LABEL[c]}
            </option>
          ))}
        </select>
        <span className="font-label-sm text-label-sm text-on-surface-variant">الأرقام</span>
        <select className={FIELD} data-imsakiya-digits="" value={settings.digits} onChange={(e) => m.update({ digits: e.target.value as 'indic' | 'latin' })}>
          <option value="indic">١٢٣ (هندية)</option>
          <option value="latin">123 (عربية)</option>
        </select>
      </div>
      <label className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface">
        <input checked={settings.fridays} data-imsakiya-fridays="" type="checkbox" onChange={(e) => m.update({ fridays: e.target.checked })} />
        ميّز أيام الجمعة بلون الجدول
      </label>
    </div>
  );
}
