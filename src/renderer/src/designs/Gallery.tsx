/**
 * معرض التصاميم — يبدأ من الزبون لا من القالب.
 *
 * «لمن التصميم؟» أولًا: شعار المدرسة واسمها، فيُستخرج لونها من شعارها. ثم يرى
 * المكتب أنواعه الاثني عشر **بهويّة هذه المدرسة** حيّةً بعيّنةٍ عراقية — لا
 * صناديق فارغة — ويبدّل النمط واللون فتتبدّل كلّها معًا. ويضغط ما يريد فيُفتح
 * في المحرّر نسخةً يعدّلها ويحفظها.
 *
 * والشعار من «الترويسات والشعارات»: يُرفع مرّةً ويخدم الكتب والتصاميم معًا.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Seal, TemplateSummary } from '@shared/api';
import { canvasPx, SCREEN_DPI } from '@shared/canvas';
import { renderCanvasHtml } from '@shared/canvasHtml';
import { fitCanvasText } from '@shared/canvasFit';
import { impose, inlineBarcodes } from '@shared/imposition';
import {
  KINDS,
  PALETTES,
  STYLES,
  buildDoc,
  dominantColor,
  paletteFrom,
  sampleValues,
  type Brand,
  type KindSpec,
  type Palette
} from '@shared/designKit';

export type GalleryPick = { kind: KindSpec; style: string; palette: Palette; brand: Brand };

const GROUPS = ['الكل', 'شهادات', 'هويّات', 'مدرسية', 'مناسبات', 'أعمال'];

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

/** لون الشعار من بكسلاته — والصورة تُقرأ من المخزن برأس CORS فلا تُقفَل اللوحة. */
async function logoColor(path: string): Promise<string | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `diwan://store/${path}`;
  await img.decode();
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  return dominantColor(ctx.getImageData(0, 0, size, size).data);
}

function Thumb({
  kind,
  style,
  palette,
  brand,
  width,
  height
}: {
  kind: KindSpec;
  style: string;
  palette: Palette;
  brand: Brand;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { html, px } = useMemo(() => {
    const doc = buildDoc({ kind: kind.key, style, palette, brand });
    return {
      html: inlineBarcodes(renderCanvasHtml(doc, sampleValues(brand), { dpi: SCREEN_DPI, marks: false, missing: 'blank' })),
      px: canvasPx(doc.canvas!, SCREEN_DPI)
    };
  }, [kind, style, palette, brand]);
  const scale = Math.min(width / px.w, height / px.h);

  // القياس بعد الرسم وبعد الخطوط — فالاسم الطويل يصغر في اللمحة كما يصغر في الطباعة.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    fitCanvasText(root);
    void document.fonts.ready.then(() => ref.current && fitCanvasText(ref.current));
  }, [html]);

  return (
    <div className="shrink-0 overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgba(15,23,42,0.12),0_8px_24px_-6px_rgba(15,23,42,0.25)]" style={{ width: px.w * scale, height: px.h * scale }}>
      <div
        ref={ref}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ width: px.w, height: px.h, transform: `scale(${scale})`, transformOrigin: 'top right' }}
      />
    </div>
  );
}

export default function Gallery({
  saved,
  onPick,
  onOpenSaved,
  onOpenImage,
  onImport
}: {
  saved: TemplateSummary[];
  onPick: (pick: GalleryPick) => void;
  onOpenSaved: (id: number) => void;
  onOpenImage: () => void;
  onImport: () => void;
}) {
  const [logos, setLogos] = useState<Seal[]>([]);
  const [logoId, setLogoId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [paletteKey, setPaletteKey] = useState('royal');
  const [style, setStyle] = useState('official');
  const [group, setGroup] = useState('الكل');

  useEffect(() => {
    void window.diwan.seals.list().then((all) => setLogos(all.filter((s) => s.kind === 'شعار' && s.imagePath)));
  }, []);

  const logo = logos.find((l) => l.id === logoId) ?? null;

  // شعارٌ اختير: اسمه اسم الجهة ما لم يُكتب غيره، ولونه لوحتها.
  useEffect(() => {
    setBrandColor(null);
    if (!logo?.imagePath) {
      if (paletteKey === 'brand') setPaletteKey('royal');
      return;
    }
    let alive = true;
    void logoColor(logo.imagePath)
      .then((hex) => {
        if (!alive) return;
        setBrandColor(hex);
        if (hex) setPaletteKey('brand');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo?.imagePath]);

  const palette = useMemo(
    () =>
      paletteKey === 'brand' && brandColor
        ? paletteFrom(brandColor, 'لون الشعار')
        : (PALETTES.find((p) => p.key === paletteKey) ?? PALETTES[0]!),
    [paletteKey, brandColor]
  );
  const brand: Brand = useMemo(
    () => ({ name: name.trim() || logo?.name || undefined, logo: logo?.imagePath ?? null }),
    [name, logo]
  );
  const kinds = KINDS.filter((k) => group === 'الكل' || k.group === group);
  const current = STYLES.find((s) => s.key === style)!;

  const chip = (on: boolean) =>
    `h-9 px-3 rounded-full font-label-md text-label-md flex items-center gap-2 transition-colors ${
      on ? 'bg-primary-container text-on-primary' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
    }`;

  return (
    <div className="h-full overflow-auto" data-gallery-view="">
      <div className="max-w-[1440px] mx-auto px-space-xl py-space-lg space-y-space-lg">
        <header className="flex flex-wrap items-end justify-between gap-space-md">
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold">التصاميم</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              هويّات وشهادات وبطاقات بهويّة الجهة — وتُطبع قائمةً كاملة على ورقٍ يُقصّ
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5"
              data-act="background"
              type="button"
              onClick={onOpenImage}
            >
              <span className="material-symbols-outlined text-[18px]">image</span>
              تصميمك من صورة
            </button>
            <button
              className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5"
              data-act="import"
              title="Word · Photoshop · PDF — المقاس والمواضع من الملف"
              type="button"
              onClick={onImport}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              من Word أو Photoshop أو PDF
            </button>
          </div>
        </header>

        {/* لمن التصميم — الشعار والاسم واللون */}
        <section className="rounded-xl bg-surface-container-low p-space-md space-y-space-md" data-brand="">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="font-label-md text-label-md text-on-surface-variant font-semibold w-20 shrink-0">لمن؟</span>
            <button className={chip(logoId === null)} data-logo="none" type="button" onClick={() => setLogoId(null)}>
              <span className="material-symbols-outlined text-[18px]">hide_image</span>
              بلا شعار
            </button>
            {logos.map((l) => (
              <button key={l.id} className={chip(logoId === l.id)} data-logo={l.id} type="button" onClick={() => setLogoId(l.id)}>
                <img alt="" className="w-6 h-6 object-contain rounded bg-white" src={`diwan://store/${l.imagePath}`} />
                <span className="max-w-[12rem] truncate">{l.name}</span>
              </button>
            ))}
            {logos.length === 0 && (
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                ارفع شعار المدرسة من «الترويسات والشعارات» فتخرج التصاميم بلونها وشعارها
              </span>
            )}
            <input
              className="h-9 min-w-[16rem] flex-1 max-w-md px-3 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-md text-label-md text-on-surface"
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
                لون الشعار
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
            <div className="flex p-1 rounded-xl bg-surface-container-lowest">
              {STYLES.map((s) => (
                <button
                  key={s.key}
                  className={`h-9 px-4 rounded-lg font-label-md text-label-md transition-colors ${
                    style === s.key ? 'bg-primary-container text-on-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'
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

        <nav className="flex flex-wrap gap-1 border-b border-outline-variant">
          {GROUPS.map((g) => (
            <button
              key={g}
              className={`h-10 px-4 font-label-md text-label-md -mb-px border-b-2 transition-colors ${
                group === g ? 'border-primary text-on-surface font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
              data-group={g}
              type="button"
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ))}
        </nav>

        <div className="grid gap-space-md" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
          {kinds.map((k) => {
            const imp = impose(k.size, k.bleed);
            return (
              <button
                key={k.key}
                className="group rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors text-right overflow-hidden flex flex-col focus:outline-none focus:ring-2 focus:ring-primary"
                data-kind={k.key}
                type="button"
                onClick={() => onPick({ kind: k, style, palette, brand })}
              >
                <div className="h-[230px] flex items-center justify-center p-space-md">
                  <Thumb kind={k} style={style} palette={palette} brand={brand} width={250} height={196} />
                </div>
                <div className="px-space-md pb-space-md flex items-center justify-between gap-2">
                  <span className="font-body-md text-body-md text-on-surface font-semibold">{k.title}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant tabular whitespace-nowrap">
                    {imp.single ? `${k.size.w} × ${k.size.h} ملم` : `${toIndic(imp.per)} في الورقة`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {saved.length > 0 && (
          <section className="space-y-space-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">تصاميمك المحفوظة</h2>
            <div className="flex flex-wrap gap-space-sm">
              {saved.map((d) => (
                <button
                  key={d.id}
                  className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-md text-label-md text-on-surface flex items-center gap-2"
                  data-saved={d.id}
                  type="button"
                  onClick={() => onOpenSaved(d.id)}
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">draw</span>
                  {d.title}
                  {d.subtitle && <span className="text-on-surface-variant">— {d.subtitle}</span>}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
