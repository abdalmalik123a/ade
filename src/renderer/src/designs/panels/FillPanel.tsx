/**
 * «املأ الحقول» — واحدًا بيد، أو قائمةً كاملة في «دفعة» تحته (وما في القائمة يغلب ما يُكتب هنا).
 * وحقل الصورة يُختار صورةً لا يُكتب نصًّا.
 */
import { isChoiceKey } from '@shared/gender';
import type { DesignEditor } from '../editor/useDesignEditor';

export default function FillPanel({ ed }: { ed: DesignEditor }) {
  const { doc, values, setValues, imageKeys, batchRows } = ed;
  if (doc.fields.length === 0) return null;
  return (
    <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm">
      <h2 className="font-body-md text-body-md text-on-surface font-semibold">
        {batchRows.length ? 'ما يشترك فيه الجميع — والقائمة تغلبه' : `املأ الحقول (${doc.fields.length})`}
      </h2>
      {doc.fields
        .filter((f) => !isChoiceKey(f.key))
        .map((f) =>
          imageKeys.includes(f.key) ? (
            <div key={f.key} className="flex items-center gap-space-sm">
              {values[f.key] ? (
                <img alt="" className="w-12 h-14 object-cover rounded border border-outline-variant" src={`diwan://store/${values[f.key]}`} />
              ) : (
                <span className="w-12 h-14 rounded border border-dashed border-outline-variant flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">person</span>
                </span>
              )}
              <button
                className="h-9 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-md text-label-md text-on-surface"
                data-photo={f.key}
                type="button"
                onClick={() => void window.diwan.files.pickImage('photos').then((src) => src && setValues((v) => ({ ...v, [f.key]: src })))}
              >
                {values[f.key] ? `غيّر ${f.label}` : `اختر ${f.label}`}
              </button>
            </div>
          ) : (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant">{f.label}</span>
              <input
                className="h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface"
                data-value={f.key}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </label>
          )
        )}
    </div>
  );
}
