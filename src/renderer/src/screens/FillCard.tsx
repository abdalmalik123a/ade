/**
 * بطاقة التعبئة (هـ٦) — تُفتح في نافذةٍ صغيرة فوق المتصفّح.
 *
 * الموظف يملأ استمارةً في موقعٍ حكومي: ينقر السطر فيُنسخ، ثم يلصقه في الخانة. والاسم
 * مفرَّقٌ كما تسأل المواقع، والتاريخ والهاتف بصيغها — فلا يقصّ بيده ولا يعيد الكتابة.
 */
import { useEffect, useState } from 'react';
import type { CitizenDetail } from '@shared/api';
import { fillGroups } from '@shared/fillCard';

export default function FillCard({ citizenId }: { citizenId: number }) {
  const [citizen, setCitizen] = useState<CitizenDetail | null | undefined>(undefined);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void window.diwan.citizens.get(citizenId).then(setCitizen).catch(() => setCitizen(null));
  }, [citizenId]);

  useEffect(() => {
    document.title = citizen ? `بطاقة التعبئة — ${citizen.fullName}` : 'بطاقة التعبئة';
  }, [citizen]);

  if (citizen === undefined) return <main className="p-space-md font-label-md text-label-md text-on-surface-variant">…</main>;
  if (!citizen) return <main className="p-space-md font-label-md text-label-md text-error">لم يُعثر على ملف المواطن</main>;

  const copy = (key: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  };

  return (
    <main className="min-h-screen bg-surface p-space-sm flex flex-col gap-space-sm" data-fill-card="">
      <header className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-secondary text-[22px]">content_paste</span>
        <div className="flex flex-col min-w-0">
          <span className="font-headline-sm text-headline-sm text-on-surface truncate">{citizen.fullName}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">انقر السطر فيُنسخ، ثم الصقه في خانة الموقع</span>
        </div>
      </header>
      {fillGroups(citizen).map((g) => (
        <section key={g.title} className="rounded-xl bg-surface-container-lowest p-space-xs flex flex-col gap-0.5 shadow-sm">
          <span className="px-space-xs font-label-sm text-label-sm text-on-surface-variant font-semibold">{g.title}</span>
          {g.lines.map((l) => {
            const key = `${g.title}/${l.label}`;
            return (
              <button
                key={key}
                className={`flex items-center gap-space-xs text-right px-space-xs py-1.5 rounded-lg transition-colors ${
                  copied === key ? 'bg-secondary-fixed' : 'hover:bg-surface-container-high'
                }`}
                data-fill-line={l.label}
                title="انقر لتنسخه"
                type="button"
                onClick={() => copy(key, l.value)}
              >
                <span className="w-28 shrink-0 font-label-sm text-label-sm text-on-surface-variant">{l.label}</span>
                <span className="flex-1 min-w-0 font-label-lg text-label-lg text-on-surface truncate" dir="auto">
                  {l.value}
                </span>
                <span className="material-symbols-outlined text-[16px] text-secondary">{copied === key ? 'check' : 'content_copy'}</span>
              </button>
            );
          })}
        </section>
      ))}
    </main>
  );
}
