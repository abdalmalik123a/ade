/**
 * «خاناتٌ مقترحة من الورقة» و«جرّب باسمٍ آخر» — فوق لوح الحقول في مصمّم النماذج (المرحلة ١).
 *
 * ملفّ Word يُفتح كما هو، وفيه فراغاتٌ وأسماءٌ وصياغةٌ تتبع الجنس: تُعرض هنا اقتراحاتٍ،
 * كلٌّ بموضعه وعدده، ويُقبل بضغطة أو كلّها معًا — ولا يتغيّر شيءٌ قبل الضغط. و«جرّب باسمٍ آخر»
 * يملأ الورقة باسم امرأةٍ وقيمٍ تجريبية: فما بقي نصًّا وهو خانة يُرى، ويُعلَّم على الورقة.
 */
import { useMemo, useState } from 'react';
import type { Doc } from '@shared/doc';
import { applyHint, fieldHints, type FieldHint } from '@shared/fieldHints';

const KIND_LABEL: Record<FieldHint['kind'], string> = {
  repeat: 'بقي نصًّا',
  blank: 'فراغ',
  name: 'اسم',
  class: 'صفّ',
  year: 'سنة',
  date: 'تاريخ',
  gender: 'صياغة'
};

const hintId = (h: FieldHint) => `${h.kind}:${h.label}:${h.text}`;

export default function FieldHints({
  doc,
  onApply,
  trying,
  onTry
}: {
  doc: Doc;
  /** الوثيقة بعد قبول اقتراحٍ أو أكثر — يُطبَّق خطوةً واحدة يتراجع عنها Ctrl+Z. */
  onApply: (next: Doc) => void;
  trying: boolean;
  onTry: (on: boolean) => void;
}) {
  const hints = useMemo(() => fieldHints(doc), [doc]);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const shown = hints.filter((h) => !skipped.has(hintId(h)));

  /** يُقبل الاقتراح على الوثيقة كما هي الآن — فالمواضع لا تتقادم بين قبولٍ وقبول. */
  const accept = (list: FieldHint[]) => {
    let next = doc;
    for (const h of list) {
      const fresh = fieldHints(next).find((x) => hintId(x) === hintId(h));
      if (fresh) next = applyHint(next, fresh);
    }
    onApply(next);
  };

  return (
    <div className="flex flex-col gap-space-xs pb-space-sm border-b border-outline-variant/60" data-hints="">
      <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer" title="يملأ الورقة باسم امرأةٍ وقيمٍ تجريبية — فيظهر ما بقي نصًّا وهو خانة">
        <input checked={trying} className="w-4 h-4 accent-secondary" data-act="try-other-name" type="checkbox" onChange={(e) => onTry(e.target.checked)} />
        جرّب باسمٍ آخر
      </label>
      {trying && (
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          الورقة باسم «زينب» — وما عُلِّم بالأحمر بقي مذكّرًا أو نصًّا مكتوبًا.
        </span>
      )}

      {shown.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-space-xs pt-space-xs">
            <span className="font-label-md text-label-md text-on-surface font-semibold">خاناتٌ مقترحة من الورقة ({shown.length})</span>
            {shown.length > 1 && (
              <button
                className="h-7 px-2 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm"
                data-act="hints-all"
                type="button"
                onClick={() => accept(shown)}
              >
                اقبلها كلّها
              </button>
            )}
          </div>
          {shown.map((h) => (
            <div key={hintId(h)} className="p-space-xs rounded-lg bg-surface-container-low flex items-center gap-space-xs" data-hint={h.kind}>
              <span className="shrink-0 px-1.5 rounded bg-secondary-fixed text-secondary font-label-sm text-label-sm">{KIND_LABEL[h.kind]}</span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-label-md text-label-md text-on-surface truncate">{h.label}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate" dir="auto">
                  {h.kind === 'blank' ? 'فراغٌ منقوط' : `«${h.text}»`}
                  {h.count > 1 ? ` · ${h.count} مواضع` : ''}
                </span>
              </span>
              <button
                className="h-7 px-2 rounded-lg text-secondary font-label-sm text-label-sm font-bold hover:bg-surface-container-high"
                data-act="hint-apply"
                title="اجعله خانةً في كلّ مواضعه"
                type="button"
                onClick={() => accept([h])}
              >
                خانة
              </button>
              <button
                className="w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
                data-act="hint-skip"
                title="تجاهله"
                type="button"
                onClick={() => setSkipped((s) => new Set(s).add(hintId(h)))}
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
