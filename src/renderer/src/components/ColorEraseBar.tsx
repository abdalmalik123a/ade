/**
 * أدوات «امسح لونًا» (البند ٣٨) — في «الصور الشخصية» و«أزل الخلفية» بالتصاميم: السماحية، والمتّصل وحده أو الصورة كلّها،
 * وتنعيم الحافّة، و«تراجع». وما يتغيّر منها يعيد آخر ضغطةٍ وهي ظاهرة (`useColorErase`). و`ColorEraseHint` الاقتراح بعد
 * التفريغ: حوافّ الصورة بقيت لونًا واحدًا.
 */
import { toIndic } from '@shared/arabic';
import { SMOOTH_MAX } from '@shared/colorErase';
import type { ColorErase } from '../lib/useColorErase';

const LABEL = 'flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant';
const chip = (on: boolean) =>
  `h-7 px-2.5 rounded-full font-label-sm text-label-sm ${on ? 'bg-secondary-container text-on-secondary-container font-semibold' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'}`;

export default function ColorEraseBar({ erase }: { erase: ColorErase }) {
  const { opts, update } = erase;
  return (
    <div className="flex flex-wrap items-center justify-center gap-space-sm" data-erase-bar="">
      <label className={LABEL} title="كم يبتعد اللون عمّا ضغطت عليه ويُمسح معه">
        السماحية
        <input className="w-24" data-erase-tolerance="" max={120} min={1} type="range" value={opts.tolerance} onChange={(e) => update({ tolerance: Number(e.target.value) })} />
        <span className="w-6 tabular">{toIndic(opts.tolerance)}</span>
      </label>
      <span className="flex gap-1">
        <button className={chip(opts.contiguous)} data-erase-mode="contiguous" title="ما يتّصل بموضع الضغطة وحده" type="button" onClick={() => update({ contiguous: true })}>
          المتّصل وحده
        </button>
        <button className={chip(!opts.contiguous)} data-erase-mode="all" title="اللون في الصورة كلّها — لما بين الحروف وداخل الحلقات" type="button" onClick={() => update({ contiguous: false })}>
          الصورة كلّها
        </button>
      </span>
      <label className={LABEL} title="الحافّة حول ما يُمسح تصير ناعمةً بلا هالةٍ من اللون">
        تنعيم الحافّة
        <input className="w-16" data-erase-smooth="" max={SMOOTH_MAX} min={0} step={1} type="range" value={opts.smooth} onChange={(e) => update({ smooth: Number(e.target.value) })} />
      </label>
      <button className={`${chip(false)} flex items-center gap-1 disabled:opacity-40`} data-act="erase-undo" disabled={!erase.canUndo} type="button" onClick={erase.undo}>
        <span className="material-symbols-outlined text-[15px]">undo</span>
        تراجع
      </button>
    </div>
  );
}

/** الاقتراح بعد التفريغ — «امسحه» يمسح اللون من حوافّ الصورة، و`onAccept` يختار الأداة فتُضبط منزلقاتها. */
export function ColorEraseHint({ erase, onAccept }: { erase: ColorErase; onAccept?: () => void }) {
  if (!erase.hint) return null;
  const [r, g, b] = erase.hint;
  return (
    <div className="flex items-center gap-space-sm px-space-sm py-1.5 rounded-lg bg-secondary-container/60 text-on-secondary-container font-label-sm text-label-sm" data-erase-hint="">
      <span className="w-4 h-4 shrink-0 rounded-full border border-outline-variant" style={{ background: `rgb(${r},${g},${b})` }} />
      <span className="flex-1">حوافّ الصورة بقيت بهذا اللون — أهو خلفيةٌ لم تُزل؟</span>
      <button
        className="h-7 px-2.5 rounded-full bg-primary-container text-on-primary font-semibold"
        data-act="erase-hint"
        type="button"
        onClick={() => {
          erase.acceptHint();
          onAccept?.();
        }}
      >
        امسحه
      </button>
      <button className="w-6 h-6 rounded-full hover:bg-surface-container-high flex items-center justify-center" title="اتركه" type="button" onClick={erase.dismissHint}>
        <span className="material-symbols-outlined text-[15px]">close</span>
      </button>
    </div>
  );
}
