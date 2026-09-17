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
  mmToPx,
  HEADER_FIELDS,
  type Align,
  type BlockKind,
  type Letterhead,
  type LetterheadBlock,
  type LetterheadLayout
} from '@shared/letterhead';

const KIND_META: Record<BlockKind, { icon: string; label: string }> = {
  text: { icon: 'title', label: 'سطر نصّي' },
  image: { icon: 'image', label: 'شعار أو صورة' },
  divider: { icon: 'horizontal_rule', label: 'خط فاصل' },
  field: { icon: 'data_object', label: 'حقل تلقائي' },
  spacer: { icon: 'height', label: 'فراغ' }
};

const ALIGN_META: { value: Align; icon: string; title: string }[] = [
  { value: 'right', icon: 'format_align_right', title: 'يمين' },
  { value: 'center', icon: 'format_align_center', title: 'وسط' },
  { value: 'left', icon: 'format_align_left', title: 'يسار' }
];

const SEAL_KINDS = ['ختم', 'توقيع', 'شعار'];

const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : null);

const settingInput =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

let counter = 0;
const nextId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

type Toast = { text: string; tone: 'ok' | 'warn' } | null;

export default function LetterheadScreen() {
  const [list, setList] = useState<Letterhead[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [layout, setLayout] = useState<LetterheadLayout>(emptyLayout);
  const [selected, setSelected] = useState<string | null>(null);
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
    const [items, sealList] = await Promise.all([
      window.diwan.letterheads.list(),
      window.diwan.seals.list()
    ]);
    setList(items);
    setSeals(sealList);
    return items;
  }, []);

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
    setLayout(item.layout);
    setSelected(null);
    setDirty(false);
  }

  function startNew() {
    setCurrentId(null);
    setName('');
    setLayout(emptyLayout());
    setSelected(null);
    setDirty(false);
  }

  const current = layout.blocks.find((b) => b.id === selected) ?? null;

  function mutate(fn: (blocks: LetterheadBlock[]) => LetterheadBlock[]) {
    setLayout((prev) => ({ ...prev, blocks: fn(prev.blocks) }));
    setDirty(true);
  }

  async function addBlock(kind: BlockKind) {
    let value = '';
    if (kind === 'image') {
      const picked = await window.diwan.files.pickImage('letterheads');
      if (!picked) return;
      value = picked;
    }
    const block: LetterheadBlock = {
      id: nextId(),
      kind,
      value,
      align: 'center',
      size: kind === 'text' ? 16 : 14,
      bold: kind === 'text',
      ...(kind === 'image' ? { width: 90 } : {}),
      ...(kind === 'spacer' ? { gap: 12 } : {})
    };
    mutate((bs) => [...bs, block]);
    setSelected(block.id);
  }

  function patch(id: string, changes: Partial<LetterheadBlock>) {
    mutate((bs) => bs.map((b) => (b.id === id ? { ...b, ...changes } : b)));
  }

  function move(id: string, delta: number) {
    mutate((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + delta;
      if (i === -1 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  async function replaceImage(id: string) {
    const picked = await window.diwan.files.pickImage('letterheads');
    if (picked) patch(id, { value: picked });
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
        layout
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
              <div className="flex items-center gap-space-xs">
                <select
                  className="flex-1 h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                  value={currentId ?? ''}
                  onChange={(e) => {
                    const item = list.find((x) => x.id === Number(e.target.value));
                    if (item) load(item);
                  }}
                >
                  {currentId === null && <option value="">— ترويسة جديدة —</option>}
                  {list.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.isDefault ? ' (الافتراضية)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="h-9 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors disabled:opacity-40"
                  type="button"
                  title="اجعلها الافتراضية لكل كتاب جديد"
                  disabled={currentId === null || isDefault}
                  onClick={() => void makeDefault()}
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">star</span>
                  <span>{isDefault ? 'افتراضية' : 'اجعلها افتراضية'}</span>
                </button>
              </div>

              <label className="font-label-sm text-label-sm text-on-surface-variant font-medium pt-space-xs">
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
            {/* إضافة كتلة */}
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">add_box</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">إضافة كتلة</h3>
                </div>
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  {layout.blocks.length} كتلة
                </span>
              </div>
              <div className="grid grid-cols-2 gap-space-sm">
                {(Object.keys(KIND_META) as BlockKind[]).map((kind) => (
                  <button
                    key={kind}
                    className="flex items-center gap-space-xs h-9 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
                    type="button"
                    onClick={() => void addBlock(kind)}
                  >
                    <span className="material-symbols-outlined text-[16px] text-secondary">
                      {KIND_META[kind].icon}
                    </span>
                    <span>{KIND_META[kind].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ترتيب الكتل */}
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center gap-space-xs pb-space-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">reorder</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">ترتيب الكتل</h3>
              </div>

              {layout.blocks.length === 0 ? (
                <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[32px]">layers_clear</span>
                  <span className="font-label-md text-label-md">لا توجد كتل بعد</span>
                  <span className="font-label-sm text-label-sm">
                    ابدأ بإضافة سطر نصّي أو شعار من الأعلى
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  {layout.blocks.map((b, i) => (
                    <div
                      key={b.id}
                      className={
                        b.id === selected
                          ? 'flex items-center justify-between px-space-sm py-space-sm rounded-lg bg-secondary-fixed text-on-secondary-fixed transition-all cursor-pointer'
                          : 'flex items-center justify-between px-space-sm py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all cursor-pointer'
                      }
                      onClick={() => setSelected(b.id)}
                    >
                      <div className="flex items-center gap-space-sm min-w-0">
                        <span className="material-symbols-outlined text-[18px]">
                          {KIND_META[b.kind].icon}
                        </span>
                        <span className="font-label-md text-label-md truncate">
                          {b.kind === 'image'
                            ? 'صورة'
                            : b.value || KIND_META[b.kind].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          className="p-space-xs rounded hover:bg-surface-container-high transition-colors disabled:opacity-30"
                          type="button"
                          title="أعلى"
                          disabled={i === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            move(b.id, -1);
                          }}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            keyboard_arrow_up
                          </span>
                        </button>
                        <button
                          className="p-space-xs rounded hover:bg-surface-container-high transition-colors disabled:opacity-30"
                          type="button"
                          title="أسفل"
                          disabled={i === layout.blocks.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            move(b.id, 1);
                          }}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            keyboard_arrow_down
                          </span>
                        </button>
                        <button
                          className="p-space-xs rounded hover:bg-surface-container-high text-error transition-colors"
                          type="button"
                          title="حذف"
                          onClick={(e) => {
                            e.stopPropagation();
                            mutate((bs) => bs.filter((x) => x.id !== b.id));
                            if (selected === b.id) setSelected(null);
                          }}
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* خصائص الكتلة */}
            {current && (
              <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
                <div className="flex items-center gap-space-xs pb-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">tune</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">خصائص الكتلة</h3>
                </div>

                {current.kind === 'text' && (
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">النص</label>
                    <input
                      className="w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
                      type="text"
                      value={current.value}
                      placeholder="اكتب محتوى السطر"
                      onChange={(e) => patch(current.id, { value: e.target.value })}
                    />
                  </div>
                )}

                {current.kind === 'field' && (
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      الحقل التلقائي — يملؤه المحرّك عند الإصدار
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {HEADER_FIELDS.map((f) => (
                        <button
                          key={f.token}
                          className={
                            current.value === f.token
                              ? 'px-2 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold transition-colors'
                              : 'px-2 py-1 rounded bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm transition-colors'
                          }
                          type="button"
                          onClick={() => patch(current.id, { value: f.token })}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {current.kind === 'image' && (
                  <div className="flex items-center gap-space-sm">
                    <button
                      className="flex items-center gap-space-xs h-9 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
                      type="button"
                      onClick={() => void replaceImage(current.id)}
                    >
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        swap_horiz
                      </span>
                      <span>استبدال الصورة</span>
                    </button>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        العرض ({current.width ?? 90}px)
                      </label>
                      <input
                        className="w-full accent-secondary"
                        type="range"
                        min={24}
                        max={260}
                        value={current.width ?? 90}
                        onChange={(e) => patch(current.id, { width: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                )}

                {current.kind === 'spacer' && (
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      ارتفاع الفراغ ({current.gap ?? 12}px)
                    </label>
                    <input
                      className="w-full accent-secondary"
                      type="range"
                      min={2}
                      max={80}
                      value={current.gap ?? 12}
                      onChange={(e) => patch(current.id, { gap: Number(e.target.value) })}
                    />
                  </div>
                )}

                {current.kind !== 'spacer' && (
                  <div className="grid grid-cols-2 gap-space-sm">
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        المحاذاة
                      </label>
                      <div className="flex items-center gap-1">
                        {ALIGN_META.map((a) => (
                          <button
                            key={a.value}
                            className={
                              current.align === a.value
                                ? 'w-9 h-9 rounded flex items-center justify-center bg-primary-container text-on-primary transition-colors'
                                : 'w-9 h-9 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors'
                            }
                            type="button"
                            title={a.title}
                            onClick={() => patch(current.id, { align: a.value })}
                          >
                            <span className="material-symbols-outlined text-[18px]">{a.icon}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {(current.kind === 'text' || current.kind === 'field') && (
                      <div className="flex flex-col gap-1">
                        <label className="font-label-sm text-label-sm text-on-surface-variant">
                          الحجم ({current.size}px)
                        </label>
                        <input
                          className="w-full h-9 accent-secondary"
                          type="range"
                          min={8}
                          max={32}
                          value={current.size}
                          onChange={(e) => patch(current.id, { size: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                )}

                {(current.kind === 'text' || current.kind === 'field') && (
                  <label className="flex items-center gap-space-sm cursor-pointer pt-space-xs">
                    <input
                      className="w-4 h-4 accent-primary-container"
                      type="checkbox"
                      checked={current.bold}
                      onChange={(e) => patch(current.id, { bold: e.target.checked })}
                    />
                    <span className="font-label-md text-label-md text-on-surface">خط عريض</span>
                  </label>
                )}
              </div>
            )}

            {/* الهوامش */}
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center gap-space-xs pb-space-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  crop_free
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  هوامش الورقة (ملم)
                </h3>
              </div>
              <div className="grid grid-cols-4 gap-space-sm">
                {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                  <div key={side} className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      {{ top: 'أعلى', right: 'يمين', bottom: 'أسفل', left: 'يسار' }[side]}
                    </label>
                    <input
                      className="w-full h-9 px-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md text-center focus:outline-none focus:ring-2 focus:ring-secondary"
                      type="number"
                      min={0}
                      max={60}
                      value={layout.margins[side]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setLayout((prev) => ({
                          ...prev,
                          margins: { ...prev.margins, [side]: v }
                        }));
                        setDirty(true);
                      }}
                    />
                  </div>
                ))}
              </div>
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
              {layout.blocks.length === 0 ? (
                <div className="py-space-xl flex flex-col items-center gap-space-sm text-on-surface-variant border border-dashed border-outline-variant rounded-lg">
                  <span className="material-symbols-outlined text-[40px]">note_add</span>
                  <span className="font-body-md text-body-md">منطقة الترويسة فارغة</span>
                  <span className="font-label-sm text-label-sm">
                    كل ما تضيفه يظهر هنا بمقاسه الحقيقي على الورقة
                  </span>
                </div>
              ) : (
                <div>
                  {layout.blocks.map((b) => {
                    const onClick = () => setSelected(b.id);
                    const ring =
                      b.id === selected ? 'outline outline-1 outline-secondary outline-offset-2' : '';

                    if (b.kind === 'spacer') {
                      return <div key={b.id} style={{ height: b.gap ?? 12 }} onClick={onClick} />;
                    }
                    if (b.kind === 'divider') {
                      return (
                        <hr
                          key={b.id}
                          className={`border-t border-on-surface my-space-sm ${ring}`}
                          onClick={onClick}
                        />
                      );
                    }
                    if (b.kind === 'image') {
                      const justify =
                        b.align === 'center'
                          ? 'center'
                          : b.align === 'left'
                            ? 'flex-start'
                            : 'flex-end';
                      return (
                        <div
                          key={b.id}
                          className={`flex ${ring}`}
                          style={{ justifyContent: justify }}
                          onClick={onClick}
                        >
                          <img
                            alt=""
                            src={storeUrl(b.value) ?? undefined}
                            style={{ width: b.width ?? 90 }}
                          />
                        </div>
                      );
                    }
                    return (
                      <div
                        key={b.id}
                        className={`${b.bold ? 'font-bold' : ''} ${ring}`}
                        style={{ textAlign: b.align, fontSize: `${b.size}px`, lineHeight: 1.9 }}
                        onClick={onClick}
                      >
                        {b.value || ' '}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
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
