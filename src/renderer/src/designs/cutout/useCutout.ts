/**
 * إزالة خلفية الشيء في التصاميم (DESIGNS.md ٢٫٣): الصورة بكسلاتٍ بحدّ العمل (`workPixels` كالصور الشخصية) ← نموذج
 * الأشياء في العملية الرئيسة (`photos:cutoutObject`) ← قناعٌ تصحّحه فرشاتا «أبقِ» و«امسح» (`strokeAlpha` نفسها) ←
 * PNG شفّافة في المخزن (`files:storeImage`) تحلّ محلّ صورة العنصر، والتراجع يعيدها.
 *
 * وما كان شفّافًا في الأصل (شعارٌ PNG) يبقى شفّافًا: القناع يُضرب بشفافيّة الأصل. والألوان خارج الحافّة كما هي —
 * فما تعيده «أبقِ» يعود بلونه.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { strokeAlpha, type BrushMode } from '@shared/portraitMask';
import { loadImage, workPixels, type Work } from '../../lib/portraitCanvas';

export type CutoutPhase = 'loading' | 'running' | 'ready' | 'saving' | 'error';
type Rect = { x: number; y: number; w: number; h: number };

export function useCutout(src: string) {
  const [phase, setPhase] = useState<CutoutPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [ms, setMs] = useState(0);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const work = useRef<Work | null>(null);
  const cut = useRef<{ alpha: Uint8Array; model: Uint8Array; pixels: Uint8ClampedArray } | null>(null);

  /** مستطيلٌ من الصورة بشفافيّته الحاليّة — أثر الفرشاة وحده، أو الصورة كلّها. */
  const draw = useCallback((r?: Rect) => {
    const w = work.current;
    const c = cut.current;
    const ctx = canvas.current?.getContext('2d');
    if (!w || !c || !ctx) return;
    const { x, y, w: rw, h: rh } = r ?? { x: 0, y: 0, w: w.width, h: w.height };
    if (rw <= 0 || rh <= 0) return;
    const img = ctx.createImageData(rw, rh);
    for (let yy = 0; yy < rh; yy++) {
      for (let xx = 0; xx < rw; xx++) {
        const i = (y + yy) * w.width + (x + xx);
        const o = (yy * rw + xx) * 4;
        img.data[o] = c.pixels[i * 4]!;
        img.data[o + 1] = c.pixels[i * 4 + 1]!;
        img.data[o + 2] = c.pixels[i * 4 + 2]!;
        img.data[o + 3] = (c.alpha[i]! * w.pixels[i * 4 + 3]!) / 255;
      }
    }
    ctx.putImageData(img, x, y);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const w = workPixels(await loadImage(src.startsWith('data:') ? src : `diwan://store/${src}`));
      if (!alive) return;
      work.current = w;
      setPhase('running');
      const res = await window.diwan.photos.cutoutObject({ pixels: new Uint8Array(w.pixels.buffer, w.pixels.byteOffset, w.pixels.byteLength), width: w.width, height: w.height });
      if (!alive) return;
      cut.current = { alpha: Uint8Array.from(res.alpha), model: Uint8Array.from(res.alpha), pixels: new Uint8ClampedArray(res.pixels.buffer, res.pixels.byteOffset, res.pixels.byteLength) };
      setMs(res.ms);
      setPhase('ready');
    })().catch((e: unknown) => {
      if (!alive) return;
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e));
      setPhase('error');
    });
    return () => {
      alive = false;
    };
  }, [src]);

  /** اللوحة حين تظهر: بمقاس الصورة العاملة، ثم الصورة كلّها. */
  const mount = useCallback(
    (el: HTMLCanvasElement | null) => {
      canvas.current = el;
      if (!el || !work.current) return;
      el.width = work.current.width;
      el.height = work.current.height;
      draw();
    },
    [draw]
  );

  /** خطّ فرشاةٍ بإحداثيّات الصورة ونصف قطرها. */
  const paint = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }, radius: number, mode: BrushMode) => {
      const w = work.current;
      const c = cut.current;
      if (!w || !c) return;
      draw(strokeAlpha(c.alpha, w.width, w.height, from, to, radius, mode));
    },
    [draw]
  );

  /** «أعِد»: قناع النموذج كما خرج. */
  const reset = useCallback(() => {
    cut.current?.alpha.set(cut.current.model);
    draw();
  }, [draw]);

  /** الصورة الشفّافة في المخزن — ومسارها، أو `null` إن تعذّر. */
  const save = useCallback(async (): Promise<string | null> => {
    const el = canvas.current;
    if (!el) return null;
    setPhase('saving');
    const blob = await new Promise<Blob | null>((resolve) => el.toBlob(resolve, 'image/png'));
    const path = blob ? await window.diwan.files.storeImage(new Uint8Array(await blob.arrayBuffer())) : null;
    if (!path) {
      setError('تعذّر حفظ الصورة');
      setPhase('error');
    }
    return path;
  }, []);

  return { phase, error, ms, size: work.current ? { w: work.current.width, h: work.current.height } : null, mount, paint, reset, save };
}
