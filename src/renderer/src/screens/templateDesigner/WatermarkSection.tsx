/**
 * العلامة المائية في مصمّم النماذج (تقسيمه بعد ١٫٧٫٠) — منقولةٌ من `TemplateDesigner` كما هي: نصٌّ أو شعارٌ يُطبع خلف المتن باهتًا.
 */
import type { Dispatch, SetStateAction } from 'react';
import { inputCls } from './shared';
import type { Watermark } from '@shared/doc';
import type { Seal } from '@shared/api';

type Props = {
  watermark: Watermark | null;
  wantImage: boolean;
  setWantImage: Dispatch<SetStateAction<boolean>>;
  setWatermark: (next: Watermark | null) => void;
  sealImages: Seal[];
};

export default function WatermarkSection({ watermark, wantImage, setWantImage, setWatermark, sealImages }: Props) {
  return (
    <section className="mt-space-md bg-surface-container-low rounded-xl p-space-md space-y-space-sm">
      <h3 className="font-headline-sm text-headline-sm text-on-surface">العلامة المائية</h3>
      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-surface-container-lowest">
        {(
          [
            { key: 'none', label: 'بلا' },
            { key: 'text', label: 'نصّ' },
            { key: 'image', label: 'شعار' }
          ] as const
        ).map((o) => {
          const on =
            o.key === 'none'
              ? !watermark && !wantImage
              : o.key === 'text'
                ? watermark?.kind === 'text'
                : watermark?.kind === 'image' || (wantImage && !watermark);
          return (
            <button
              key={o.key}
              className={`h-8 rounded-md font-label-md text-label-md transition-colors ${
                on
                  ? 'bg-primary-container text-on-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
              data-act={`wm-${o.key}`}
              type="button"
              onClick={() => {
                setWantImage(o.key === 'image');
                if (o.key === 'none') setWatermark(null);
                else if (o.key === 'text')
                  setWatermark({
                    kind: 'text',
                    text: watermark?.kind === 'text' ? watermark.text : 'مسودة'
                  });
                else {
                  const first = sealImages[0] ?? null;
                  setWatermark(first ? { kind: 'image', src: first.imagePath! } : null);
                }
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {watermark?.kind === 'text' && (
        <>
          <input
            className={inputCls}
            maxLength={40}
            type="text"
            value={watermark.text}
            onChange={(e) => setWatermark({ kind: 'text', text: e.target.value })}
          />
          <div className="flex flex-wrap gap-1">
            {['مسودة', 'نسخة', 'سري', 'للاستعمال الرسمي'].map((t) => (
              <button
                key={t}
                className="h-7 px-2 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm"
                type="button"
                onClick={() => setWatermark({ kind: 'text', text: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}

      {(watermark?.kind === 'image' || wantImage) &&
        (sealImages.length === 0 ? (
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            لا شعار محفوظ — ارفعه من «الترويسات والشعارات» ثم اختره هنا.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {sealImages.map((s) => (
              <button
                key={s.id}
                className={`p-1 rounded-lg flex flex-col items-center gap-0.5 ${
                  watermark?.kind === 'image' && watermark.src === s.imagePath
                    ? 'bg-secondary-fixed ring-2 ring-secondary'
                    : 'bg-surface-container-lowest hover:bg-surface-container-high'
                }`}
                type="button"
                onClick={() => setWatermark({ kind: 'image', src: s.imagePath! })}
              >
                <img alt="" className="w-12 h-12 object-contain" src={`diwan://store/${s.imagePath}`} />
                <span className="font-label-sm text-label-sm truncate w-full text-center">{s.name}</span>
              </button>
            ))}
          </div>
        ))}

      <p className="font-label-sm text-label-sm text-on-surface-variant">
        تُرسم خلف المتن باهتةً فلا تحجب حرفًا — وتُطبع كما تراها.
      </p>
    </section>
  );
}
