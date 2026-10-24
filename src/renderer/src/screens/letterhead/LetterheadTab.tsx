/**
 * تبويب «الترويسة» في شاشتها (تقسيمها بعد ١٫٧٫٠) — منقولٌ من `LetterheadScreen` كما هو: الترويسة الحالية، والترشيح والمكتبة، واسمها
 * وتصنيفها وجهتها والحفظ والحذف، ثم بناؤها بالأقسام والشعارات.
 */
import type { Dispatch, SetStateAction } from 'react';
import RevisionsMenu from '../../components/RevisionsMenu';
import { normalizeLayout, type Letterhead, type LetterheadLayout } from '@shared/letterhead';
import LetterheadDesigner from '../../components/LetterheadDesigner';
import { storeUrl } from './shared';
import type { Client } from '@shared/orders';
import type { Seal } from '@shared/api';

type Props = {
  startFresh: () => Promise<void>;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  categories: string[];
  filter: string | null;
  setFilter: Dispatch<SetStateAction<string | null>>;
  list: Letterhead[];
  currentId: number | null;
  toggleFavorite: (item: Letterhead) => Promise<void>;
  open: (item: Letterhead) => Promise<void>;
  duplicate: (id: number) => Promise<void>;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  setDirty: Dispatch<SetStateAction<boolean>>;
  category: string;
  setCategory: Dispatch<SetStateAction<string>>;
  clients: Client[];
  authorityId: number | null;
  setAuthorityId: Dispatch<SetStateAction<number | null>>;
  isDefault: boolean;
  makeDefault: () => Promise<void>;
  current: Letterhead | null;
  leave: () => Promise<boolean>;
  setLayout: Dispatch<SetStateAction<LetterheadLayout>>;
  say: (text: string, tone?: 'ok' | 'warn') => void;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<boolean>;
  remove: () => Promise<void>;
  layout: LetterheadLayout;
  editLayout: (next: LetterheadLayout) => void;
  addSeal: () => Promise<void>;
  seals: Seal[];
  setSeals: Dispatch<SetStateAction<Seal[]>>;
  deleteSeal: (id: number) => Promise<void>;
};

export default function LetterheadTab({ startFresh, query, setQuery, categories, filter, setFilter, list, currentId, toggleFavorite, open, duplicate, name, setName, setDirty, category, setCategory, clients, authorityId, setAuthorityId, isDefault, makeDefault, current, leave, setLayout, say, dirty, saving, save, remove, layout, editLayout, addSeal, seals, setSeals, deleteSeal }: Props) {
  return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-space-md bg-surface-container-low flex flex-col gap-space-sm shrink-0 border-b border-outline-variant/30">
            <div className="bg-surface-container-lowest p-space-sm rounded-card shadow-xs flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                  الترويسة الحالية
                </label>
                <button
                  className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
                  type="button"
                  onClick={() => void startFresh()}
                >
                  + ترويسة جديدة
                </button>
              </div>
              {/* البحث: في الاسم والتصنيف ونصّ الترويسة */}
              <div className="relative">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  search
                </span>
                <input
                  className="input-field w-full h-9 pr-9 pl-3 text-on-surface font-label-md text-label-md"
                  placeholder="ابحث: هيت، تربية، بلدية…"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

          {/* الترشيح: المفضّلة والتصنيفات التي نبتت من استعمال المكتب */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { key: null, label: 'الكل' },
              { key: '★', label: '★ المفضّلة' },
              ...categories.map((c) => ({ key: c, label: c }))
            ].map((c) => (
              <button
                key={c.key ?? 'all'}
                className={`h-7 px-2.5 rounded-chip font-label-sm text-label-sm transition-colors ${
                  filter === c.key
                    ? 'bg-primary-fixed text-primary font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
                onClick={() => setFilter(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* المكتبة: المفضّلة أولًا ثم الأحدث استعمالًا */}
          <div className="max-h-52 overflow-y-auto -mx-1 px-1 flex flex-col gap-1">
            {list.length === 0 ? (
              <div className="py-space-md text-center font-label-sm text-label-sm text-on-surface-variant">
                {query || filter ? 'لا ترويسة بهذا الوصف' : 'المكتبة فارغة — ابنِ أولى ترويساتك'}
              </div>
            ) : (
              list.map((item) => (
                <div
                  key={item.id}
                  className={`group flex items-center gap-1 h-9 pr-2 pl-1 rounded-card transition-colors ${
                    item.id === currentId
                      ? 'bg-primary-fixed text-primary'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <button
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    title={item.isFavorite ? 'أزلها من المفضّلة' : 'أضفها إلى المفضّلة'}
                    type="button"
                    onClick={() => void toggleFavorite(item)}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        item.isFavorite ? 'text-secondary' : 'opacity-30'
                      }`}
                      style={{ fontVariationSettings: item.isFavorite ? "'FILL' 1" : undefined }}
                    >
                      star
                    </span>
                  </button>
                  <button
                    className="flex-1 min-w-0 text-right font-label-md text-label-md truncate"
                    type="button"
                    onClick={() => void open(item)}
                  >
                    {item.name}
                    {item.isDefault && (
                      <span className="font-label-sm text-label-sm opacity-70"> · الافتراضية</span>
                    )}
                  </button>
                  <button
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="نسخة منها"
                    type="button"
                    onClick={() => void duplicate(item.id)}
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-space-xs pt-space-xs">
            <div className="flex-1 flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                اسم الترويسة <span className="text-error">*</span>
              </label>
              <input
                className="input-field w-full h-9 px-3 text-on-surface font-label-md text-label-md"
                placeholder="مثال: مديرية تربية بغداد / الرصافة الأولى"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className="w-32 flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                التصنيف
              </label>
              <input
                className="input-field w-full h-9 px-3 text-on-surface font-label-md text-label-md"
                list="letterhead-categories"
                placeholder="مدارس"
                type="text"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setDirty(true);
                }}
              />
              <datalist id="letterhead-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          {clients.length > 0 && (
            <label className="flex items-center gap-space-sm">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium shrink-0">لجهة</span>
              <select
                className="input-field flex-1 h-9 px-3 text-on-surface font-label-md text-label-md"
                data-letterhead-client=""
                value={authorityId ?? ''}
                onChange={(e) => {
                  setAuthorityId(e.target.value ? Number(e.target.value) : null);
                  setDirty(true);
                }}
              >
                <option value="">— لا جهة بعينها —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            className="h-9 px-2.5 rounded-btn bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1 transition-colors disabled:opacity-40"
            type="button"
            title="اجعلها الافتراضية لكل كتاب جديد"
            disabled={currentId === null || isDefault}
            onClick={() => void makeDefault()}
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">star</span>
            <span>{isDefault ? 'هي الافتراضية لكل كتاب جديد' : 'اجعلها افتراضية'}</span>
          </button>

          <div className="flex items-center gap-space-xs pt-space-xs">
            {currentId !== null && (
              <RevisionsMenu
                current={current?.revision}
                id={currentId}
                kind="letterhead"
                onRestore={(p, revision) => {
                  // تُحمَّل للمراجعة ولا تُكتب: الحفظ يعتمدها نسخةً جديدة. وهي تحلّ محلّ ما على الشاشة.
                  void (async () => {
                    if (!(await leave())) return;
                    setName(p.name);
                    setCategory(p.category ?? '');
                    setAuthorityId(p.authorityId);
                    setLayout(normalizeLayout(p.layout));
                    setDirty(true);
                    say(`حُمّلت النسخة ${revision} — احفظ لتعتمدها`);
                  })();
                }}
              />
            )}
            {dirty && (
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold shrink-0">
                غير محفوظة
              </span>
            )}
            <button
              className="flex-1 h-9 btn-act font-label-md text-label-md font-bold flex items-center justify-center gap-space-xs transition-all disabled:opacity-40"
              type="button"
              disabled={saving || !dirty}
              onClick={() => void save()}
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>{saving ? 'جارٍ الحفظ...' : 'حفظ الترويسة'}</span>
            </button>
            <button
              className="h-9 px-3 rounded-btn text-error hover:bg-error-container transition-colors font-label-md text-label-md disabled:opacity-40"
              data-act="delete-letterhead"
              title="حذف الترويسة"
              type="button"
              disabled={currentId === null}
              onClick={() => void remove()}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-space-md space-y-space-md">
        {/* بناء الترويسة بالأقسام */}
        <div className="bg-surface-container-lowest rounded-card p-space-md shadow-low space-y-space-sm">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[20px]">
                view_column
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                بناء الترويسة
              </h3>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              {layout.sections
                .slice(0, layout.columns)
                .reduce((n, sec) => n + sec.blocks.length, 0)}{' '}
              عنصرًا
            </span>
          </div>

          {layout.sheet?.length ? (
            // رأسٌ من ورقة Word: يُحفظ كما رُسم، وتقسيمه أقسامًا يزحزحه.
            <p className="font-body-md text-body-md text-on-surface-variant" data-sheet-note="">
              هذه الترويسة رأسُ ورقةٍ مستوردة، محفوظةٌ كما رسمها Word. يُغيَّر هنا اسمها
              وتصنيفها؛ ولتغيير أسطرها عدّلها في Word واستورد الورقة ثانيةً.
            </p>
          ) : (
            <LetterheadDesigner layout={layout} onChange={editLayout} showPageOptions />
          )}
        </div>

        {/* الشعارات — والختم والتوقيع حيّان بيد الجهة بعد الطباعة */}
        <div className="bg-surface-container-lowest rounded-card p-space-md shadow-low space-y-space-sm">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[20px]">
                image
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">الشعارات</h3>
            </div>
            <button
              className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
              type="button"
              onClick={() => void addSeal()}
            >
              + إضافة شعار
            </button>
          </div>
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            تُطبع في رأس الورقة أو علامةً مائية. أما الختم والتوقيع فتضعهما الجهة بيدها بعد الطباعة.
          </p>

          {seals.length === 0 ? (
            <div className="py-space-lg flex flex-col items-center gap-space-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[28px]">image</span>
              <span className="font-label-md text-label-md">لا شعارات محفوظة</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-space-sm">
              {seals.map((s) => (
                <div
                  key={s.id}
                  className="rounded-card bg-surface-container-low p-space-sm flex flex-col items-center gap-space-xs"
                >
                  <img
                    alt={s.name}
                    className="w-14 h-14 object-contain"
                    src={storeUrl(s.imagePath) ?? undefined}
                  />
                  <input
                    className="input-field w-full h-7 px-1 text-on-surface font-label-sm text-label-sm text-center"
                    value={s.name}
                    onChange={(e) =>
                      setSeals((prev) =>
                        prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                  />
                  {s.kind !== 'شعار' && (
                    // رُفع ختمًا أو توقيعًا قبل أن يُرفع ذلك من التطبيق — يبقى ليُحذف.
                    <span className="font-label-sm text-label-sm px-2 rounded-full bg-surface-container-high text-on-surface-variant">
                      {s.kind} — لا يُطبع
                    </span>
                  )}
                  <button
                    className="text-error font-label-sm text-label-sm hover:underline"
                    type="button"
                    onClick={() => void deleteSeal(s.id)}
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
