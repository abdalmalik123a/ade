/**
 * سؤالٌ في شجرة الأسئلة بفروعه ودرجته وإجابته (تقسيم شاشة الأسئلة بعد ١٫٧٫٠) — منقولٌ منها كما هو.
 */
import { type ListItem, type Numerals, type Dir, itemScore } from '@shared/doc';
import { EXAM_STYLES, MAX_DEPTH } from '@shared/examPaper';
import { marker } from '@shared/docHtml';
import { NUM_INPUT, ICON_BTN } from './shared';
import { textOf, inlinesOf } from '../papersTree';

// ── شجرة الأسئلة: تحويلاتٌ خالصة ─────────────────────────────────────

// ── السؤال الواحد ────────────────────────────────────────────────────

export type NodeProps = {
  item: ListItem;
  index: number;
  depth: number;
  numerals: Numerals;
  answers: boolean;
  dir: Dir;
  onPatch: (id: string, patch: Partial<ListItem>) => void;
  onBranch: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, step: -1 | 1) => void;
  /** يحفظ السؤال (بفروعه) في بنك الأسئلة — للأسئلة الأمّ وحدها. */
  onBank?: (item: ListItem) => void;
  onFocusInput: (el: HTMLTextAreaElement | HTMLInputElement) => void;
};

export function QuestionNode(props: NodeProps) {
  const { item, index, depth, numerals, answers, dir, onPatch } = props;
  const kids = item.items ?? [];
  const style = EXAM_STYLES[Math.min(depth, EXAM_STYLES.length - 1)] ?? 'number';
  const head = marker(style, index, numerals);
  const computed = itemScore(item);
  const canBranch = depth + 1 < MAX_DEPTH;

  return (
    <div
      className={`rounded-xl border border-outline-variant bg-surface-container-lowest p-space-sm space-y-space-xs ${
        depth ? 'mr-space-lg' : ''
      }`}
      data-question={depth === 0 ? 'root' : 'branch'}
    >
      {/* الترتيب كما يكتبه المدرّس: العلامة، ثم الدرجة، ثم النصّ. */}
      <div className="flex items-center gap-space-sm">
        <span className="min-w-12 font-label-lg text-label-lg font-bold text-secondary tabular">
          {head}
        </span>

        <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
          الدرجة
          <input
            className={NUM_INPUT}
            inputMode="numeric"
            title="درجة السؤال"
            value={item.score ?? ''}
            placeholder={kids.length ? String(computed) : '—'}
            onFocus={(e) => props.onFocusInput(e.currentTarget)}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, '');
              onPatch(item.id, { score: raw === '' ? undefined : Number(raw) });
            }}
          />
        </label>

        {kids.length > 1 && (
          <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
            أجب عن
            <input
              className={NUM_INPUT}
              inputMode="numeric"
              title="أجب عن ن من فروعه فقط"
              value={item.pick ?? ''}
              placeholder="الكل"
              onFocus={(e) => props.onFocusInput(e.currentTarget)}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, '');
                onPatch(item.id, {
                  pick: raw === '' ? undefined : Number(raw)
                });
              }}
            />
            من فروعه
          </label>
        )}

        <div className="flex-1" />

        <button
          className={ICON_BTN}
          data-act="question-image"
          title="أرفق صورة توضيحية للسؤال"
          type="button"
          onClick={async () => {
            try {
              const path = await window.diwan.files.pickImage('questions');
              if (path) onPatch(item.id, { image: { path } });
            } catch {
              /* أُلغي الاختيار */
            }
          }}
        >
          <span className="material-symbols-outlined text-[18px]">image</span>
        </button>

        {depth === 0 && props.onBank && (
          <button
            className={ICON_BTN}
            data-act="bank-save"
            title="احفظه في بنك الأسئلة — بفروعه ودرجته"
            type="button"
            onClick={() => props.onBank!(item)}
          >
            <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
          </button>
        )}
        <button
          className={ICON_BTN}
          title="ارفع"
          type="button"
          onClick={() => props.onMove(item.id, -1)}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
        </button>
        <button
          className={ICON_BTN}
          title="أنزل"
          type="button"
          onClick={() => props.onMove(item.id, 1)}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
        </button>
        <button
          className={ICON_BTN}
          title="احذف"
          type="button"
          onClick={() => props.onRemove(item.id)}
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>

      <textarea
        className="w-full min-h-[44px] px-space-sm py-1.5 rounded-lg bg-surface-container-low border border-outline-variant font-body-md text-body-md text-on-surface resize-y"
        dir={dir}
        data-question-text={item.id}
        placeholder={depth === 0 ? 'نصّ السؤال' : 'نصّ الفرع'}
        value={textOf(item.inlines)}
        rows={1}
        onFocus={(e) => props.onFocusInput(e.currentTarget)}
        onChange={(e) => onPatch(item.id, { inlines: inlinesOf(e.target.value) })}
      />

      {item.image?.path && (
        <div
          className="flex items-center gap-space-sm p-space-xs rounded-lg bg-surface-container-low border border-outline-variant"
          data-question-image-preview={item.id}
        >
          <img
            src={`diwan://store/${item.image.path}`}
            alt="صورة السؤال"
            className="h-14 w-20 object-contain rounded bg-surface-container-lowest border border-outline-variant shrink-0"
          />
          <div className="flex-1 flex flex-wrap items-center gap-space-sm min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              صورة توضيحية
            </span>
            <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
              العرض:
              <input
                className="w-16 h-7 px-1.5 text-center rounded bg-surface-container-lowest border border-outline-variant font-label-sm text-label-sm tabular"
                type="number"
                min={40}
                max={600}
                placeholder="تلقائي"
                value={item.image.width ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  onPatch(item.id, { image: { ...item.image!, width: val } });
                }}
              />
              <span className="text-[11px]">بكسل</span>
            </label>
          </div>
          <button
            className={ICON_BTN}
            data-act="remove-question-image"
            title="احذف الصورة"
            type="button"
            onClick={() => onPatch(item.id, { image: undefined })}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {answers && (
        <input
          className="w-full h-9 px-space-sm rounded-lg bg-surface-container-low border border-dashed border-outline-variant font-body-sm text-body-sm text-on-surface"
          dir={dir}
          data-answer={item.id}
          placeholder="الإجابة النموذجية — تظهر في ورقة المصحّح وحدها"
          value={textOf(item.answer ?? [])}
          onFocus={(e) => props.onFocusInput(e.currentTarget)}
          onChange={(e) => {
            const text = e.target.value;
            onPatch(item.id, { answer: text ? inlinesOf(text) : undefined });
          }}
        />
      )}

      {kids.length > 0 && (
        <div className="space-y-space-xs pt-space-xs">
          {kids.map((kid, i) => (
            <QuestionNode {...props} key={kid.id} item={kid} index={i} depth={depth + 1} />
          ))}
        </div>
      )}

      {canBranch && (
        <button
          className="h-8 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1 transition-colors"
          title="أضف فرعًا"
          type="button"
          onClick={() => props.onBranch(item.id)}
        >
          <span className="material-symbols-outlined text-[16px]">subdirectory_arrow_left</span>
          <span>أضف فرعًا</span>
        </button>
      )}
    </div>
  );
}
