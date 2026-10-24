/**
 * «استورد من Excel» — قائمة زبائن المكتب ملفّاتٍ في السجلّ (الموجة ٢، «كلفة الانتقال»).
 *
 * الملف يُقرأ، وكلّ عمودٍ يُربط بخانته من عنوانه (`shared/citizenImport.ts`) ويُصحَّح ما أخطأ أو يُترك،
 * ثم تُعرض الخطّة قبل الاستيراد: كم يُضاف، وكم ملفٍّ موجودٍ يُكمل فارغه، وما يُترك ولماذا. والربط
 * يُتذكّر، فقائمة الشهر القادم بالعناوين نفسها تُربط وحدها.
 */
import { useEffect, useMemo, useState } from 'react';
import type { CitizenImportReport } from '@shared/api';
import { IMPORT_TARGETS, importRows, mapOf, readTable, withTarget, type ImportTable, type ImportTarget } from '@shared/citizenImport';
import { errorText } from '../lib/errors';
import { toIndic, count } from '@shared/arabic';
import { useEscape } from '../kit/useEscape';

const GROUPS = [...new Set(IMPORT_TARGETS.map((t) => t.group))];

/** ما خرج — جملةٌ واحدة للشريط بعد الاستيراد. */
function doneText(r: CitizenImportReport): string {
  const parts = [`أُضيف ${toIndic(r.added)}`, r.completed ? `وأُكمل من الموجود ${count(r.completed, 'ملف')}` : ''];
  const left = r.similar + r.noName;
  return `${parts.filter(Boolean).join('، ')}${left ? `، وتُرك ${toIndic(left)}` : ''}`;
}

export default function CitizenImportDialog({
  categories,
  onClose,
  onDone
}: {
  categories: string[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  useEscape(onClose);
  const [file, setFile] = useState<string | null>(null);
  const [table, setTable] = useState<ImportTable | null>(null);
  const [category, setCategory] = useState('');
  const [addSimilar, setAddSimilar] = useState(false);
  const [plan, setPlan] = useState<CitizenImportReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (table ? importRows(table) : []), [table]);
  const hasName = Boolean(table?.columns.some((c) => c.target === 'fullName'));
  const opts = useMemo(() => ({ category: category.trim() || null, addSimilar, fileName: file }), [category, addSimilar, file]);

  // الخطّة تُحسب من جديد مع كلّ ربطٍ أو خيار — بلا كتابة.
  useEffect(() => {
    if (!table || !hasName) {
      setPlan(null);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      window.diwan.citizens
        .importPlan(rows, opts)
        .then((p) => {
          if (!live) return;
          setPlan(p);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!live) return;
          setPlan(null);
          setError(errorText(e, 'تعذّرت قراءة الملف'));
        });
    }, 150);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [table, rows, hasName, opts]);

  async function pick() {
    setError(null);
    try {
      const sheet = await window.diwan.files.readSheet();
      if (!sheet) return;
      if (!sheet.text.trim()) {
        setError(`«${sheet.name}» فارغ — لا صفوف فيه`);
        return;
      }
      const saved = await window.diwan.citizens.importMap();
      setFile(sheet.name);
      setTable(readTable(sheet.text, saved));
    } catch (e) {
      setError(errorText(e, 'تعذّرت قراءة الملف'));
    }
  }

  async function run() {
    if (!table) return;
    setBusy('يُستورد…');
    setError(null);
    try {
      const report = await window.diwan.citizens.import(rows, opts);
      await window.diwan.citizens.setImportMap(mapOf(table));
      onDone(doneText(report));
    } catch (e) {
      setError(errorText(e, 'تعذّر الاستيراد'));
    } finally {
      setBusy(null);
    }
  }

  const planRows: [string, number, string][] = plan
    ? [
        ['يُضاف جديدًا', plan.added, 'added'],
        ['موجودٌ يُكمل فارغه — ولا يُكتب فوق ما فيه', plan.completed, 'completed'],
        ['موجودٌ لا جديد فيه', plan.unchanged, 'unchanged'],
        ['مكرّرٌ في الملف نفسه — دُمج في أوّله', plan.repeated, 'repeated'],
        ['بلا اسم — يُترك', plan.noName, 'no-name']
      ]
    : [];

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50" data-citizen-import="" onClick={onClose}>
      <div className="w-[760px] max-h-[86vh] surface-panel p-space-md flex flex-col gap-space-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-headline-sm text-headline-sm">استيراد الزبائن من Excel</h2>
        {!table ? (
          <div className="flex flex-col items-start gap-space-sm">
            <p className="font-label-md text-label-md text-on-surface-variant">
              قائمة زبائن المكتب ملفّاتٍ في السجلّ: كلّ عمودٍ يُربط بخانته من عنوانه («الاسم»، «اسم الأب»، «رقم الهوية»، «الموبايل»…)،
              وتُرى الخطّة قبل الاستيراد. ومن له ملفٌّ يُكمل فارغه ولا يتكرّر.
            </p>
            <button
              className="h-10 px-space-lg btn-act font-label-md text-label-md font-semibold"
              data-act="import-pick"
              type="button"
              onClick={() => void pick()}
            >
              اختر ملف Excel أو CSV
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-space-sm font-label-md text-label-md text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span className="text-on-surface font-semibold" data-import-file="">
                {file}
              </span>
              <span>— الصفوف: {toIndic(table.rows.length)}</span>
              <button className="ms-auto h-8 px-space-sm rounded-btn hover:bg-surface-container-high" type="button" onClick={() => void pick()}>
                ملفٌّ آخر
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto rounded-card border border-outline-variant">
              <table className="w-full text-right font-label-md text-label-md">
                <thead className="sticky top-0 bg-surface-container-low">
                  <tr>
                    <th className="p-space-xs font-semibold">العمود في الملف</th>
                    <th className="p-space-xs font-semibold">أمثلةٌ منه</th>
                    <th className="p-space-xs font-semibold w-[15rem]">يُحفظ في</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((col, i) => (
                    <tr key={i} className={`border-t border-outline-variant/60 ${col.target ? '' : 'text-on-surface-variant'}`} data-import-col={i}>
                      <td className="p-space-xs font-semibold">{col.header}</td>
                      <td className="p-space-xs truncate max-w-[16rem]">{col.samples.join('، ') || '—'}</td>
                      <td className="p-space-xs">
                        <select
                          aria-label={`العمود «${col.header}»`}
                          className="h-9 w-full px-1 rounded-field bg-surface-container-low border border-outline-variant"
                          data-import-target={i}
                          value={col.target ?? ''}
                          onChange={(e) => setTable(withTarget(table, i, (e.target.value || null) as ImportTarget | null))}
                        >
                          <option value="">— اتركه —</option>
                          {GROUPS.map((g) => (
                            <optgroup key={g} label={g}>
                              {IMPORT_TARGETS.filter((t) => t.group === g).map((t) => (
                                <option key={t.key} value={t.key}>
                                  {t.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!hasName && (
              <p className="font-label-md text-label-md text-error" data-import-need-name="">
                اربط عمود الاسم (أو أعمدته: الاسم واسم الأب واسم الجد) — بلا اسمٍ لا يُستورد زبون.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-space-sm font-label-md text-label-md">
              <label className="flex items-center gap-1">
                تصنيفٌ لهم جميعًا
                <input
                  className="h-9 w-48 px-space-xs rounded-field bg-surface-container-low border border-outline-variant"
                  data-import-category=""
                  list="citizen-import-categories"
                  placeholder="اختياري — مثل «موظفو التربية»"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
                <datalist id="citizen-import-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
            </div>

            {plan && (
              <div className="rounded-card bg-surface-container-low p-space-sm flex flex-col gap-1 font-label-md text-label-md" data-import-plan="">
                {planRows
                  .filter(([, n]) => n > 0)
                  .map(([label, n, key]) => (
                    <div key={key} className="flex items-center justify-between" data-plan={key}>
                      <span>{label}</span>
                      <span className="font-semibold">{toIndic(n)}</span>
                    </div>
                  ))}
                {plan.similar > 0 && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-outline-variant/60" data-plan="similar">
                    <div className="flex items-center justify-between">
                      <span>بالاسم نفسه في السجلّ ولا رقمَ ولا هاتفَ يفرّق بينهما — يُترك</span>
                      <span className="font-semibold">{toIndic(plan.similar)}</span>
                    </div>
                    <span className="text-on-surface-variant truncate">{plan.similarNames.join('، ')}</span>
                    <label className="flex items-center gap-1">
                      <input checked={addSimilar} data-import-similar="" type="checkbox" onChange={(e) => setAddSimilar(e.target.checked)} />
                      أضفهم ملفّاتٍ جديدة — هم غير من في السجلّ
                    </label>
                  </div>
                )}
                {plan.unusualIds > 0 && (
                  <p className="text-on-surface-variant" data-plan="unusual-ids">
                    أرقامٌ وطنية بصيغةٍ غير معتادة ({toIndic(plan.unusualIds)}): تُحفظ كما كُتبت، ويُنبَّه عليها في الملف.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="font-label-md text-label-md text-error">{error}</p>}
        <div className="flex justify-end gap-space-sm">
          <button className="h-10 px-space-md rounded-btn font-label-md text-label-md" type="button" onClick={onClose}>
            إلغاء
          </button>
          {table && (
            <button
              className="h-10 px-space-lg btn-act font-label-md text-label-md font-semibold disabled:opacity-40"
              data-act="import-run"
              disabled={!hasName || !plan || plan.added + plan.completed === 0 || busy !== null}
              type="button"
              onClick={() => void run()}
            >
              {busy ?? 'استورد'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
