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
  HEADER_FIELDS,
  type BlockKind,
  type LetterheadBlock,
  type LetterheadLayout
} from '@shared/letterhead';
import { COLUMN_CHOICES, SECTION_NAMES, sectionPlace, KIND_META } from './letterheadDesigner/shared';
import SectionBlocks from './letterheadDesigner/SectionBlocks';
import BasmalaOptions from './letterheadDesigner/BasmalaOptions';
import RegistryOptions from './letterheadDesigner/RegistryOptions';
import PageOptions from './letterheadDesigner/PageOptions';
import FooterOptions from './letterheadDesigner/FooterOptions';

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
        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-card">
          {COLUMN_CHOICES.map((c) => (
            <button
              key={c.value}
              className={`flex-1 h-9 rounded font-label-sm text-label-sm transition-colors flex flex-col items-center justify-center leading-tight ${
                layout.columns === c.value
                  ? 'bg-primary-fixed text-primary font-semibold'
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
              className={`flex-1 h-8 rounded-btn font-label-sm text-label-sm transition-colors ${
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
      <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-card">
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
                ? 'bg-primary-fixed text-primary font-semibold'
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
            className="input-field w-full min-h-[104px] p-space-sm text-on-surface font-label-md text-label-md leading-7 resize-y"
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
            className="h-8 px-2 rounded-btn bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors"
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
          <div className="py-space-md rounded-card border border-dashed border-outline-variant flex flex-col items-center gap-1 text-on-surface-variant">
            <span className="font-label-md text-label-md">هذا القسم فارغ</span>
            <span className="font-label-sm text-label-sm">أضف سطرًا أو شعارًا من الأعلى</span>
          </div>
        ) : null
      ) : (
        <SectionBlocks
          shown={shown}
          patchBlock={patchBlock}
          pickImage={pickImage}
          section={section}
          moveBlock={moveBlock}
          removeBlock={removeBlock}
        />
      )}

      {/* البسملة: سطر فوق الأقسام كلّها، ومطفأة في الأصل */}
      <BasmalaOptions
        layout={layout}
        onChange={onChange}
        adoptBasmala={adoptBasmala}
        basmalaNote={basmalaNote}
      />

      {/* العدد والتاريخ: موضعهما القسم الأخير، وهما اختياريان */}
      <RegistryOptions
        layout={layout}
        onChange={onChange}
      />

      {/* تذييل الورقة */}
      <FooterOptions
        layout={layout}
        onChange={onChange}
      />

      {/* خيارات الورقة */}
      <PageOptions
        layout={layout}
        onChange={onChange}
        showPageOptions={showPageOptions}
      />
    </div>
  );
}
