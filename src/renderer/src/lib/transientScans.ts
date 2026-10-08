import { useCallback, useEffect, useRef } from 'react';

/**
 * مسحٌ عابر لحوارٍ يستنسخ هويّةً (مراجعة ٧ ت١): المسح يُكتب في `store/tmp/` ويُحذف حين يُغلق الحوار.
 *
 * كان كلّ مسحٍ يبقى في المخزن إلى الأبد (نحو ١١ م.ب) فتنتقل صور هويّات الزبائن إلى النسخ الاحتياطية بلا سجلّ.
 * وما بقي بعد انقطاعٍ مفاجئ يُكنس عند الإقلاع (`services/transient.ts`). وهذا الخطّاف يُنادي المسح ويتذكّر مساره
 * ليحذفه عند التفكيك — فلا يشغل الحوار نفسه عن نسيانه.
 */
export function useTransientScans(): (dpi: number) => Promise<string> {
  const paths = useRef<string[]>([]);
  useEffect(
    () => () => {
      const mine = paths.current;
      paths.current = [];
      if (mine.length) void window.diwan.files.discardTransient(mine).catch(() => undefined);
    },
    []
  );
  return useCallback(async (dpi: number) => {
    const rel = await window.diwan.scanner.scanImage(dpi);
    paths.current.push(rel);
    return rel;
  }, []);
}
