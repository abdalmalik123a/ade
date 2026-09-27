/**
 * تصحيح الدوائر في شاشة الأسئلة — ورقة إجابةٍ تُطبع، ثم تُمسح وتُصحَّح.
 *
 * ثلاث خطوات: يُضبط عدد الأسئلة وبدائلها ويُكتب المفتاح («أ ب ج د…»)، وتُطبع
 * أوراق الإجابة بعدد الطلاب، ثم تُمسح بعد الامتحان (من الماسح ورقةً ورقة، أو
 * مجلّدُ صورٍ ممسوحة) فتظهر لكلّ ورقةٍ رقمُ صاحبها ودرجتُه وما تُرك وما ظُلّل
 * مرّتين — ويُحفظ الجدول لـExcel.
 *
 * والتصحيح حسابٌ ثابت (`shared/omr.ts`) لا تخمين: الورقة التي لا تُوجد أركانها
 * تُقال ولا تُصحَّح.
 */
import { useMemo, useState } from 'react';
import type { PrinterInfo } from '@shared/api';
import { CHOICE_LETTERS, gradeOmr, omrCapacity, omrSheetHtml, parseKey, readOmr, type OmrGrade, type OmrSpec } from '@shared/omr';
import type { PixelData } from '@shared/deskew';

const toIndic = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

type Result = { name: string; id: string; answers: number[]; grade: OmrGrade } | { name: string; error: string };

/** بكسلات صورةٍ من المخزن — بإذن الأصل (crossOrigin) وإلا امتنعت قراءتها. */
function pixelsOf(src: string): Promise<PixelData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = () => resolve(null);
    img.src = `diwan://store/${src}`;
  });
}

export default function OmrPanel({
  spec,
  onSpec,
  title,
  lines,
  printer,
  onSay
}: {
  spec: OmrSpec;
  onSpec: (spec: OmrSpec) => void;
  title: string;
  lines: string[];
  printer: PrinterInfo | null;
  onSay: (text: string, tone?: 'ok' | 'warn') => void;
}) {
  const [keyText, setKeyText] = useState(() => spec.key.map((k) => (k >= 0 ? CHOICE_LETTERS[k] : '-')).join(' '));
  const [copies, setCopies] = useState(30);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);

  const key = useMemo(() => parseKey(keyText, spec.choices), [keyText, spec.choices]);
  const capacity = omrCapacity(spec.choices);
  const set = (patch: Partial<OmrSpec>) => onSpec({ ...spec, ...patch, key });

  async function printSheets() {
    setBusy(true);
    try {
      const page = omrSheetHtml({ ...spec, key }, { title, lines });
      const out = await window.diwan.output.printJob({
        label: `أوراق إجابة — ${title}`,
        pages: Array.from({ length: Math.max(1, copies) }, () => page),
        printer: printer?.name ?? null,
        page: { w: 210, h: 297 },
        duplex: false
      });
      onSay(out.ok ? `أُرسلت ${toIndic(out.sent)} ورقة إجابة إلى الطابعة` : out.reason || 'لم تتم الطباعة', out.ok ? 'ok' : 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function grade(images: { name: string; src: string }[]) {
    const spec2 = { ...spec, key };
    const out: Result[] = [];
    for (const image of images) {
      const px = await pixelsOf(image.src);
      const read = px ? readOmr(px, spec2) : null;
      out.push(read ? { name: image.name, id: read.id, answers: read.answers, grade: gradeOmr(read.answers, key) } : { name: image.name, error: 'لم تُوجد مربّعات الورقة الأربعة — أعد مسحها كاملة' });
    }
    setResults((prev) => [...prev, ...out]);
  }

  async function fromScanner() {
    setBusy(true);
    try {
      const src = await window.diwan.scanner.scanImage(200);
      await grade([{ name: `مسح ${toIndic(results.length + 1)}`, src }]);
    } catch (e) {
      onSay(e instanceof Error ? e.message : 'تعذّر المسح', 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function fromFolder() {
    setBusy(true);
    try {
      const list = await window.diwan.files.pickImageFolder('omr');
      if (list) await grade(list);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const header = ['الورقة', 'رقم الطالب', 'الصواب', 'من', 'النسبة', 'الفارغ', 'المتعدّد', ...Array.from({ length: spec.questions }, (_, q) => `س${q + 1}`)];
    const rows = results.map((r) =>
      'error' in r
        ? [r.name, '', '', '', '', '', '', r.error]
        : [r.name, r.id, r.grade.correct, r.grade.total, r.grade.percent, r.grade.blank, r.grade.multi, ...r.answers.map((a) => (a >= 0 ? CHOICE_LETTERS[a] : a === -2 ? 'متعدّد' : ''))]
    );
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    // علامة UTF-8 في أوّله — وإلا فتحه Excel حروفًا مكسّرة.
    const data = new TextEncoder().encode(`﻿${csv}`);
    const path = await window.diwan.files.saveAs({ data, suggestedName: `نتائج ${title.replace(/[\\/:*?"<>|]/g, '-')}.csv`, filterName: 'Excel (CSV)', ext: 'csv' });
    if (path) onSay('حُفظت النتائج — تُفتح في Excel');
  }

  const numInput = 'w-16 h-8 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular';

  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-sm flex flex-col gap-space-sm" data-omr="">
      <span className="font-label-lg text-label-lg text-on-surface font-semibold flex items-center gap-1">
        <span className="material-symbols-outlined text-[20px] text-secondary">checklist</span>
        تصحيح الدوائر (OMR)
      </span>
      <div className="flex flex-wrap items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
        <label className="flex items-center gap-1">
          الأسئلة
          <input className={numInput} data-omr-questions="" value={spec.questions} onChange={(e) => set({ questions: Math.max(1, Math.min(capacity, Number(e.target.value.replace(/\D/g, '')) || 1)) })} />
        </label>
        <label className="flex items-center gap-1">
          البدائل
          <select className="h-8 px-1 rounded-lg bg-surface-container-low border border-outline-variant" value={spec.choices} onChange={(e) => set({ choices: Number(e.target.value) })}>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {toIndic(n)} ({CHOICE_LETTERS.slice(0, n).join(' ')})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          خانات رقم الطالب
          <input className={numInput} value={spec.idDigits} onChange={(e) => set({ idDigits: Math.max(1, Math.min(6, Number(e.target.value.replace(/\D/g, '')) || 1)) })} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">مفتاح الإجابة — حرفٌ لكل سؤال، و«-» لسؤالٍ لا يُصحَّح</span>
        <input
          className="h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md"
          data-omr-key=""
          placeholder="أ ب ج د ب أ …"
          value={keyText}
          onChange={(e) => {
            setKeyText(e.target.value);
            // يصل إلى الورقة مع كل حرف — فيُحفظ معها ولو لم تغادر الخانة.
            onSpec({ ...spec, key: parseKey(e.target.value, spec.choices) });
          }}
        />
        <span className={`font-label-sm text-label-sm ${key.length === spec.questions ? 'text-secondary' : 'text-error'}`}>
          {toIndic(key.length)} من {toIndic(spec.questions)} في المفتاح
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-space-xs">
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          نسخ
          <input className={numInput} value={copies} onChange={(e) => setCopies(Number(e.target.value.replace(/\D/g, '')) || 1)} />
        </label>
        <button className="h-9 px-space-sm rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-40" disabled={busy} type="button" onClick={() => void printSheets()}>
          اطبع أوراق الإجابة
        </button>
        <button className="h-9 px-space-sm rounded-lg bg-surface-container-high font-label-md text-label-md disabled:opacity-40" data-act="omr-scan" disabled={busy || key.length !== spec.questions} type="button" onClick={() => void fromScanner()}>
          صحّح ورقةً من الماسح
        </button>
        <button className="h-9 px-space-sm rounded-lg bg-surface-container-high font-label-md text-label-md disabled:opacity-40" data-act="omr-folder" disabled={busy || key.length !== spec.questions} type="button" onClick={() => void fromFolder()}>
          صحّح مجلّد صورٍ ممسوحة
        </button>
      </div>

      {results.length > 0 && (
        <div className="flex flex-col gap-1" data-omr-results="">
          <table className="w-full font-label-sm text-label-sm">
            <thead>
              <tr className="text-on-surface-variant">
                <th className="text-right">الورقة</th>
                <th>الرقم</th>
                <th>الدرجة</th>
                <th>فارغ</th>
                <th>متعدّد</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-t border-outline-variant/50">
                  <td className="py-1">{r.name}</td>
                  {'error' in r ? (
                    <td className="text-error" colSpan={4}>
                      {r.error}
                    </td>
                  ) : (
                    <>
                      <td className="text-center tabular">{r.id}</td>
                      <td className="text-center tabular font-bold">
                        {toIndic(r.grade.correct)} / {toIndic(r.grade.total)} ({toIndic(r.grade.percent)}٪)
                      </td>
                      <td className="text-center tabular">{toIndic(r.grade.blank)}</td>
                      <td className={`text-center tabular ${r.grade.multi ? 'text-error font-bold' : ''}`}>{toIndic(r.grade.multi)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-space-xs">
            <button className="h-8 px-space-sm rounded-lg bg-secondary text-on-secondary font-label-sm text-label-sm" type="button" onClick={() => void exportCsv()}>
              احفظ النتائج لـExcel
            </button>
            <button className="h-8 px-space-sm rounded-lg bg-surface-container font-label-sm text-label-sm" type="button" onClick={() => setResults([])}>
              امسح الجدول
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
