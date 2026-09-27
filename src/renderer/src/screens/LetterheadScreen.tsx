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
import type { Addressing, Clip, Seal } from '@shared/api';
import { ADDRESSING, ADDRESSING_HINT, ADDRESSING_LABEL, guessAddressing } from '@shared/addressing';
import {
  emptyLayout,
  isLayoutEmpty,
  mmToPx,
  normalizeLayout,
  type Letterhead,
  type LetterheadLayout
} from '@shared/letterhead';
import type { Client } from '@shared/orders';
import LetterheadDesigner from '../components/LetterheadDesigner';
import LetterheadView from '../components/LetterheadView';
import RevisionsMenu from '../components/RevisionsMenu';

const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : null);

const settingInput =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

type Toast = { text: string; tone: 'ok' | 'warn' } | null;

export default function LetterheadScreen() {
  const [activeTab, setActiveTab] = useState<'letterhead' | 'clips'>('letterhead');
  const [list, setList] = useState<Letterhead[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  /** لأيّ جهةٍ هذه الترويسة — فتظهر في ملفّها. */
  const [authorityId, setAuthorityId] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => {
    void window.diwan.clients.list().then(setClients);
  }, []);
  /** ترشيح المكتبة: بحث، وتصنيف، أو المفضّلة وحدها. */
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [layout, setLayout] = useState<LetterheadLayout>(emptyLayout);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seals, setSeals] = useState<Seal[]>([]);

  // الكليشات
  const [clipsList, setClipsList] = useState<Clip[]>([]);
  const [clipQuery, setClipQuery] = useState('');
  const [clipTitle, setClipTitle] = useState('');
  const [clipBody, setClipBody] = useState('');
  const [clipCategory, setClipCategory] = useState('');
  /** اتجاه الكليشة: `auto` يُخمَّن من أفعالها عند الحفظ، و`any` لكلّ اتجاه. */
  const [clipDirection, setClipDirection] = useState<Addressing | 'auto' | 'any'>('auto');
  const [editingClipId, setEditingClipId] = useState<number | null>(null);

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    void window.diwan.clips.list().then(setClipsList);
  }, []);

  const reloadClips = useCallback(async () => {
    const clips = await window.diwan.clips.list(clipQuery);
    setClipsList(clips);
  }, [clipQuery]);

  useEffect(() => {
    void reloadClips();
  }, [reloadClips]);

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
    setAuthorityId(item.authorityId ?? null);
    setLayout(normalizeLayout(item.layout));
    setDirty(false);
  }

  function startNew() {
    setAuthorityId(null);
    setCurrentId(null);
    setName('');
    setCategory('');
    setLayout(emptyLayout());
    setDirty(false);
    // والبسملة بتفضيل المكتب (FOUNDATION §٥) — تصل بعد لحظة، فلا يُنتظر لفتح الورقة.
    void window.diwan.settings.get().then((s) => {
      if (s.basmala) setLayout((cur) => (cur.basmala.show ? cur : { ...cur, basmala: { ...cur.basmala, show: true } }));
    });
  }

  /** تعديل التخطيط من المصمّم — يخصّ الترويسة الجارية ويعلّمها غير محفوظة. */
  function editLayout(next: LetterheadLayout) {
    setLayout(next);
    setDirty(true);
  }

  /** حفظ الترويسة: تحديثًا للجارية، أو باسمٍ جديد إن كانت بلا معرّف. */
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
        authorityId,
        layout,
        category: category.trim() || null
      });
      await reload();
      setCurrentId(saved.id);
      setDirty(false);
      say('حُفظت الترويسة');
    } catch (e) {
      say(e instanceof Error ? e.message : 'تعذّر الحفظ', 'warn');
    } finally {
      setSaving(false);
    }
  }

  /** حذف الترويسة الجارية، ثم العودة إلى الافتراضية أو أول ما في المكتبة. */
  async function remove() {
    if (currentId === null) return;
    await window.diwan.letterheads.delete(currentId);
    const items = await reload();
    const first = items.find((x) => x.isDefault) ?? items[0];
    if (first) load(first);
    else startNew();
    say('حُذفت الترويسة');
  }

  /** اجعل الجارية افتراضيةً لكل كتاب جديد. */
  async function makeDefault() {
    if (currentId === null) return;
    await window.diwan.letterheads.setDefault(currentId);
    await reload();
    say('صارت الافتراضية لكل كتاب جديد');
  }

  /** المفضّلة: عليها يقوم ترتيب المكتبة — تُقدَّم على غيرها. */
  async function toggleFavorite(item: Letterhead) {
    await window.diwan.letterheads.favorite(item.id, !item.isFavorite);
    await reload();
  }

  /** «نسخة منها»: مستقلّة تُعدَّل دون المساس بالأصل — كما في مكتبة النماذج. */
  async function duplicate(id: number) {
    const copy = await window.diwan.letterheads.duplicate(id);
    if (!copy) {
      say('تعذّر النسخ', 'warn');
      return;
    }
    await reload();
    load(copy);
    say('أُنشئت نسخة — عدّلها دون المساس بالأصل');
  }

  /**
   * الشعار: صورةٌ تُطبع مع الورقة — في رأسها أو علامةً مائية.
   * ولا ختم ولا توقيع: الجهة تختم وتوقّع بيدها على الورقة المطبوعة.
   */
  async function addSeal() {
    const imagePath = await window.diwan.files.pickImage('seals');
    if (!imagePath) return;
    await window.diwan.seals.add({ name: 'شعار جديد', kind: 'شعار', imagePath });
    await reload();
    say('أُضيف شعار — سمِّه');
  }

  async function deleteSeal(id: number) {
    await window.diwan.seals.delete(id);
    await reload();
    say('حُذف');
  }

  async function saveClip() {
    if (!clipTitle.trim() || !clipBody.trim()) {
      say('أدخل عنوان الكليشة ومحتواها أولاً', 'warn');
      return;
    }
    await window.diwan.clips.save({
      id: editingClipId,
      title: clipTitle.trim(),
      body: clipBody.trim(),
      category: clipCategory.trim() || null,
      direction: clipDirection === 'auto' ? undefined : clipDirection === 'any' ? null : clipDirection
    });
    setEditingClipId(null);
    setClipTitle('');
    setClipBody('');
    setClipCategory('');
    setClipDirection('auto');
    await reloadClips();
    say('حُفظت الكليشة بنجاح');
  }

  async function deleteClip(id: number) {
    await window.diwan.clips.delete(id);
    await reloadClips();
    say('حُذفت الكليشة');
  }

  /** الترويسة الجارية من المكتبة — منها الافتراضيةُ والجهة عند الحفظ. */
  const current = list.find((x) => x.id === currentId) ?? null;
  const isDefault = current?.isDefault ?? false;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-surface">
        {/* لوح البناء والتحكم */}
        <div className="w-full lg:w-[500px] xl:w-[540px] shrink-0 h-full flex flex-col bg-surface-container-lowest shadow-[0_10px_30px_rgba(11,28,48,0.06)] z-20 overflow-hidden">
          {/* التبويبات الرئيسية */}
          <div className="px-space-md pt-space-sm bg-surface-container-low flex items-center justify-between border-b border-outline-variant/30">
            <div className="flex items-center gap-space-xs">
              <button
                className={`h-10 px-4 rounded-t-xl font-headline-sm text-headline-sm flex items-center gap-2 transition-all ${
                  activeTab === 'letterhead'
                    ? 'bg-surface-container-lowest text-on-surface border-t-2 border-secondary font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
                onClick={() => setActiveTab('letterhead')}
              >
                <span className="material-symbols-outlined text-[20px] text-secondary">verified</span>
                مصمّم الترويسات
              </button>
              <button
                className={`h-10 px-4 rounded-t-xl font-headline-sm text-headline-sm flex items-center gap-2 transition-all ${
                  activeTab === 'clips'
                    ? 'bg-surface-container-lowest text-on-surface border-t-2 border-secondary font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
                onClick={() => setActiveTab('clips')}
              >
                <span className="material-symbols-outlined text-[20px] text-secondary">article</span>
                مكتبة الكليشات والعبارات
              </button>
            </div>
          </div>

          {activeTab === 'letterhead' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-space-md bg-surface-container-low flex flex-col gap-space-sm shrink-0 border-b border-outline-variant/30">
                <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-xs flex flex-col gap-space-xs">
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
                  {/* البحث: في الاسم والتصنيف ونصّ الترويسة */}
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

              {clients.length > 0 && (
                <label className="flex items-center gap-space-sm">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-medium shrink-0">لجهة</span>
                  <select
                    className="flex-1 h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none"
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
                {currentId !== null && (
                  <RevisionsMenu
                    current={current?.revision}
                    id={currentId}
                    kind="letterhead"
                    onRestore={(p, revision) => {
                      // تُحمَّل للمراجعة ولا تُكتب: الحفظ يعتمدها نسخةً جديدة.
                      setName(p.name);
                      setCategory(p.category ?? '');
                      setAuthorityId(p.authorityId);
                      setLayout(normalizeLayout(p.layout));
                      setDirty(true);
                      say(`حُمّلت النسخة ${revision} — احفظ لتعتمدها`);
                    }}
                  />
                )}
                {dirty && (
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold shrink-0">
                    غير محفوظة
                  </span>
                )}
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
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
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
      ) : (
            <div className="flex-1 flex flex-col p-space-md space-y-space-md overflow-y-auto">
              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs space-y-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-primary-container text-on-primary">
                      <span className="material-symbols-outlined text-[18px]">post_add</span>
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      {editingClipId ? 'تعديل كليشة' : 'إضافة كليشة جديدة'}
                    </h3>
                  </div>
                </div>

                <div className="space-y-space-xs">
                  <div className="grid grid-cols-2 gap-space-sm">
                    <label className="flex flex-col gap-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                        عنوان الكليشة <span className="text-error">*</span>
                      </span>
                      <input
                        className={settingInput}
                        placeholder="مثال: افتتاحية محكمة البداءة"
                        type="text"
                        value={clipTitle}
                        onChange={(e) => setClipTitle(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                        التصنيف
                      </span>
                      <input
                        className={settingInput}
                        placeholder="مثال: محاكم، كتب إدارية…"
                        type="text"
                        value={clipCategory}
                        onChange={(e) => setClipCategory(e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                      محتوى النص / الكليشة <span className="text-error">*</span>
                    </span>
                    <textarea
                      className="w-full min-h-[100px] p-space-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md leading-6 focus:outline-none focus:ring-2 focus:ring-secondary resize-y"
                      placeholder="اكتب العبارة أو النص الذي تعيد استخدامه دائمًا…"
                      value={clipBody}
                      onChange={(e) => setClipBody(e.target.value)}
                    />
                  </label>

                  {/* لمن تُكتب: فتتصدّر في كتابٍ باتجاهها (FOUNDATION §٦) */}
                  <label className="flex items-center gap-space-xs">
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-medium shrink-0">تُكتب</span>
                    <select
                      className={`${settingInput} cursor-pointer`}
                      data-clip-direction-input=""
                      value={clipDirection}
                      onChange={(e) => setClipDirection(e.target.value as Addressing | 'auto' | 'any')}
                    >
                      <option value="auto">
                        {(() => {
                          const g = guessAddressing(clipBody);
                          return g ? `تلقائيًّا من أفعالها — ${ADDRESSING_LABEL[g]}` : 'تلقائيًّا من أفعالها';
                        })()}
                      </option>
                      {ADDRESSING.map((a) => (
                        <option key={a} value={a}>
                          {ADDRESSING_LABEL[a]} ({ADDRESSING_HINT[a]})
                        </option>
                      ))}
                      <option value="any">لأيّ جهة</option>
                    </select>
                  </label>

                  <div className="flex items-center gap-space-xs pt-space-xs">
                    <button
                      className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center justify-center gap-space-xs transition-all"
                      type="button"
                      onClick={() => void saveClip()}
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>{editingClipId ? 'حفظ التعديل' : 'حفظ الكليشة'}</span>
                    </button>
                    {editingClipId && (
                      <button
                        className="h-9 px-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors font-label-md text-label-md"
                        type="button"
                        onClick={() => {
                          setEditingClipId(null);
                          setClipTitle('');
                          setClipBody('');
                          setClipCategory('');
                          setClipDirection('auto');
                        }}
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* قائمة الكليشات */}
              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs space-y-space-sm flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    الكليشات المحفوظة ({clipsList.length})
                  </span>
                  <div className="w-48 relative">
                    <input
                      className="w-full h-8 pr-7 pl-2 rounded-lg bg-surface-container-low text-on-surface font-label-sm text-label-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      placeholder="بحث في الكليشات…"
                      type="search"
                      value={clipQuery}
                      onChange={(e) => setClipQuery(e.target.value)}
                    />
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      search
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-space-xs pr-1">
                  {clipsList.length === 0 ? (
                    <div className="py-space-xl text-center flex flex-col items-center gap-2 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[32px]">article</span>
                      <span className="font-label-md text-label-md">لا توجد كليشات محفوظة</span>
                      <span className="font-label-sm text-label-sm">تُبنى من عمل المكتب: اكتب العبارة التي تتكرّر واحفظها</span>
                    </div>
                  ) : (
                    clipsList.map((c) => (
                      <div
                        key={c.id}
                        className="p-space-sm rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-all flex flex-col gap-1 border border-outline-variant/20"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-label-md text-label-md text-on-surface font-bold">
                            {c.title}
                          </span>
                          <div className="flex items-center gap-1">
                            {c.direction && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-container-high text-on-surface-variant">
                                {ADDRESSING_LABEL[c.direction]}
                              </span>
                            )}
                            {c.category && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-secondary-container text-on-secondary-container font-semibold">
                                {c.category}
                              </span>
                            )}
                            <button
                              className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-secondary"
                              title="تعديل الكليشة"
                              type="button"
                              onClick={() => {
                                setEditingClipId(c.id);
                                setClipTitle(c.title);
                                setClipBody(c.body);
                                setClipDirection(c.direction ?? 'any');
                                setClipCategory(c.category ?? '');
                              }}
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              className="w-7 h-7 rounded flex items-center justify-center text-error hover:bg-error-container"
                              title="حذف الكليشة"
                              type="button"
                              onClick={() => void deleteClip(c.id)}
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                        <p className="font-label-sm text-label-sm text-on-surface-variant line-clamp-2 whitespace-pre-wrap leading-5">
                          {c.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
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
