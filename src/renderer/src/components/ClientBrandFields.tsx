/**
 * هويّة الجهة في ملفّها (DESIGNS.md ٣٫٣): لونها، وخطّها من «خطوط ديوان» — ومعهما شعارها، يطبّقها «طقم الجهة» على أيّ تصميمٍ
 * بضغطة. واللون إن لم يُختر يُستخرج من الشعار.
 */
import FontSelect from './FontSelect';

const SELECT = 'h-10 px-space-sm rounded-card bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface';

export default function ClientBrandFields({ color, font, onChange }: { color: string; font: string; onChange: (patch: { color?: string; font?: string }) => void }) {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="font-label-md text-label-md text-on-surface font-semibold">اللون</span>
        <span className="flex items-center gap-space-sm">
          <input className="w-12 h-10 rounded-field border border-outline-variant bg-surface-container-low" type="color" value={color || '#1f3a8a'} onChange={(e) => onChange({ color: e.target.value })} />
          <span className="font-label-sm text-label-sm text-on-surface-variant">{color ? 'لون تصاميمها وترويساتها' : 'يُستخرج من الشعار حين يُوضع'}</span>
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-md text-label-md text-on-surface font-semibold">الخطّ</span>
        <FontSelect act="client-font" blank="بلا خطٍّ خاصّ" className={SELECT} title="خطّ تصاميم الجهة — يطبّقه «طقم الجهة»" value={font || null} onChange={(family) => onChange({ font: family ?? '' })} />
      </label>
    </>
  );
}
