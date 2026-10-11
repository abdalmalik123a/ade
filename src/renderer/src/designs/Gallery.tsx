/**
 * معرض التصاميم — يبدأ من الزبون لا من القالب.
 *
 * «لمن التصميم؟» أولًا: شعار المدرسة واسمها، فيُستخرج لونها من شعارها. ثم يرى
 * المكتب أنواعه الاثني عشر **بهويّة هذه المدرسة** حيّةً بعيّنةٍ عراقية — لا
 * صناديق فارغة — ويبدّل النمط واللون فتتبدّل كلّها معًا. ويضغط ما يريد فيُفتح
 * في المحرّر نسخةً يعدّلها ويحفظها.
 *
 * والشعار من «الترويسات والشعارات»: يُرفع مرّةً ويخدم الكتب والتصاميم معًا.
 *
 * (DESIGNS.md ٠٫٩: الحال في `gallery/useGalleryBrand`، واللمحات في `gallery/Thumbs`، و«لمن؟» في `gallery/BrandPanel`،
 * والمحفوظة في `gallery/SavedDesigns` — وهنا التركيب.)
 */
import { useState } from 'react';
import type { TemplateSummary } from '@shared/api';
import type { Client } from '@shared/orders';
import { toIndic } from '@shared/arabic';
import { impose } from '@shared/design/imposition';
import { KINDS, type Brand, type KindSpec, type Palette } from '@shared/design/kit';
import BrandPanel from './gallery/BrandPanel';
import SavedDesigns from './gallery/SavedDesigns';
import { Thumb } from './gallery/Thumbs';
import { useGalleryBrand } from './gallery/useGalleryBrand';
import { useDesignPacks } from './gallery/useDesignPacks';

/** ما اختير في المعرض — والجهة بملفّها إن كانت، فتملأ حقول التصميم (٣٫٥). */
export type GalleryPick = { kind: KindSpec; style: string; palette: Palette; brand: Brand; client?: Client | null };

/** المجموعات بترتيبها المعتاد، وما أُضيف إلى القائمة بعدها (٣٫١: «مطاعم ومحلّات») — فنوعٌ جديد لا يختفي بلا تبويب. */
const ORDER = ['شهادات', 'هويّات', 'مدرسية', 'مناسبات', 'أعمال وكروت'];
const GROUPS = ['الكل', ...ORDER, ...[...new Set(KINDS.map((k) => k.group))].filter((g) => !ORDER.includes(g))];

export default function Gallery({
  saved,
  presetClient,
  onPick,
  onOpenSaved,
  onDeleteSaved,
  onOpenImage,
  onImport,
  onNewBlank,
  say,
  reload
}: {
  saved: TemplateSummary[];
  /** «صمّم لها» من ملف الجهة: يُفتح المعرض عليها. */
  presetClient?: { id: number; key: number } | null;
  onPick: (pick: GalleryPick) => void;
  onOpenSaved: (id: number) => void;
  onDeleteSaved?: (id: number) => void;
  onOpenImage: () => void;
  onImport: () => void;
  onNewBlank?: () => void;
  /** رسائل حزم التصاميم (٣٫٦)، وإعادة قراءة المحفوظ بعد الاستيراد. */
  say: Parameters<typeof useDesignPacks>[0]['say'];
  reload: () => Promise<void> | void;
}) {
  const b = useGalleryBrand(presetClient);
  const packs = useDesignPacks({ say, reload });
  const { style, palette, brand } = b;
  const [group, setGroup] = useState('الكل');
  const kinds = KINDS.filter((k) => group === 'الكل' || k.group === group);

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
            {onNewBlank && (
              <button
                className="h-10 px-space-md rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-all"
                data-act="new-blank"
                type="button"
                onClick={onNewBlank}
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                تصميم فارغ جديد (البدء من الصفر)
              </button>
            )}
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
            <button
              className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
              data-act="pack-import"
              disabled={packs.busy}
              title="حزمة تصاميم من مكتبٍ آخر أو جهازٍ ثانٍ — والموجود منها لا يُكرَّر"
              type="button"
              onClick={() => void packs.importPack()}
            >
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              استورد حزمة تصاميم
            </button>
          </div>
        </header>

        {/* تصاميمك المحفوظة — في الصدارة لسهولة العودة إليها وتعديلها */}
        <SavedDesigns saved={saved} packs={packs} onOpenSaved={onOpenSaved} onDeleteSaved={onDeleteSaved} />

        {/* لمن التصميم — الشعار والاسم واللون */}
        <BrandPanel b={b} />

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
          {onNewBlank && (
            <button
              className="group rounded-xl border-2 border-dashed border-outline-variant/80 hover:border-primary/80 bg-surface-container-low/50 hover:bg-surface-container-high/60 transition-all text-center overflow-hidden flex flex-col items-center justify-center p-space-lg min-h-[290px] focus:outline-none focus:ring-2 focus:ring-primary"
              data-act="blank-card"
              type="button"
              onClick={onNewBlank}
            >
              <div className="w-16 h-16 rounded-2xl bg-primary-container/40 group-hover:bg-primary-container flex items-center justify-center mb-space-sm transition-colors text-primary">
                <span className="material-symbols-outlined text-[36px]">add</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-1">
                لوحة بيضاء فارغة
              </h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant max-w-[200px]">
                ابدأ من الصفر بالمقاس الذي تريده مع تحكم كامل بالعناصر والجداول والباركود
              </p>
            </button>
          )}
          {kinds.map((k) => {
            const imp = impose(k.size, k.bleed);
            return (
              <button
                key={k.key}
                className="group rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors text-right overflow-hidden flex flex-col focus:outline-none focus:ring-2 focus:ring-primary"
                data-kind={k.key}
                type="button"
                onClick={() => onPick({ kind: k, style, palette, brand, client: b.client })}
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
