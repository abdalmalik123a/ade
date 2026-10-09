/**
 * لا يضيع تصميم (DESIGNS.md ٣٫٨ و٠٫٦): ما تغيّر عمّا حُفظ يُكتب مسودّةً بعد ثوانٍ من آخر تعديل، وعند مغادرة الشاشة،
 * وعند إغلاق البرنامج، وقبل أن يُفتح تصميمٌ غيره — في جدول المسودّات نفسه الذي يحفظ فيه محرّر الكتب
 * (`shared/design/draft.ts`)، فيُكمَل من «قيد العمل» ومن رأس المعرض بعد الانتقال أو الإغلاق أو انقطاع الكهرباء.
 * وما عاد إلى ما حُفظ تُمحى مسودّته، و«احفظ» يمحوها.
 *
 * ولأنّ المسودّة تحرسه لا يُسأل الموظف «اترك بلا حفظ؟» (قرار المالك ٨ ت١ — `kit/leaveGuard.ts`).
 *
 * وكلّ تصميمٍ يُفتح **جلسة** (`begin`): ما يُكتب لجلسةٍ سابقة يُكتب في مسودّتها هي ولا يمسّ اللاحقة، والكتابات تصطفّ
 * واحدةً بعد واحدة فلا تُنشأ مسودّتان لتصميمٍ واحد.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Doc } from '@shared/doc';
import { canvasText } from '@shared/canvas';
import { designDraftValues, designKey } from '@shared/design/draft';
import { onBeforeClose } from '../../lib/beforeClose';
import { errorText } from '../../lib/errors';

/** كمحرّر الكتب. */
const AUTOSAVE_MS = 4000;

type Inputs = {
  doc: Doc;
  title: string;
  values: Record<string, string>;
  designId: number | null;
  say: (text: string, tone?: 'ok' | 'warn') => void;
  onChanged?: () => void;
};

type Session = {
  draftId: number | null;
  /** بصمة ما حُفظ أو فُتح — وما يساويها لا مسودّة له. وعدمٌ بعد استئناف مسودّة: لا يُعرف ما حُفظ. */
  baseline: string | null;
  /** بصمة آخر ما كُتب في المسودّة — فلا تُكتب ثانيةً بلا تغيير. */
  written: string | null;
};

export function useDesignDraft(inputs: Inputs) {
  const latest = useRef(inputs);
  latest.current = inputs;

  const cur = useRef<Session>({ draftId: null, baseline: null, written: null });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  /** جلسةٌ بدأت وتنتظر رسمها: بصمتها تُقرأ بعده. */
  const [epoch, setEpoch] = useState(0);
  const starting = useRef<'fresh' | 'resumed'>('fresh');

  useEffect(() => {
    const key = designKey(latest.current.doc);
    if (starting.current === 'resumed') cur.current.written = key;
    else cur.current.baseline = key;
  }, [epoch]);

  /** يكتب ما تغيّر في مسودّة الجلسة الحاضرة — بلقطته لحظةَ النداء، وفي دوره. */
  const persist = useCallback((): Promise<void> => {
    const s = cur.current;
    const { doc, title, values, designId } = latest.current;
    const run = async () => {
      const key = designKey(doc);
      if (key === s.written) return;
      if (key === s.baseline) {
        // عاد إلى ما حُفظ: لا عمل يضيع، فلا مسودّة.
        if (s.draftId === null) return;
        const old = s.draftId;
        s.draftId = null;
        s.written = null;
        if (s === cur.current) setDraftSavedAt(null);
        await window.diwan.drafts.delete(old);
        latest.current.onChanged?.();
        return;
      }
      const isNew = s.draftId === null;
      try {
        s.draftId = await window.diwan.drafts.save({
          id: s.draftId,
          templateId: designId,
          citizenId: null,
          title: title.trim() || 'تصميمٌ بلا اسم',
          values: designDraftValues({ doc, values }),
          bodyHtml: doc.canvas ? canvasText(doc.canvas, values) : ''
        });
      } catch (e) {
        if (s === cur.current) latest.current.say(errorText(e, 'تعذّر حفظ مسودّة التصميم — احفظه بنفسك'), 'warn');
        return;
      }
      s.written = key;
      if (s === cur.current) setDraftSavedAt(new Date());
      // العدد في «قيد العمل» والجرس يتغيّر بمسودّةٍ جديدة وحدها.
      if (isNew) latest.current.onChanged?.();
    };
    const next = queue.current.then(run).catch(() => undefined);
    queue.current = next;
    return next;
  }, []);

  /**
   * تصميمٌ آخر يُفتح — يُنادى قبل أن يُبدَّل ما في اللوحة: ما لم يُحفظ من السابق يُكتب في مسودّته أوّلًا.
   * و`resumedDraft` مسودّةٌ تُستأنف: الكتابة فيها هي.
   */
  const begin = useCallback(
    (resumedDraft?: number) => {
      void persist();
      cur.current = { draftId: resumedDraft ?? null, baseline: null, written: null };
      starting.current = resumedDraft === undefined ? 'fresh' : 'resumed';
      setDraftSavedAt(null);
      setEpoch((e) => e + 1);
    },
    [persist]
  );

  /** حُفظ التصميم بـ«احفظ»: مسودّته تُمحى — بعد ما سبقها من كتابة — وما يُرسم بعده هو المحفوظ. */
  const markSaved = useCallback(() => {
    const s = cur.current;
    cur.current = { draftId: null, baseline: null, written: null };
    starting.current = 'fresh';
    setDraftSavedAt(null);
    setEpoch((e) => e + 1);
    queue.current = queue.current
      .then(async () => {
        if (s.draftId === null) return;
        const old = s.draftId;
        s.draftId = null;
        await window.diwan.drafts.delete(old);
        latest.current.onChanged?.();
      })
      .catch(() => undefined);
  }, []);

  // بعد ثوانٍ من آخر تعديل.
  useEffect(() => {
    const timer = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [inputs.doc, persist]);

  // وعند مغادرة الشاشة وإغلاق البرنامج.
  useEffect(() => {
    const unregister = onBeforeClose(() => persist());
    return () => {
      unregister();
      void persist();
    };
  }, [persist]);

  return { draftSavedAt, beginSession: begin, markSaved };
}
