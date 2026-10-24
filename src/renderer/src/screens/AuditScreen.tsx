/**
 * سجلّ التدقيق وسلامة الأرشيف — data-path="audit-log-integrity"
 *
 * **سجلّ التدقيق** (د٤): من أصدر، ومن أعاد الطباعة، ومن أبطل، ومتى — كان يُكتب منذ
 * اليوم الأول ولا يُقرأ في أي شاشة.
 *
 * **وسلامة الأرشيف** (د٥): كل كتابٍ تُعاد بصمته من متنه، والسلسلة من أوّلها، وأرقام
 * كل سنةٍ تُعدّ. وبصمة آخر السلسلة تُكتب خارج الجهاز (ورقة، هاتف): من يحتفظ بها يثبت
 * بها أن أرشيفه كلّه لم يُمسّ حتى ذلك اليوم.
 */
import { useCallback, useEffect, useState } from 'react';
import { localStamp } from '@shared/dates';
import { LIST_LIMITS, limitNote } from '@shared/limits';
import type { AuditEntry } from '@shared/api';
import { AUDIT_ENTITIES, auditLabel } from '@shared/auditLabels';
import { errorText } from '../lib/errors';

export default function AuditScreen({ onOpenSerial }: { onOpenSerial?: (serial: string) => void }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [entity, setEntity] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await window.diwan.audit.list({ entity, query, limit: LIST_LIMITS.audit }));
    } catch (e) {
      setError(errorText(e, 'تعذّرت قراءة سجلّ التدقيق'));
    }
  }, [entity, query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 200 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  /** السجلّ بلغ حدّه: يُقال ذلك تحته لا يُظنّ أنه كلّ ما جرى. */
  const capNote = limitNote(entries.length, LIST_LIMITS.audit, 'حدث', 'الأحدث أوّلًا؛ اختر نوعًا أو ابحث برقم الصادر لترى غيرها');

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-audit="">
      <div className="p-space-lg flex flex-col gap-space-md max-w-6xl">
        <header>
          <h1 className="font-headline-md text-headline-md text-on-surface font-bold">الأحداث</h1>
          <p className="font-label-md text-label-md text-on-surface-variant">
            من طبع ومن أعاد الطبع ومن أبطل ومتى — وفحص سلامة السجلّ في «الإعدادات ← البيانات»
          </p>
        </header>

        {error && (
          <div className="p-space-sm rounded-card bg-error-container text-on-error-container font-label-md text-label-md">{error}</div>
        )}

        {/* سجلّ التدقيق */}
        <section className="surface-panel overflow-hidden" data-audit-log="">
          <div className="p-space-md flex flex-wrap items-center gap-space-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex-1">سجلّ التدقيق</h2>
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-card">
              {[{ value: null, label: 'الكل' }, ...AUDIT_ENTITIES].map((o) => (
                <button
                  key={o.label}
                  className={`h-8 px-space-sm rounded font-label-sm text-label-sm ${
                    entity === o.value ? 'bg-primary-fixed text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                  data-entity={o.value ?? 'all'}
                  type="button"
                  onClick={() => setEntity(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <input
              className="input-field w-64 h-9 px-3 text-on-surface font-label-md text-label-md"
              data-audit-search=""
              placeholder="رقم صادر، أو اسم، أو مشغّل…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-right border-collapse font-body-sm text-body-sm">
              <thead className="sticky top-0">
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                  <th className="p-space-sm">الوقت</th>
                  <th className="p-space-sm">الكتاب</th>
                  <th className="p-space-sm">ما جرى</th>
                  <th className="p-space-sm">المشغّل</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-space-lg text-center text-on-surface-variant">
                      {query || entity ? 'لا قيد يطابق' : 'لا قيود بعد — كل إصدارٍ وإعادة طباعةٍ وإبطالٍ يُقيَّد هنا'}
                    </td>
                  </tr>
                ) : (
                  entries.map((e, i) => (
                    <tr key={e.id} className={i % 2 ? 'bg-surface-container-low/40' : ''} data-audit-row={`${e.entity}/${e.action}`}>
                      <td className="p-space-sm font-mono text-label-sm text-on-surface-variant whitespace-nowrap">{localStamp(e.at)}</td>
                      <td className="p-space-sm">
                        {e.serial ? (
                          <button className="font-mono text-secondary font-semibold hover:underline" type="button" onClick={() => onOpenSerial?.(e.serial!)}>
                            {e.serial}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-space-sm text-on-surface">{auditLabel(e)}</td>
                      <td className="p-space-sm text-on-surface-variant">{e.operator ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {capNote && (
            <p className="p-space-sm font-label-sm text-label-sm text-on-surface-variant" data-list-limit="">
              {capNote}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
