/**
 * مسودّة المحرّر (تقسيمه بعد ١٫٧٫٠) — منقولةٌ من `EditorScreen` كما هي: تُحفظ في «قيد العمل» بعد ثوانٍ من الكتابة وبـCtrl+S،
 * وما لم يُحفظ يُحفظ عند المغادرة وعند إغلاق البرنامج، والمغادرة تقول أين صار (البند ١٠).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { docText, type Doc } from '@shared/doc';
import type { LetterheadLayout } from '@shared/letterhead';
import { letterValues, type Registry } from '@shared/letterDraft';
import { errorText } from '../../lib/errors';
import { onBeforeClose } from '../../lib/beforeClose';
import { editorsPending, flushEditors } from '../../components/pageEditor/flushEditors';

const AUTOSAVE_MS = 4000;

export function useEditorDraft(
  ctx: {
    draftId: number | null;
    draft: number | null;
    setDraft: Dispatch<SetStateAction<number | null>>;
    hasContent: boolean;
    setError: Dispatch<SetStateAction<string | null>>;
    setSaving: Dispatch<SetStateAction<boolean>>;
    activeTemplate: number | null;
    linkedCitizen: number | null;
    draftName: string;
    savedLetter: () => Parameters<typeof letterValues>[0];
    /** الوثيقة كما رُسمت: تغيّرها (إرسال المحرّر) يعيد موعد الحفظ التلقائي — والمحفوظ من `savedLetter` (D143). */
    doc: Doc;
    values: Record<string, string>;
    setSavedAt: Dispatch<SetStateAction<Date | null>>;
    dirty: MutableRefObject<boolean>;
    setToast: Dispatch<SetStateAction<string | null>>;
    registry: Registry;
    layout: LetterheadLayout;
    owner: string;
    onLeave: ((draft: { id: number; title: string }) => void) | undefined;
  }
) {
  const { draftId, draft, setDraft, hasContent, setError, setSaving, activeTemplate, linkedCitizen, draftName, savedLetter, doc, values, setSavedAt, dirty, setToast, registry, layout, owner, onLeave } = ctx;

  /** المسودّة الحاضرة — تُقرأ بعد أن تُفكّ الشاشة عند المغادرة، فلا تنتظر رسمًا. */
  const draftRef = useRef<number | null>(draftId);
  draftRef.current = draft;
  const saveDraft = useCallback(
    async (silent: boolean) => {
      if (!hasContent) {
        if (!silent) setError('لا تُحفظ مسودة فارغة — اكتب في الورقة أو اسم صاحب العلاقة أولًا');
        return;
      }
      setSaving(true);
      try {
        // الوثيقة بآخر ما كُتب فيها (D143) — والمتن النصّيّ منها نفسها.
        const letter = savedLetter();
        const id = await window.diwan.drafts.save({
          id: draft,
          templateId: activeTemplate,
          citizenId: linkedCitizen,
          title: draftName,
          values: letterValues(letter),
          bodyHtml: docText(letter.doc, values)
        });
        setDraft(id);
        draftRef.current = id;
        setSavedAt(new Date());
        dirty.current = false;
        if (!silent) setToast('حُفظت المسودة');
      } catch (e) {
        setError(errorText(e, 'تعذّر حفظ المسودة'));
      } finally {
        setSaving(false);
      }
    },
    // الناقص ضوابطُ حالٍ ومرجع (`dirty`)، و`savedLetter` يتجدّد مع `draftName` والوثيقة والقيم
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasContent, draft, activeTemplate, linkedCitizen, draftName, doc, values, registry, layout, owner]
  );

  useEffect(() => {
    if (!dirty.current || !hasContent) return;
    // والكتابة جارية (عند المحرّر ما لم يُرسل): لا يُستعجل في وسطها — يرسله المحرّر بعد ٢٥٠ م.ث فيتغيّر `doc` ويُعاد هذا الموعد (D143).
    const timer = setTimeout(() => void (editorsPending() || saveDraft(true)), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [doc, values, registry, hasContent, saveDraft]);

  /**
   * ما لم يُحفظ بعد يُحفظ عند مغادرة المحرّر وعند إغلاق البرنامج (خطة Production، ١٫٥).
   *
   * مؤقّت الحفظ يُعاد مع كلّ حرف ويُلغى مع الشاشة، فكان ما كُتب منذ آخر توقّفٍ عن الكتابة يضيع
   * بنقرةٍ على الشريط — بلا تنبيه. والحفظ هنا هو الحفظ التلقائيّ نفسه. وكان صامتًا: ما كُتب في «قيد العمل» ولا يعرف الموظف
   * ذلك، فيظنّه ضاع (البند ١٠) — فالمغادرة تقول أين صار، بعنوانه، ويُفتح منها بضغطة (`onLeave`).
   */
  const flushDraft = useRef<() => Promise<void>>(async () => undefined);
  flushDraft.current = async () => {
    // ما كُتب في آخر ٢٥٠ م.ث يصل إلى الوثيقة أوّلًا فيُعلِّمها «لم تُحفظ» (D143) — والمحرّر يُفكّ بعد هذه الشاشة.
    flushEditors();
    if (dirty.current && hasContent) await saveDraft(true);
  };
  const leave = useRef({ draftName, onLeave });
  leave.current = { draftName, onLeave };
  useEffect(() => {
    const unregister = onBeforeClose(() => flushDraft.current());
    return () => {
      unregister();
      const { draftName: left, onLeave: told } = leave.current;
      void flushDraft.current().then(() => draftRef.current !== null && told?.({ id: draftRef.current, title: left }));
    };
  }, []);

  return { saveDraft };
}
