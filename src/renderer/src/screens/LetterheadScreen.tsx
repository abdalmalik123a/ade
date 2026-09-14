/**
 * إعدادات الترويسة والأختام — data-path="header-seal-configuration"
 *
 * لا يوجد لها تصميم Stitch. صُمّمت هنا بنفس اللغة البصرية المستخرجة من الشاشات الأربع:
 * نفس التوكنات، ونفس إيقاع البطاقات (rounded-xl + shadow-sm + p-space-md)،
 * ونفس بنية «لوح إدخال يمين + معاينة ورقة يسار» المعتمدة في شاشة المحرر.
 *
 * الترويسة حرّة البنية: الكتاب يصدر عن جهة لا عن المكتب، فلا حقول ثابتة —
 * بل كتل يضيفها صاحب المكتب ويرتّبها.
 */
import { useState } from 'react';

type BlockKind = 'text' | 'image' | 'divider' | 'field';
type Align = 'right' | 'center' | 'left';

type Block = {
  id: string;
  kind: BlockKind;
  value: string;
  align: Align;
  size: number;
  bold: boolean;
};

const KIND_META: Record<BlockKind, { icon: string; label: string }> = {
  text: { icon: 'title', label: 'سطر نصّي' },
  image: { icon: 'image', label: 'شعار أو صورة' },
  divider: { icon: 'horizontal_rule', label: 'خط فاصل' },
  field: { icon: 'data_object', label: 'حقل تلقائي' }
};

const ALIGN_META: { value: Align; icon: string; title: string }[] = [
  { value: 'right', icon: 'format_align_right', title: 'يمين' },
  { value: 'center', icon: 'format_align_center', title: 'وسط' },
  { value: 'left', icon: 'format_align_left', title: 'يسار' }
];

let seq = 0;
const nextId = () => `b${++seq}`;

export default function LetterheadScreen() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');

  const current = blocks.find((b) => b.id === selected) ?? null;

  function addBlock(kind: BlockKind) {
    const block: Block = {
      id: nextId(),
      kind,
      value: '',
      align: 'center',
      size: kind === 'text' ? 16 : 14,
      bold: kind === 'text'
    };
    setBlocks((prev) => [...prev, block]);
    setSelected(block.id);
  }

  function patch(id: string, changes: Partial<Block>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...changes } : b)));
  }

  function move(id: string, delta: number) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const j = i + delta;
      if (i === -1 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

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
              <span className="font-code-sm text-code-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                حرّة البنية
              </span>
            </div>
            <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                اسم الترويسة <span className="text-error">*</span>
              </label>
              <input
                className="w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="مثال: مديرية تربية بغداد / الرصافة الأولى"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-space-md space-y-space-md">
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    add_box
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">إضافة كتلة</h3>
                </div>
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  {blocks.length} كتلة
                </span>
              </div>
              <div className="grid grid-cols-2 gap-space-sm">
                {(Object.keys(KIND_META) as BlockKind[]).map((kind) => (
                  <button
                    key={kind}
                    className="flex items-center gap-space-xs h-9 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
                    type="button"
                    onClick={() => addBlock(kind)}
                  >
                    <span className="material-symbols-outlined text-[16px] text-secondary">
                      {KIND_META[kind].icon}
                    </span>
                    <span>{KIND_META[kind].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center gap-space-xs pb-space-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  reorder
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">ترتيب الكتل</h3>
              </div>

              {blocks.length === 0 ? (
                <div className="py-space-xl flex flex-col items-center gap-space-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[32px]">layers_clear</span>
                  <span className="font-label-md text-label-md">لا توجد كتل بعد</span>
                  <span className="font-label-sm text-label-sm">
                    ابدأ بإضافة سطر نصّي أو شعار من الأعلى
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  {blocks.map((b, i) => (
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
                          {b.value || KIND_META[b.kind].label}
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
                          disabled={i === blocks.length - 1}
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
                            setBlocks((prev) => prev.filter((x) => x.id !== b.id));
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

            {current && (
              <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
                <div className="flex items-center gap-space-xs pb-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">tune</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    خصائص الكتلة
                  </h3>
                </div>

                {current.kind !== 'divider' && (
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      {current.kind === 'image' ? 'مسار الصورة' : 'النص'}
                    </label>
                    <input
                      className="w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
                      type="text"
                      value={current.value}
                      placeholder={
                        current.kind === 'field' ? 'مثال: {رقم_الصادر}' : 'اكتب محتوى السطر'
                      }
                      onChange={(e) => patch(current.id, { value: e.target.value })}
                    />
                  </div>
                )}

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
                </div>

                <label className="flex items-center gap-space-sm cursor-pointer pt-space-xs">
                  <input
                    className="w-4 h-4 accent-primary-container"
                    type="checkbox"
                    checked={current.bold}
                    onChange={(e) => patch(current.id, { bold: e.target.checked })}
                  />
                  <span className="font-label-md text-label-md text-on-surface">خط عريض</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* معاينة الترويسة على ورقة A4 */}
        <div className="flex-1 h-full overflow-auto bg-surface-dim/40 flex flex-col items-center py-space-xl">
          <div className="a4-sheet bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] shrink-0">
            <div className="px-[76px] pt-[76px]">
              {blocks.length === 0 ? (
                <div className="py-space-xl flex flex-col items-center gap-space-sm text-on-surface-variant border border-dashed border-outline-variant rounded-lg">
                  <span className="material-symbols-outlined text-[40px]">note_add</span>
                  <span className="font-body-md text-body-md">منطقة الترويسة فارغة</span>
                  <span className="font-label-sm text-label-sm">
                    كل ما تضيفه يظهر هنا بمقاسه الحقيقي على الورقة
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  {blocks.map((b) => {
                    if (b.kind === 'divider') {
                      return <hr key={b.id} className="border-t border-on-surface my-space-sm" />;
                    }
                    if (b.kind === 'image') {
                      return (
                        <div key={b.id} className={`flex justify-${b.align}`}>
                          <div className="w-16 h-16 rounded border border-dashed border-outline-variant flex items-center justify-center text-on-surface-variant">
                            <span className="material-symbols-outlined text-[24px]">image</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={b.id}
                        className={b.bold ? 'font-bold' : ''}
                        style={{ textAlign: b.align, fontSize: `${b.size}px`, lineHeight: 1.9 }}
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
    </main>
  );
}
