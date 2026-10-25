/**
 * شريط الإخراج في «ملفات PDF» (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو: حدّ الحجم، وأبيض وأسود، والحفظ —
 * و«صفحاتٌ في ورقة» ومعاينة ورقته الأولى (S27، D178).
 */
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { ToolOutput, type ToolNav } from '../../components/ToolFrame';
import { SIZE_LIMITS } from '@shared/pdfEdit';
import { SHEET_COUNTS } from '@shared/pdfSheets';
import { toIndic } from '@shared/arabic';

type Props = {
  limit: number;
  setLimit: (bytes: number) => void;
  gray: boolean;
  setGray: Dispatch<SetStateAction<boolean>>;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  save: () => Promise<void>;
  nav: ToolNav;
  btn: 'h-9 px-space-sm rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1 disabled:opacity-40';
  toCustomer: () => Promise<void>;
  perSheet: number;
  setPerSheet: Dispatch<SetStateAction<number>>;
  /** «١٢ صفحة ← ٣ أوراق» — وفارغٌ لصفحةٍ في ورقة. */
  sheets: string;
  preview: ReactNode;
};

export default function PdfOutputBar({ limit, setLimit, gray, setGray, name, setName, save, nav, btn, toCustomer, perSheet, setPerSheet, sheets, preview }: Props) {
  return (
    <ToolOutput bar>
          <label className="flex items-center gap-1 font-label-md text-label-md" title="حدّ الحجم كما تطلبه خانة الرفع — للملف ولكلّ صورة">
            الحجم
            <select
              className="h-9 min-w-[6.5rem] px-1 rounded-field bg-surface-container-lowest border border-outline-variant"
              data-pdf-limit=""
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {SIZE_LIMITS.map((l) => (
                <option key={l.bytes} value={l.bytes}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 font-label-md text-label-md" title="صفحاتٌ في ورقة A4 من اليمين — للملازم وتوفير الورق">
            صفحاتٌ في ورقة
            <select
              className="h-9 px-1 rounded-field bg-surface-container-lowest border border-outline-variant"
              data-pdf-per-sheet=""
              value={perSheet}
              onChange={(e) => setPerSheet(Number(e.target.value))}
            >
              {SHEET_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {toIndic(n)}
                </option>
              ))}
            </select>
          </label>
          {preview}
          {sheets && (
            <span className="font-label-sm text-label-sm text-on-surface-variant" data-pdf-sheets="">
              {sheets}
            </span>
          )}
          <label className="flex items-center gap-1 font-label-md text-label-md" title="يصغّر الملف كثيرًا، ويكفي أكثر المستمسكات">
            <input checked={gray} data-pdf-gray="" type="checkbox" onChange={(e) => setGray(e.target.checked)} />
            أبيض وأسود
          </label>
          <input
            className="h-9 w-56 px-2 rounded-field bg-surface-container-lowest border border-outline-variant font-label-md text-label-md"
            data-pdf-name=""
            title="اسم الملف الجديد"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="h-9 px-space-md btn-act font-label-md text-label-md font-semibold flex items-center gap-1"
            data-act="pdf-save"
            type="button"
            onClick={() => void save()}
          >
            <span className="material-symbols-outlined text-[18px]">save</span>احفظ ملفًّا جديدًا
          </button>
      {nav.customer && (
        <button className={btn} data-act="pdf-to-customer" title="في ملفّه مستمسكًا — بحدّ الحجم المختار" type="button" onClick={() => void toCustomer()}>
          <span className="material-symbols-outlined text-[18px]">person_add</span>في ملفّ {nav.customer.name || 'الزبون'}
        </button>
      )}
    </ToolOutput>
  );
}
