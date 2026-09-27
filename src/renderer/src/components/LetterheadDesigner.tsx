/**
 * مصمّم الترويسة بالأقسام — مكوّن واحد يعمل في مكانين:
 * داخل محرر الكتاب (ترويسة هذا الكتاب)، وفي شاشة الإعدادات (ترويسة محفوظة).
 *
 * الترتيب: تختار عدد الأقسام، ثم تنتقل بين الأقسام وتملأ كلّ قسم بأسطره
 * وشعاره. ما تكتبه في قسم لا يضيع حين تقلّل عدد الأقسام — يبقى محفوظًا
 * ويظهر ثانيةً عند زيادتها.
 */
import { useState } from 'react';
import {
  defaultAlign,
  newId,
  FONTS,
  HEADER_FIELDS,
  type Align,
  type BlockKind,
  type ColumnCount,
  type LetterheadBlock,
  type LetterheadLayout
} from '@shared/letterhead';

const KIND_META: { kind: BlockKind; icon: string; label: string }[] = [
  { kind: 'text', icon: 'title', label: 'سطر نصّي' },
  { kind: 'image', icon: 'image', label: 'شعار أو صورة' },
  { kind: 'field', icon: 'data_object', label: 'حقل تلقائي' },
  { kind: 'divider', icon: 'horizontal_rule', label: 'خط فاصل' },
  { kind: 'spacer', icon: 'height', label: 'فراغ' }
];

const ALIGN_META: { value: Align; icon: string; title: string }[] = [
  { value: 'right', icon: 'format_align_right', title: 'يمين' },
  { value: 'center', icon: 'format_align_center', title: 'وسط' },
  { value: 'left', icon: 'format_align_left', title: 'يسار' }
];

const COLUMN_CHOICES: { value: ColumnCount; label: string; hint: string }[] = [
  { value: 1, label: 'قسم واحد', hint: 'بعرض الورقة' },
  { value: 2, label: 'قسمان', hint: 'يمين ويسار' },
  { value: 3, label: 'ثلاثة أقسام', hint: 'يمين ووسط ويسار' }
];

const SECTION_NAMES = ['القسم الأول', 'القسم الثاني', 'القسم الثالث'];

function sectionPlace(index: number, columns: ColumnCount): string {
  if (columns === 1) return 'بعرض الورقة';
  if (index === 0) return 'يمين الورقة';
  if (index === columns - 1) return 'يسار الورقة';
  return 'وسط الورقة';
}

export type LetterheadDesignerProps = {
  layout: LetterheadLayout;
  onChange: (next: LetterheadLayout) => void;
  /** يعرض الهوامش والخط الفاصل — تُخفى داخل المحرر لضيق اللوح. */
  showPageOptions?: boolean;
};

export default function LetterheadDesigner({
  layout,
  onChange,
  showPageOptions = false
}: LetterheadDesignerProps) {
  const [active, setActive] = useState(0);
  /** أُعلن أن البسملة صارت تفضيل المكتب — مرّةً عند أوّل إشعال. */
  const [basmalaNote, setBasmalaNote] = useState(false);

  /**
   * أوّل مرّة يشعل المكتب البسملة في ترويسةٍ تصير تفضيله (FOUNDATION §٥): كل
   * ترويسةٍ جديدة تبدأ بها. وما دام قد اختار — إشعالًا أو إطفاءً من الإعدادات —
   * لا يُمسّ اختياره من هنا.
   */
  async function adoptBasmala() {
    try {
      const s = await window.diwan.settings.get();
      if (s.basmala !== null) return;
      await window.diwan.settings.set({ basmala: true });
      setBasmalaNote(true);
    } catch {
      // التفضيل راحةٌ لا شرط: الترويسة نفسها أُشعلت بسملتها على كل حال.
    }
  }
  /** «أسطر» هو الأصل: الترويسة تُكتب أسرع مما تُركَّب كتلةً كتلة. */
  const [mode, setMode] = useState<'lines' | 'detail'>('lines');
  const index = Math.min(active, layout.columns - 1);
  const section = layout.sections[index]!;
  const shown = mode === 'lines' ? section.blocks.filter((b) => b.kind !== 'text') : section.blocks;

  /** أسطر القسم النصّية سطرًا في كل سطر — ولا شيء غيرها. */
  const lines = section.blocks
    .filter((b) => b.kind === 'text')
    .map((b) => b.value)
    .join('\n');

  /**
   * صندوق النصّ يحكم الأسطر النصّية وحدها.
   *
   * `Enter` يضيف سطرًا، ومسح السطر يحذفه، واللصق من Word يبني الترويسة في
   * ثانية. وما كُتب من حجم وعريض ومحاذاة يبقى لكل سطر بموضعه، والشعار والخط
   * الفاصل لا ينتقلان من مكانهما.
   */
  function setLines(text: string) {
    const wanted = text === '' ? [] : text.split('\n');
    const olds = section.blocks.filter((b) => b.kind === 'text');
    const made: LetterheadBlock[] = wanted.map((value, i) => {
      const prev = olds[i];
      if (prev) return { ...prev, value };
      return {
        id: newId('b'),
        kind: 'text',
        value,
        align: defaultAlign(index, layout.columns),
        size: 14,
        bold: i === 0 && olds.length === 0
      };
    });

    const blocks: LetterheadBlock[] = [];
    let at = 0;
    let lastText = -1;
    for (const b of section.blocks) {
      if (b.kind !== 'text') {
        blocks.push(b);
        continue;
      }
      if (at < made.length) {
        blocks.push(made[at]!);
        lastText = blocks.length - 1;
        at += 1;
      }
    }
    const extra = made.slice(at);
    if (extra.length) blocks.splice(lastText + 1, 0, ...extra);
    patchSection({ blocks });
  }

  function patchSection(next: Partial<(typeof layout.sections)[number]>) {
    const sections = [...layout.sections] as LetterheadLayout['sections'];
    sections[index] = { ...section, ...next };
    onChange({ ...layout, sections });
  }

  function addBlock(kind: BlockKind) {
    const block: LetterheadBlock = {
      id: newId('b'),
      kind,
      value: kind === 'field' ? HEADER_FIELDS[0]!.token : '',
      align: defaultAlign(index, layout.columns),
      size: kind === 'text' ? 14 : 12,
      bold: kind === 'text' && section.blocks.length === 0,
      width: kind === 'image' ? 90 : undefined,
      gap: kind === 'spacer' ? 12 : undefined
    };
    patchSection({ blocks: [...section.blocks, block] });
  }

  function patchBlock(id: string, patch: Partial<LetterheadBlock>) {
    patchSection({ blocks: section.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  }

  function removeBlock(id: string) {
    patchSection({ blocks: section.blocks.filter((b) => b.id !== id) });
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const blocks = [...section.blocks];
    const at = blocks.findIndex((b) => b.id === id);
    const to = at + direction;
    if (at < 0 || to < 0 || to >= blocks.length) return;
    [blocks[at], blocks[to]] = [blocks[to]!, blocks[at]!];
    patchSection({ blocks });
  }

  async function pickImage(id: string) {
    const path = await window.diwan.files.pickImage('letterheads');
    if (path) patchBlock(id, { value: path });
  }

  return (
    <div className="space-y-space-sm">
      {/* عدد الأقسام */}
      <div className="flex flex-col gap-space-xs">
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          تقسيم الترويسة
        </span>
        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
          {COLUMN_CHOICES.map((c) => (
            <button
              key={c.value}
              className={`flex-1 h-9 rounded font-label-sm text-label-sm transition-colors flex flex-col items-center justify-center leading-tight ${
                layout.columns === c.value
                  ? 'bg-primary-container text-on-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              type="button"
              onClick={() => {
                onChange({ ...layout, columns: c.value });
                setActive(0);
              }}
            >
              <span>{c.label}</span>
              <span className="text-[10px] opacity-80">{c.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* تبويبات الأقسام */}
      {layout.columns > 1 && (
        <div className="flex items-center gap-1">
          {layout.sections.slice(0, layout.columns).map((s, i) => (
            <button
              key={s.id}
              className={`flex-1 h-8 rounded-lg font-label-sm text-label-sm transition-colors ${
                i === index
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
              onClick={() => setActive(i)}
            >
              {SECTION_NAMES[i]} ({s.blocks.length})
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          {SECTION_NAMES[index]} — {sectionPlace(index, layout.columns)}
        </span>
        {layout.columns > 1 && (
          <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            عرضه
            <input
              className="w-14 h-7 px-1 rounded bg-surface-container-low text-on-surface text-center"
              min={1}
              max={6}
              type="number"
              value={section.weight || 1}
              onChange={(e) => patchSection({ weight: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
        )}
      </div>

      {/* وضع التحرير */}
      <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
        {(
          [
            { value: 'lines', label: 'أسطر', hint: 'اكتب أو الصق من Word' },
            { value: 'detail', label: 'تفصيل', hint: 'حجم وعريض ومحاذاة' }
          ] as const
        ).map((m) => (
          <button
            key={m.value}
            className={`flex-1 h-9 rounded font-label-sm text-label-sm transition-colors flex flex-col items-center justify-center leading-tight ${
              mode === m.value
                ? 'bg-primary-container text-on-primary font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
            type="button"
            onClick={() => setMode(m.value)}
          >
            <span>{m.label}</span>
            <span className="text-[10px] opacity-80">{m.hint}</span>
          </button>
        ))}
      </div>

      {mode === 'lines' && (
        <div className="flex flex-col gap-1">
          <textarea
            className="w-full min-h-[104px] p-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md leading-7 focus:outline-none focus:ring-1 focus:ring-secondary resize-y"
            placeholder={'جمهورية العراق\nوزارة التربية\nالمديرية العامة للتربية في محافظة …\nمديرية تربية …'}
            spellCheck={false}
            value={lines}
            onChange={(e) => setLines(e.target.value)}
          />
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            سطرٌ لكل سطر. والصق ترويستك من Word كما هي.
          </span>
        </div>
      )}

      {/* أدوات الإضافة */}
      <div className="flex flex-wrap items-center gap-space-xs">
        {(mode === 'lines' ? KIND_META.filter((k) => k.kind !== 'text') : KIND_META).map((k) => (
          <button
            key={k.kind}
            className="h-8 px-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors"
            type="button"
            onClick={() => addBlock(k.kind)}
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">{k.icon}</span>
            {k.label}
          </button>
        ))}
      </div>

      {/* كتل القسم */}
      {shown.length === 0 ? (
        mode === 'detail' ? (
          <div className="py-space-md rounded-lg border border-dashed border-outline-variant flex flex-col items-center gap-1 text-on-surface-variant">
            <span className="font-label-md text-label-md">هذا القسم فارغ</span>
            <span className="font-label-sm text-label-sm">أضف سطرًا أو شعارًا من الأعلى</span>
          </div>
        ) : null
      ) : (
        <div className="space-y-space-xs">
          {shown.map((block) => (
            <div
              key={block.id}
              className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-xs"
            >
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  {KIND_META.find((k) => k.kind === block.kind)?.icon ?? 'title'}
                </span>

                {block.kind === 'text' && (
                  <input
                    className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
                    placeholder="اكتب محتوى السطر"
                    type="text"
                    value={block.value}
                    onChange={(e) => patchBlock(block.id, { value: e.target.value })}
                  />
                )}

                {block.kind === 'field' && (
                  <select
                    className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md"
                    value={block.value}
                    onChange={(e) => patchBlock(block.id, { value: e.target.value })}
                  >
                    {HEADER_FIELDS.map((f) => (
                      <option key={f.token} value={f.token}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                )}

                {block.kind === 'image' && (
                  <button
                    className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm text-right truncate"
                    type="button"
                    onClick={() => void pickImage(block.id)}
                  >
                    {block.value ? 'تغيير الصورة' : 'اختر صورة من الحاسوب'}
                  </button>
                )}

                {block.kind === 'spacer' && (
                  <input
                    className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md"
                    min={2}
                    type="number"
                    value={block.gap ?? 12}
                    onChange={(e) => patchBlock(block.id, { gap: Number(e.target.value) || 12 })}
                  />
                )}

                {block.kind === 'divider' && (
                  <span className="flex-1 font-label-sm text-label-sm text-on-surface-variant">
                    خط فاصل داخل القسم
                  </span>
                )}

                <button
                  className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
                  disabled={section.blocks.indexOf(block) === 0}
                  title="أعلى"
                  type="button"
                  onClick={() => moveBlock(block.id, -1)}
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                </button>
                <button
                  className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
                  disabled={section.blocks.indexOf(block) === section.blocks.length - 1}
                  title="أسفل"
                  type="button"
                  onClick={() => moveBlock(block.id, 1)}
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                </button>
                <button
                  className="w-7 h-7 rounded flex items-center justify-center text-error hover:bg-error-container"
                  title="حذف"
                  type="button"
                  onClick={() => removeBlock(block.id)}
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>

              {(block.kind === 'text' || block.kind === 'field' || block.kind === 'image') && (
                <div className="flex items-center gap-space-sm pr-6">
                  <div className="flex items-center gap-0.5">
                    {ALIGN_META.map((a) => (
                      <button
                        key={a.value}
                        className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                          block.align === a.value
                            ? 'bg-surface-container-high text-on-surface'
                            : 'text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                        title={a.title}
                        type="button"
                        onClick={() => patchBlock(block.id, { align: a.value })}
                      >
                        <span className="material-symbols-outlined text-[16px]">{a.icon}</span>
                      </button>
                    ))}
                  </div>

                  {block.kind === 'image' ? (
                    <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                      العرض
                      <input
                        className="w-16 h-7 px-1 rounded bg-surface-container-lowest text-on-surface text-center"
                        min={20}
                        max={400}
                        type="number"
                        value={block.width ?? 90}
                        onChange={(e) =>
                          patchBlock(block.id, { width: Number(e.target.value) || 90 })
                        }
                      />
                    </label>
                  ) : (
                    <>
                      <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                        الحجم
                        <input
                          className="w-14 h-7 px-1 rounded bg-surface-container-lowest text-on-surface text-center"
                          min={8}
                          max={40}
                          type="number"
                          value={block.size}
                          onChange={(e) =>
                            patchBlock(block.id, { size: Number(e.target.value) || 14 })
                          }
                        />
                      </label>
                      <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant cursor-pointer">
                        <input
                          className="w-4 h-4 accent-secondary"
                          checked={block.bold}
                          type="checkbox"
                          onChange={(e) => patchBlock(block.id, { bold: e.target.checked })}
                        />
                        غامق
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* البسملة: سطر فوق الأقسام كلّها، ومطفأة في الأصل */}
      <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
        <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
          <input
            className="w-4 h-4 accent-secondary"
            checked={layout.basmala.show}
            data-act="basmala"
            type="checkbox"
            onChange={(e) => {
              onChange({ ...layout, basmala: { ...layout.basmala, show: e.target.checked } });
              if (e.target.checked) void adoptBasmala();
            }}
          />
          البسملة فوق الترويسة
        </label>
        {basmalaNote && (
          <span className="font-label-sm text-label-sm text-on-surface-variant" data-basmala-note="">
            صارت البسملة تفضيل المكتب: كل ترويسةٍ جديدة تبدأ بها — وتُطفأ من الإعدادات.
          </span>
        )}

        {layout.basmala.show && (
          <div className="flex items-center gap-space-xs">
            <input
              className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
              type="text"
              value={layout.basmala.text}
              onChange={(e) =>
                onChange({ ...layout, basmala: { ...layout.basmala, text: e.target.value } })
              }
            />
            <input
              className="w-14 h-8 px-1 rounded bg-surface-container-lowest text-on-surface text-center font-label-md text-label-md"
              min={8}
              max={40}
              type="number"
              value={layout.basmala.size}
              onChange={(e) =>
                onChange({
                  ...layout,
                  basmala: { ...layout.basmala, size: Number(e.target.value) || 14 }
                })
              }
            />
            <div className="flex items-center gap-0.5">
              {ALIGN_META.map((a) => (
                <button
                  key={a.value}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                    layout.basmala.align === a.value
                      ? 'bg-surface-container-high text-on-surface'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                  title={a.title}
                  type="button"
                  onClick={() =>
                    onChange({ ...layout, basmala: { ...layout.basmala, align: a.value } })
                  }
                >
                  <span className="material-symbols-outlined text-[16px]">{a.icon}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* العدد والتاريخ: موضعهما القسم الأخير، وهما اختياريان */}
      <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
        <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
          <input
            className="w-4 h-4 accent-secondary"
            checked={layout.registry.show}
            type="checkbox"
            onChange={(e) =>
              onChange({ ...layout, registry: { ...layout.registry, show: e.target.checked } })
            }
          />
          إظهار التاريخ والعدد في {layout.columns === 1 ? 'الترويسة' : 'القسم الأخير'}
        </label>

        {layout.registry.show && (
          <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-lg">
            {(
              [
                { value: 'manual', label: 'فراغ يُملأ باليد', hint: 'يكتبهما موظّف الاستلام' },
                { value: 'printed', label: 'مطبوعان', hint: 'من سجل الصادر' }
              ] as const
            ).map((c) => (
              <button
                key={c.value}
                className={`flex-1 h-9 rounded font-label-sm text-label-sm transition-colors flex flex-col items-center justify-center leading-tight ${
                  layout.registry.mode === c.value
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
                type="button"
                onClick={() => onChange({ ...layout, registry: { ...layout.registry, mode: c.value } })}
              >
                <span>{c.label}</span>
                <span className="text-[10px] opacity-80">{c.hint}</span>
              </button>
            ))}
          </div>
        )}
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          التاريخ فوق العدد. والكتاب يُقيَّد في الأرشيف برقمه في الحالين — الاختيار في ما
          يُطبع على الورقة فقط.
        </span>
      </div>

      {/* خيارات الورقة */}
      <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
        <label className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
          الخط
          <select
            className="h-8 px-2 rounded bg-surface-container-low text-on-surface font-label-md text-label-md"
            value={layout.font}
            onChange={(e) => onChange({ ...layout, font: e.target.value as typeof layout.font })}
          >
            {FONTS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface cursor-pointer">
          <input
            className="w-4 h-4 accent-secondary"
            checked={layout.divider}
            type="checkbox"
            onChange={(e) => onChange({ ...layout, divider: e.target.checked })}
          />
          خط فاصل أسفل الترويسة
        </label>

        {showPageOptions &&
          (['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <label
              key={side}
              className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant"
            >
              {{ top: 'أعلى', right: 'يمين', bottom: 'أسفل', left: 'يسار' }[side]}
              <input
                className="w-14 h-7 px-1 rounded bg-surface-container-low text-on-surface text-center"
                min={0}
                max={60}
                type="number"
                value={layout.margins[side]}
                onChange={(e) =>
                  onChange({
                    ...layout,
                    margins: { ...layout.margins, [side]: Number(e.target.value) || 0 }
                  })
                }
              />
              ملم
            </label>
          ))}
      </div>
    </div>
  );
}
