/**
 * التصاميم — الشهادة والهوية والملصق والدعوة.
 *
 * وهي لوحاتٌ لا وثائق متدفّقة: مقاسٌ ثابت وصفحةٌ واحدة وخلفيةٌ تملأ الورقة
 * وعناصرُ بمواضعها. ولذلك شاشةٌ ثالثة: لا الكتب ولا الأسئلة تصلح لها.
 *
 * وطريقُ العمل هو طريق المكتب نفسه: يُصمَّم في Word أو Photoshop أو يُشترى
 * جاهزًا، ثم **يُفتح هنا** فيُقرأ مقاسه من الملف، وتُوضع فوقه حقولٌ تُملأ وتُطبع.
 * فنحن لا نصمّم — نملأ ونطبع. والحقل هو الحقل نفسه، فالدمج يعمل بلا تغيير.
 *
 * والحساب كلّه في `shared/canvasEdit.ts`: الالتصاق والمحاذاة والتوزيع والطبقات
 * قواعدُ هندسية تُختبر بالأرقام، وهذه الشاشة تناديها ولا تحسب بنفسها.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PrinterInfo, TemplateSummary } from '@shared/api';
import { newUuid, reconcileFields, tokenInlines, type Doc, type Inline } from '@shared/doc';
import {
  BLEED_MM,
  PRINT_DPI,
  SCREEN_DPI,
  SIZE_PRESETS,
  barcodeElement,
  canvasDoc,
  canvasPx,
  clampBox,
  emptyCanvas,
  imageElement,
  mmToPx,
  normalizeCanvas,
  shapeElement,
  textElement,
  topZ,
  type Box,
  type Canvas,
  type CanvasElement,
  type TextElement
} from '@shared/canvas';
import {
  alignBoxes,
  cloneElements,
  commitCanvas,
  distribute,
  moveLayer,
  nudge,
  redoCanvas,
  resizeBox,
  snapBox,
  startCanvasHistory,
  undoCanvas,
  withBoxes,
  type AlignMode,
  type Edge,
  type Guide,
  type LayerMove
} from '@shared/canvasEdit';
import { renderCanvasHtml } from '@shared/canvasHtml';
import { barcodeSvg } from '@shared/barcode';
import { qrSvg } from '@shared/qr';
import { errorText } from '../lib/errors';

const DESIGN_CATEGORY = 'تصاميم';
const NUM =
  'w-20 h-8 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular font-label-md text-label-md text-on-surface';
const ICON =
  'w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors flex items-center justify-center';
const TOOL =
  'w-8 h-8 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors disabled:opacity-40';

/** خطوةُ السهم نسبةً، ومع Shift عشرة أضعافها. */
const NUDGE = 0.002;

type Toast = { text: string; tone: 'ok' | 'warn' } | null;

/** ما يجري سحبه الآن: تحريكٌ أو مقبض. */
type Drag =
  | { kind: 'move'; ids: string[]; from: { x: number; y: number }; boxes: Map<string, Box> }
  | { kind: 'resize'; id: string; edge: Edge; from: { x: number; y: number }; box: Box };

const textOf = (inlines: Inline[]): string =>
  inlines.map((n) => (n.kind === 'run' ? n.text : n.kind === 'field' ? `{${n.ref}}` : ' ')).join('');

/** `{اسم}` عقدةَ حقل — والمُرمِّز واحدٌ مع الترحيل والاستيراد (`shared/doc.ts`). */
const inlinesOf = tokenInlines;

const kindName = (el: CanvasElement): string =>
  el.kind === 'text'
    ? textOf(el.inlines).trim() || 'نصّ'
    : el.kind === 'image'
      ? el.ref
        ? `صورة {${el.ref}}`
        : 'صورة'
      : el.kind === 'barcode'
        ? `${el.symbology === 'qr' ? 'QR' : 'باركود'} ${el.ref ? `{${el.ref}}` : el.value}`
        : 'شكل';

export type DesignsScreenProps = {
  printer: PrinterInfo | null;
  onChanged?: () => void;
};

export default function DesignsScreen({ printer, onChanged }: DesignsScreenProps) {
  const [history, setHistory] = useState(() =>
    startCanvasHistory(emptyCanvas(SIZE_PRESETS[1]!.size))
  );
  const canvas = history.present;

  const [values, setValues] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [copies, setCopies] = useState(1);
  const [designId, setDesignId] = useState<number | null>(null);
  const [designs, setDesigns] = useState<TemplateSummary[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [askSize, setAskSize] = useState(false);
  const [preview, setPreview] = useState(false);
  const [grid, setGrid] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [zoom, setZoom] = useState(0.5);

  const sheetRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const beforeDrag = useRef<Canvas | null>(null);
  const toastTimer = useRef<number | null>(null);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  /** كل تغييرٍ منتهٍ يُقيَّد في التاريخ؛ وأثناء السحب يُبدَّل الحاضر بلا قيد. */
  const apply = useCallback((next: Canvas, commit = true) => {
    setHistory((h) => (commit ? commitCanvas(h, next) : { ...h, present: next }));
  }, []);

  const loadDesigns = useCallback(async () => {
    try {
      setDesigns(await window.diwan.templates.list(DESIGN_CATEGORY, 'print-only'));
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
    () => renderCanvasHtml(doc, values, { dpi: SCREEN_DPI, missing: preview ? 'blank' : 'token' }),
    [doc, values, preview]
  );

  /**
   * الباركود يُرسم بعد الحقن.
   *
   * فمحرّك الرسم يترك موضعه وقيمته فحسب — ولو بنى الـSVG بنفسه لصار على
   * `shared/canvasHtml.ts` أن يعرف Code128 وQR، وهو رسّامٌ لا مُرمِّز.
   */
  useEffect(() => {
    const root = paintRef.current;
    if (!root) return;
    for (const node of root.querySelectorAll<HTMLElement>('[data-barcode]')) {
      const value = node.dataset.value ?? '';
      if (!value) {
        node.innerHTML = '';
        continue;
      }
      try {
        node.innerHTML =
          node.dataset.barcode === 'qr' ? qrSvg(value) : barcodeSvg(value, { height: 40 });
      } catch {
        // قيمةٌ لا تُرمَّز (حروفٌ عربية في Code128) — تُترك فارغة ولا تُسقط الشاشة.
        node.innerHTML = '';
      }
    }
  }, [html]);

  const page = canvasPx(canvas, SCREEN_DPI);
  const pxW = mmToPx(canvas.size.w, SCREEN_DPI);
  const pxH = mmToPx(canvas.size.h, SCREEN_DPI);
  const offset = mmToPx(canvas.bleed, SCREEN_DPI);

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
      apply({
        ...canvas,
        background: out.meta?.dpi
          ? { kind: 'image', src: out.src, dpi: out.meta.dpi }
          : { kind: 'image', src: out.src },
        size: out.meta?.mm ? { w: out.meta.mm.w, h: out.meta.mm.h } : canvas.size
      });

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
  }, [canvas, apply, say]);

  /**
   * استيرادٌ من Word أو Photoshop أو PDF — لا من الصور وحدها.
   *
   * وWord يعطي مواضعَ مربّعاته فتخرج الشهادة كما صُمّمت، لا كومةَ أسطر.
   */
  const importDesign = useCallback(async () => {
    try {
      const out = await window.diwan.designs.import(askSize ? canvas.size : null);
      if (!out) return;

      if (out.canvas) {
        apply(normalizeCanvas(out.canvas));
        setSelection([]);
        setAskSize(false);
      } else {
        setAskSize(true);
      }
      if (!title.trim()) setTitle(out.name.replace(/\.[^.]+$/, ''));

      const where =
        out.source === 'word'
          ? 'Word'
          : out.source === 'psd'
            ? 'Photoshop'
            : out.source === 'pdf'
              ? 'PDF'
              : 'صورة';
      say(
        out.size
          ? `${where}: ${out.size.w.toFixed(1)} × ${out.size.h.toFixed(1)} ملم` +
              (out.warnings.length ? ` — ${out.warnings[0]}` : '')
          : out.warnings[0] || 'الملف لا يذكر مقاسه — اختره',
        out.size ? 'ok' : 'warn'
      );
    } catch (e) {
      say(errorText(e, 'تعذّر استيراد التصميم'), 'warn');
    }
  }, [canvas.size, askSize, title, apply, say]);

  // ── العناصر ────────────────────────────────────────────────────────
  const add = useCallback(
    (el: CanvasElement) => {
      apply({ ...canvas, elements: [...canvas.elements, { ...el, z: topZ(canvas.elements) + 1 }] });
      setSelection([el.id]);
    },
    [canvas, apply]
  );

  const patchElement = useCallback(
    (id: string, patch: Partial<CanvasElement>, commit = true) => {
      apply(
        {
          ...canvas,
          elements: canvas.elements.map((el) =>
            el.id === id ? ({ ...el, ...patch } as CanvasElement) : el
          )
        },
        commit
      );
    },
    [canvas, apply]
  );

  const removeSelected = useCallback(() => {
    if (!selection.length) return;
    apply({ ...canvas, elements: canvas.elements.filter((el) => !selection.includes(el.id)) });
    setSelection([]);
  }, [canvas, selection, apply]);

  const duplicateSelected = useCallback(() => {
    if (!selection.length) return;
    const made = cloneElements(canvas.elements, selection, newUuid);
    apply({ ...canvas, elements: [...canvas.elements, ...made] });
    setSelection(made.map((el) => el.id));
  }, [canvas, selection, apply]);

  const align = useCallback(
    (mode: AlignMode) => apply(withBoxes(canvas, selection, (boxes) => alignBoxes(boxes, mode))),
    [canvas, selection, apply]
  );

  const spread = useCallback(
    (axis: 'x' | 'y') => apply(withBoxes(canvas, selection, (boxes) => distribute(boxes, axis))),
    [canvas, selection, apply]
  );

  const layer = useCallback(
    (move: LayerMove) => apply({ ...canvas, elements: moveLayer(canvas.elements, selection, move) }),
    [canvas, selection, apply]
  );

  const toggleLock = useCallback(() => {
    const anyOpen = canvas.elements.some((el) => selection.includes(el.id) && !el.locked);
    apply({
      ...canvas,
      elements: canvas.elements.map((el) =>
        selection.includes(el.id) ? { ...el, locked: anyOpen } : el
      )
    });
  }, [canvas, selection, apply]);

  // ── السحب: نِسَبٌ لا بكسلات ────────────────────────────────────────
  /** موضعُ الفأرة نسبةً من مقاس التصميم — والمحور الأفقي من اليمين. */
  const pointAt = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = sheetRef.current!.getBoundingClientRect();
      return {
        x: (rect.right - e.clientX - offset * zoom) / (pxW * zoom),
        y: (e.clientY - rect.top - offset * zoom) / (pxH * zoom)
      };
    },
    [offset, pxW, pxH, zoom]
  );

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const at = pointAt(e);

      if (drag.kind === 'resize') {
        const box = resizeBox(
          drag.box,
          drag.edge,
          { dx: at.x - drag.from.x, dy: at.y - drag.from.y },
          e.shiftKey
        );
        patchElement(drag.id, { box } as Partial<CanvasElement>, false);
        return;
      }

      const dx = at.x - drag.from.x;
      const dy = at.y - drag.from.y;
      const moving = new Map<string, Box>();
      for (const id of drag.ids) {
        const start = drag.boxes.get(id);
        if (start) moving.set(id, clampBox({ ...start, x: start.x + dx, y: start.y + dy }));
      }

      // الالتصاق يُحسب على عنصرٍ واحد: التصاقُ مجموعةٍ يشدّها في اتجاهين.
      let hits: Guide[] = [];
      if (drag.ids.length === 1) {
        const id = drag.ids[0]!;
        const siblings = canvas.elements.filter((el) => el.id !== id).map((el) => el.box);
        const snapped = snapBox(moving.get(id)!, siblings);
        moving.set(id, snapped.box);
        hits = snapped.guides;
      }
      setGuides(hits);

      apply(
        {
          ...canvas,
          elements: canvas.elements.map((el) =>
            moving.has(el.id) && !el.locked ? { ...el, box: moving.get(el.id)! } : el
          )
        },
        false
      );
    },
    [canvas, apply, patchElement, pointAt]
  );

  /**
   * انتهاء السحب: قيدٌ واحد للسحبة كلّها.
   *
   * ولو قُيّد كل تحرّكٍ بالفأرة لامتلأ التاريخ بمئة خطوةٍ لا معنى لها، وصار
   * «تراجع» يزحف بالعنصر بكسلًا بكسلًا بدل أن يعيده إلى حيث كان.
   */
  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setGuides([]);
    const before = beforeDrag.current;
    beforeDrag.current = null;
    if (before) setHistory((h) => ({ past: [...h.past, before].slice(-60), present: h.present, future: [] }));
  }, []);

  // ── لوحة المفاتيح ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        setHistory(undoCanvas);
        return;
      }
      if (e.ctrlKey && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) {
        e.preventDefault();
        setHistory(redoCanvas);
        return;
      }
      if (e.ctrlKey && e.code === 'KeyD') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.code === 'Escape') {
        setSelection([]);
        return;
      }
      if (!selection.length) return;

      if (e.code === 'Delete') {
        e.preventDefault();
        removeSelected();
        return;
      }

      const arrows: Record<string, [number, number]> = {
        ArrowRight: [-1, 0],
        ArrowLeft: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1]
      };
      const move = arrows[e.code];
      if (move) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE * 10 : NUDGE;
        apply(
          withBoxes(canvas, selection, (boxes) => boxes.map((b) => nudge(b, move[0]!, move[1]!, step)))
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canvas, selection, apply, duplicateSelected, removeSelected]);

  const selected = canvas.elements.filter((el) => selection.includes(el.id));
  const single = selected.length === 1 ? selected[0]! : null;

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

  /** ورقةٌ بدقّة الطباعة، وباركودُها مرسومٌ فيها — لا مُؤجَّلٌ إلى المتصفّح. */
  const printSheet = useCallback((): string => {
    const px = canvasPx(canvas, PRINT_DPI);
    const body = renderCanvasHtml(doc, values, {
      dpi: PRINT_DPI,
      missing: 'blank',
      marks: canvas.cropMarks
    }).replace(
      /<div data-barcode="([^"]*)" data-value="([^"]*)" style="([^"]*)"><\/div>/g,
      (_all, kind: string, value: string, style: string) => {
        if (!value) return '';
        try {
          const svg = kind === 'qr' ? qrSvg(value) : barcodeSvg(value, { height: 40 });
          return `<div style="${style}">${svg}</div>`;
        } catch {
          return '';
        }
      }
    );
    return `<div class="print-sheet" style="width:${px.w}px;height:${px.h}px">${body}</div>`;
  }, [canvas, doc, values]);

  const print = useCallback(async () => {
    setBusy(true);
    try {
      const out = await window.diwan.output.print({
        sheetHtml: printSheet(),
        printer: printer?.name ?? null,
        copies: Math.max(1, copies),
        silent: false
      });
      say(out.ok ? `أُرسلت ${copies} نسخة` : out.reason || 'لم تتم الطباعة', out.ok ? 'ok' : 'warn');
    } catch (e) {
      say(errorText(e, 'تعذّرت الطباعة'), 'warn');
    } finally {
      setBusy(false);
    }
  }, [printSheet, printer, copies, say]);

  const openDesign = useCallback(
    async (id: number) => {
      try {
        const loaded = await window.diwan.templates.doc(id);
        setHistory(startCanvasHistory(normalizeCanvas(loaded.canvas)));
        setTitle(loaded.meta.title ?? '');
        setValues({});
        setDesignId(id);
        setSelection([]);
        say('فُتح التصميم');
      } catch (e) {
        say(errorText(e, 'تعذّر فتح التصميم'), 'warn');
      }
    },
    [say]
  );

  const EDGES: { edge: Edge; style: React.CSSProperties; cursor: string }[] = [
    { edge: 'nw', style: { top: -4, left: -4 }, cursor: 'nwse-resize' },
    { edge: 'ne', style: { top: -4, right: -4 }, cursor: 'nesw-resize' },
    { edge: 'sw', style: { bottom: -4, left: -4 }, cursor: 'nesw-resize' },
    { edge: 'se', style: { bottom: -4, right: -4 }, cursor: 'nwse-resize' },
    { edge: 'n', style: { top: -4, left: '50%', marginLeft: -4 }, cursor: 'ns-resize' },
    { edge: 's', style: { bottom: -4, left: '50%', marginLeft: -4 }, cursor: 'ns-resize' },
    { edge: 'w', style: { left: -4, top: '50%', marginTop: -4 }, cursor: 'ew-resize' },
    { edge: 'e', style: { right: -4, top: '50%', marginTop: -4 }, cursor: 'ew-resize' }
  ];

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ── الأدوات ──────────────────────────────────────────────── */}
        <section className="w-[420px] shrink-0 overflow-auto border-l border-outline-variant bg-surface-container-low p-space-lg space-y-space-md">
          <header>
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">التصاميم</h1>
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
            <button
              className="w-full h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5"
              data-act="import"
              title="Word · Photoshop · PDF — المقاس والمواضع من الملف"
              type="button"
              onClick={() => void importDesign()}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              استورد من Word أو Photoshop أو PDF
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
                    apply({
                      ...canvas,
                      size: { ...preset.size },
                      bleed: preset.bleed ? BLEED_MM : 0,
                      cropMarks: preset.bleed
                    });
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
                        apply({
                          ...canvas,
                          size: { ...canvas.size, w: Number(e.target.value) || canvas.size.w }
                        })
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
                        apply({
                          ...canvas,
                          size: { ...canvas.size, h: Number(e.target.value) || canvas.size.h }
                        })
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
                  apply({
                    ...canvas,
                    bleed: e.target.checked ? BLEED_MM : 0,
                    cropMarks: e.target.checked
                  })
                }
              />
              نزفٌ ٣ ملم وعلامات قصّ
            </label>
          </div>

          {/* الإضافة */}
          <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm">
            <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
              ضع عنصرًا فوق التصميم
            </h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              اكتبه هكذا: <span className="font-mono">{'{اسم الطالب}'}</span> — والنصّ الثابت يُكتب
              كما هو. ثم اسحبه إلى مكانه.
            </p>
            <AddBox
              onAdd={(label) =>
                add(
                  textElement({
                    box: clampBox({ x: 0.3, y: 0.45, w: 0.4, h: 0.1 }),
                    inlines: inlinesOf(label)
                  })
                )
              }
            />
            <div className="flex items-center gap-space-xs">
              <button
                className="h-8 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface"
                data-add="image"
                type="button"
                onClick={() =>
                  add(
                    imageElement({
                      box: clampBox({ x: 0.06, y: 0.2, w: 0.24, h: 0.55 }),
                      ref: 'صورة الطالب'
                    })
                  )
                }
              >
                + صورة حقل
              </button>
              <button
                className="h-8 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface"
                data-add="barcode"
                type="button"
                onClick={() =>
                  add(
                    barcodeElement({
                      box: clampBox({ x: 0.35, y: 0.78, w: 0.55, h: 0.14 }),
                      ref: 'الرقم'
                    })
                  )
                }
              >
                + باركود
              </button>
              <button
                className="h-8 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface"
                data-add="shape"
                type="button"
                onClick={() =>
                  add(
                    shapeElement({
                      box: clampBox({ x: 0.1, y: 0.1, w: 0.3, h: 0.1 }),
                      fill: 'transparent',
                      stroke: '#333333',
                      strokeWidth: 1
                    })
                  )
                }
              >
                + شكل
              </button>
            </div>
          </div>

          {/* خصائص المحدَّد */}
          {single && (
            <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-title-sm text-title-sm text-on-surface font-semibold truncate">
                  {kindName(single)}
                </h2>
                <div className="flex items-center gap-1 shrink-0">
                  <button className={ICON} title="اقفل / افتح" type="button" onClick={toggleLock}>
                    <span className="material-symbols-outlined text-[18px]">
                      {single.locked ? 'lock' : 'lock_open'}
                    </span>
                  </button>
                  <button
                    className={ICON}
                    title="كرّر (Ctrl+D)"
                    type="button"
                    onClick={duplicateSelected}
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  </button>
                  <button className={ICON} title="احذف" type="button" onClick={removeSelected}>
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>

              {single.kind === 'text' && (
                <>
                  <input
                    className="w-full h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-body-sm text-body-sm text-on-surface"
                    data-element-text
                    value={textOf(single.inlines)}
                    onChange={(e) => patchElement(single.id, { inlines: inlinesOf(e.target.value) })}
                  />
                  <div className="flex items-center gap-space-sm flex-wrap">
                    <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                      حجم
                      <input
                        className={NUM}
                        inputMode="numeric"
                        title="حجم الخط بالنقاط"
                        value={single.size}
                        onChange={(e) =>
                          patchElement(single.id, { size: Number(e.target.value) || single.size })
                        }
                      />
                      نقطة
                    </label>
                    <select
                      className="h-8 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
                      title="المحاذاة"
                      value={single.align}
                      onChange={(e) =>
                        patchElement(single.id, { align: e.target.value as TextElement['align'] })
                      }
                    >
                      <option value="right">يمين</option>
                      <option value="center">وسط</option>
                      <option value="left">يسار</option>
                    </select>
                    <select
                      className="h-8 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
                      title="اتجاه النصّ"
                      value={single.dir ?? 'rtl'}
                      onChange={(e) =>
                        patchElement(single.id, { dir: e.target.value as 'rtl' | 'ltr' })
                      }
                    >
                      <option value="rtl">عربي</option>
                      <option value="ltr">لاتيني</option>
                    </select>
                    <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                      <input
                        checked={single.bold ?? false}
                        type="checkbox"
                        onChange={(e) => patchElement(single.id, { bold: e.target.checked })}
                      />
                      عريض
                    </label>
                    <input
                      className="w-10 h-8 rounded border border-outline-variant bg-surface-container-low"
                      title="اللون"
                      type="color"
                      value={single.color}
                      onChange={(e) => patchElement(single.id, { color: e.target.value })}
                    />
                  </div>
                </>
              )}

              {(single.kind === 'image' || single.kind === 'barcode') && (
                <label className="flex flex-col gap-1">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    اسم الحقل الذي يملؤه
                  </span>
                  <input
                    className="h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-body-sm text-body-sm text-on-surface"
                    data-element-ref
                    value={single.ref ?? ''}
                    onChange={(e) => patchElement(single.id, { ref: e.target.value.trim() })}
                  />
                </label>
              )}

              {single.kind === 'barcode' && (
                <select
                  className="h-8 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
                  title="نوع الرمز"
                  value={single.symbology}
                  onChange={(e) =>
                    patchElement(single.id, { symbology: e.target.value as 'code128' | 'qr' })
                  }
                >
                  <option value="code128">Code128 — للأرقام واللاتيني</option>
                  <option value="qr">QR — يُقرأ بالهاتف</option>
                </select>
              )}
            </div>
          )}

          {/* الطبقات */}
          {canvas.elements.length > 0 && (
            <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-xs">
              <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
                الطبقات ({canvas.elements.length})
              </h2>
              {[...canvas.elements]
                .sort((a, b) => b.z - a.z)
                .map((el) => (
                  <button
                    key={el.id}
                    className={`w-full text-right rounded-lg px-space-sm py-1 font-label-sm text-label-sm flex items-center gap-1.5 ${
                      selection.includes(el.id)
                        ? 'bg-primary-container text-on-primary'
                        : 'text-on-surface hover:bg-surface-container-high'
                    }`}
                    data-layer={el.id}
                    type="button"
                    onClick={(e) =>
                      setSelection((s) =>
                        e.ctrlKey
                          ? s.includes(el.id)
                            ? s.filter((id) => id !== el.id)
                            : [...s, el.id]
                          : [el.id]
                      )
                    }
                  >
                    {el.locked && (
                      <span className="material-symbols-outlined text-[14px]">lock</span>
                    )}
                    <span className="truncate">{kindName(el)}</span>
                  </button>
                ))}
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
          <div className="h-14 px-space-lg flex items-center gap-space-sm border-b border-outline-variant bg-surface-container-lowest overflow-x-auto">
            <div className="flex items-center gap-1 shrink-0">
              <button
                className={TOOL}
                data-undo
                title="تراجع (Ctrl+Z)"
                type="button"
                onClick={() => setHistory(undoCanvas)}
              >
                <span className="material-symbols-outlined text-[18px]">undo</span>
              </button>
              <button
                className={TOOL}
                title="إعادة (Ctrl+Y)"
                type="button"
                onClick={() => setHistory(redoCanvas)}
              >
                <span className="material-symbols-outlined text-[18px]">redo</span>
              </button>
            </div>

            <div className="w-px h-6 bg-outline-variant shrink-0" />

            <div className="flex items-center gap-1 shrink-0">
              {(
                [
                  ['right', 'align_horizontal_right', 'حاذِ يمينًا'],
                  ['hCenter', 'align_horizontal_center', 'وسّط أفقيًّا'],
                  ['left', 'align_horizontal_left', 'حاذِ يسارًا'],
                  ['top', 'align_vertical_top', 'حاذِ أعلى'],
                  ['vCenter', 'align_vertical_center', 'وسّط عموديًّا'],
                  ['bottom', 'align_vertical_bottom', 'حاذِ أسفل']
                ] as [AlignMode, string, string][]
              ).map(([mode, icon, label]) => (
                <button
                  key={mode}
                  className={TOOL}
                  data-align={mode}
                  title={label}
                  type="button"
                  disabled={!selection.length}
                  onClick={() => align(mode)}
                >
                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                </button>
              ))}
              <button
                className={TOOL}
                data-spread="x"
                title="وزّع أفقيًّا"
                type="button"
                disabled={selection.length < 3}
                onClick={() => spread('x')}
              >
                <span className="material-symbols-outlined text-[18px]">horizontal_distribute</span>
              </button>
              <button
                className={TOOL}
                title="وزّع عموديًّا"
                type="button"
                disabled={selection.length < 3}
                onClick={() => spread('y')}
              >
                <span className="material-symbols-outlined text-[18px]">vertical_distribute</span>
              </button>
            </div>

            <div className="w-px h-6 bg-outline-variant shrink-0" />

            <div className="flex items-center gap-1 shrink-0">
              {(
                [
                  ['front', 'flip_to_front', 'إلى الأمام'],
                  ['forward', 'keyboard_arrow_up', 'خطوةً أمام'],
                  ['backward', 'keyboard_arrow_down', 'خطوةً خلف'],
                  ['back', 'flip_to_back', 'إلى الخلف']
                ] as [LayerMove, string, string][]
              ).map(([move, icon, label]) => (
                <button
                  key={move}
                  className={TOOL}
                  data-layer-move={move}
                  title={label}
                  type="button"
                  disabled={!selection.length}
                  onClick={() => layer(move)}
                >
                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-outline-variant shrink-0" />

            <button
              className={`${TOOL} ${grid ? 'bg-primary-container text-on-primary' : ''}`}
              title="شبكة بسنتيمتر"
              type="button"
              onClick={() => setGrid((g) => !g)}
            >
              <span className="material-symbols-outlined text-[18px]">grid_4x4</span>
            </button>
            <button
              className={`${TOOL} ${preview ? 'bg-primary-container text-on-primary' : ''}`}
              data-preview
              title="معاينة بلا مقابض"
              type="button"
              onClick={() => {
                setPreview((p) => !p);
                setSelection([]);
              }}
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
            </button>

            <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap shrink-0">
              {Math.round(zoom * 100)}٪
            </span>
            <input
              className="w-24 shrink-0"
              max={1}
              min={0.15}
              step={0.05}
              type="range"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />

            <div className="flex-1" />

            <div className="flex items-center gap-space-sm shrink-0">
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
          </div>

          <div
            ref={deskRef}
            className="flex-1 overflow-auto flex items-start justify-center p-space-xl"
            onMouseLeave={endDrag}
            onMouseMove={onMove}
            onMouseUp={endDrag}
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
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setSelection([]);
                }}
              >
                <div ref={paintRef} dangerouslySetInnerHTML={{ __html: html }} />

                {grid && !preview && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      zIndex: 4000,
                      backgroundImage:
                        'linear-gradient(to right, rgba(0,0,0,.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.07) 1px, transparent 1px)',
                      backgroundSize: `${mmToPx(10, SCREEN_DPI)}px ${mmToPx(10, SCREEN_DPI)}px`
                    }}
                  />
                )}

                {/* خطوط الإرشاد: الالتصاق يُرى، وبغيرها يبدو سحرًا. */}
                {guides.map((g, i) => (
                  <div
                    key={i}
                    className="absolute pointer-events-none bg-primary"
                    data-guide={g.axis}
                    style={
                      g.axis === 'x'
                        ? { right: offset + g.at * pxW, top: 0, bottom: 0, width: 1, zIndex: 9000 }
                        : { top: offset + g.at * pxH, right: 0, left: 0, height: 1, zIndex: 9000 }
                    }
                  />
                ))}

                {/* مقابضُ التحديد فوق الرسم — لا داخله، فالمطبوع لا يحملها. */}
                {!preview &&
                  canvas.elements.map((el) => {
                    const on = selection.includes(el.id);
                    return (
                      <div
                        key={el.id}
                        className={`absolute ${el.locked ? 'cursor-not-allowed' : 'cursor-move'} ${
                          on
                            ? 'outline outline-2 outline-primary'
                            : 'hover:outline hover:outline-1 hover:outline-outline-variant'
                        }`}
                        data-handle={el.id}
                        style={{
                          right: offset + el.box.x * pxW,
                          top: offset + el.box.y * pxH,
                          width: el.box.w * pxW,
                          height: el.box.h * pxH,
                          zIndex: 5000 + el.z
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const ids = e.ctrlKey
                            ? selection.includes(el.id)
                              ? selection
                              : [...selection, el.id]
                            : selection.includes(el.id)
                              ? selection
                              : [el.id];
                          setSelection(ids);
                          if (el.locked) return;
                          beforeDrag.current = canvas;
                          dragRef.current = {
                            kind: 'move',
                            ids,
                            from: pointAt(e),
                            boxes: new Map(
                              canvas.elements
                                .filter((x) => ids.includes(x.id))
                                .map((x) => [x.id, x.box])
                            )
                          };
                        }}
                      >
                        {on &&
                          !el.locked &&
                          single?.id === el.id &&
                          EDGES.map(({ edge, style, cursor }) => (
                            <div
                              key={edge}
                              className="absolute w-2 h-2 bg-surface border border-primary"
                              data-grip={edge}
                              style={{ ...style, cursor }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                beforeDrag.current = canvas;
                                dragRef.current = {
                                  kind: 'resize',
                                  id: el.id,
                                  edge,
                                  from: pointAt(e),
                                  box: el.box
                                };
                              }}
                            />
                          ))}
                      </div>
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
