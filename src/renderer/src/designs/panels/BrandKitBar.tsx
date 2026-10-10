/**
 * «طقم الجهة» في المحرّر (DESIGNS.md ٣٫٣): جهةٌ من ملفّاتها ثم ضغطة — شعارها مكان شعار الجهة (أو في الركن)، ولونها في عائلة
 * اللون الغالبة، وخطّها على النصوص، واسمها وعنوانها وهاتفها في حقولها — على أيّ تصميمٍ مفتوح، والتراجع يعيده كلّه.
 */
import { useEffect, useState } from 'react';
import type { Client } from '@shared/orders';
import { applyBrand } from '@shared/design/brand';
import type { DesignEditor } from '../editor/useDesignEditor';
import { logoColor } from '../gallery/useGalleryBrand';

const SELECT = 'flex-1 min-w-0 h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface';

/** حقول هويّة الجهة في التصاميم: الاسم بأسمائه الثلاثة، والعنوان والهاتف. */
const fieldsOf = (c: Client): Record<string, string> => ({
  الجهة: c.name,
  المدرسة: c.name,
  الدائرة: c.name,
  ...(c.address && { العنوان: c.address }),
  ...(c.phone && { الهاتف: c.phone })
});

export default function BrandKitBar({ ed }: { ed: DesignEditor }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [id, setId] = useState<number | null>(null);
  // تُقرأ الجهات مع كلّ تصميمٍ يُفتح — فجهةٌ أُضيفت بعد فتح الشاشة تظهر.
  useEffect(() => void window.diwan.clients.list().then(setClients), [ed.doc.id]);
  if (!clients.length) return null;

  const apply = async () => {
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    // بلا لونٍ محفوظ: لون الشعار، كما في المعرض.
    const color = client.color ?? (client.logo ? await logoColor(client.logo).catch(() => null) : null);
    const out = applyBrand(ed.canvas, { color, font: client.font, logo: client.logo });
    ed.apply(out.canvas);
    const keys = new Set(ed.doc.fields.map((f) => f.key));
    const filled = Object.fromEntries(Object.entries(fieldsOf(client)).filter(([k]) => keys.has(k)));
    if (Object.keys(filled).length) ed.setValues((v) => ({ ...v, ...filled }));
    const parts = [
      out.colors ? `${out.colors} لونًا بلونها` : '',
      out.fonts ? `${out.fonts} نصًّا بخطّها` : '',
      out.logo === 'replaced' ? 'شعارها مكان الشعار' : out.logo === 'added' ? 'شعارها في الركن' : '',
      Object.keys(filled).length ? 'واسمها في حقوله' : ''
    ].filter(Boolean);
    ed.say(parts.length ? `طقم «${client.name}»: ${parts.join('، ')} — والتراجع يعيده` : `لا شيء في ملفّ «${client.name}» يُطبَّق — أضف شعارها أو لونها أو خطّها من «الجهات»`, parts.length ? 'ok' : 'warn');
  };

  return (
    <div className="flex items-center gap-space-sm" data-brand-kit="">
      <span className="font-label-md text-label-md text-on-surface-variant shrink-0">طقم الجهة</span>
      <select className={SELECT} data-act="brand-client" value={id ?? ''} onChange={(e) => setId(e.target.value ? Number(e.target.value) : null)}>
        <option value="">اختر جهة…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        className="h-9 px-space-md rounded-lg bg-secondary-container text-on-secondary font-label-md text-label-md disabled:opacity-40 shrink-0"
        data-act="brand-apply"
        disabled={id === null}
        title="شعارها ولونها وخطّها واسمها على هذا التصميم"
        type="button"
        onClick={() => void apply()}
      >
        طبّق
      </button>
    </div>
  );
}
