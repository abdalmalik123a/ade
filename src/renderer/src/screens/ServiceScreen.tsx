/**
 * الشبّاك — الشاشة اليومية، والزبون واقف.
 *
 * ثلاث خطوات لا غير: **اختر** البطاقات، ثم **املأ** ورقة إدخال واحدة فيها
 * اتحادُ ما تطلبه المختارات بلا تكرار — الاسم يُكتب مرّة فيملأ الخمس — ثم
 * **راجع** الأوراق مملوءةً ورقةً ورقة، ثم اطبع.
 *
 * والطباعة قرارٌ بعد المراجعة لا نتيجة تلقائية. وتُقيَّد الأوراق **معاملةً
 * واحدة** لزبون واحد، لكل ورقة رقم صادرها وبصمتها.
 *
 * ولا أداة تصميم هنا: من أراد أن يبني استمارة فمكانه الورشة.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mergeFields, type Doc, type DocField } from '@shared/doc';
import { renderDocHtml } from '@shared/docHtml';
import { normalizeLayout, type Letterhead, type LetterheadLayout } from '@shared/letterhead';
import { FINGERPRINT_SLOT, QR_SLOT, SERIAL_SLOT } from '@shared/api';
import type {
  OfficeSettings,
  PrinterInfo,
  TemplateDetail,
  TemplateSummary,
  TransactionSheet
} from '@shared/api';
import { formatGregorian } from '@shared/dates';
import LetterheadView from '../components/LetterheadView';

type Step = 'pick' | 'fill' | 'review';

type Loaded = {
  summary: TemplateSummary;
  detail: TemplateDetail;
  doc: Doc;
  layout: LetterheadLayout | null;
};

export type ServiceScreenProps = {
  printer: PrinterInfo | null;
  onIssued?: () => void;
};

const STEPS: { key: Step; label: string; hint: string }[] = [
  { key: 'pick', label: 'اختر', hint: 'ما يطلبه الزبون' },
  { key: 'fill', label: 'املأ', hint: 'مرّةً واحدة للجميع' },
  { key: 'review', label: 'راجع', hint: 'ثم اطبع' }
];

export default function ServiceScreen({ printer, onIssued }: ServiceScreenProps) {
  const [step, setStep] = useState<Step>('pick');
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [at, setAt] = useState(0);
  const [fee, setFee] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [citizenId, setCitizenId] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);

  const sheets = useRef(new Map<number, HTMLDivElement | null>());
  const toastTimer = useRef<number | null>(null);

  /**
   * رسالةٌ تُعرض ثوانيَ ثم تختفي.
   *
   * ويُلغى مؤقّت السابقة أولًا — وإلا محا مؤقّتٌ قديم رسالةً جديدة بعد لحظة
   * من ظهورها، فيظنّ الموظف أن الإصدار لم يقل شيئًا.
   */
  const say = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    void (async () => {
      const [list, lhs, s] = await Promise.all([
        window.diwan.templates.list(null),
        window.diwan.letterheads.list(),
        window.diwan.settings.get()
      ]);
      setItems(list);
      setLetterheads(lhs);
      setSettings(s);
    })();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim();
    if (!q) return items;
    return items.filter((t) => `${t.title} ${t.subtitle ?? ''} ${t.category ?? ''}`.includes(q));
  }, [items, query]);

  /** الحقول التي تُعرض: اتحاد ما تطلبه المختارات، بلا تكرار. */
  const fields: DocField[] = useMemo(() => mergeFields(loaded.map((l) => l.doc)), [loaded]);

  const toggle = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** تحميل تفاصيل المختارات مرّة عند الانتقال — لا مع كل ضغطة. */
  async function goFill() {
    setBusy(true);
    try {
      const details = await Promise.all(picked.map((id) => window.diwan.templates.get(id)));
      const next: Loaded[] = [];
      for (const [i, detail] of details.entries()) {
        if (!detail) continue;
        const summary = items.find((t) => t.id === picked[i])!;
        const lh = letterheads.find((x) => x.id === detail.letterheadId) ?? null;
        next.push({
          summary,
          detail,
          doc: await window.diwan.templates.doc(detail.id),
          layout: lh ? normalizeLayout(lh.layout) : null
        });
      }
      setLoaded(next);
      setStep('fill');
    } catch {
      say('تعذّر تحميل الاستمارات', 'warn');
    } finally {
      setBusy(false);
    }
  }

  /** F2: ما يعرفه البرنامج عن المواطن يملأ ما يطابقه من الحقول. */
  async function useCitizen(id: number) {
    const citizen = (await window.diwan.citizens.get(id)) as Record<string, unknown> | null;
    if (!citizen) return;
    setCitizenId(id);
    setValues((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (!f.source) continue;
        const raw = citizen[f.source];
        // ما كتبه الموظف بيده لا يُطمس.
        if (typeof raw === 'string' && raw.trim() && !next[f.key]?.trim()) next[f.key] = raw;
      }
      const name = citizen.fullName;
      const byRole = fields.find((f) => f.role === 'name');
      if (byRole && typeof name === 'string' && !next[byRole.key]?.trim()) next[byRole.key] = name;
      return next;
    });
    setPicker(false);
    say('استُوردت بيانات المواطن');
  }

  const byRole = (role: DocField['role']) => {
    const f = fields.find((x) => x.role === role);
    return f ? (values[f.key]?.trim() ?? '') : '';
  };

  /** اسم صاحب العلاقة: من حقلٍ بدوره، وإلا من أول حقل مملوء. */
  const citizenName =
    byRole('name') || values[fields[0]?.key ?? '']?.trim() || '';

  const missing = fields.filter((f) => f.required && !values[f.key]?.trim());

  const collect = useCallback((): TransactionSheet[] => {
    return loaded.map((l) => {
      const node = sheets.current.get(l.summary.id)?.cloneNode(true) as HTMLElement | undefined;
      if (node) {
        node.querySelectorAll('[data-slot="serial"]').forEach((el) => {
          el.textContent = SERIAL_SLOT;
        });
        node.querySelectorAll('[data-slot="fingerprint"]').forEach((el) => {
          el.textContent = FINGERPRINT_SLOT;
        });
        const qr = node.querySelector('[data-slot="qr"]');
        if (qr) qr.innerHTML = QR_SLOT;
      }
      return {
        sheetHtml: node?.outerHTML ?? '',
        templateId: l.summary.id,
        letterheadId: l.detail.letterheadId,
        authorityId: null,
        docType: l.summary.title,
        destination: byRole('destination') || null,
        purpose: byRole('purpose') || null,
        values,
        copies: 1,
        copyKind: 'نسخة أصلية',
        fee
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, values, fee, fields]);

  async function issue(print: boolean) {
    if (!settings) return;
    if (!citizenName) {
      say('اكتب اسم صاحب العلاقة أولًا', 'warn');
      return;
    }
    setBusy(true);
    try {
      const out = await window.diwan.documents.issueTransaction(
        {
          citizenId,
          citizenName,
          nationalId: byRole('nationalId') || null,
          operator: settings.operatorName || null,
          printer: printer?.name ?? null,
          serialPrefix: settings.serialPrefix,
          serialYear: settings.serialYear,
          gregorianDate: formatGregorian(new Date()),
          hijriDate: null,
          sheets: collect()
        },
        print
      );
      say(`صدرت ${out.documents.length} ورقة بمعاملة واحدة — ${out.documents[0]?.serial ?? ''}`);
      onIssued?.();
      setStep('pick');
      setPicked([]);
      setLoaded([]);
      setValues({});
      setCitizenId(null);
    } catch (e) {
      say(e instanceof Error ? e.message : 'تعذّر الإصدار', 'warn');
    } finally {
      setBusy(false);
    }
  }

  const current = loaded[Math.min(at, loaded.length - 1)];

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-screen="service">
      <div className="h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        {/* الخطوات الثلاث */}
        <div className="shrink-0 px-space-lg py-space-sm bg-surface-container-low flex items-center gap-space-md">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-space-xs">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center font-label-md text-label-md font-bold ${
                  step === s.key
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {i + 1}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-label-lg text-label-lg text-on-surface">{s.label}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{s.hint}</span>
              </div>
              {i < STEPS.length - 1 && (
                <span className="material-symbols-outlined text-[18px] text-outline-variant mx-space-xs">
                  chevron_left
                </span>
              )}
            </div>
          ))}
          <span className="flex-1" />
          {picked.length > 0 && (
            <span className="font-label-md text-label-md text-on-surface">
              {picked.length} ورقة مختارة
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-space-lg">
          {/* ١ — اختر */}
          {step === 'pick' && (
            <div className="flex flex-col gap-space-md">
              <input
                className="w-full max-w-md h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="ابحث عن استمارة"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {shown.length === 0 ? (
                <div className="py-space-lg text-center font-body-md text-body-md text-on-surface-variant">
                  {items.length === 0
                    ? 'المكتبة فارغة — استورد مجلد ملفاتك من شاشة النماذج'
                    : 'لا استمارة بهذا الاسم'}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-sm">
                  {shown.map((t) => {
                    const on = picked.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        className={`p-space-md rounded-xl text-right flex flex-col gap-1 transition-all ${
                          on
                            ? 'bg-primary-container text-on-primary shadow-md'
                            : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                        }`}
                        type="button"
                        onClick={() => toggle(t.id)}
                      >
                        <div className="flex items-start gap-space-xs">
                          <span className="material-symbols-outlined text-[20px] shrink-0">
                            {on ? 'check_circle' : 'description'}
                          </span>
                          <span className="flex-1 font-title-md text-title-md leading-snug">
                            {t.title}
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm opacity-70">
                          {t.category ?? 'بلا تصنيف'} · طُبعت {t.printCount} مرّة
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ٢ — املأ */}
          {step === 'fill' && (
            <div className="max-w-3xl mx-auto flex flex-col gap-space-md">
              <div className="flex items-center gap-space-sm">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  بيانات صاحب العلاقة
                </span>
                <span className="flex-1 font-label-sm text-label-sm text-on-surface-variant">
                  تُكتب مرّة وتملأ {loaded.length} أوراق
                </span>
                <button
                  className="h-9 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1"
                  type="button"
                  onClick={() => setPicker(true)}
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">badge</span>
                  استيراد (F2)
                </button>
              </div>

              {fields.length === 0 ? (
                <span className="font-body-md text-body-md text-on-surface-variant">
                  لا حقول في هذه الاستمارات — امضِ إلى المراجعة.
                </span>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                  {fields.map((f) => (
                    <label key={f.key} className="flex flex-col gap-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {f.label}
                        {f.required && <span className="text-error"> *</span>}
                      </span>
                      <input
                        className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
                        type="text"
                        value={values[f.key] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ٣ — راجع */}
          <div className={step === 'review' ? 'flex flex-col items-center gap-space-md' : 'hidden'}>
            {loaded.length > 1 && (
              <div className="flex items-center gap-space-sm">
                <button
                  className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30"
                  disabled={at === 0}
                  type="button"
                  onClick={() => setAt((n) => n - 1)}
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
                <span className="font-label-md text-label-md text-on-surface">
                  ورقة {at + 1} من {loaded.length} — {current?.summary.title}
                </span>
                <button
                  className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30"
                  disabled={at >= loaded.length - 1}
                  type="button"
                  onClick={() => setAt((n) => n + 1)}
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
              </div>
            )}

            {loaded.map((l, i) => (
              <div key={l.summary.id} className={i === at ? '' : 'hidden'}>
                <div
                  ref={(el) => {
                    sheets.current.set(l.summary.id, el);
                  }}
                  className="a4-sheet bg-white text-black shadow-lg"
                  style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}
                >
                  {l.layout && <LetterheadView layout={l.layout} />}
                  <div
                    className="mt-space-md font-body-md text-body-md leading-8"
                    dangerouslySetInnerHTML={{
                      __html: renderDocHtml(l.doc, values, { missing: 'blank' })
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* شريط القرار */}
        <div className="shrink-0 px-space-lg py-space-sm bg-surface-container-low flex items-center gap-space-sm">
          {step !== 'pick' && (
            <button
              className="h-10 px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
              type="button"
              onClick={() => setStep(step === 'review' ? 'fill' : 'pick')}
            >
              رجوع
            </button>
          )}
          <span className="flex-1" />

          {step === 'review' && (
            <>
              <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                الأجرة للورقة
                <input
                  className="w-20 h-9 px-2 rounded-lg bg-surface-container-lowest text-on-surface text-center font-label-md text-label-md"
                  min={0}
                  type="number"
                  value={fee}
                  onChange={(e) => setFee(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              {missing.length > 0 && (
                <span className="font-label-md text-label-md text-error">
                  {missing.length} حقلًا إلزاميًّا فارغًا
                </span>
              )}
            </>
          )}

          {step === 'pick' && (
            <button
              className="h-10 px-5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
              type="button"
              disabled={picked.length === 0 || busy}
              onClick={() => void goFill()}
            >
              املأ {picked.length > 0 ? `(${picked.length})` : ''}
            </button>
          )}
          {step === 'fill' && (
            <button
              className="h-10 px-5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
              type="button"
              disabled={busy}
              onClick={() => {
                setAt(0);
                setStep('review');
              }}
            >
              راجع الأوراق
            </button>
          )}
          {step === 'review' && (
            <>
              <button
                className="h-10 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-40"
                type="button"
                disabled={busy || missing.length > 0}
                onClick={() => void issue(false)}
              >
                أصدر بلا طباعة
              </button>
              <button
                className="h-10 px-5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
                type="button"
                disabled={busy || missing.length > 0}
                onClick={() => void issue(true)}
              >
                {busy ? 'جارٍ الإصدار...' : `اطبع ${loaded.length} ورقة`}
              </button>
            </>
          )}
        </div>
      </div>

      {picker && <CitizenPicker onClose={() => setPicker(false)} onPick={(id) => void useCitizen(id)} />}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-space-md py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${
            toast.tone === 'warn'
              ? 'bg-error-container text-on-error-container'
              : 'bg-primary-container text-on-primary'
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

/** الزبون المتكرر: يُكتب اسمه فيُستعاد ما يعرفه البرنامج عنه. */
function CitizenPicker({
  onClose,
  onPick
}: {
  onClose: () => void;
  onPick: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<{ id: number; fullName: string; nationalId: string | null }[]>(
    []
  );

  useEffect(() => {
    let alive = true;
    void window.diwan.citizens.list({ query, limit: 20 }).then((list) => {
      if (alive) setRows(list as typeof rows);
    });
    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-scrim/50">
      <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest shadow-2xl p-space-md flex flex-col gap-space-sm">
        <span className="font-headline-sm text-headline-sm text-on-surface">
          استيراد من سجل المواطنين
        </span>
        <input
          autoFocus
          className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
          placeholder="اسم المواطن أو رقمه"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
          {rows.length === 0 ? (
            <span className="py-space-md text-center font-label-md text-label-md text-on-surface-variant">
              لا ملفّ بهذا الاسم
            </span>
          ) : (
            rows.map((c) => (
              <button
                key={c.id}
                className="h-10 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface text-right font-label-md text-label-md flex items-center justify-between"
                type="button"
                onClick={() => onPick(c.id)}
              >
                <span>{c.fullName}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {c.nationalId ?? ''}
                </span>
              </button>
            ))
          )}
        </div>
        <button
          className="h-9 self-end px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
          type="button"
          onClick={onClose}
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
