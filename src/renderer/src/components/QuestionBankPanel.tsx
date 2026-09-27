/**
 * بنك الأسئلة في شاشة الأسئلة — يُفتح جانبًا، ويعرض بنك المادة والصفّ أوّلًا.
 *
 * كلّ سؤالٍ سطرٌ بنصّه ودرجته وعدد مرّات استعماله، و«أدرج» تضعه في آخر الورقة
 * بمعرّفاتٍ جديدة — فلا تشترك ورقتان في سؤالٍ واحد يُعدَّل في إحداهما فيتغيّر
 * في الأخرى.
 */
import { useEffect, useState } from 'react';
import type { BankQuestion } from '@shared/api';

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

export default function QuestionBankPanel({
  subject,
  grade,
  onInsert,
  onClose,
  refreshKey
}: {
  /** مادةُ الورقة وصفّها — مرشِّحان يبدأ بهما البنك ويُرفعان بضغطة. */
  subject: string;
  grade: string;
  onInsert: (q: BankQuestion) => void;
  onClose: () => void;
  /** يتغيّر حين يُحفظ سؤالٌ جديد فيُعاد التحميل. */
  refreshKey: number;
}) {
  const [query, setQuery] = useState('');
  const [bySubject, setBySubject] = useState(Boolean(subject));
  const [byGrade, setByGrade] = useState(Boolean(grade));
  const [list, setList] = useState<BankQuestion[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void window.diwan.bank
      .list({ query, subject: bySubject ? subject : null, grade: byGrade ? grade : null })
      .then((rows) => alive && setList(rows));
    return () => {
      alive = false;
    };
  }, [query, bySubject, byGrade, subject, grade, refreshKey, tick]);

  const chip = (on: boolean, label: string, toggle: () => void, disabled: boolean) => (
    <button
      className={`h-7 px-2 rounded-full font-label-sm text-label-sm ${on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'} disabled:opacity-40`}
      disabled={disabled}
      type="button"
      onClick={toggle}
    >
      {label}
    </button>
  );

  return (
    <aside className="rounded-xl bg-surface-container-lowest p-space-sm flex flex-col gap-space-xs" data-bank="">
      <div className="flex items-center justify-between">
        <span className="font-label-lg text-label-lg text-on-surface font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-[20px] text-secondary">inventory_2</span>
          بنك الأسئلة
        </span>
        <button className="w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center" title="إغلاق" type="button" onClick={onClose}>
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <input
        className="h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface"
        placeholder="ابحث في نصوص الأسئلة…"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        {chip(bySubject, subject ? `مادة: ${subject}` : 'بلا مادة', () => setBySubject((v) => !v), !subject)}
        {chip(byGrade, grade ? `صف: ${grade}` : 'بلا صف', () => setByGrade((v) => !v), !grade)}
      </div>
      {list.length === 0 ? (
        <span className="py-space-md text-center font-label-md text-label-md text-on-surface-variant">
          {query ? 'لا سؤال بهذا النصّ' : 'البنك فارغ لهذه المادة — احفظ فيه سؤالًا بزرّ «البنك» عليه'}
        </span>
      ) : (
        <ul className="max-h-[420px] overflow-y-auto flex flex-col gap-1">
          {list.map((q) => (
            <li key={q.id} className="p-space-xs rounded-lg bg-surface-container-low flex flex-col gap-1" data-bank-item={q.id}>
              <span className="font-body-sm text-body-sm text-on-surface whitespace-pre-line line-clamp-4">{q.text}</span>
              <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
                {q.score !== null && <span>{toIndic(q.score)} درجة</span>}
                {q.useCount > 0 && <span>· أُدرج {toIndic(q.useCount)} مرّة</span>}
                <span className="flex-1" />
                <button
                  className="h-7 px-2 rounded-md hover:text-error"
                  title="احذفه من البنك"
                  type="button"
                  onClick={() => void window.diwan.bank.delete(q.id).then(() => setTick((t) => t + 1))}
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
                <button
                  className="h-7 px-3 rounded-md bg-primary text-on-primary font-semibold"
                  data-act="bank-insert"
                  type="button"
                  onClick={() => onInsert(q)}
                >
                  أدرج
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
