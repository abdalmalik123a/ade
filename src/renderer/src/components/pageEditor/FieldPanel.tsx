/**
 * لوحة الحقول بجانب الورقة في مصمّم النماذج: الحقول وترتيبها وخصائص كلٍّ منها (تقسيم أدوات المحرّر بعد ١٫٧٫٠) — منقولةٌ من
 * `editorKit` كما هي.
 */
import { type Doc, type DocField, unfield } from '@shared/doc';
import type { ReactNode } from 'react';
import { reorderFields, patchField } from '@shared/docEdit';
import { type Calendar, CALENDAR_LABEL } from '@shared/dates';

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

export function FieldRow({
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
    <div className="p-space-sm rounded-card bg-surface-container-low flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          className="input-field flex-1 min-w-0 h-8 px-2 text-on-surface font-label-md text-label-md"
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
        {/* وحقل الصورة (S38) كتلةٌ لا تُدرج في السطر — وإلا طُبع مساره نصًّا. */}
        {field.type !== 'image' && (
          <button
            className="w-6 h-6 rounded text-secondary hover:bg-surface-container-high"
            title="أدرجه حيث وقف المؤشّر في الورقة"
            type="button"
            onClick={() => onInsert(field.key)}
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
          </button>
        )}
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
