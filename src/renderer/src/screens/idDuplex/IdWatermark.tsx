/**
 * العلامة المائية فوق نسخة الهوية — فالنسخة المعطاة لجهةٍ لا تصلح لغيرها (تقسيم النافذة بعد ١٫٧٫٠) — منقولةٌ من `IdDuplexDialog` كما هي.
 */
import type { Dispatch, SetStateAction } from 'react';
import { purposeWatermark } from '@shared/watermark';

type Props = {
  wmOn: boolean;
  setWmOn: Dispatch<SetStateAction<boolean>>;
  wmTo: string;
  setWmTo: Dispatch<SetStateAction<string>>;
  setWmText: Dispatch<SetStateAction<string>>;
  wmText: string;
  wmOpacity: number;
  setWmOpacity: Dispatch<SetStateAction<number>>;
};

export default function IdWatermark({ wmOn, setWmOn, wmTo, setWmTo, setWmText, wmText, wmOpacity, setWmOpacity }: Props) {
  return (
    <div className="space-y-2 pt-2 border-t border-outline-variant text-xs" data-id-watermark="">
      <label className="flex items-center gap-2 cursor-pointer font-bold">
        <input
          type="checkbox"
          checked={wmOn}
          data-act="id-watermark"
          onChange={(e) => setWmOn(e.target.checked)}
          className="rounded text-secondary focus:ring-primary"
        />
        <span>علامة مائية فوق النسخة</span>
      </label>
      {wmOn && (
        <>
          <input
            className="w-full h-8 px-2 rounded bg-surface text-on-surface border border-outline-variant"
            data-watermark-to=""
            placeholder="الجهة التي تُقدَّم إليها — مثال: مصرف الرشيد"
            value={wmTo}
            onChange={(e) => {
              setWmTo(e.target.value);
              setWmText(purposeWatermark(e.target.value));
            }}
          />
          <input
            className="w-full h-8 px-2 rounded bg-surface text-on-surface border border-outline-variant"
            data-watermark-text=""
            value={wmText}
            onChange={(e) => setWmText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <span>الوضوح</span>
            <input
              className="flex-1"
              max={0.5}
              min={0.1}
              step={0.02}
              type="range"
              value={wmOpacity}
              onChange={(e) => setWmOpacity(Number(e.target.value))}
            />
          </div>
        </>
      )}
    </div>
  );
}
