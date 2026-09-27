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
import type { ArchiveCheck, AuditEntry } from '@shared/api';
import { AUDIT_ENTITIES, auditLabel } from '@shared/auditLabels';
import { errorText } from '../lib/errors';

const nf = new Intl.NumberFormat('en-US');

export default function AuditScreen({ onOpenSerial }: { onOpenSerial?: (serial: string) => void }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [entity, setEntity] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [check, setCheck] = useState<ArchiveCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await window.diwan.audit.list({ entity, query, limit: 500 }));
    } catch (e) {
      setError(errorText(e, 'تعذّرت قراءة سجلّ التدقيق'));
    }
  }, [entity, query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 200 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  async function verify() {
    setChecking(true);
    setError(null);
    try {
      setCheck(await window.diwan.documents.verify());
    } catch (e) {
      setError(errorText(e, 'تعذّر فحص الأرشيف'));
    } finally {
      setChecking(false);
    }
  }

  const sound = check && check.problems.length === 0;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-audit="">
      <div className="p-space-lg flex flex-col gap-space-md max-w-6xl">
        <header>
          <h1 className="font-headline-md text-headline-md text-on-surface font-bold">سجلّ التدقيق وسلامة الأرشيف</h1>
          <p className="font-label-md text-label-md text-on-surface-variant">
            من أصدر ومن أعاد الطباعة ومن أبطل ومتى — وأنّ ما في الأرشيف هو ما صدر
          </p>
        </header>

        {error && (
          <div className="p-space-sm rounded-lg bg-error-container text-on-error-container font-label-md text-label-md">{error}</div>
        )}

        {/* سلامة الأرشيف */}
        <section className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm flex flex-col gap-space-sm" data-integrity="">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex flex-col">
              <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
                سلامة الأرشيف
              </h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                تُعاد بصمة كل كتابٍ من متنه، وسلسلة البصمات من أوّلها، وتُعدّ أرقام كل سنة
              </span>
            </div>
            <button
              className="h-10 px-space-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-space-xs disabled:opacity-50"
              data-act="verify-archive"
              type="button"
              disabled={checking}
              onClick={() => void verify()}
            >
              <span className="material-symbols-outlined text-[18px]">fact_check</span>
              {checking ? 'يفحص...' : 'تحقّق من سلامة الأرشيف'}
            </button>
          </div>

          {check && (
            <div
              className={`p-space-sm rounded-lg flex flex-col gap-space-xs font-label-md text-label-md ${
                sound ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-error-container text-on-error-container'
              }`}
              data-check-result={sound ? 'ok' : 'problems'}
            >
              <span className="font-semibold">
                {sound
                  ? `الأرشيف سليم: فُحص ${nf.format(check.checked)} كتابًا — كلٌّ ببصمة متنه، والسلسلة متّصلة، ولا رقم غائب.`
                  : `فُحص ${nf.format(check.checked)} كتابًا، ووُجد ${nf.format(check.problems.length)} مما يُسأل عنه:`}
              </span>
              {!sound && (
                <ul className="list-disc pr-5 flex flex-col gap-0.5">
                  {check.problems.map((p, i) => (
                    <li key={i}>
                      <button className="font-mono underline" type="button" onClick={() => p.id !== null && onOpenSerial?.(p.serial)}>
                        {p.serial}
                      </button>{' '}
                      — {p.text}
                    </li>
                  ))}
                </ul>
              )}
              {check.head && (
                <div className="flex flex-wrap items-center gap-space-xs font-label-sm text-label-sm">
                  <span>بصمة آخر السلسلة — اكتبها خارج الجهاز، فتثبت بها أرشيفك حتى اليوم:</span>
                  <span className="font-mono break-all" data-chain-head="">
                    {check.head}
                  </span>
                  <button
                    className="underline"
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(check.head ?? '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? 'نُسخت' : 'انسخها'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* سجلّ التدقيق */}
        <section className="rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden" data-audit-log="">
          <div className="p-space-md flex flex-wrap items-center gap-space-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex-1">سجلّ التدقيق</h2>
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
              {[{ value: null, label: 'الكل' }, ...AUDIT_ENTITIES].map((o) => (
                <button
                  key={o.label}
                  className={`h-8 px-space-sm rounded font-label-sm text-label-sm ${
                    entity === o.value ? 'bg-primary-container text-on-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'
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
              className="w-64 h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
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
                      <td className="p-space-sm font-mono text-label-sm text-on-surface-variant whitespace-nowrap">{e.at.slice(0, 16)}</td>
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
        </section>
      </div>
    </main>
  );
}
