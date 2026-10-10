/**
 * من أين يأتي التصميم: خلفيةٌ بمقاسها من الملف، واستيرادٌ من Word وPhotoshop وPDF، والمعرض، وتصميمٌ فارغ —
 * وما يُضاف فوقه من الرسومات وصور الجهاز.
 */
import { useCallback, useState } from 'react';
import type { FieldSuggestion } from '@shared/api';
import { clampBox, emptyCanvas, imageElement, normalizeCanvas, pathElement, type Canvas, type CanvasElement, type CanvasSize } from '@shared/canvas';
import { startCanvasHistory, type CanvasHistory } from '@shared/canvasEdit';
import { buildDesign } from '@shared/design/kit';
import { svgToDataUrl, type ClipartItem } from '@shared/clipart';
import { elementBox, type LibraryElement } from '@shared/design/elements';
import type { BundledElement } from '@shared/assets/elements';
import { errorText } from '../../lib/errors';
import type { GalleryPick } from '../Gallery';
import type { Side } from './useCanvasSides';

type Inputs = {
  say: (text: string, tone?: 'ok' | 'warn') => void;
  canvas: Canvas;
  apply: (next: Canvas, commit?: boolean) => void;
  add: (el: CanvasElement) => void;
  title: string;
  setTitle: (title: string) => void;
  setHistory: (h: CanvasHistory) => void;
  setBackHistory: (h: CanvasHistory | null) => void;
  setActiveSide: (side: Side) => void;
  setValues: (values: Record<string, string>) => void;
  setSelection: (ids: string[]) => void;
  setDesignId: (id: number | null) => void;
  setBatchMap: (map: Record<string, string | null>) => void;
  setView: (view: 'gallery' | 'editor') => void;
  /** جلسةٌ جديدة قبل أن يُبدَّل ما في اللوحة (`useDesignDraft`). */
  beginSession: () => void;
};

export function useDesignSources(i: Inputs) {
  const { say, canvas, apply, add, title } = i;
  const [askSize, setAskSize] = useState(false);
  /** حقولٌ مقترحة من أسماء طبقات Photoshop — تُعرض بعد الاستيراد (هـ٤). */
  const [layerReview, setLayerReview] = useState<FieldSuggestion[] | null>(null);
  /** ملاحظات آخر استيراد كلّها (٢٫١): ما صار وما لم يُنقل — تبقى حتى تُغلق. */
  const [importNotes, setImportNotes] = useState<{ where: string; lines: string[] } | null>(null);

  /**
   * تصميمٌ جديد في اللوحة — لا تعديلٌ على المفتوح. فالاستيراد من المعرض كان يحلّ في التصميم المفتوح قبله (بظهره ورقمه)،
   * فيكتب «احفظ» فوقه (DESIGNS.md ٠٫٦).
   */
  const fresh = (next: Canvas, newTitle: string) => {
    i.beginSession();
    i.setDesignId(null);
    i.setBatchMap({});
    i.setTitle(newTitle);
    i.setSelection([]);
    i.setBackHistory(null);
    i.setActiveSide('front');
    i.setValues({});
    i.setHistory(startCanvasHistory(next));
    i.setView('editor');
  };

  // ── الخلفية: المقاس من الملف ───────────────────────────────────────
  /** `asNew`: من المعرض — تصميمٌ جديد على الخلفية؛ ومن المحرّر خلفيةٌ للمفتوح. */
  const openBackground = useCallback(async (asNew = false) => {
    try {
      const out = await window.diwan.files.pickBackground('designs');
      if (!out) return;
      const next: Canvas = {
        ...(asNew ? emptyCanvas(canvas.size) : canvas),
        background: out.meta?.dpi ? { kind: 'image', src: out.src, dpi: out.meta.dpi } : { kind: 'image', src: out.src },
        size: out.meta?.mm ? { w: out.meta.mm.w, h: out.meta.mm.h } : canvas.size
      };
      if (asNew) fresh(next, '');
      else {
        i.setView('editor');
        apply(next);
      }

      if (out.meta?.mm) {
        setAskSize(false);
        say(`المقاس من الملف: ${out.meta.mm.w.toFixed(1)} × ${out.meta.mm.h.toFixed(1)} ملم عند ${out.meta.dpi} نقطة/إنش`);
      } else {
        // الملف سكت عن دقّته — فيُسأل المكتب ولا يُخمَّن له.
        setAskSize(true);
        say('الملف لا يذكر دقّته — اختر المقاس أو اكتبه بالملّم', 'warn');
      }
    } catch (e) {
      say(errorText(e, 'تعذّر فتح الخلفية'), 'warn');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, apply, say]);

  /**
   * استيرادٌ من Word أو Photoshop أو PDF — لا من الصور وحدها.
   *
   * وWord يعطي مواضعَ مربّعاته فتخرج الشهادة كما صُمّمت، لا كومةَ أسطر.
   */
  const importDesign = useCallback(async (asNew = false) => {
    try {
      const out = await window.diwan.designs.import(askSize ? canvas.size : null);
      if (!out) return;
      const name = out.name.replace(/\.[^.]+$/, '');
      if (asNew) fresh(out.canvas ? normalizeCanvas(out.canvas) : emptyCanvas(canvas.size), name);
      else i.setView('editor');

      if (out.canvas) {
        if (!asNew) apply(normalizeCanvas(out.canvas));
        i.setSelection([]);
        setAskSize(false);
        if (out.fieldSuggestions?.length) setLayerReview(out.fieldSuggestions);
      } else {
        setAskSize(true);
      }
      if (!asNew && !title.trim()) i.setTitle(name);

      const where = out.source === 'word' ? 'Word' : out.source === 'psd' ? 'Photoshop' : out.source === 'pdf' ? 'PDF' : 'صورة';
      // الملاحظات كلّها في لوح (٢٫١) — والتنبيه بأوّلها كما كان.
      setImportNotes(out.warnings.length > 1 ? { where, lines: out.warnings } : null);
      say(
        out.size
          ? `${where}: ${out.size.w.toFixed(1)} × ${out.size.h.toFixed(1)} ملم` + (out.warnings.length ? ` — ${out.warnings[0]}` : '')
          : out.warnings[0] || 'الملف لا يذكر مقاسه — اختره',
        out.size ? 'ok' : 'warn'
      );
    } catch (e) {
      say(errorText(e, 'تعذّر استيراد التصميم'), 'warn');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.size, askSize, title, apply, say]);

  /**
   * تصميمٌ من المعرض: يُبنى بهويّة الجهة ويُفتح، ولا يُزرع في القاعدة.
   *
   * فالبرنامج يبدأ فارغًا من كل ما يخصّ الجهة — والمعرض **اقتراحٌ**: لا يدخل
   * المكتبة حتى يضغط المكتب «حفظ»، فيصير حينها نسخةً ملكَه يعدّلها كيف شاء.
   */
  const pickFromGallery = useCallback(
    ({ kind, style, palette, brand }: GalleryPick) => {
      fresh(buildDesign({ kind: kind.key, style, palette, brand }), brand.name ? `${kind.title} — ${brand.name}` : kind.title);
      setAskSize(false);
      say(`${kind.title} — املأه، أو الصق قائمةً كاملة في «دفعة»`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say]
  );

  const handleCreateBlank = useCallback(
    (size: CanvasSize, bleed = 0, customTitle = '') => {
      fresh(emptyCanvas(size, bleed), customTitle);
      say(customTitle ? `بدء تصميم فارغ: ${customTitle}` : 'بدء تصميم فارغ جديد');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say]
  );

  const handleSelectClipart = useCallback(
    (item: ClipartItem) => {
      add(imageElement({ box: clampBox({ x: 0.35, y: 0.35, w: 0.3, h: 0.3 }), src: svgToDataUrl(item.svg), fit: 'contain' }));
      say(`أُدرجت رسمة «${item.name}» في اللوحة`);
    },
    [add, say]
  );

  /** عنصرٌ من «مكتبة العناصر» (DESIGNS.md ٠٫٨): بمساره في المخزن، وبنسبة أبعاده — فلا تُمطّ الأيقونة. */
  const handleSelectElement = useCallback(
    (el: LibraryElement) => {
      add(imageElement({ box: elementBox(el, canvas.size), src: el.file, fit: 'contain', name: el.name }));
      say(`أُدرج «${el.name}» في اللوحة`);
    },
    [add, say, canvas.size]
  );

  /**
   * صورةٌ ثابتة من الجهاز — تُحفظ في المخزن باسم بصمتها كسائر الصور (§١٧).
   * وكانت تُقرأ dataURL وتُكتب داخل التصميم نفسه، فتنتفخ القاعدة بكل صورة.
   */
  const pickLocalImage = useCallback(async () => {
    const src = await window.diwan.files.pickImage('designs');
    if (!src) return;
    add(imageElement({ box: clampBox({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }), src, fit: 'contain' }));
    say('أُدرجت الصورة في اللوحة');
  }, [add, say]);

  /** أيقونةٌ أو زخرفةٌ من عناصر ديوان (DESIGNS.md ١٫٤): شكلٌ حرٌّ مربّعٌ بالملّم في الوسط — يُلوَّن ويُدرَّج كسائر الأشكال. */
  const handleSelectVector = useCallback(
    (item: BundledElement) => {
      const side = Math.min(canvas.size.w, canvas.size.h) / 4;
      const [w, h] = [side / canvas.size.w, side / canvas.size.h];
      add(pathElement({ box: clampBox({ x: (1 - w) / 2, y: (1 - h) / 2, w, h }), d: item.d, fill: '#1f3a8a', name: item.name }));
      say(`أُدرجت «${item.name}» — لوّنها من خصائصها`);
    },
    [add, say, canvas.size]
  );

  return {
    askSize, setAskSize, layerReview, setLayerReview, importNotes, setImportNotes, openBackground, importDesign, pickFromGallery, handleCreateBlank, handleSelectClipart,
    handleSelectElement, handleSelectVector, pickLocalImage
  };
}
