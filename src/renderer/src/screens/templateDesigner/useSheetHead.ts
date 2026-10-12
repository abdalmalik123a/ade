/**
 * رأس الورقة في مصمّم النماذج (تقسيمه بعد ١٫٧٫٠) — منقولٌ من `TemplateDesigner` كما هو: أسطر الرأس المكتشَفة وما اعتاده المكتب منها،
 * وتصنيف النموذج المقترح، واسم الترويسة، وحفظ الرأس ترويسةً في المكتبة.
 */
import { useMemo, useState, useEffect } from 'react';
import { findSheetHead, headFingerprint, splitSheetHead, HEAD_MAX } from '@shared/sheetHead';
import { type Suggestion, APPLY_THRESHOLD, type Doc } from '@shared/doc';
import { errorText } from '../../lib/errors';
import type { Letterhead } from '@shared/letterhead';
import type { Dispatch, SetStateAction } from 'react';

export function useSheetHead(
  ctx: {
    letterheadId: number | null;
    doc: Doc;
    title: string;
    category: string;
    setSavedHead: Dispatch<SetStateAction<Letterhead | null>>;
    setDoc: Dispatch<SetStateAction<Doc>>;
    setLetterheadId: Dispatch<SetStateAction<number | null>>;
    setError: Dispatch<SetStateAction<string | null>>;
  }
) {
  const { letterheadId, doc, title, category, setSavedHead, setDoc, setLetterheadId, setError } = ctx;

  const detected = useMemo(() => (letterheadId ? 0 : findSheetHead(doc)), [doc, letterheadId]);
  const fingerprint = useMemo(() => headFingerprint(doc), [doc]);
  const [edgeHabit, setEdgeHabit] = useState<Suggestion<string> | null>(null);
  useEffect(() => {
    if (letterheadId || !fingerprint) {
      setEdgeHabit(null);
      return;
    }
    let alive = true;
    void window.diwan.learning
      .suggest('letterheadEdge', fingerprint)
      .then((s) => alive && setEdgeHabit(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fingerprint, letterheadId]);
  const [headCount, setHeadCount] = useState<number | null>(null);
  useEffect(() => setHeadCount(null), [fingerprint]);
  const habitCount = edgeHabit && edgeHabit.confidence >= APPLY_THRESHOLD ? Number(edgeHabit.value) || 0 : 0;
  const headLines = headCount ?? (habitCount || detected);
  const headSplit = useMemo(
    () => (letterheadId || headLines <= 0 ? null : splitSheetHead(doc, headLines)),
    [doc, letterheadId, headLines]
  );
  const canGrow = headLines < HEAD_MAX && !letterheadId && Boolean(splitSheetHead(doc, headLines + 1));

  /** تصنيفٌ يُقترح من العنوان: من نماذج المكتب المصنَّفة، وما صحّحه (ج١٣). */
  const [catSuggest, setCatSuggest] = useState<Suggestion<string> | null>(null);
  useEffect(() => {
    if (!title.trim()) {
      setCatSuggest(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      void window.diwan.learning
        .category(title)
        .then((s) => alive && setCatSuggest(s))
        .catch(() => undefined);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [title]);
  const [headName, setHeadName] = useState('');
  useEffect(() => setHeadName(headSplit?.name ?? ''), [headSplit?.name]);

  /**
   * «احفظ أعلى الورقة ترويسةً»: الرأس ينتقل كما هو إلى ترويسة، والورقة تختارها.
   * فما يُرى على الورقة لا يتغيّر — والجديد أن كتابًا آخر للجهة يبدأ برأسها.
   */
  async function saveHead() {
    if (!headSplit) return;
    try {
      const saved = await window.diwan.letterheads.save({
        id: null,
        name: headName.trim() || headSplit.name,
        authorityId: null,
        layout: headSplit.layout,
        category: category.trim() || null
      });
      setSavedHead(saved);
      setDoc(headSplit.doc);
      setLetterheadId(saved.id);
      // حدٌّ غير ما خمّنه الكاشف: يُقيَّد لبصمة هذا الرأس، فيُقترح لكتب الجهة القادمة.
      if (headLines !== detected) {
        void window.diwan.learning.record({
          kind: 'letterheadEdge',
          input: fingerprint,
          suggested: String(detected),
          chosen: String(headLines)
        });
      }
    } catch (e) {
      setError(errorText(e, 'تعذّر حفظ الترويسة'));
    }
  }

  return { catSuggest, headSplit, headLines, setHeadCount, canGrow, habitCount, headCount, edgeHabit, headName, setHeadName, saveHead };
}
