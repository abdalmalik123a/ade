/**
 * من أين يأتي التصميم: خلفيةٌ بمقاسها من الملف، واستيرادٌ من Word وPhotoshop وPDF، والمعرض، وتصميمٌ فارغ —
 * وما يُضاف فوقه من الرسومات وصور الجهاز.
 */
import { useCallback, useState } from 'react';
import type { FieldSuggestion } from '@shared/api';
import { clampBox, emptyCanvas, imageElement, normalizeCanvas, type Canvas, type CanvasElement, type CanvasSize } from '@shared/canvas';
import { startCanvasHistory, type CanvasHistory } from '@shared/canvasEdit';
import { buildDesign } from '@shared/design/kit';
import { svgToDataUrl, type ClipartItem } from '@shared/clipart';
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
};

export function useDesignSources(i: Inputs) {
  const { say, canvas, apply, add, title } = i;
  const [askSize, setAskSize] = useState(false);
  /** حقولٌ مقترحة من أسماء طبقات Photoshop — تُعرض بعد الاستيراد (هـ٤). */
  const [layerReview, setLayerReview] = useState<FieldSuggestion[] | null>(null);

  // ── الخلفية: المقاس من الملف ───────────────────────────────────────
  const openBackground = useCallback(async () => {
    try {
      const out = await window.diwan.files.pickBackground('designs');
      if (!out) return;
      i.setView('editor');
      apply({
        ...canvas,
        background: out.meta?.dpi ? { kind: 'image', src: out.src, dpi: out.meta.dpi } : { kind: 'image', src: out.src },
        size: out.meta?.mm ? { w: out.meta.mm.w, h: out.meta.mm.h } : canvas.size
      });

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
  const importDesign = useCallback(async () => {
    try {
      const out = await window.diwan.designs.import(askSize ? canvas.size : null);
      if (!out) return;
      i.setView('editor');

      if (out.canvas) {
        apply(normalizeCanvas(out.canvas));
        i.setSelection([]);
        setAskSize(false);
        if (out.fieldSuggestions?.length) setLayerReview(out.fieldSuggestions);
      } else {
        setAskSize(true);
      }
      if (!title.trim()) i.setTitle(out.name.replace(/\.[^.]+$/, ''));

      const where = out.source === 'word' ? 'Word' : out.source === 'psd' ? 'Photoshop' : out.source === 'pdf' ? 'PDF' : 'صورة';
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
      i.setHistory(startCanvasHistory(buildDesign({ kind: kind.key, style, palette, brand })));
      i.setBackHistory(null);
      i.setActiveSide('front');
      i.setValues({});
      i.setSelection([]);
      i.setDesignId(null);
      i.setBatchMap({});
      setAskSize(false);
      i.setTitle(brand.name ? `${kind.title} — ${brand.name}` : kind.title);
      i.setView('editor');
      say(`${kind.title} — املأه، أو الصق قائمةً كاملة في «دفعة»`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say]
  );

  const handleCreateBlank = useCallback(
    (size: CanvasSize, bleed = 0, customTitle = '') => {
      i.setDesignId(null);
      i.setBatchMap({});
      i.setTitle(customTitle);
      i.setSelection([]);
      i.setBackHistory(null);
      i.setActiveSide('front');
      i.setValues({});
      i.setHistory(startCanvasHistory(emptyCanvas(size, bleed)));
      i.setView('editor');
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

  return { askSize, setAskSize, layerReview, setLayerReview, openBackground, importDesign, pickFromGallery, handleCreateBlank, handleSelectClipart, pickLocalImage };
}
