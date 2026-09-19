/**
 * التصاميم — الشهادة والهوية والملصق والدعوة.
 *
 * وهي لوحاتٌ لا وثائق متدفّقة: مقاسٌ ثابت وصفحةٌ واحدة وخلفيةٌ تملأ الورقة
 * وعناصرُ بمواضعها. ولذلك شاشةٌ ثالثة: لا الكتب ولا الأسئلة تصلح لها.
 *
 * وطريقُ العمل هو طريق المكتب نفسه: يُصمَّم في Word أو Photoshop أو يُشترى
 * جاهزًا، ثم **يُفتح هنا** فيُقرأ مقاسه من الملف، وتُوضع فوقه حقولٌ تُملأ وتُطبع.
 * فنحن لا نصمّم — نملأ ونطبع. والحقل هو الحقل نفسه، فالدمج يعمل بلا تغيير.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PrinterInfo, TemplateSummary } from '@shared/api';
import { fieldRef, reconcileFields, run, type Doc, type Inline } from '@shared/doc';
import {
  BLEED_MM,
  PRINT_DPI,
  SCREEN_DPI,
  SIZE_PRESETS,
  canvasDoc,
  canvasPx,
  clampBox,
  emptyCanvas,
  mmToPx,
  normalizeCanvas,
  textElement,
  topZ,
  type Box,
  type Canvas,
  type CanvasElement,
  type TextElement
} from '@shared/canvas';
import { renderCanvasHtml } from '@shared/canvasHtml';
import { errorText } from '../lib/errors';

const DESIGN_CATEGORY = 'تصاميم';
const NUM =
  'w-20 h-8 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular font-label-md text-label-md text-on-surface';
const ICON =
  'w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors flex items-center justify-center';

type Toast = { text: string; tone: 'ok' | 'warn' } | null;

const textOf = (inlines: Inline[]): string =>
  inlines
    .map((n) => (n.kind === 'run' ? n.text : n.kind === 'field' ? `{${n.ref}}` : ' '))
    .join('');

/** `{اسم}` عقدةَ حقل، وما بينها نصًّا — وهي الصيغة التي يعرفها المكتب. */
const inlinesOf = (text: string): Inline[] => {
  const out: Inline[] = [];
  const re = /\{([^{}]+)\}/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push(run(text.slice(at, m.index)));
    out.push(fieldRef(m[1]!.trim()));
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(run(text.slice(at)));
  return out;
};

export type DesignsScreenProps = {
  printer: PrinterInfo | null;
  onChanged?: () => void;
};

export default function DesignsScreen({ printer, onChanged }: DesignsScreenProps) {
  const [canvas, setCanvas] = useState<Canvas>(() => emptyCanvas(SIZE_PRESETS[1]!.size));
  const [values, setValues] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [copies, setCopies] = useState(1);
  const [designId, setDesignId] = useState<number | null>(null);
  const [designs, setDesigns] = useState<TemplateSummary[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [askSize, setAskSize] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [zoom, setZoom] = useState(0.5);

  const sheetRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  const loadDesigns = useCallback(async () => {
    try {
      const all = await window.diwan.templates.list(DESIGN_CATEGORY, 'print-only');
      setDesigns(all);
    } catch {
      setDesigns([]);
    }
  }, []);

  useEffect(() => {
    void loadDesigns();
  }, [loadDesigns]);

  // ── الوثيقة مشتقّة، والحقول تتبع اللوحة ────────────────────────────
  const doc: Doc = useMemo(() => {
    const built = canvasDoc(canvas, { title: title || 'تصميم', category: DESIGN_CATEGORY });
    built.fields = reconcileFields(built);
    return built;
  }, [canvas, title]);

  const html = useMemo(
    () => renderCanvasHtml(doc, values, { dpi: SCREEN_DPI, missing: 'blank' }),
    [doc, values]
  );

  const page = canvasPx(canvas, SCREEN_DPI);

  useEffect(() => {
    const fit = () => {
      const desk = deskRef.current;
      if (desk) setZoom(Math.min(1, Math.max(0.15, (desk.clientWidth - 64) / page.w)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [page.w]);

  // ── الخلفية: المقاس من الملف ───────────────────────────────────────
  const openBackground = useCallback(async () => {
    try {
      const out = await window.diwan.files.pickBackground('designs');
      if (!out) return;
      setCanvas((c) => ({
        ...c,
        background: out.meta?.dpi
          ? { kind: 'image', src: out.src, dpi: out.meta.dpi }
          : { kind: 'image', src: out.src },
        size: out.meta?.mm ? { w: out.meta.mm.w, h: out.meta.mm.h } : c.size
      }));

      if (out.meta?.mm) {
        setAskSize(false);
        say(
          `المقاس من الملف: ${out.meta.mm.w.toFixed(1)} × ${out.meta.mm.h.toFixed(1)} ملم عند ${out.meta.dpi} نقطة/إنش`
        );
      } else {
        // الملف سكت عن دقّته — فيُسأل المكتب ولا يُخمَّن له.
        setAskSize(true);
        say('الملف لا يذكر دقّته — اختر المقاس أو اكتبه بالملّم', 'warn');
      }
    } catch (e) {
      say(errorText(e, 'تعذّر فتح الخلفية'), 'warn');
    }
  }, [say]);

  // ── العناصر ────────────────────────────────────────────────────────
  const patchElement = useCallback((id: string, patch: Partial<CanvasElement>) => {
    setCanvas((c) => ({
      ...c,
      elements: c.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as CanvasElement) : el))
    }));
  }, []);

  const addText = useCallback((label: string, box: Box) => {
    setCanvas((c) => ({
      ...c,
      elements: [
        ...c.elements,
        textElement({
          box: clampBox(box),
          inlines: inlinesOf(label),
          z: topZ(c.elements) + 1,
          name: label
        })
      ]
    }));
    setPicked(null);
  }, []);

  const removeElement = useCallback((id: string) => {
    setCanvas((c) => ({ ...c, elements: c.elements.filter((el) => el.id !== id) }));
    setPicked(null);
  }, []);

  /** السحب: نِسَبٌ لا بكسلات — فلا ينزاح العنصر حين يتغيّر المقاس أو الدقّة. */
  const onSheetMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      const sheet = sheetRef.current;
      if (!drag || !sheet) return;
      const rect = sheet.getBoundingClientRect();
      const bleedX = mmToPx(canvas.bleed, SCREEN_DPI) * zoom;
      const bleedY = bleedX;
      const w = mmToPx(canvas.size.w, SCREEN_DPI) * zoom;
      const h = mmToPx(canvas.size.h, SCREEN_DPI) * zoom;
      // صفحةٌ بالعربية: المحور الأفقي يُقاس من اليمين.
      const x = (rect.right - e.clientX - bleedX) / w - drag.dx;
      const y = (e.clientY - rect.top - bleedY) / h - drag.dy;
      setCanvas((c) => ({
        ...c,
        elements: c.elements.map((el) =>
          el.id === drag.id && !el.locked ? { ...el, box: clampBox({ ...el.box, x, y }) } : el
        )
      }));
    },
    [canvas.bleed, canvas.size.h, canvas.size.w, zoom]
  );

  const selected = canvas.elements.find((el) => el.id === picked) ?? null;

  // ── الحفظ والطباعة ─────────────────────────────────────────────────
  const save = useCallback(async () => {
    const name = title.trim();
    if (!name) {
      say('سمِّ التصميم قبل الحفظ', 'warn');
      return;
    }
    setBusy(true);
    try {
      const saved = await window.diwan.templates.save({
        id: designId,
        code: null,
        title: name,
        subtitle: `${canvas.size.w.toFixed(1)} × ${canvas.size.h.toFixed(1)} ملم`,
        category: DESIGN_CATEGORY,
        subjectLine: null,
        bodyHtml: canvas.elements
          .filter((el): el is TextElement => el.kind === 'text')
          .map((el) => textOf(el.inlines))
          .join('\n'),
        letterheadId: null,
        variables: [],
        doc
      });
      setDesignId(saved.id);
      await loadDesigns();
      onChanged?.();
      say('حُفظ التصميم');
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ التصميم'), 'warn');
    } finally {
      setBusy(false);
    }
  }, [title, designId, canvas, doc, loadDesigns, onChanged, say]);

  /** الطباعة ترسم بـ٣٠٠ نقطة/إنش — لا بما على الشاشة. */
  const print = useCallback(async () => {
    setBusy(true);
    try {
      const sheet = renderCanvasHtml(doc, values, {
        dpi: PRINT_DPI,
        missing: 'blank',
        marks: canvas.cropMarks
      });
      const px = canvasPx(canvas, PRINT_DPI);
      const out = await window.diwan.output.print({
        sheetHtml: `<div class="print-sheet" style="width:${px.w}px;height:${px.h}px">${sheet}</div>`,
        printer: printer?.name ?? null,
        copies: Math.max(1, copies),
        silent: false
      });
      say(
        out.ok ? `أُرسلت ${copies} نسخة` : out.reason || 'لم تتم الطباعة',
        out.ok ? 'ok' : 'warn'
      );
    } catch (e) {
      say(errorText(e, 'تعذّرت الطباعة'), 'warn');
    } finally {
      setBusy(false);
    }
  }, [doc, values, canvas, printer, copies, say]);

  const openDesign = useCallback(
    async (id: number) => {
      try {
        const loaded = await window.diwan.templates.doc(id);
        setCanvas(normalizeCanvas(loaded.canvas));
        setTitle(loaded.meta.title ?? '');
        setValues({});
        setDesignId(id);
        setPicked(null);
        say('فُتح التصميم');
      } catch (e) {
        say(errorText(e, 'تعذّر فتح التصميم'), 'warn');
      }
    },
    [say]
  );

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ── الأدوات ──────────────────────────────────────────────── */}
        <section className="w-[420px] shrink-0 overflow-auto border-l border-outline-variant bg-surface-container-low p-space-lg space-y-space-md">
          <header>
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              التصاميم
            </h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              شهادة · هوية · ملصق · دعوة — تُفتح وتُملأ وتُطبع
            </p>
          </header>

          <input
            className="w-full h-9 px-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant font-body-sm text-body-sm text-on-surface"
            data-title
            placeholder="اسم التصميم — مثال: هوية طالب"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* الخلفية */}
          <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm">
            <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">الخلفية</h2>
            <button
              className="w-full h-10 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5"
              data-act="background"
              type="button"
              onClick={() => void openBackground()}
            >
              <span className="material-symbols-outlined text-[18px]">image</span>
              افتح تصميمًا (صورة)
            </button>
            <p className="font-label-sm text-label-sm text-on-surface-variant" data-size>
              المقاس {canvas.size.w.toFixed(1)} × {canvas.size.h.toFixed(1)} ملم
              {canvas.background.kind === 'image' && canvas.background.dpi
                ? ` · ${canvas.background.dpi} نقطة/إنش`
                : canvas.background.kind === 'image'
                  ? ' · الدقّة مجهولة'
                  : ''}
            </p>

            {(askSize || canvas.background.kind !== 'image') && (
              <div className="space-y-space-xs">
                <select
                  className="w-full h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
                  data-preset
                  value=""
                  onChange={(e) => {
                    const preset = SIZE_PRESETS.find((p) => p.key === e.target.value);
                    if (!preset) return;
                    setCanvas((c) => ({
                      ...c,
                      size: { ...preset.size },
                      bleed: preset.bleed ? BLEED_MM : 0,
                      cropMarks: preset.bleed
                    }));
                    setAskSize(false);
                  }}
                >
                  <option value="">اختر مقاسًا معياريًّا…</option>
                  {SIZE_PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} — {p.size.w} × {p.size.h} ملم
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-space-sm">
                  <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                    عرض
                    <input
                      className={NUM}
                      inputMode="decimal"
                      value={canvas.size.w}
                      onChange={(e) =>
                        setCanvas((c) => ({
                          ...c,
                          size: { ...c.size, w: Number(e.target.value) || c.size.w }
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                    ارتفاع
                    <input
                      className={NUM}
                      inputMode="decimal"
                      value={canvas.size.h}
                      onChange={(e) =>
                        setCanvas((c) => ({
                          ...c,
                          size: { ...c.size, h: Number(e.target.value) || c.size.h }
                        }))
                      }
                    />
                  </label>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">ملم</span>
                </div>
              </div>
            )}

            <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <input
                checked={canvas.bleed > 0}
                type="checkbox"
                onChange={(e) =>
                  setCanvas((c) => ({
                    ...c,
                    bleed: e.target.checked ? BLEED_MM : 0,
                    cropMarks: e.target.checked
                  }))
                }
              />
              نزفٌ ٣ ملم وعلامات قصّ
            </label>
          </div>

          {/* الحقول */}
          <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm">
            <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
              ضع حقلًا فوق التصميم
            </h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              اكتبه هكذا: <span className="font-mono">{'{اسم الطالب}'}</span> — والنصّ الثابت يُكتب
              كما هو. ثم اسحبه إلى مكانه.
            </p>
            <AddBox onAdd={(label) => addText(label, { x: 0.3, y: 0.45, w: 0.4, h: 0.1 })} />
          </div>

          {/* خصائص المحدَّد */}
          {selected && selected.kind === 'text' && (
            <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
                  العنصر المحدَّد
                </h2>
                <button
                  className={ICON}
                  title="احذف العنصر"
                  type="button"
                  onClick={() => removeElement(selected.id)}
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
              <input
                className="w-full h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-body-sm text-body-sm text-on-surface"
                data-element-text
                value={textOf(selected.inlines)}
                onChange={(e) => patchElement(selected.id, { inlines: inlinesOf(e.target.value) })}
              />
              <div className="flex items-center gap-space-sm flex-wrap">
                <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                  حجم
                  <input
                    className={NUM}
                    inputMode="numeric"
                    title="حجم الخط بالنقاط"
                    value={selected.size}
                    onChange={(e) =>
                      patchElement(selected.id, { size: Number(e.target.value) || selected.size })
                    }
                  />
                  نقطة
                </label>
                <select
                  className="h-8 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
                  title="المحاذاة"
                  value={selected.align}
                  onChange={(e) =>
                    patchElement(selected.id, { align: e.target.value as TextElement['align'] })
                  }
                >
                  <option value="right">يمين</option>
                  <option value="center">وسط</option>
                  <option value="left">يسار</option>
                </select>
                <select
                  className="h-8 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
                  title="اتجاه النصّ"
                  value={selected.dir ?? 'rtl'}
                  onChange={(e) =>
                    patchElement(selected.id, { dir: e.target.value as 'rtl' | 'ltr' })
                  }
                >
                  <option value="rtl">عربي</option>
                  <option value="ltr">لاتيني</option>
                </select>
                <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                  <input
                    checked={selected.bold ?? false}
                    type="checkbox"
                    onChange={(e) => patchElement(selected.id, { bold: e.target.checked })}
                  />
                  عريض
                </label>
                <input
                  className="w-10 h-8 rounded border border-outline-variant bg-surface-container-low"
                  title="اللون"
                  type="color"
                  value={selected.color}
                  onChange={(e) => patchElement(selected.id, { color: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* القيم */}
          {doc.fields.length > 0 && (
            <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm">
              <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
                املأ الحقول ({doc.fields.length})
              </h2>
              {doc.fields.map((f) => (
                <label key={f.key} className="flex flex-col gap-1">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {f.label}
                  </span>
                  <input
                    className="h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-body-sm text-body-sm text-on-surface"
                    data-value={f.key}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          )}

          {/* المحفوظة */}
          {designs.length > 0 && (
            <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-xs">
              <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
                تصاميمُ محفوظة ({designs.length})
              </h2>
              {designs.map((d) => (
                <button
                  key={d.id}
                  className="w-full text-right rounded-lg px-space-sm py-1.5 hover:bg-surface-container-high font-body-sm text-body-sm text-on-surface"
                  type="button"
                  onClick={() => void openDesign(d.id)}
                >
                  {d.title}
                  {d.subtitle && <span className="text-on-surface-variant"> — {d.subtitle}</span>}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── اللوحة ───────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col min-w-0">
          <div className="h-14 px-space-lg flex items-center gap-space-sm border-b border-outline-variant bg-surface-container-lowest">
            <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
              {Math.round(zoom * 100)}٪
            </span>
            <input
              className="w-32"
              max={1}
              min={0.15}
              step={0.05}
              type="range"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <div className="flex-1" />
            <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
              نسخ
              <input
                className={NUM}
                inputMode="numeric"
                title="عدد النسخ"
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value.replace(/[^\d]/g, '')) || 1)}
              />
            </label>
            <button
              className="h-9 px-space-md rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
              data-act="save"
              title="احفظ التصميم"
              type="button"
              disabled={busy}
              onClick={() => void save()}
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              حفظ
            </button>
            <button
              className="h-9 px-space-md rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-md disabled:opacity-50"
              data-act="print"
              title="اطبع بـ٣٠٠ نقطة/إنش — بلا إصدار"
              type="button"
              disabled={busy}
              onClick={() => void print()}
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              اطبع
            </button>
          </div>

          <div
            ref={deskRef}
            className="flex-1 overflow-auto flex items-start justify-center p-space-xl"
            onMouseLeave={() => (dragRef.current = null)}
            onMouseMove={onSheetMove}
            onMouseUp={() => (dragRef.current = null)}
          >
            <div className="shrink-0" style={{ width: page.w * zoom, height: page.h * zoom }}>
              <div
                ref={sheetRef}
                className="shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)]"
                data-design
                style={{
                  width: page.w,
                  height: page.h,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top right',
                  position: 'relative'
                }}
              >
                <div dangerouslySetInnerHTML={{ __html: html }} />

                {/* مقابضُ التحديد فوق الرسم — لا داخله، فالمطبوع لا يحملها. */}
                {canvas.elements.map((el) => {
                  const offset = mmToPx(canvas.bleed, SCREEN_DPI);
                  const w = mmToPx(canvas.size.w, SCREEN_DPI);
                  const h = mmToPx(canvas.size.h, SCREEN_DPI);
                  return (
                    <div
                      key={el.id}
                      className={`absolute cursor-move ${
                        el.id === picked
                          ? 'outline outline-2 outline-primary'
                          : 'hover:outline hover:outline-1 hover:outline-outline-variant'
                      }`}
                      data-handle={el.id}
                      style={{
                        right: offset + el.box.x * w,
                        top: offset + el.box.y * h,
                        width: el.box.w * w,
                        height: el.box.h * h,
                        zIndex: 5000 + el.z
                      }}
                      onMouseDown={(e) => {
                        const rect = sheetRef.current!.getBoundingClientRect();
                        setPicked(el.id);
                        dragRef.current = {
                          id: el.id,
                          dx: (rect.right - e.clientX - offset * zoom) / (w * zoom) - el.box.x,
                          dy: (e.clientY - rect.top - offset * zoom) / (h * zoom) - el.box.y
                        };
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${
            toast.tone === 'ok' ? 'bg-secondary text-on-primary' : 'bg-error text-on-error'
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

/** صندوقُ إضافةٍ صغير — يُكتب النصّ ويُضاف، ثم يُسحب إلى مكانه. */
function AddBox({ onAdd }: { onAdd: (label: string) => void }) {
  const [text, setText] = useState('');
  const add = () => {
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText('');
  };
  return (
    <div className="flex items-center gap-space-sm">
      <input
        className="flex-1 h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-body-sm text-body-sm text-on-surface"
        data-add-text
        placeholder="{اسم الطالب}"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
      />
      <button
        className="h-9 px-space-md rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md whitespace-nowrap"
        data-act="add"
        type="button"
        onClick={add}
      >
        أضف
      </button>
    </div>
  );
}
