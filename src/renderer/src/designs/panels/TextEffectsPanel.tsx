/**
 * تأثيرات النصّ (DESIGNS.md ١٫١٠): ظلٌّ بلونه وبُعده ونعومته، وحدٌّ حول الحروف بلونه وسُمكه، وقوسٌ يحني السطر للأعلى
 * كقوس الباب أو للأسفل كالابتسامة — للأختام والشعارات وعناوين الشهادات.
 */
import type { TextElement } from '@shared/canvas';
import { NUM, toHexColor } from '../editor/kit';

const ROW = 'flex items-center gap-space-sm flex-wrap font-label-sm text-label-sm text-on-surface-variant';
const COLOR = 'w-10 h-8 rounded border border-outline-variant bg-surface-container-low';

type EffectsPatch = Partial<Pick<TextElement, 'shadow' | 'outline' | 'arc'>>;
type Shadow = NonNullable<TextElement['shadow']>;

/** ظلٌّ أسود خفيف (شفافيته ٣٥٪) أسفلَ النصّ ويساره قليلًا — ما يُريده أكثر المكاتب. */
const SHADOW: Shadow = { color: '#00000059', dx: 0.6, dy: 1, blur: 2 };

/** لون الظلّ الجديد بشفافية القديم: منتقي الألوان لا يعرف الشفافية. */
const keepAlpha = (hex: string, old: string) => hex + (/^#[0-9a-f]{8}$/i.test(old) ? old.slice(7) : '');

export default function TextEffectsPanel({ el, patch }: { el: TextElement; patch: (p: EffectsPatch) => void }) {
  const sh = el.shadow;
  const distance = sh ? Math.round(Math.hypot(sh.dx, sh.dy) * 10) / 10 : 0;
  /** البُعد يُزاح باتّجاهه الأوّل (أسفل ويسار قليلًا) — والصفر ظلٌّ حول الحروف كالتوهّج. */
  const at = (d: number): Pick<Shadow, 'dx' | 'dy'> => {
    const len = sh && distance > 0 ? distance : Math.hypot(SHADOW.dx, SHADOW.dy);
    const base = sh && distance > 0 ? sh : SHADOW;
    return { dx: Math.round(((base.dx * d) / len) * 100) / 100, dy: Math.round(((base.dy * d) / len) * 100) / 100 };
  };
  return (
    <div className="space-y-space-xs" data-panel="text-effects">
      <div className={ROW}>
        <label className="flex items-center gap-1">
          <input checked={Boolean(sh)} data-act="text-shadow-on" type="checkbox" onChange={(e) => patch({ shadow: e.target.checked ? SHADOW : undefined })} />
          ظلّ
        </label>
        {sh && (
          <>
            <input className={COLOR} data-act="text-shadow-color" title="لون الظلّ" type="color" value={toHexColor(sh.color.slice(0, 7))} onChange={(e) => patch({ shadow: { ...sh, color: keepAlpha(e.target.value, sh.color) } })} />
            <label className="flex items-center gap-1">
              بُعد
              <input className={NUM} data-act="text-shadow-distance" inputMode="decimal" title="بُعد الظلّ عن النصّ (نقطة)" value={distance} onChange={(e) => patch({ shadow: { ...sh, ...at(Math.max(0, Number(e.target.value) || 0)) } })} />
            </label>
            <label className="flex items-center gap-1">
              نعومة
              <input className={NUM} data-act="text-shadow-blur" inputMode="decimal" title="نعومة الظلّ (نقطة) — الصفر ظلٌّ حادّ" value={sh.blur} onChange={(e) => patch({ shadow: { ...sh, blur: Math.max(0, Number(e.target.value) || 0) } })} />
            </label>
          </>
        )}
      </div>
      <div className={ROW}>
        <label className="flex items-center gap-1">
          <input checked={Boolean(el.outline)} data-act="text-outline-on" type="checkbox" onChange={(e) => patch({ outline: e.target.checked ? { color: '#ffffff', width: 0.75 } : undefined })} />
          حدّ حول الحروف
        </label>
        {el.outline && (
          <>
            <input className={COLOR} data-act="text-outline-color" title="لون الحدّ" type="color" value={toHexColor(el.outline.color)} onChange={(e) => patch({ outline: { ...el.outline!, color: e.target.value } })} />
            <label className="flex items-center gap-1">
              <input className={NUM} data-act="text-outline-width" inputMode="decimal" title="سُمك الحدّ (نقطة)" value={el.outline.width} onChange={(e) => patch({ outline: { ...el.outline!, width: Number(e.target.value) || el.outline!.width } })} />
              نقطة
            </label>
          </>
        )}
      </div>
      <label className={ROW}>
        قوس
        <input className="flex-1" data-act="text-arc" max={100} min={-100} step={5} title="الموجب يحني السطر للأعلى كقوس الباب، والسالب للأسفل كالابتسامة" type="range" value={el.arc ?? 0} onChange={(e) => patch({ arc: Number(e.target.value) || undefined })} />
        <span className="w-10 tabular">{el.arc ?? 0}</span>
      </label>
    </div>
  );
}
