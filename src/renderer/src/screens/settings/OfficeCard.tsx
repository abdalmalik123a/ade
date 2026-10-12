/**
 * بطاقة المكتب في الإعدادات: اسمه وبياناته، وحجم الواجهة، وإزاحة التاريخ الهجري، وحفظ ما تغيّر (تقسيم الإعدادات بعد ١٫٧٫٠) — منقولةٌ من `SettingsScreen` كما هي.
 */
import type { Dispatch, SetStateAction } from 'react';
import { input, HIJRI_OFFSETS } from './shared';
import { UI_SCALES } from '../../shell/Onboarding';
import { toIndic } from '@shared/arabic';
import { formatGregorian, formatHijri } from '@shared/dates';
import type { OfficeSettings } from '@shared/api';

type Props = {
  card: string;
  title: (icon: string, text: string) => JSX.Element;
  dirty: boolean;
  settings: OfficeSettings;
  patch: (next: Partial<OfficeSettings>) => void;
  setSettings: Dispatch<SetStateAction<OfficeSettings | null>>;
  onChanged: (() => void) | undefined;
};

export default function OfficeCard({ card, title, dirty, settings, patch, setSettings, onChanged }: Props) {
  return (
    <section className={card}>
      <div className="flex items-center justify-between">
        {title('storefront', 'المكتب')}
        {dirty && (
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">
            غير محفوظة
          </span>
        )}
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">اسم المكتب</span>
        <input className={input} data-setting="officeName" value={settings.officeName} onChange={(e) => patch({ officeName: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-space-sm">
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">هاتف المكتب</span>
          <input className={input} data-setting="officePhone" dir="ltr" value={settings.officePhone} onChange={(e) => patch({ officePhone: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">عنوان المكتب</span>
          <input className={input} data-setting="officeAddress" value={settings.officeAddress} onChange={(e) => patch({ officeAddress: e.target.value })} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">اسم المشغّل — يُقيَّد مع كل كتاب</span>
        <input className={input} data-setting="operatorName" value={settings.operatorName} onChange={(e) => patch({ operatorName: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          بادئة رقم القيد في أرشيف المكتب — والسنة سنة يوم الإصدار، والرقم لا يُطبع على الكتاب
        </span>
        <input className={input} data-setting="serialPrefix" value={settings.serialPrefix} onChange={(e) => patch({ serialPrefix: e.target.value })} />
      </label>
      <div className="flex items-center justify-between gap-space-sm" data-ui-scale="">
        <span className="font-label-sm text-label-sm text-on-surface-variant">حجم الخطّ في البرنامج</span>
        <div className="flex p-0.5 rounded-lg bg-surface-container-low">
          {UI_SCALES.map((o) => (
            <button
              key={o.value}
              className={`h-8 px-3 rounded-md font-label-md text-label-md ${
                (settings.uiScale || 1) === o.value
                  ? 'bg-primary-container text-on-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
              data-scale={o.value}
              type="button"
              onClick={() => {
                // يُطبَّق ويُحفظ فورًا — تغييرٌ يُرى لا يحتاج «حفظ».
                window.diwan.ui.setZoom(o.value);
                void window.diwan.settings.set({ uiScale: o.value }).then((next) =>
                  setSettings((cur) => (cur ? { ...cur, uiScale: next.uiScale } : next))
                );
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1" data-hijri-offset="">
        <div className="flex items-center justify-between gap-space-sm">
          <span className="font-label-sm text-label-sm text-on-surface-variant">إزاحة التاريخ الهجري</span>
          <div className="flex p-0.5 rounded-lg bg-surface-container-low">
            {HIJRI_OFFSETS.map((d) => (
              <button
                key={d}
                className={`h-8 px-2.5 rounded-md font-label-md text-label-md tabular ${
                  (settings.hijriOffset ?? 0) === d
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
                data-hijri={d}
                title={d === 0 ? 'كما يحسبه تقويم أمّ القرى' : `${d > 0 ? 'بعده' : 'قبله'} ${d === 1 || d === -1 ? 'بيوم' : 'بيومين'}`}
                type="button"
                onClick={() => {
                  // يُطبَّق ويُحفظ فورًا كحجم الخطّ — والواجهة تأخذه من ساعتها (App.tsx).
                  setSettings((cur) => (cur ? { ...cur, hijriOffset: d } : cur));
                  void window.diwan.settings.set({ hijriOffset: d }).then(() => onChanged?.());
                }}
              >
                {d === 0 ? 'كما هو' : `${d > 0 ? '+' : '−'}${toIndic(Math.abs(d))}`}
              </button>
            ))}
          </div>
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant" data-hijri-preview="">
          اليوم {formatGregorian(new Date())} م — {formatHijri(new Date(), settings.hijriOffset ?? 0)} هـ. الميلادي هو الأصل،
          والهجري يُحسب بأمّ القرى فيُزاح يومًا أو يومين ليطابق ما يُعلن في العراق.
        </span>
      </div>
    </section>
  );
}
