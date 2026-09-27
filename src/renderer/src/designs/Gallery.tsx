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
import type { Client } from '@shared/orders';
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

/**
 * لمحةُ تصميمٍ محفوظ — بمحرّك الرسم نفسه، فيُعرف التصميم بشكله لا باسمه وحده.
 * وتُحمَّل حين تظهر البطاقة، والحقول فيها فراغاتٌ كما تخرج قبل الملء.
 */
function SavedThumb({ id, width, height }: { id: number; width: number; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ html: string; w: number; h: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void window.diwan.templates
      .doc(id)
      .then((doc) => {
        if (!alive || !doc?.canvas) return;
        const px = canvasPx(doc.canvas, SCREEN_DPI);
        setView({
          html: inlineBarcodes(renderCanvasHtml(doc, {}, { dpi: SCREEN_DPI, marks: false, missing: 'blank' })),
          w: px.w,
          h: px.h
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id]);

  useLayoutEffect(() => {
    if (ref.current) fitCanvasText(ref.current);
  }, [view]);

  if (!view) return <span className="material-symbols-outlined text-[28px] text-on-surface-variant/50">draw</span>;
  const scale = Math.min(width / view.w, height / view.h);
  return (
    <div className="shrink-0 overflow-hidden rounded-[3px] shadow-sm" style={{ width: view.w * scale, height: view.h * scale }}>
      <div
        ref={ref}
        dangerouslySetInnerHTML={{ __html: view.html }}
        style={{ width: view.w, height: view.h, transform: `scale(${scale})`, transformOrigin: 'top right' }}
      />
    </div>
  );
}

export default function Gallery({
  saved,
  presetClient,
  onPick,
  onOpenSaved,
  onDeleteSaved,
  onOpenImage,
  onImport
}: {
  saved: TemplateSummary[];
  /** «صمّم لها» من ملف الجهة: يُفتح المعرض عليها. */
  presetClient?: { id: number; key: number } | null;
  onPick: (pick: GalleryPick) => void;
  onOpenSaved: (id: number) => void;
  onDeleteSaved?: (id: number) => void;
  onOpenImage: () => void;
  onImport: () => void;
}) {
  const [logos, setLogos] = useState<Seal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  /** «لمن؟»: جهةٌ من ملفّاتها، أو شعارٌ مرفوعٌ بلا جهة. */
  const [who, setWho] = useState<{ client?: number; logo?: number } | null>(null);
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [paletteKey, setPaletteKey] = useState('royal');
  const [style, setStyle] = useState('official');
  const [group, setGroup] = useState('الكل');

  useEffect(() => {
    // الشعارات المربوطة بجهةٍ تُعرض مع جهتها — فلا تتكرّر الجهة مرّتين في الصفّ.
    void window.diwan.seals.list().then((all) => setLogos(all.filter((s) => s.kind === 'شعار' && s.imagePath && !s.authorityId)));
    void window.diwan.clients.list().then(setClients);
  }, [presetClient?.key]);

  useEffect(() => {
    if (presetClient) setWho({ client: presetClient.id });
  }, [presetClient?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const client = who?.client ? (clients.find((c) => c.id === who.client) ?? null) : null;
  const rawLogo = who?.logo ? (logos.find((l) => l.id === who.logo) ?? null) : null;
  const logo = client ? (client.logo ? { name: client.name, imagePath: client.logo } : null) : rawLogo;

  // جهةٌ أو شعارٌ اختير: اسمه اسم الجهة ما لم يُكتب غيره، ولونه لوحتها —
  // لون الجهة المحفوظ في ملفّها أولًا، وإلا ما يُستخرج من شعارها.
  useEffect(() => {
    setBrandColor(null);
    if (client?.color) {
      setBrandColor(client.color);
      setPaletteKey('brand');
      return;
    }
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
  }, [logo?.imagePath, client?.id, client?.color]);

  const palette = useMemo(
    () =>
      paletteKey === 'brand' && brandColor
        ? paletteFrom(brandColor, 'لون الشعار')
        : (PALETTES.find((p) => p.key === paletteKey) ?? PALETTES[0]!),
    [paletteKey, brandColor]
  );
  const brand: Brand = useMemo(
    () => ({ name: name.trim() || client?.name || logo?.name || undefined, logo: logo?.imagePath ?? null }),
    [name, logo, client]
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
          <div className="flex items-center gap-space-sm flex-wrap">
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

        {/* تصاميمك المحفوظة — في الصدارة لسهولة العودة إليها وتعديلها */}
        {saved.length > 0 && (
          <section className="rounded-xl bg-surface-container-low p-space-md space-y-space-sm" data-saved-section="">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-secondary text-[22px]">folder_special</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  تصاميمك المحفوظة ({toIndic(saved.length)})
                </h2>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                اضغط على أي تصميم لفتحه وتعديله، أو طباعة دفعة منه
              </span>
            </div>

            <div className="grid gap-space-sm" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {saved.map((d) => (
                <div
                  key={d.id}
                  className="group p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/60 hover:border-secondary/50 hover:shadow-md transition-all flex flex-col justify-between gap-space-xs"
                >
                  <button
                    className="h-28 rounded-lg bg-surface-container flex items-center justify-center overflow-hidden"
                    data-saved-thumb={d.id}
                    title="فتح وتعديل"
                    type="button"
                    onClick={() => onOpenSaved(d.id)}
                  >
                    <SavedThumb id={d.id} width={236} height={104} />
                  </button>
                  <div className="flex items-start justify-between gap-space-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-secondary">draw</span>
                      <div className="flex flex-col">
                        <span className="font-body-md text-body-md text-on-surface font-bold truncate max-w-[170px]" title={d.title}>
                          {d.title}
                        </span>
                        {d.subtitle && (
                          <span className="font-label-sm text-label-sm text-on-surface-variant tabular">
                            {d.subtitle}
                          </span>
                        )}
                      </div>
                    </div>
                    {onDeleteSaved && (
                      <button
                        className="w-7 h-7 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="حذف هذا التصميم"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`هل أنت متأكد من حذف «${d.title}»؟`)) {
                            onDeleteSaved(d.id);
                          }
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                  <button
                    className="w-full h-8 mt-1 rounded-lg bg-surface-container-low hover:bg-primary hover:text-on-primary text-on-surface font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 transition-colors"
                    data-saved={d.id}
                    type="button"
                    onClick={() => onOpenSaved(d.id)}
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    فتح وتعديل
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* لمن التصميم — الشعار والاسم واللون */}
        <section className="rounded-xl bg-surface-container-low p-space-md space-y-space-md" data-brand="">
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
      </div>
    </div>
  );
}
