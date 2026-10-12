/**
 * رسم صفحات محرّر PDF (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو: المصغّرات بمفتاح دورانها وقصّها، والصفحة الحالية
 * بمقاس مكانها ودقّة الشاشة.
 */
import { type PageRef, shownSize, totalRotation, type FracBox } from '@shared/pdfEdit';
import { useEffect } from 'react';
import { cropCanvas, drawShown, type Src } from './pdfPages';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';

export function usePdfThumbs(
  ctx: {
    pages: PageRef[];
    thumbs: Record<string, string>;
    sources: Record<string, Src>;
    setThumbs: Dispatch<SetStateAction<Record<string, string>>>;
    currentRef: PageRef | null;
    setView: Dispatch<SetStateAction<{ url: string; w: number; h: number; } | null>>;
    crop: FracBox | null;
    stage: MutableRefObject<HTMLDivElement | null>;
    current: string | null;
  }
) {
  const { pages, thumbs, sources, setThumbs, currentRef, setView, crop, stage, current } = ctx;

  const thumbKey = (r: PageRef) => `${r.source}:${r.index}:${r.rotate}:${JSON.stringify(r.crop ?? null)}`;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const r of pages) {
        const key = thumbKey(r);
        if (cancelled || thumbs[key] || !sources[r.source]) continue;
        const c = cropCanvas(await drawShown(sources[r.source]!, r.index, r.rotate, r.crop ? 110 / r.crop.w : 110), r.crop);
        if (cancelled) return;
        setThumbs((t) => ({ ...t, [key]: c.toDataURL('image/jpeg', 0.8) }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, sources]);

  useEffect(() => {
    let cancelled = false;
    if (!currentRef || !sources[currentRef.source]) {
      setView(null);
      return;
    }
    void (async () => {
      const src = sources[currentRef.source]!;
      // في القصّ تُرى الصفحة كاملةً وعليها صندوقه؛ وبعده تُرى مقصوصة.
      const shownCrop = crop ? undefined : currentRef.crop;
      const box = stage.current?.getBoundingClientRect();
      const maxW = Math.max(320, (box?.width ?? 640) - 32);
      const maxH = Math.max(320, (box?.height ?? 800) - 32);
      const info = src.pages[currentRef.index]!;
      const s = shownSize(info, totalRotation(info.rotation, currentRef.rotate));
      const aspect = (s.h * (shownCrop?.h ?? 1)) / (s.w * (shownCrop?.w ?? 1));
      const w = Math.min(maxW, maxH / aspect);
      const dpr = window.devicePixelRatio || 1;
      const full = await drawShown(src, currentRef.index, currentRef.rotate, (w * dpr) / (shownCrop?.w ?? 1));
      if (cancelled) return;
      setView({ url: cropCanvas(full, shownCrop).toDataURL('image/png'), w, h: w * aspect });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, currentRef?.rotate, JSON.stringify(currentRef?.crop ?? null), sources, crop === null]);

  return { thumbKey };
}
