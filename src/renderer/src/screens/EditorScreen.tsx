/**
 * المحرر الذكي ومعاينة A4 — data-path="smart-editor-a4-preview"
 *
 * علاماتها من stitch_/a4/code.html، وسلوكها من docs/design-behavior/a4.js:
 * ربط حيّ بين الحقول والورقة، حقن متغيرات بصيغة {الاسم}، تكبير محصور بين 45% و160%،
 * وورقة عرضها 794px = 210mm عند 96 نقطة/إنش.
 *
 * لا شيء مبرمَج: الترويسة من إعدادات المكتب، والنموذج من المكتبة، والمواطن من السجل.
 * قبل أن يُدخل المكتب أيًّا منها، الورقة بيضاء والحقول خالية — وهذا هو الصواب.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OfficeSettings, TemplateSummary } from '@shared/api';
import { formatGregorian, formatHijri } from '@shared/dates';
import { mmToPx, type Letterhead } from '@shared/letterhead';

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.6;
const SHEET_WIDTH = 794;

const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : undefined);

type Fields = {
  serial: string;
  dateGreg: string;
  dateHijri: string;
  name: string;
  nationalId: string;
  jobTitle: string;
  jobStatus: string;
  addressedTo: string;
  purpose: string;
  subject: string;
  body: string;
  signerName: string;
  signerRole: string;
};

const EMPTY: Fields = {
  serial: '',
  dateGreg: '',
  dateHijri: '',
  name: '',
  nationalId: '',
  jobTitle: '',
  jobStatus: '',
  addressedTo: '',
  purpose: '',
  subject: '',
  body: '',
  signerName: '',
  signerRole: ''
};

/** حقن المتغيّرات: نفس الصيغة التي يستعملها التصميم — {الاسم} لا [الاسم]. */
function injectTokens(body: string, f: Fields): string {
  const map: Record<string, string> = {
    '{الاسم}': f.name,
    '{الرقم_الوطني}': f.nationalId,
    '{العنوان_الوظيفي}': f.jobTitle,
    '{الجهة_الموجه_إليها}': f.addressedTo,
    '{الغرض}': f.purpose,
    '{رقم_الصادر}': f.serial,
    '{التاريخ_الميلادي}': f.dateGreg,
    '{التاريخ_الهجري}': f.dateHijri
  };
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let out = escape(body);
  for (const [token, value] of Object.entries(map)) {
    if (!value) continue;
    out = out.split(escape(token)).join(
      `<span class="font-bold text-black underline underline-offset-4 decoration-1">${escape(value)}</span>`
    );
  }
  return out.replace(/\n/g, '<br/>');
}

type Props = { templateId?: number | null; citizenId?: number | null };

export default function EditorScreen({ templateId = null, citizenId = null }: Props) {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [letterheadId, setLetterheadId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<number | null>(templateId);
  const [f, setF] = useState<Fields>(EMPTY);
  const [zoom, setZoom] = useState(1);
  const [showStamp, setShowStamp] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showWatermark, setShowWatermark] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const [s, lhs, tpls] = await Promise.all([
        window.diwan.settings.get(),
        window.diwan.letterheads.list(),
        window.diwan.templates.list()
      ]);
      setSettings(s);
      setLetterheads(lhs);
      setLetterheadId(lhs.find((x) => x.isDefault)?.id ?? lhs[0]?.id ?? null);
      setTemplates(tpls);
    })();
  }, []);

  const set = useCallback((patch: Partial<Fields>) => setF((prev) => ({ ...prev, ...patch })), []);

  // استيراد مواطن قادم من سجل المواطنين (زرّ «إدراج في محرر الكتب»).
  useEffect(() => {
    if (citizenId === null) return;
    void window.diwan.citizens.get(citizenId).then((c) => {
      if (!c) return;
      set({
        name: c.fullName,
        nationalId: c.nationalId ?? '',
        jobTitle: c.jobTitle ?? '',
        jobStatus: c.serviceStatus ?? ''
      });
    });
  }, [citizenId, set]);

  const letterhead = letterheads.find((x) => x.id === letterheadId) ?? null;
  const template = templates.find((t) => t.id === activeTemplate) ?? null;

  function loadTemplate(id: number | null) {
    setActiveTemplate(id);
    const t = templates.find((x) => x.id === id);
    if (t) set({ body: t.bodyHtml, subject: t.subjectLine ?? '' });
  }

  async function generateSerial() {
    if (!settings) return;
    const serial = await window.diwan.documents.peekSerial(
      settings.serialPrefix,
      settings.serialYear
    );
    set({ serial });
  }

  function stampToday() {
    const now = new Date();
    set({ dateGreg: formatGregorian(now), dateHijri: formatHijri(now) });
  }

  function insertToken(token: string) {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = f.body.slice(0, start) + token + f.body.slice(end);
    set({ body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  function fitZoom() {
    const desk = deskRef.current;
    if (!desk) return;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (desk.clientWidth - 64) / SHEET_WIDTH)));
  }

  const rendered = useMemo(() => injectTokens(f.body, f), [f]);

  /** المتغيّرات المتاحة: ما يعرّفه النموذج المحمَّل، أو لا شيء قبل تحميله. */
  const tokens = template?.variables.map((v) => `{${v}}`) ?? [];

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-surface">
        {/* لوح الإدخال */}
        <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 h-full flex flex-col bg-surface-container-lowest shadow-[0_10px_30px_rgba(11,28,48,0.06)] z-20 overflow-hidden">
          <div className="p-space-md bg-surface-container-low flex flex-col gap-space-sm shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="p-1 rounded-lg bg-primary-container text-on-primary">
                  <span className="material-symbols-outlined text-[18px]">auto_stories</span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  محرر الكتب الرسمية الذكي
                </span>
              </div>
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                مزامنة فورية
              </span>
            </div>

            <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                  النموذج الرسمي النشط
                </label>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  مكتبة النماذج (Ctrl+M)
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                <select
                  className="flex-1 h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                  value={activeTemplate ?? ''}
                  onChange={(e) => loadTemplate(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">
                    {templates.length === 0 ? '— لا نماذج في المكتبة بعد —' : '— اختر نموذجًا —'}
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <button
                  className="h-9 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors"
                  title="استيراد سريع من سجل المواطنين"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">
                    person_search
                  </span>
                  <span>استيراد (F2)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-space-md space-y-space-md">
            {/* القسم الأول: الترويسة */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    account_balance
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    ترويسة الجهة الإدارية
                  </h3>
                </div>
                <span className="font-code-sm text-code-sm text-on-surface-variant">القسم الأول</span>
              </div>
              {letterheads.length === 0 ? (
                <div className="py-space-md rounded-lg border border-dashed border-outline-variant flex flex-col items-center gap-space-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[24px]">note_add</span>
                  <span className="font-label-md text-label-md">لم تُنشأ ترويسة بعد</span>
                  <span className="font-label-sm text-label-sm">
                    أنشئها من «إعدادات الترويسة والأختام»
                  </span>
                </div>
              ) : (
                <select
                  className="w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                  value={letterheadId ?? ''}
                  onChange={(e) => setLetterheadId(Number(e.target.value))}
                >
                  {letterheads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
            </section>

            {/* القسم الثاني: سجل الصادر والتاريخ */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">123</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    سجل الصادر والتأريخ الرسمي
                  </h3>
                </div>
                <button
                  className="font-label-sm text-label-sm text-secondary font-semibold flex items-center gap-1 hover:underline"
                  type="button"
                  onClick={() => void generateSerial()}
                >
                  <span className="material-symbols-outlined text-[16px]">autorenew</span>
                  <span>توليد متسلسل</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-space-sm">
                <Field label="رقم الصادر" required>
                  <input
                    className={inputCls}
                    id="inputSerial"
                    type="text"
                    value={f.serial}
                    placeholder="—"
                    onChange={(e) => set({ serial: e.target.value })}
                  />
                </Field>
                <Field label="التاريخ الميلادي">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.dateGreg}
                    placeholder="—"
                    onChange={(e) => set({ dateGreg: e.target.value })}
                  />
                </Field>
                <Field label="التاريخ الهجري">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.dateHijri}
                    placeholder="—"
                    onChange={(e) => set({ dateHijri: e.target.value })}
                  />
                </Field>
              </div>
              <button
                className="w-full h-8 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors"
                type="button"
                onClick={stampToday}
              >
                ختم تاريخ اليوم (ميلادي وهجري)
              </button>
            </section>

            {/* القسم الثالث: صاحب العلاقة */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    بيانات صاحب العلاقة
                  </h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-space-sm">
                <Field label="الاسم الرباعي واللقب" required>
                  <input
                    className={inputCls}
                    type="text"
                    value={f.name}
                    placeholder="—"
                    onChange={(e) => set({ name: e.target.value })}
                  />
                </Field>
                <Field label="الرقم الوطني / البطاقة الموحدة">
                  <input
                    className={`${inputCls} font-mono`}
                    type="text"
                    value={f.nationalId}
                    placeholder="—"
                    onChange={(e) => set({ nationalId: e.target.value })}
                  />
                </Field>
                <Field label="العنوان الوظيفي">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.jobTitle}
                    placeholder="—"
                    onChange={(e) => set({ jobTitle: e.target.value })}
                  />
                </Field>
                <Field label="الحالة الوظيفية والخدمة">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.jobStatus}
                    placeholder="—"
                    onChange={(e) => set({ jobStatus: e.target.value })}
                  />
                </Field>
                <Field label="الجهة الموجه إليها الكتاب">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.addressedTo}
                    placeholder="—"
                    onChange={(e) => set({ addressedTo: e.target.value })}
                  />
                </Field>
                <Field label="الغرض من التأييد">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.purpose}
                    placeholder="—"
                    onChange={(e) => set({ purpose: e.target.value })}
                  />
                </Field>
              </div>
            </section>

            {/* القسم الرابع: المتن والمتغيرات */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    text_fields
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    منطوق الكتاب والمتغيرات
                  </h3>
                </div>
              </div>

              {tokens.length > 0 && (
                <div className="flex flex-wrap items-center gap-space-xs">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    حقن سريع:
                  </span>
                  {tokens.map((t) => (
                    <button
                      key={t}
                      className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-label-sm text-label-sm hover:bg-secondary-fixed transition-colors"
                      type="button"
                      onClick={() => insertToken(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              <Field label="سطر الموضوع (م /)">
                <input
                  className={inputCls}
                  type="text"
                  value={f.subject}
                  placeholder="—"
                  onChange={(e) => set({ subject: e.target.value })}
                />
              </Field>

              <Field label="المتن الرسمي">
                <textarea
                  ref={bodyRef}
                  className="w-full p-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md leading-relaxed focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                  rows={7}
                  value={f.body}
                  placeholder={
                    templates.length === 0
                      ? 'اكتب المتن هنا، أو أنشئ نموذجًا في المكتبة لتحميله'
                      : 'اختر نموذجًا من الأعلى أو اكتب المتن هنا'
                  }
                  onChange={(e) => set({ body: e.target.value })}
                />
              </Field>
            </section>

            {/* القسم الخامس: التوقيع والأختام */}
            <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
              <div className="flex items-center gap-space-xs pb-space-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">approval</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  التوقيع وأختام التوثيق
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-space-sm">
                <Field label="اسم الموقّع">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.signerName}
                    placeholder="—"
                    onChange={(e) => set({ signerName: e.target.value })}
                  />
                </Field>
                <Field label="صفة الموقّع">
                  <input
                    className={inputCls}
                    type="text"
                    value={f.signerRole}
                    placeholder="—"
                    onChange={(e) => set({ signerRole: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
                <Toggle checked={showStamp} onChange={setShowStamp} label="ختم رسمي" />
                <Toggle checked={showBarcode} onChange={setShowBarcode} label="باركود تدقيق" />
                <Toggle checked={showWatermark} onChange={setShowWatermark} label="علامة مسودة" />
              </div>
            </section>
          </div>
        </div>

        {/* منضدة الورق */}
        <div className="flex-1 h-full flex flex-col overflow-hidden bg-surface-dim/40">
          <div className="h-12 shrink-0 px-space-md flex items-center justify-between bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-space-sm">
              <button
                className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
                title="تصغير"
                type="button"
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))}
              >
                <span className="material-symbols-outlined text-[18px]">zoom_out</span>
              </button>
              <span className="font-label-md text-label-md text-on-surface font-semibold tabular w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
                title="تكبير"
                type="button"
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}
              >
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
              <button
                className="px-space-sm h-8 rounded text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm transition-colors"
                type="button"
                onClick={fitZoom}
              >
                ملاءمة العرض
              </button>
            </div>
            <div className="flex items-center gap-space-md font-label-sm text-label-sm text-on-surface-variant">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">crop_portrait</span>
                ISO 216 (A4 — 210×297mm)
              </span>
            </div>
          </div>

          <div ref={deskRef} className="flex-1 overflow-auto flex flex-col items-center py-space-xl">
            <div
              className="a4-sheet print-sheet bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] shrink-0 relative"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              {showWatermark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span
                    className="font-headline-xl text-on-surface opacity-[0.12] select-none"
                    style={{ fontSize: '96px', transform: 'rotate(-30deg)' }}
                  >
                    مسودة
                  </span>
                </div>
              )}

              <div
                style={{
                  paddingTop: mmToPx(letterhead?.layout.margins.top ?? 20),
                  paddingRight: mmToPx(letterhead?.layout.margins.right ?? 20),
                  paddingBottom: mmToPx(letterhead?.layout.margins.bottom ?? 20),
                  paddingLeft: mmToPx(letterhead?.layout.margins.left ?? 20)
                }}
              >
                {/* الترويسة كما بناها المكتب */}
                {letterhead && letterhead.layout.blocks.length > 0 ? (
                  <div>
                    {letterhead.layout.blocks.map((b) => {
                      if (b.kind === 'spacer') return <div key={b.id} style={{ height: b.gap ?? 12 }} />;
                      if (b.kind === 'divider')
                        return <hr key={b.id} className="border-t border-on-surface my-space-sm" />;
                      if (b.kind === 'image') {
                        const justify =
                          b.align === 'center' ? 'center' : b.align === 'left' ? 'flex-start' : 'flex-end';
                        return (
                          <div key={b.id} className="flex" style={{ justifyContent: justify }}>
                            <img alt="" src={storeUrl(b.value)} style={{ width: b.width ?? 90 }} />
                          </div>
                        );
                      }
                      const text =
                        b.kind === 'field'
                          ? injectTokens(b.value, f).replace(/<[^>]+>/g, '') || b.value
                          : b.value;
                      return (
                        <div
                          key={b.id}
                          className={b.bold ? 'font-bold' : ''}
                          style={{ textAlign: b.align, fontSize: `${b.size}px`, lineHeight: 1.9 }}
                        >
                          {text || ' '}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-space-lg text-center text-on-surface-variant font-label-sm text-label-sm border border-dashed border-outline-variant rounded">
                    الترويسة فارغة — أنشئها من «إعدادات الترويسة والأختام»
                  </div>
                )}

                {/* المرسل إليه والموضوع */}
                <div className="mt-space-lg space-y-space-md">
                  {f.addressedTo && (
                    <div className="font-bold text-on-surface" style={{ fontSize: '15px' }}>
                      إلى / {f.addressedTo}
                    </div>
                  )}
                  {f.subject && (
                    <div
                      className="font-bold text-on-surface text-center underline underline-offset-8"
                      style={{ fontSize: '15px' }}
                    >
                      م / {f.subject}
                    </div>
                  )}
                </div>

                {/* المتن */}
                <div
                  className="mt-space-lg text-on-surface"
                  style={{ fontSize: '14px', lineHeight: 2, textAlign: 'justify' }}
                  dangerouslySetInnerHTML={{ __html: rendered }}
                />

                {/* التوقيع والأختام */}
                {(f.signerName || f.signerRole || showStamp || showBarcode) && (
                  <div className="mt-space-xl flex items-end justify-between">
                    <div className="flex flex-col items-center gap-1">
                      {showBarcode && (
                        <div className="w-16 h-16 bg-surface-container-high rounded flex items-center justify-center">
                          <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                            qr_code_2
                          </span>
                        </div>
                      )}
                    </div>
                    {showStamp && (
                      <div className="w-24 h-24 rounded-full border-2 border-dashed border-secondary/60 flex items-center justify-center">
                        <span className="font-label-sm text-label-sm text-secondary text-center px-2">
                          موضع الختم
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-1 min-w-[150px]">
                      {f.signerName && (
                        <span className="font-bold text-on-surface" style={{ fontSize: '14px' }}>
                          {f.signerName}
                        </span>
                      )}
                      {f.signerRole && (
                        <span className="text-on-surface-variant" style={{ fontSize: '12px' }}>
                          {f.signerRole}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const inputCls =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-label-sm text-label-sm text-on-surface-variant">
        {label} {required && <span className="text-error">*</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-space-sm cursor-pointer">
      <input
        className="w-4 h-4 accent-primary-container"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
    </label>
  );
}
