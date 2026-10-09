/**
 * أدوات المحرّر المشتركة — الشريط وقائمة الإدراج ولوحة الحقول وخصائصه.
 *
 * كانت في ملفّ المحرّر الأوّل (`DocEditor.tsx`) ويستوردها المحرّر الجديد منه، فلم يُحذف الأوّل
 * إلا بعد أن نُقلت إلى هنا (الموجة ١، المجموعة ج). والمحرّر الآن واحد: `PageEditor.tsx`.
 */
import { useEffect, useState, type MutableRefObject, type ReactNode } from 'react';
import { unfield, type Align, type Doc, type DocField } from '@shared/doc';
import { CALENDAR_LABEL, type Calendar } from '@shared/dates';
import { ADDRESSING_LABEL, rankByAddressing } from '@shared/addressing';
import type { Addressing, Seal } from '@shared/api';
import { patchField, reorderFields } from '@shared/docEdit';

export type EditorProps = {
  doc: Doc;
  onChange: (doc: Doc) => void;
  /** عبارات المكتب — تُدرج من قائمة `/`، وكليشات اتجاه الكتاب أولًا (`doc.meta.addressing`). */
  clips?: MenuClip[];
  /** يُرسم أعلى الورقة قبل الكتل — الترويسة عادةً — فيكتب المكتب على ورقةٍ حقيقية. */
  header?: ReactNode;
  /**
   * قيم الحقول — في محرّر الكتب: الحقل على الورقة يُظهر قيمته حيث كُتب، لا اسمه.
   * وفي مصمّم النماذج لا قيم، فيُظهر اسمه بين قوسين.
   */
  values?: Record<string, string>;
  /**
   * اللوح بجانب الورقة: `undefined` لوحُ تعريف الحقول (المصمّم)، و`null` لا لوح،
   * وغيرهما يُرسم مكانه (لوح القيم في المحرّر).
   */
  aside?: ReactNode | null;
  /** يُعطى الشاشةَ ما تفعله في موضع المؤشّر: حقلٌ أو نصٌّ يُدرج حيث وقف. */
  apiRef?: MutableRefObject<EditorApi | null>;
};

export type EditorApi = {
  /** حقلٌ موجود في الوثيقة يُدرج حيث وقف المؤشّر. */
  insertField: (key: string) => void;
  /** نصٌّ (رمزٌ أو عبارة) يُدرج حيث وقف المؤشّر. */
  insertText: (text: string) => void;
  /** حقلٌ جديد (من كتالوج المعاملات) يُعرَّف ويُدرج معًا حيث وقف المؤشّر — أو آخر الورقة. */
  insertNewField: (field: DocField) => void;
};

/**
 * حجم المتن حين لا يُذكر حجم — وهو حجم الورقة في المعاينة والإصدار (بالبكسل؛ ١٠٫٥ نقطة). وقائمة الأحجام
 * بالنقطة كما في Word في `shared/fontSize.ts` (د٥).
 */
export const BASE_SIZE = 14;
/** المسافة البادئة للكتاب الرسمي: ٢ سم في أوّل سطر المتن (الأساس §٤). */
export const OFFICIAL_INDENT_MM = 20;

/** زرّ أداة: لا يسرق التحديد من الورقة، وإلا ضاع ما ظلّله الكاتب قبل أن يُنسَّق. */
export function Tool({
  act,
  icon,
  title,
  active,
  disabled,
  onRun,
  children
}: {
  act: string;
  icon: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onRun: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      className={`h-8 min-w-[2rem] px-1.5 rounded-lg flex items-center justify-center gap-0.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'bg-secondary-fixed text-secondary' : 'text-on-surface hover:bg-surface-container-high'
      }`}
      data-act={act}
      disabled={disabled}
      title={title}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
    >
      <span className="material-symbols-outlined text-[19px]">{icon}</span>
      {children}
    </button>
  );
}

export function ToolSep() {
  return <span className="w-px h-5 bg-outline-variant/60 mx-1" />;
}

type Preset = 'copies' | 'columns' | 'answer' | 'spacer' | 'pageBreak' | 'rule';

/**
 * قائمة الإدراج: ما يحتاجه الكتاب الرسمي بضغطة — بلا أشرطة أدوات.
 *
 * ولا توقيع فيها ولا ختم: المكتب يستنسخ ويطبع، والجهة توقّع وتختم بيدها بعد
 * الطباعة. فالصور شعاراتٌ تُطبع مع الورقة، لا أختامٌ تُزوَّر عليها.
 */
export type MenuClip = { id: number; title: string; body: string; direction?: Addressing | null };

export function InsertMenu({
  addressing,
  clips,
  onPick,
  onTable,
  onImage,
  onClip,
  onClose
}: {
  addressing: Addressing | null;
  clips: MenuClip[];
  onPick: (what: Preset) => void;
  onTable: (rows: number, cols: number) => void;
  onImage: (src: string, align: Align) => void;
  onClip: (clip: MenuClip) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<'main' | 'table' | 'image'>('main');
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState({ r: 3, c: 3 });
  const [seals, setSeals] = useState<Seal[]>([]);
  // كليشات اتجاه الكتاب أولًا — «يرجى» لجهةٍ أعلى و«تنسب» لأدنى — ولا يُخفى غيرها.
  const shown = rankByAddressing(
    clips.map((c) => ({ ...c, direction: c.direction ?? null })),
    addressing
  ).filter((c) => !query.trim() || c.title.includes(query.trim()) || c.body.includes(query.trim()));

  // الشعارات وحدها: الختم والتوقيع يوضعان باليد على الورقة المطبوعة.
  useEffect(() => {
    if (view === 'image')
      void window.diwan.seals.list().then((all) => setSeals(all.filter((s) => s.kind === 'شعار' && s.imagePath)));
  }, [view]);

  async function fromDevice() {
    const src = await window.diwan.files.pickImage('images');
    if (src) onImage(src, 'center');
  }

  const back = (
    <button
      className="self-start h-8 px-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1"
      type="button"
      onClick={() => setView('main')}
    >
      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      رجوع
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-scrim/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface-container-lowest shadow-2xl p-space-sm flex flex-col gap-space-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'main' && (
          <>
            <input
              autoFocus
              className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="ابحث عن كليشة، أو اختر ما تُدرج"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-1">
              <MenuItem act="ins-table" icon="table" label="جدول" onClick={() => setView('table')} />
              <MenuItem act="ins-image" icon="image" label="صورة أو شعار" onClick={() => setView('image')} />
              <MenuItem act="ins-copies" icon="forward_to_inbox" label="نسخة منه إلى" onClick={() => onPick('copies')} />
              <MenuItem act="ins-columns" icon="view_column" label="عمودان" onClick={() => onPick('columns')} />
              <MenuItem act="ins-answer" icon="edit_note" label="مساحة كتابة" onClick={() => onPick('answer')} />
              <MenuItem act="ins-spacer" icon="height" label="مسافة" onClick={() => onPick('spacer')} />
              <MenuItem act="ins-rule" icon="horizontal_rule" label="خطّ فاصل" onClick={() => onPick('rule')} />
              <MenuItem act="ins-break" icon="insert_page_break" label="فاصل صفحة" onClick={() => onPick('pageBreak')} />
            </div>

            {clips.length > 0 && (
              <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pt-space-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  كليشات المكتب{addressing ? ` — ما يُكتب ${ADDRESSING_LABEL[addressing]} أولًا` : ''}
                </span>
                {shown.length === 0 ? (
                  <span className="font-label-sm text-label-sm text-on-surface-variant py-space-sm text-center">
                    لا كليشة بهذا الاسم
                  </span>
                ) : (
                  shown.map((c) => (
                    <button
                      key={c.id}
                      className="text-right p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high flex flex-col gap-0.5"
                      data-clip-direction={c.direction ?? ''}
                      type="button"
                      onClick={() => onClip(c)}
                    >
                      <span className="font-label-md text-label-md text-on-surface flex items-center gap-1">
                        {c.title}
                        {c.direction && (
                          <span
                            className={`font-label-sm text-label-sm px-1.5 rounded-full ${
                              c.direction === addressing ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-high text-on-surface-variant'
                            }`}
                          >
                            {ADDRESSING_LABEL[c.direction]}
                          </span>
                        )}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                        {c.body.split('\n')[0]}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {view === 'table' && (
          <>
            {back}
            <span className="font-label-md text-label-md text-on-surface text-center tabular">
              جدول {hover.r} صفوف × {hover.c} أعمدة
            </span>
            {/* تُختار المقاسات بالمرور كما في Word — ضغطةٌ واحدة لا خانتا أرقام. */}
            <div className="mx-auto grid grid-cols-8 gap-1" dir="rtl">
              {Array.from({ length: 8 }, (_, r) =>
                Array.from({ length: 8 }, (_, c) => (
                  <button
                    key={`${r}-${c}`}
                    aria-label={`${r + 1} × ${c + 1}`}
                    className={`w-6 h-6 rounded border transition-colors ${
                      r < hover.r && c < hover.c
                        ? 'bg-secondary-fixed border-secondary'
                        : 'bg-surface-container-low border-outline-variant'
                    }`}
                    data-grid={`${r + 1}-${c + 1}`}
                    type="button"
                    onClick={() => onTable(r + 1, c + 1)}
                    onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })}
                  />
                ))
              )}
            </div>
          </>
        )}

        {view === 'image' && (
          <>
            {back}
            {seals.length === 0 ? (
              <span className="font-label-sm text-label-sm text-on-surface-variant text-center py-space-sm">
                لا شعار محفوظ — ارفعه من «الترويسات والشعارات»، أو أدرج صورةً من الجهاز.
              </span>
            ) : (
              <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto">
                {seals.map((s) => (
                    <button
                      key={s.id}
                      className="p-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high flex flex-col items-center gap-1"
                      type="button"
                      onClick={() => onImage(s.imagePath!, 'center')}
                    >
                      <img alt="" className="w-16 h-16 object-contain" src={`diwan://store/${s.imagePath}`} />
                      <span className="font-label-sm text-label-sm text-on-surface truncate w-full text-center">
                        {s.name}
                      </span>
                    </button>
                  ))}
              </div>
            )}
            <button
              className="h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1"
              type="button"
              onClick={() => void fromDevice()}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">image</span>
              صورة من الجهاز…
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  act,
  icon,
  label,
  wide,
  onClick
}: {
  act: string;
  icon: string;
  label: string;
  /** يملأ الصفّ — فلا يبقى زرٌّ وحده في نصفه. */
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-10 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-2 ${wide ? 'col-span-2' : ''}`}
      data-act={act}
      type="button"
      onClick={onClick}
    >
      <span className="material-symbols-outlined text-[18px] text-secondary">{icon}</span>
      {label}
    </button>
  );
}

/** لوحة الحقول: ترتيبها هو ترتيب شاشة الإدخال في الشبّاك. */
export function FieldPanel({
  doc,
  onChange,
  onInsert,
  top
}: {
  doc: Doc;
  onChange: (doc: Doc) => void;
  onInsert: (key: string) => void;
  /** ما يُعرض فوق الحقول — الخانات المقترحة في المحرّر الجديد. */
  top?: ReactNode;
}) {
  const move = (key: string, dir: -1 | 1) => {
    const keys = doc.fields.map((f) => f.key);
    const at = keys.indexOf(key);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= keys.length) return;
    [keys[at], keys[to]] = [keys[to]!, keys[at]!];
    onChange(reorderFields(doc, keys));
  };

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-r border-outline-variant p-space-sm flex flex-col gap-space-xs">
      {top}
      <span className="font-label-md text-label-md text-on-surface font-semibold">
        المتغيّرات على الورقة ({doc.fields.length})
      </span>
      <span className="font-label-sm text-label-sm text-on-surface-variant">
        أضفها بتظليل العبارة في الورقة ثم الضغط على F4.
      </span>

      {doc.fields.length === 0 ? (
        <span className="py-space-md text-center font-label-sm text-label-sm text-on-surface-variant">
          ظلّل كلمةً واضغط F4 لتصير حقلًا
        </span>
      ) : (
        doc.fields.map((f) => <FieldRow key={f.key} field={f} doc={doc} onChange={onChange} onInsert={onInsert} onMove={move} />)
      )}
    </div>
  );
}

function FieldRow({
  field,
  doc,
  onChange,
  onInsert,
  onMove
}: {
  field: DocField;
  doc: Doc;
  onChange: (doc: Doc) => void;
  onInsert: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
}) {
  return (
    <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          className="flex-1 min-w-0 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
          type="text"
          value={field.label}
          onChange={(e) => onChange(patchField(doc, field.key, { label: e.target.value }))}
        />
        <button
          className="w-6 h-6 rounded text-on-surface-variant hover:bg-surface-container-high"
          title="أعلى"
          type="button"
          onClick={() => onMove(field.key, -1)}
        >
          <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
        </button>
        <button
          className="w-6 h-6 rounded text-on-surface-variant hover:bg-surface-container-high"
          title="أسفل"
          type="button"
          onClick={() => onMove(field.key, 1)}
        >
          <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
        </button>
      </div>
      <div className="flex items-center gap-space-xs">
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          <input
            className="w-3.5 h-3.5 accent-secondary"
            checked={field.required}
            type="checkbox"
            onChange={(e) => onChange(patchField(doc, field.key, { required: e.target.checked }))}
          />
          إلزامي
        </label>
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          عرضه
          <input
            className="w-12 h-7 px-1 rounded bg-surface-container-lowest text-on-surface text-center"
            min={3}
            type="number"
            value={field.width}
            onChange={(e) =>
              onChange(patchField(doc, field.key, { width: Math.max(3, Number(e.target.value) || 6) }))
            }
          />
        </label>
        <span className="flex-1" />
        <button
          className="w-6 h-6 rounded text-secondary hover:bg-surface-container-high"
          title="أدرجه حيث وقف المؤشّر في الورقة"
          type="button"
          onClick={() => onInsert(field.key)}
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
        </button>
        <button
          className="w-6 h-6 rounded text-error hover:bg-error-container"
          title="ليس حقلًا — أعِده نقاطًا"
          type="button"
          onClick={() => onChange(unfield(doc, field.key))}
        >
          <span className="material-symbols-outlined text-[14px]">backspace</span>
        </button>
      </div>
      {/* النوع: التاريخ بتقويمه يُكتب «اليوم» أو من التقويم في الشبّاك والمحرّر. */}
      <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
        نوعه
        <select
          className="flex-1 h-7 px-1 rounded bg-surface-container-lowest text-on-surface cursor-pointer"
          data-field-kind={field.key}
          value={field.type === 'date' ? `date:${field.calendar ?? 'gregorian'}` : field.type === 'text' ? 'text' : 'other'}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'other') return;
            onChange(
              patchField(doc, field.key, v.startsWith('date:') ? { type: 'date', calendar: v.slice(5) as Calendar } : { type: 'text', calendar: undefined })
            );
          }}
        >
          <option value="text">نصّ</option>
          {(Object.keys(CALENDAR_LABEL) as Calendar[]).map((c) => (
            <option key={c} value={`date:${c}`}>
              تاريخ {CALENDAR_LABEL[c]}
            </option>
          ))}
          {field.type !== 'text' && field.type !== 'date' && (
            <option disabled value="other">
              كما هو
            </option>
          )}
        </select>
      </label>
    </div>
  );
}
