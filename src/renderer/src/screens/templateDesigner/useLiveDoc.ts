/**
 * وثيقة مصمّم النماذج كما في المحرّر الآن (D172) — كـ`latestDoc` في `editor/useEditorDocument.ts` (D143).
 *
 * المحرّر يؤجّل إرسال الوثيقة ربع ثانيةٍ أثناء الكتابة (D122)، و«حفظ النموذج» والحفظ عند المغادرة والإغلاق كانت تقرأ حال React —
 * فما كُتب قبل الحفظ بأقلّ من ربع ثانيةٍ بلا ترك التركيز لا يُحفظ (رآه سيناريو `imageField`). فـ`latestDoc` يستعجل المحرّر أوّلًا
 * (`flushEditors`) ثم يقرأ المرجع الحيّ: الوثيقة الكاملة من المحرّر تصير حاضرةً فورًا بلا انتظار رسم.
 */
import { useCallback, useRef, useState } from 'react';
import type { Doc } from '@shared/doc';
import { flushEditors } from '../../components/pageEditor/flushEditors';

export function useLiveDoc(init: () => Doc) {
  const [doc, setDocState] = useState<Doc>(init);
  const liveDoc = useRef(doc);
  liveDoc.current = doc;

  const setDoc = useCallback((next: Doc | ((d: Doc) => Doc)) => {
    if (typeof next !== 'function') liveDoc.current = next;
    setDocState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      liveDoc.current = resolved;
      return resolved;
    });
  }, []);

  const latestDoc = useCallback(() => {
    flushEditors();
    return liveDoc.current;
  }, []);

  return { doc, setDoc, latestDoc };
}
