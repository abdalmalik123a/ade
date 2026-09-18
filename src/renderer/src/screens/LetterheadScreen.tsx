/**
 * إعدادات الترويسة والأختام — data-path="header-seal-configuration"
 *
 * لا تصميم Stitch لها؛ بُنيت بنفس التوكنات وإيقاع البطاقات المستخرج من الشاشات الأربع،
 * وبنفس بنية «لوح إدخال + معاينة ورقة» المعتمدة في شاشة المحرر.
 *
 * الترويسة حرّة البنية: الكتاب يصدر عن جهة لا عن المكتب، فلا حقول ثابتة —
 * بل كتل يركّبها صاحب المكتب ويرتّبها، وتُحفظ JSON.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OfficeSettings, PrinterInfo, Seal } from '@shared/api';
import {
  emptyLayout,
  isLayoutEmpty,
  mmToPx,
  normalizeLayout,
  type Letterhead,
  type LetterheadLayout
} from '@shared/letterhead';
import LetterheadDesigner from '../components/LetterheadDesigner';
import LetterheadView from '../components/LetterheadView';

const SEAL_KINDS = ['ختم', 'توقيع', 'شعار'];

const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : null);

const settingInput =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

type Toast = { text: string; tone: 'ok' | 'warn' } | null;

export default function LetterheadScreen() {
  const [list, setList] = useState<Letterhead[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  /** ترشيح المكتبة: بحث، وتصنيف، أو المفضّلة وحدها. */
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [layout, setLayout] = useState<LetterheadLayout>(emptyLayout);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seals, setSeals] = useState<Seal[]>([]);
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    void Promise.all([window.diwan.settings.get(), window.diwan.printers.list()]).then(
      ([loaded, list]) => {
        setSettings(loaded);
        setPrinters(list);
      }
    );
  }, []);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    setToast({ text, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const reload = useCallback(async () => {
    const [items, sealList, cats] = await Promise.all([
      window.diwan.letterheads.list({
        query,
        category: filter === '★' ? null : filter,
        favoritesOnly: filter === '★'
      }),
      window.diwan.seals.list(),
      window.diwan.letterheads.categories()
    ]);
    setList(items);
    setSeals(sealList);
    setCategories(cats);
    return items;
  }, [query, filter]);

  // الترشيح يعيد القراءة فورًا — والترويسات عشرات فلا حاجة إلى تأخير.
  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void (async () => {
      const items = await reload();
      const first = items.find((x) => x.isDefault) ?? items[0];
      if (first) load(first);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load(item: Letterhead) {
    setCurrentId(item.id);
    setName(item.name);
    setCategory(item.category ?? '');
    setLayout(normalizeLayout(item.layout));
    setDirty(false);
  }

  function startNew() {
    setCurrentId(null);
    setName('');
    setCategory('');
    setLayout(emptyLayout());
    setDirty(false);
  }

  /** نسخةٌ من ترويسة قائمة: «الأنبار» تصير «ديالى» بتبديل كلمة. */
  async function duplicate(id: number) {
    const copy = await window.diwan.letterheads.duplicate(id);
    if (!copy) return;
    await reload();
    load(copy);
    say('أُنشئت نسخة — بدّل ما يلزم واحفظ');
  }

  async function toggleFavorite(item: Letterhead) {
    await window.diwan.letterheads.favorite(item.id, !item.isFavorite);
    await reload();
  }

  function editLayout(next: LetterheadLayout) {
    setLayout(next);
    setDirty(true);
  }

  async function save() {
    if (!name.trim()) {
      say('سمِّ الترويسة أولًا', 'warn');
      return;
    }
    setSaving(true);
    try {
      const saved = await window.diwan.letterheads.save({
        id: currentId,
        name: name.trim(),
        authorityId: null,
        layout,
        category: category.trim() || null
      });
      setCurrentId(saved.id);
      setDirty(false);
      await reload();
      say('حُفظت الترويسة');
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault() {
    if (currentId === null) return;
    await window.diwan.letterheads.setDefault(currentId);
    await reload();
    say('صارت الترويسة الافتراضية');
  }

  async function remove() {
    if (currentId === null) return;
    await window.diwan.letterheads.delete(currentId);
    const items = await reload();
    const next = items.find((x) => x.isDefault) ?? items[0];
    if (next) load(next);
    else startNew();
    say('حُذفت الترويسة');
  }

  async function addSeal() {
    const picked = await window.diwan.files.pickImage('seals');
    if (!picked) return;
    const created = await window.diwan.seals.add({ name: 'ختم جديد', kind: 'ختم', imagePath: picked });
    setSeals((prev) => [...prev, created]);
    say('أُضيف الختم');
  }

  async function deleteSeal(id: number) {
    await window.diwan.seals.delete(id);
    setSeals((prev) => prev.filter((s) => s.id !== id));
  }

  const isDefault = list.find((x) => x.id === currentId)?.isDefault ?? false;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-surface">
        {/* لوح البناء */}
        <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 h-full flex flex-col bg-surface-container-lowest shadow-[0_10px_30px_rgba(11,28,48,0.06)] z-20 overflow-hidden">
          <div className="p-space-md bg-surface-container-low flex flex-col gap-space-sm shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="p-1 rounded-lg bg-primary-container text-on-primary">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  مصمّم الترويسة والأختام
                </span>
              </div>
              {dirty && (
                <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">
                  غير محفوظة
                </span>
              )}
            </div>

            <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                  الترويسة الحالية
                </label>
                <button
                  className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
                  type="button"
                  onClick={startNew}
                >
                  + ترويسة جديدة
                </button>
              </div>
              {/* البحث: في الاسم والتصنيف ونصّ الترويسة، متساهلًا مع الهمزة */}
              <div className="relative">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  search
                </span>
                <input
                  className="w-full h-9 pr-9 pl-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
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
                    className={`h-7 px-2.5 rounded-full font-label-sm text-label-sm transition-colors ${
                      filter === c.key
                        ? 'bg-primary-container text-on-primary font-semibold'
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
                      className={`group flex items-center gap-1 h-9 pr-2 pl-1 rounded-lg transition-colors ${
                        item.id === currentId
                          ? 'bg-primary-container text-on-primary'
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
                        onClick={() => load(item)}
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
                    className="w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
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
                    className="w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
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

              <button
                className="h-9 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1 transition-colors disabled:opacity-40"
                type="button"
                title="اجعلها الافتراضية لكل كتاب جديد"
                disabled={currentId === null || isDefault}
                onClick={() => void makeDefault()}
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">star</span>
                <span>{isDefault ? 'هي الافتراضية لكل كتاب جديد' : 'اجعلها افتراضية'}</span>
              </button>

              <div className="flex items-center gap-space-xs pt-space-xs">
                <button
                  className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center justify-center gap-space-xs transition-all disabled:opacity-40"
                  type="button"
                  disabled={saving || !dirty}
                  onClick={() => void save()}
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>{saving ? 'جارٍ الحفظ...' : 'حفظ الترويسة'}</span>
                </button>
                <button
                  className="h-9 px-3 rounded-lg text-error hover:bg-error-container transition-colors font-label-md text-label-md disabled:opacity-40"
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
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
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

              <LetterheadDesigner layout={layout} onChange={editLayout} showPageOptions />
            </div>

            {/* الأختام */}
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    approval
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    الأختام والتواقيع
                  </h3>
                </div>
                <button
                  className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
                  type="button"
                  onClick={() => void addSeal()}
                >
                  + إضافة ختم
                </button>
              </div>

              {seals.length === 0 ? (
                <div className="py-space-lg flex flex-col items-center gap-space-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[28px]">approval</span>
                  <span className="font-label-md text-label-md">لا أختام محفوظة</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-space-sm">
                  {seals.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg bg-surface-container-low p-space-sm flex flex-col items-center gap-space-xs"
                    >
                      <img
                        alt={s.name}
                        className="w-14 h-14 object-contain"
                        src={storeUrl(s.imagePath) ?? undefined}
                      />
                      <input
                        className="w-full h-7 px-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm text-center focus:outline-none focus:ring-1 focus:ring-secondary"
                        value={s.name}
                        onChange={(e) =>
                          setSeals((prev) =>
                            prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x))
                          )
                        }
                      />
                      <select
                        className="w-full h-7 rounded bg-surface-container-lowest text-on-surface-variant font-label-sm text-label-sm text-center cursor-pointer focus:outline-none"
                        value={s.kind ?? 'ختم'}
                        onChange={(e) =>
                          setSeals((prev) =>
                            prev.map((x) => (x.id === s.id ? { ...x, kind: e.target.value } : x))
                          )
                        }
                      >
                        {SEAL_KINDS.map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </select>
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

            {/* إعدادات المكتب والطباعة — هويّة الكتاب وتسلسله ومخرجه */}
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    settings
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    إعدادات المكتب والطباعة
                  </h3>
                </div>
                {settingsDirty && (
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">
                    غير محفوظة
                  </span>
                )}
              </div>

              {settings && (
                <>
                  <div className="grid grid-cols-2 gap-space-sm">
                    <label className="flex flex-col gap-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        اسم المكتب
                      </span>
                      <input
                        className={settingInput}
                        type="text"
                        value={settings.officeName}
                        placeholder="—"
                        onChange={(e) => {
                          setSettings({ ...settings, officeName: e.target.value });
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        اسم المشغّل (يُطبع أسفل الكتاب)
                      </span>
                      <input
                        className={settingInput}
                        type="text"
                        value={settings.operatorName}
                        placeholder="—"
                        onChange={(e) => {
                          setSettings({ ...settings, operatorName: e.target.value });
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        بادئة رقم الصادر
                      </span>
                      <input
                        className={settingInput}
                        type="text"
                        value={settings.serialPrefix}
                        onChange={(e) => {
                          setSettings({ ...settings, serialPrefix: e.target.value });
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        سنة السجل
                      </span>
                      <input
                        className={settingInput}
                        type="number"
                        value={settings.serialYear}
                        onChange={(e) => {
                          setSettings({
                            ...settings,
                            serialYear: Number(e.target.value) || settings.serialYear
                          });
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      الطابعة الافتراضية
                    </span>
                    <select
                      className={settingInput}
                      value={settings.defaultPrinter ?? ''}
                      onChange={(e) => {
                        setSettings({ ...settings, defaultPrinter: e.target.value || null });
                        setSettingsDirty(true);
                      }}
                    >
                      <option value="">— يسأل النظام عند كل طباعة —</option>
                      {printers.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.displayName}
                          {p.isDefault ? ' (طابعة النظام)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    {printers.length === 0
                      ? 'لا طابعة مثبَّتة على هذا الجهاز'
                      : settings.defaultPrinter
                        ? 'الطباعة تخرج مباشرةً إلى هذه الطابعة بلا حوار'
                        : 'بلا طابعة محدَّدة يُفتح حوار الطباعة في النظام'}
                  </p>

                  <button
                    className="w-full h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-50"
                    type="button"
                    disabled={!settingsDirty}
                    onClick={() => {
                      void window.diwan.settings.set(settings).then((saved) => {
                        setSettings(saved);
                        setSettingsDirty(false);
                        say('حُفظت إعدادات المكتب');
                      });
                    }}
                  >
                    حفظ إعدادات المكتب
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* معاينة الترويسة على ورقة A4 حقيقية */}
        <div className="flex-1 h-full overflow-auto bg-surface-dim/40 flex flex-col items-center py-space-xl">
          <div className="a4-sheet bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] shrink-0">
            <div
              style={{
                paddingTop: mmToPx(layout.margins.top),
                paddingRight: mmToPx(layout.margins.right),
                paddingBottom: mmToPx(layout.margins.bottom),
                paddingLeft: mmToPx(layout.margins.left)
              }}
            >
              <LetterheadView
                layout={layout}
                emptyHint="منطقة الترويسة فارغة — كل ما تضيفه يظهر هنا بمقاسه الحقيقي"
              />

              {!isLayoutEmpty(layout) && (
                <div className="mt-space-xl space-y-space-md opacity-30 select-none">
                  <div className="h-3 bg-surface-container-high rounded w-1/3" />
                  <div className="h-2 bg-surface-container-high rounded" />
                  <div className="h-2 bg-surface-container-high rounded" />
                  <div className="h-2 bg-surface-container-high rounded w-4/5" />
                </div>
              )}
            </div>
          </div>
          <span className="mt-space-sm font-label-sm text-label-sm text-on-surface-variant">
            ورقة A4 بمقاسها الحقيقي — 210×297 ملم
          </span>
        </div>
      </div>

      {/* إشعار موجز */}
      {toast && (
        <div
          className={
            toast.tone === 'ok'
              ? 'fixed bottom-6 right-80 z-50 px-space-lg py-space-sm rounded-lg bg-primary-container text-on-primary font-label-md text-label-md shadow-lg flex items-center gap-space-xs'
              : 'fixed bottom-6 right-80 z-50 px-space-lg py-space-sm rounded-lg bg-error-container text-on-error-container font-label-md text-label-md shadow-lg flex items-center gap-space-xs'
          }
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.tone === 'ok' ? 'check_circle' : 'warning'}
          </span>
          <span>{toast.text}</span>
        </div>
      )}
    </main>
  );
}
