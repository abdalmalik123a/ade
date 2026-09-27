/**
 * ما تعلّمه المكتب من التذكير والتأنيث (ج٤) — يُحمَّل مع الشاشة، ويُضاف إليه ما يُجاب.
 *
 * `remember` تحفظ جواب الموظف في القاعدة وفي الشاشة معًا، فلا يُسأل عن الاسم ثانيةً
 * ولو بقيت الشاشة مفتوحة.
 */
import { useCallback, useEffect, useState } from 'react';
import { firstNameKey, type Gender, type LearnedGenders } from '@shared/gender';

export function useLearnedGenders(): [LearnedGenders, (answers: { name: string; gender: Gender }[]) => void] {
  const [learned, setLearned] = useState<LearnedGenders>({});

  useEffect(() => {
    void window.diwan.gender
      .learned()
      .then(setLearned)
      .catch(() => setLearned({}));
  }, []);

  const remember = useCallback((answers: { name: string; gender: Gender }[]) => {
    if (answers.length === 0) return;
    setLearned((cur) => {
      const next = { ...cur };
      for (const a of answers) {
        const key = firstNameKey(a.name);
        if (key) next[key] = a.gender;
      }
      return next;
    });
    void window.diwan.gender.learn(answers).catch(() => undefined);
  }, []);

  return [learned, remember];
}
