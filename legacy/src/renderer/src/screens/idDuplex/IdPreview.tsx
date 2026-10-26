// انتهى — البديل: screens/idSheet/IdDocsDialog.tsx و@shared/idDocSheet («ورقة المستمسكات»، S47) — الأمر D197–D201 — ٢٦ ت١ ٢٠٢٦
/**
 * معاينة ورقة A4 الحقيقية في استنساخ الهوية (تقسيم النافذة بعد ١٫٧٫٠) — منقولةٌ من `IdDuplexDialog` كما هي.
 */
import type { IdDuplexLayoutMode } from '@shared/idCardDuplex';

type Props = {
  pagesHtml: string[];
  mode: IdDuplexLayoutMode;
};

export default function IdPreview({ pagesHtml, mode }: Props) {
  return (
    <div className="flex-1 bg-neutral-800 flex flex-col items-center justify-center p-6 overflow-auto">
      {pagesHtml.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-white/50">
          <span className="material-symbols-outlined text-[48px]">badge</span>
          <span>اختر صورة الوجه أو الظهر لبدء المعاينة الحية للورقة</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-6">
          {pagesHtml.map((pHtml, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <span className="text-white/70 text-xs font-mono">
                {mode === 'duplex'
                  ? idx === 0
                    ? 'الوجه الأمامي (Page 1)'
                    : 'الظهر الخلفي (Page 2)'
                  : `ورقة A4 (${idx + 1})`}
              </span>
              <div
                className="bg-white shadow-card rounded-sm overflow-hidden border border-black/20 origin-center transition-transform"
                style={{
                  width: '297px', // معاينة بنسبة A4 مصغرة
                  height: '420px',
                  transform: 'scale(1)'
                }}
                dangerouslySetInnerHTML={{
                  __html: pHtml.replace(/width:210mm;height:297mm/g, 'width:297px;height:420px')
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
