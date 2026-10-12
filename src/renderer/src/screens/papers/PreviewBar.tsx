/**
 * شريط معاينة ورقة الأسئلة (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PapersScreen` كما هو: الاتجاه والأرقام والإجابات والنموذجان والتكبير.
 */
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  total: number;
  answers: boolean;
  setAnswers: Dispatch<SetStateAction<boolean>>;
  versions: boolean;
  setVersions: Dispatch<SetStateAction<boolean>>;
  setShowB: Dispatch<SetStateAction<boolean>>;
  showB: boolean;
};

export default function PreviewBar({ total, answers, setAnswers, versions, setVersions, setShowB, showB }: Props) {
  return (
    <div className="min-h-14 px-space-lg py-space-xs flex flex-wrap items-center gap-space-sm border-b border-outline-variant bg-surface-container-lowest">
      <span
        className={`px-space-sm py-0.5 rounded-full font-label-sm text-label-sm font-bold shrink-0 whitespace-nowrap ${
          total === 100
            ? 'bg-secondary text-on-secondary'
            : 'bg-surface-container-high text-on-surface-variant'
        }`}
        data-total
      >
        المجموع {total}
        {total !== 100 && ' — لم يبلغ المئة'}
      </span>

      <div className="flex-1" />
      <div className="flex flex-wrap items-center justify-end gap-space-sm">
        <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
          <input
            checked={answers}
            type="checkbox"
            onChange={(e) => setAnswers(e.target.checked)}
          />
          ورقة المصحّح
        </label>

        <label
          className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap"
          title="الفروع بترتيبين، والنسخ تتناوب أ، ب، أ، ب — فلا ينقل الطالب عن جاره"
        >
          <input
            checked={versions}
            data-act="versions"
            type="checkbox"
            onChange={(e) => {
              setVersions(e.target.checked);
              setShowB(false);
            }}
          />
          نموذجان أ و ب
        </label>
        {versions && (
          <div className="flex p-0.5 rounded-lg bg-surface-container-low" data-version-view="">
            {['أ', 'ب'].map((v) => (
              <button
                key={v}
                className={`h-7 px-3 rounded-md font-label-md text-label-md ${
                  (v === 'ب') === showB ? 'bg-primary-container text-on-primary font-semibold' : 'text-on-surface-variant'
                }`}
                data-version={v}
                type="button"
                onClick={() => setShowB(v === 'ب')}
              >
                {v}
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
