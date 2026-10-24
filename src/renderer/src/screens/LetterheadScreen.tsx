/**
 * الترويسات والشعارات — data-path="header-seal-configuration" (مسارٌ من أيام الأختام، وأُزيلت؛
 * يبقى لأن السيناريوهات تقصده به).
 *
 * لا تصميم Stitch لها؛ بُنيت بنفس التوكنات وإيقاع البطاقات المستخرج من الشاشات الأربع،
 * وبنفس بنية «لوح إدخال + معاينة ورقة» المعتمدة في شاشة المحرر.
 *
 * الترويسة حرّة البنية: الكتاب يصدر عن جهة لا عن المكتب، فلا حقول ثابتة —
 * بل كتل يركّبها صاحب المكتب ويرتّبها، وتُحفظ JSON.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Addressing, Clip, Seal } from '@shared/api';
import {
  emptyLayout,
  normalizeLayout,
  type Letterhead,
  type LetterheadLayout
} from '@shared/letterhead';
import type { Client } from '@shared/orders';
import { confirmAction } from '../kit/ask';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import LetterheadTab from './letterhead/LetterheadTab';
import ClipsTab from './letterhead/ClipsTab';
import LetterheadPreview from './letterhead/LetterheadPreview';

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
  // لا مسودّة للترويسة: ما عُدِّل ولم يُحفظ يضيع بالانتقال أو بـ«ترويسة جديدة» أو بإغلاق البرنامج (ج٣).
  const leave = useLeaveGuard({ label: 'الترويسة', dirty, save });
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
    // مرّةً عند فتح الشاشة
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

  /** ترويسةٌ أخرى من القائمة: تحلّ محلّ ما على الشاشة، فيُسأل عمّا لم يُحفظ أوّلًا. */
  async function open(item: Letterhead) {
    if (!(await leave())) return;
    load(item);
  }

  async function startFresh() {
    if (!(await leave())) return;
    startNew();
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
  async function save(): Promise<boolean> {
    if (!name.trim()) {
      say('سمِّ الترويسة أولًا', 'warn');
      return false;
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
      return true;
    } catch (e) {
      say(e instanceof Error ? e.message : 'تعذّر الحفظ', 'warn');
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** حذف الترويسة الجارية، ثم العودة إلى الافتراضية أو أول ما في المكتبة. */
  async function remove() {
    if (currentId === null) return;
    // حذفٌ نهائيّ بنقرة: تضيع معه نسخها السابقة، وتبقى النماذج المربوطة بها بلا ترويسة (ج٢).
    const ok = await confirmAction({
      title: `حذف الترويسة «${name.trim() || 'بلا اسم'}»؟`,
      message: 'تضيع معها نسخها السابقة، وتبقى النماذج المربوطة بها بلا ترويسة. والكتب التي صدرت لا تتغيّر. لا رجعة بعد الحذف.',
      confirm: 'احذفها نهائيًّا',
      danger: true
    });
    if (!ok) return;
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
    if (!(await leave())) return;
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
    const seal = seals.find((s) => s.id === id);
    if (!(await confirmAction({ title: `حذف الشعار «${seal?.name.trim() || 'بلا اسم'}» من المكتبة؟`, message: 'لا رجعة بعد الحذف.', confirm: 'احذفه', danger: true }))) return;
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
    const clip = clipsList.find((c) => c.id === id);
    if (!(await confirmAction({ title: `حذف الكليشة «${clip?.title.trim() || 'بلا عنوان'}»؟`, message: 'تضيع معها نسخها السابقة. لا رجعة بعد الحذف.', confirm: 'احذفها نهائيًّا', danger: true }))) return;
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
                    ? 'bg-surface-container-lowest text-on-surface border-t-2 border-secondary font-bold shadow-low'
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
                    ? 'bg-surface-container-lowest text-on-surface border-t-2 border-secondary font-bold shadow-low'
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
            <LetterheadTab
              startFresh={startFresh}
              query={query}
              setQuery={setQuery}
              categories={categories}
              filter={filter}
              setFilter={setFilter}
              list={list}
              currentId={currentId}
              toggleFavorite={toggleFavorite}
              open={open}
              duplicate={duplicate}
              name={name}
              setName={setName}
              setDirty={setDirty}
              category={category}
              setCategory={setCategory}
              clients={clients}
              authorityId={authorityId}
              setAuthorityId={setAuthorityId}
              isDefault={isDefault}
              makeDefault={makeDefault}
              current={current}
              leave={leave}
              setLayout={setLayout}
              say={say}
              dirty={dirty}
              saving={saving}
              save={save}
              remove={remove}
              layout={layout}
              editLayout={editLayout}
              addSeal={addSeal}
              seals={seals}
              setSeals={setSeals}
              deleteSeal={deleteSeal}
            />
      ) : (
            <ClipsTab
              editingClipId={editingClipId}
              clipTitle={clipTitle}
              setClipTitle={setClipTitle}
              clipCategory={clipCategory}
              setClipCategory={setClipCategory}
              clipBody={clipBody}
              setClipBody={setClipBody}
              clipDirection={clipDirection}
              setClipDirection={setClipDirection}
              saveClip={saveClip}
              setEditingClipId={setEditingClipId}
              clipsList={clipsList}
              clipQuery={clipQuery}
              setClipQuery={setClipQuery}
              deleteClip={deleteClip}
            />
          )}
        </div>

        {/* معاينة الترويسة على ورقة A4 حقيقية */}
        <LetterheadPreview
          layout={layout}
        />
      </div>

      {/* إشعار موجز */}
      {toast && (
        <div
          className={
            toast.tone === 'ok'
              ? 'fixed bottom-6 right-80 z-50 px-space-lg py-space-sm rounded-card bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-soft flex items-center gap-space-xs'
              : 'fixed bottom-6 right-80 z-50 px-space-lg py-space-sm rounded-card bg-error-container text-on-error-container font-label-md text-label-md shadow-soft flex items-center gap-space-xs'
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
