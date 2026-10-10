/**
 * «حسّن الصورة» (DESIGNS.md ٢٫٢): الصورة بحدّ العمل (`workPixels` كالصور الشخصية) ← تعديلاتٌ تُرى فورًا على معاينةٍ مصغَّرة ←
 * «استعمل» يرسمها بمقاسها كاملًا ويحفظها في المخزن (`files:storeImage`) فتحلّ محلّ صورة العنصر، والتراجع يعيدها.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { autoEnhance, NEUTRAL } from '@shared/portraitEnhance';
import { isEdited, NO_EDIT, type PhotoEdit } from '@shared/photoEdit';
import { loadImage, workPixels } from '../../lib/portraitCanvas';
import { encodeEdit, renderEdit, renderPreview } from './photoCanvas';

export function usePhotoEdit(src: string) {
  const [edit, setEdit] = useState<PhotoEdit>(NO_EDIT);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<HTMLCanvasElement | null>(null);
  const source = useRef<{ canvas: HTMLCanvasElement; w: number; h: number; pixels: Uint8ClampedArray } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const work = workPixels(await loadImage(src.startsWith('data:') ? src : `diwan://store/${src}`));
      if (!alive) return;
      const canvas = document.createElement('canvas');
      canvas.width = work.width;
      canvas.height = work.height;
      canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(work.pixels), work.width, work.height), 0, 0);
      source.current = { canvas, w: work.width, h: work.height, pixels: work.pixels };
      setReady(true);
    })().catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [src]);

  // المعاينة بعد كلّ تعديل — في الإطار التالي، فالمنزلق لا يتعثّر.
  useEffect(() => {
    const s = source.current;
    if (!ready || !s) return;
    const id = requestAnimationFrame(() => setPreview(renderPreview(s.canvas, s.w, s.h, edit)));
    return () => cancelAnimationFrame(id);
  }, [ready, edit]);

  const patch = useCallback((p: Partial<PhotoEdit>) => setEdit((e) => ({ ...e, ...p })), []);
  const light = useCallback((p: Partial<PhotoEdit['enhance']>) => setEdit((e) => ({ ...e, enhance: { ...e.enhance, ...p } })), []);
  /** «تلقائي»: توازن الأبيض والإضاءة من الصورة نفسها، كالصور الشخصية. */
  const auto = useCallback(() => {
    const s = source.current;
    if (s) setEdit((e) => ({ ...e, enhance: autoEnhance(s.pixels, null, s.w, s.h) }));
  }, []);
  const reset = useCallback(() => setEdit(NO_EDIT), []);
  const resetLight = useCallback(() => setEdit((e) => ({ ...e, enhance: NEUTRAL, saturation: 0, smooth: 0 })), []);

  /** الصورة المعدَّلة في المخزن — ومسارها؛ و`null` إن لم يتغيّر شيء أو تعذّر. */
  const save = useCallback(async (): Promise<string | null> => {
    const s = source.current;
    if (!s || !isEdited(edit)) return null;
    setSaving(true);
    try {
      const bytes = await encodeEdit(renderEdit(s.canvas, s.w, s.h, edit));
      const path = bytes ? await window.diwan.files.storeImage(bytes) : null;
      if (!path) setError('تعذّر حفظ الصورة');
      return path;
    } finally {
      setSaving(false);
    }
  }, [edit]);

  return { edit, patch, light, auto, reset, resetLight, ready, saving, error, preview, size: source.current ? { w: source.current.w, h: source.current.h } : null, save };
}
