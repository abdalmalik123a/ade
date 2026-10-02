/**
 * «عن البرنامج» (خطة Production، ٦٫١ و٦٫٥): الأيقونة والإصدار، والمطوّر بالعربية والإنكليزية ورقمه،
 * وشعار MADA TECH على بطاقةٍ داكنة (حروفه البيضاء لا تُرى على فاتح)، والإشعارات القانونية لما في
 * البرنامج من عمل غيرنا.
 */
import { useEffect, useState } from 'react';
import type { LicenseStatus } from '@shared/api';
import { DEVELOPER, channels } from '@shared/brand';
import icon from '../assets/brand/diwan-icon.png';
import logo from '../assets/brand/madatech-logo.png';
import notices from '../assets/notices.json';
import { licenseLine } from './LicenseCard';

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  const [version, setVersion] = useState<string | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [legal, setLegal] = useState(false);

  useEffect(() => {
    void window.diwan.ui.info().then((i) => setVersion(i.version));
    void window.diwan.license.status().then(setLicense).catch(() => setLicense(null));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-scrim/50 p-space-md"
      data-about=""
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-2xl p-space-lg flex flex-col gap-space-md">
        <div className="flex items-center gap-space-md">
          <img alt="ديوان" className="w-20 h-20" src={icon} />
          <div className="flex-1 min-w-0">
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">ديوان</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">منظومة الكتب والتحارير لمكاتب الاستنساخ والطباعة</p>
            <p className="font-label-md text-label-md text-on-surface" data-about-version="">
              الإصدار {version ?? '…'}
            </p>
          </div>
          <button className="self-start w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface-container-high" title="إغلاق" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {license && (
          <p className={`font-label-md text-label-md ${license.status === 'expired' ? 'text-error' : 'text-secondary'}`}>{licenseLine(license)}</p>
        )}

        <div className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-1" data-about-developer="">
          <span className="font-label-sm text-label-sm text-on-surface-variant">التطوير</span>
          <span className="font-title-md text-title-md text-on-surface font-semibold">{DEVELOPER.nameAr}</span>
          <span className="font-label-md text-label-md text-on-surface-variant" dir="ltr">
            {DEVELOPER.nameEn}
          </span>
          <a className="font-label-md text-label-md text-secondary font-semibold" dir="ltr" href={DEVELOPER.whatsapp} rel="noreferrer" target="_blank">
            {DEVELOPER.phoneDisplay} — WhatsApp
          </a>
        </div>

        {channels().length > 0 && (
          <div className="flex flex-col gap-space-xs" data-channels="">
            <span className="font-label-sm text-label-sm text-on-surface-variant">قنواتنا — تُفتح في متصفّح الجهاز</span>
            <div className="flex flex-wrap gap-space-xs">
              {channels().map((c) => (
                <a
                  key={c.key}
                  className="h-9 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center"
                  href={c.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {c.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* الشعار أبيضٌ وأزرق على شفّاف: يُعرض على داكن. */}
        <div className="rounded-xl bg-[#0b1020] p-space-md flex items-center justify-center">
          <img alt={DEVELOPER.company} className="h-24 object-contain" src={logo} />
        </div>

        <div>
          <button
            className="font-label-md text-label-md text-secondary hover:underline"
            data-act="about-legal"
            type="button"
            onClick={() => setLegal((v) => !v)}
          >
            {legal ? 'أخفِ الإشعارات القانونية' : 'الإشعارات القانونية — ما في البرنامج من عمل غيرنا'}
          </button>
          {legal && (
            <ul className="mt-space-xs flex flex-col gap-0.5 font-label-sm text-label-sm text-on-surface" data-about-notices="">
              {notices.map((n) => (
                <li key={n.name} className="flex gap-space-xs">
                  <span className="flex-1 min-w-0 truncate" dir="auto">
                    {n.name}
                  </span>
                  <span className="text-on-surface-variant" dir="ltr">
                    {n.version}
                  </span>
                  <span className="text-on-surface-variant shrink-0" dir="auto">
                    {n.license}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
