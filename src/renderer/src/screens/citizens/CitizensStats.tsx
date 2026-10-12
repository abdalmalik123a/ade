/**
 * مؤشّرات «الأشخاص» في أعلاها (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `CitizensScreen` كما هي.
 */
import { nf } from './shared';
import type { CitizenStats } from '@shared/api';

type Props = {
  stats: CitizenStats | null;
  ocrReady: boolean;
};

export default function CitizensStats({ stats, ocrReady }: Props) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
      {[
        {
          label: 'الملفات المسجلة النشطة',
          value: nf.format(stats?.activeFiles ?? 0),
          unit: 'ملف',
          icon: 'folder_shared',
          hint:
            (stats?.activeFiles ?? 0) === 0
              ? 'لم يُسجَّل أي مواطن بعد'
              : `${nf.format(stats?.verifiedFiles ?? 0)} موثّق رسميًا`
        },
        {
          label: 'المستمسكات المؤرشفة',
          value: nf.format(stats?.attachments ?? 0),
          unit: 'مستمسك',
          icon: 'inventory_2',
          hint:
            (stats?.attachments ?? 0) === 0 ? 'لم يُمسح أي مستمسك بعد' : 'محفوظة محليًا'
        },
        {
          label: 'دقة استخراج النصوص OCR',
          value:
            stats?.ocrAccuracy === null || stats?.ocrAccuracy === undefined
              ? '—'
              : `${(stats.ocrAccuracy * 100).toFixed(1)}%`,
          unit: '',
          icon: 'document_scanner',
          hint: ocrReady
            ? stats?.ocrAccuracy == null
              ? 'تُقاس بعد أول استخراج'
              : 'متوسط الملفات المستخرَجة'
            : 'بيانات التعرّف غير مثبّتة'
        },
        {
          label: 'الكتب الصادرة هذا الشهر',
          value: nf.format(stats?.issuedThisMonth ?? 0),
          unit: 'كتاب',
          icon: 'history_edu',
          hint:
            (stats?.issuedThisMonth ?? 0) === 0 ? 'لم يصدر أي كتاب هذا الشهر' : 'من الصادر'
        }
      ].map((card) => (
        <div
          key={card.label}
          className="bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center justify-between"
        >
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold tracking-wide">
              {card.label}
            </span>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight tabular">
                {card.value}
              </span>
              {card.unit && (
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  {card.unit}
                </span>
              )}
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {card.hint}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary shadow-sm">
            <span className="material-symbols-outlined text-[24px]">{card.icon}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
