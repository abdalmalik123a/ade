/**
 * اختيار الخطّ من «خطوط ديوان» (DESIGNS.md ٠٫٧) — قائمةٌ واحدة لمحرّر الكتب والترويسة (والتصاميم في ١٫٥): المحزوم ثم ما
 * أضافه المكتب.
 *
 * **ولا بديل صامت**: خطٌّ تذكره الورقة وليس في المكتبة يُقال باسمه بجانب القائمة. فإن كان في خطوط Windows على هذا الجهاز
 * أُضيف بضغطة (فينتقل في النسخة الاحتياطية ويخرج بخطّه على كلّ جهاز)، وإلا قيل إنّه غائب واقتُرح أقرب المحزوم.
 */
import { useEffect, useState } from 'react';
import { missingFamilies, sameFamily, stackOf, suggestFor } from '@shared/fonts';
import { toIndic } from '@shared/arabic';
import { loadFonts, useLibraryFonts } from '../lib/fonts';

type Props = {
  /** العائلة المختارة — أو عدم (الخيار الفارغ). */
  value: string | null;
  onChange: (family: string | null) => void;
  /** خطوطٌ أخرى في الورقة نفسها — يُقال الغائب منها وإن لم يكن تحت المؤشّر. */
  used?: string[];
  /** اسم الخيار الفارغ («خطّ الورقة») — وبغيره لا خيار فارغ. */
  blank?: string;
  className?: string;
  act?: string;
  title?: string;
};

export default function FontSelect({ value, onChange, used = [], blank, className, act, title }: Props) {
  const fonts = useLibraryFonts();
  const known = value ? fonts.find((f) => sameFamily(f.family, value))?.family : undefined;
  const missing = missingFamilies([...(value ? [value] : []), ...used], fonts.map((f) => f.family));
  const imported = fonts.filter((f) => f.source === 'imported');
  const option = (family: string, label: string) => (
    <option key={family} value={family} style={{ fontFamily: stackOf(family) }}>
      {label}
    </option>
  );
  return (
    <span className="inline-flex items-center gap-1">
      <select aria-label="الخطّ" className={className} data-act={act} title={title} value={known ?? value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        {blank !== undefined && <option value="">{blank}</option>}
        {value && !known && option(value, `${value} — ليس في خطوط ديوان`)}
        <optgroup label="المحزومة مع ديوان">{fonts.filter((f) => f.source === 'bundled').map((f) => option(f.family, f.label))}</optgroup>
        {imported.length > 0 && <optgroup label="ما أضافه المكتب">{imported.map((f) => option(f.family, f.label))}</optgroup>}
      </select>
      {missing[0] && <MissingFont key={missing[0]} family={missing[0]} more={missing.length - 1} />}
    </span>
  );
}

/** الخطّ الغائب باسمه — ويُضاف من Windows بضغطة إن وُجد هناك. */
function MissingFont({ family, more }: { family: string; more: number }) {
  const [state, setState] = useState<'checking' | 'windows' | 'absent' | 'adding' | 'failed'>('checking');
  useEffect(() => {
    let live = true;
    window.diwan.fonts
      .windows()
      .then((list) => live && setState(list.some((f) => sameFamily(f.family, family)) ? 'windows' : 'absent'))
      .catch(() => live && setState('absent'));
    return () => {
      live = false;
    };
  }, [family]);

  const add = async () => {
    setState('adding');
    const out = await window.diwan.fonts.importWindows(family).catch(() => null);
    if (out?.added.length) await loadFonts(); // يختفي التنبيه بنفسه: صار في المكتبة.
    else setState('failed');
  };

  return (
    <span
      className="inline-flex items-center gap-1 h-8 px-2 rounded-lg bg-amber-500/15 text-amber-950 border border-amber-500/40 font-label-sm text-label-sm whitespace-nowrap"
      data-missing-font={family}
      title="خطٌّ ليس في خطوط ديوان يُرسم بخطّ هذا الجهاز وحده — وعلى جهازٍ آخر بخطٍّ غيره"
    >
      <span className="material-symbols-outlined text-[16px]">warning</span>
      «{family}» ليس في خطوط ديوان{more > 0 ? ` (و${toIndic(more)} غيره)` : ''}
      {state === 'windows' && (
        <button className="h-6 px-2 rounded-md bg-amber-600 text-white font-bold" data-act="font-add-windows" type="button" onClick={() => void add()}>
          أضِفه من Windows
        </button>
      )}
      {state === 'adding' && <span>— يُضاف…</span>}
      {(state === 'absent' || state === 'failed') && <span>— ليس على هذا الجهاز؛ أقرب بديل «{suggestFor(family)}»</span>}
    </span>
  );
}
