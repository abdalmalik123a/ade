/**
 * «لمن التصميم؟» — الشعار والاسم واللون والنمط (DESIGNS.md ٠٫٩): الحال في `useGalleryBrand`، وهنا ما يُرى.
 */
import { PALETTES, STYLES, paletteFrom } from '@shared/design/kit';
import type { GalleryBrand } from './useGalleryBrand';

const chip = (on: boolean) =>
  `h-9 px-3 rounded-chip font-label-md text-label-md flex items-center gap-2 transition-colors ${
    on ? 'bg-primary-fixed text-primary' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
  }`;

export default function BrandPanel({ b }: { b: GalleryBrand }) {
  const { who, setWho, clients, logos, logo, name, setName, brandColor, paletteKey, setPaletteKey, client, style, setStyle, current } = b;
  return (
    <section className="rounded-card bg-surface-container-low p-space-md space-y-space-md" data-brand="">
      <div className="flex flex-wrap items-center gap-space-sm">
        <span className="font-label-md text-label-md text-on-surface-variant font-semibold w-20 shrink-0">لمن؟</span>
        <button className={chip(who === null)} data-logo="none" type="button" onClick={() => setWho(null)}>
          <span className="material-symbols-outlined text-[18px]">hide_image</span>
          بلا جهة
        </button>
        {clients.map((c) => (
          <button key={`c${c.id}`} className={chip(who?.client === c.id)} data-client-chip={c.id} type="button" onClick={() => setWho({ client: c.id })}>
            {c.logo ? (
              <img alt="" className="w-6 h-6 object-contain rounded bg-white" src={`diwan://store/${c.logo}`} />
            ) : (
              <span className="material-symbols-outlined text-[18px]">domain</span>
            )}
            <span className="max-w-[12rem] truncate">{c.name}</span>
          </button>
        ))}
        {logos.map((l) => (
          <button key={`l${l.id}`} className={chip(who?.logo === l.id)} data-logo={l.id} type="button" onClick={() => setWho({ logo: l.id })}>
            <img alt="" className="w-6 h-6 object-contain rounded bg-white" src={`diwan://store/${l.imagePath}`} />
            <span className="max-w-[12rem] truncate">{l.name}</span>
          </button>
        ))}
        {clients.length === 0 && logos.length === 0 && (
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            أضف المدارس والدوائر في «الجهات» بشعاراتها، فتخرج التصاميم بلون كلٍّ منها وشعاره
          </span>
        )}
        <input
          className="h-9 min-w-[16rem] flex-1 max-w-md px-3 rounded-field bg-surface-container-lowest border border-outline-variant font-label-md text-label-md text-on-surface"
          data-brand-name=""
          placeholder={logo?.name ?? 'اسم الجهة كما يُطبع — مدرسة، دائرة، شركة'}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-space-sm">
        <span className="font-label-md text-label-md text-on-surface-variant font-semibold w-20 shrink-0">اللون</span>
        {brandColor && (
          <button
            className={chip(paletteKey === 'brand')}
            data-palette="brand"
            type="button"
            onClick={() => setPaletteKey('brand')}
          >
            <span className="w-5 h-5 rounded-full ring-2 ring-white" style={{ background: paletteFrom(brandColor).primary }} />
            {client?.color ? 'لون الجهة' : 'لون الشعار'}
          </button>
        )}
        {PALETTES.map((p) => (
          <button
            key={p.key}
            className={chip(paletteKey === p.key)}
            data-palette={p.key}
            title={p.name}
            type="button"
            onClick={() => setPaletteKey(p.key)}
          >
            <span
              className="w-5 h-5 rounded-full ring-2 ring-white"
              style={{ background: `linear-gradient(135deg, ${p.primary} 55%, ${p.accent} 55%)` }}
            />
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-space-sm">
        <span className="font-label-md text-label-md text-on-surface-variant font-semibold w-20 shrink-0">النمط</span>
        {/* ثلاثة عشر نمطًا (٣٫١): تلتفّ أسطرًا ولا تخرج عن العرض. */}
        <div className="flex flex-wrap gap-0.5 p-1 rounded-card bg-surface-container-lowest">
          {STYLES.map((s) => (
            <button
              key={s.key}
              className={`h-9 px-4 rounded-btn font-label-md text-label-md transition-colors ${
                style === s.key ? 'bg-primary-fixed text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
              data-style={s.key}
              type="button"
              onClick={() => setStyle(s.key)}
            >
              {s.name}
            </button>
          ))}
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant">{current.hint}</span>
      </div>
    </section>
  );
}
