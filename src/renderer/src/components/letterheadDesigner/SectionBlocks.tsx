/**
 * كتل القسم: لكلّ كتلةٍ محتواها (سطرٌ أو حقلٌ أو صورةٌ أو فراغٌ أو خطّ)، وترتيبها وحذفها، ومحاذاتها وحجمها
 * وعرض الصورة (تقسيم مصمّم الترويسة بعد ١٫٧٫٠) — منقولٌ من `LetterheadDesigner` كما هو.
 */
import { KIND_META, ALIGN_META } from './shared';
import { HEADER_FIELDS, type LetterheadBlock, type LetterheadSection } from '@shared/letterhead';

type Props = {
  shown: LetterheadBlock[];
  patchBlock: (id: string, patch: Partial<LetterheadBlock>) => void;
  pickImage: (id: string) => Promise<void>;
  section: LetterheadSection;
  moveBlock: (id: string, direction: -1 | 1) => void;
  removeBlock: (id: string) => void;
};

export default function SectionBlocks({ shown, patchBlock, pickImage, section, moveBlock, removeBlock }: Props) {
  return (
    <div className="space-y-space-xs">
      {shown.map((block) => (
        <div
          key={block.id}
          className="p-space-sm rounded-card bg-surface-container-low flex flex-col gap-space-xs"
        >
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
              {KIND_META.find((k) => k.kind === block.kind)?.icon ?? 'title'}
            </span>

            {block.kind === 'text' && (
              <input
                className="input-field flex-1 h-8 px-2 text-on-surface font-label-md text-label-md"
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
  );
}
