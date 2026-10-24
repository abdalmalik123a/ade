/**
 * رأس ورقة الأسئلة الثابت (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PapersScreen` كما هو: النماذج الوزارية السريعة وخانات الترويسة.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { EXAM_PRESETS, HEAD_INPUTS } from '@shared/examPaper';

type Props = {
  setHead: Dispatch<SetStateAction<Record<string, string>>>;
  head: Record<string, string>;
  focused: MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>;
};

export default function PaperHead({ setHead, head, focused }: Props) {
  return (
    <div className="rounded-card bg-surface-container-lowest p-space-md space-y-space-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-secondary text-[20px]">lock</span>
          <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
            الرأس ثابت (تعبئة تلقائية)
          </h2>
        </div>
      </div>
      {/* نماذج وزارية سريعة لتعبئة ترويسة الامتحان */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {EXAM_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className="h-7 px-2.5 rounded-btn bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-on-surface font-label-sm text-label-sm shrink-0 transition-colors flex items-center gap-1 shadow-low"
            type="button"
            title={preset.description}
            onClick={() => {
              setHead((h) => {
                const next = { ...h };
                for (const [k, v] of Object.entries(preset.head)) {
                  if (v !== undefined) next[k] = v;
                }
                return next;
              });
            }}
          >
            <span className="text-secondary font-bold">⚡ {preset.name}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-space-sm">
        {HEAD_INPUTS.map((input) => (
          <label
            key={input.key}
            className={`flex flex-col gap-1 ${
              input.key === 'الملاحظة' || input.key === 'التمنيات' ? 'col-span-2' : ''
            }`}
          >
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {input.label}
            </span>
            <input
              className="h-9 px-space-sm rounded-field bg-surface-container-low border border-outline-variant font-body-sm text-body-sm text-on-surface"
              data-head={input.key}
              placeholder={input.hint}
              value={head[input.key] ?? ''}
              onFocus={(e) => (focused.current = e.currentTarget)}
              onChange={(e) => setHead((h) => ({ ...h, [input.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
