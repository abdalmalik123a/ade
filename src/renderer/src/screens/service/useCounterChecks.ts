/**
 * قبل الطباعة في الشبّاك (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو: التنبيه الإملائي فيما كُتب وفي نصّ النموذج، والورقة المعروضة، والجنس الذي لم يُحسم،
 * وما يمنع الإصدار.
 */
import { useMemo } from 'react';
import { spellingIssues, type SpellIssue, docSpelling } from '@shared/spelling';
import { GENDER_KEY, guessGender, type LearnedGenders } from '@shared/gender';
import type { Loaded } from './types';
import type { DocField } from '@shared/doc';

export function useCounterChecks(
  ctx: {
    values: Record<string, string>;
    loaded: Loaded[];
    at: number;
    needsGender: boolean;
    citizenName: string;
    learned: LearnedGenders;
    merge: boolean;
    genderByHand: boolean;
    rows: string[];
    missing: DocField[];
  }
) {
  const { values, loaded, at, needsGender, citizenName, learned, merge, genderByHand, rows, missing } = ctx;

  /**
   * التنبيه الإملائي قبل الطباعة: ما كتبه الموظف يُصلح هنا بضغطة، وما في نصّ
   * النموذج نفسه يُقال ويُصلح في الورشة — فالشبّاك لا يعدّل النماذج.
   */
  const typedSpelling = useMemo(
    () =>
      spellingIssues(
        Object.entries(values)
          .filter(([k]) => k !== GENDER_KEY)
          .map(([, v]) => v)
          .join('\n')
      ),
    [values]
  );
  const templateSpelling = useMemo(() => {
    const merged = new Map<string, SpellIssue>();
    for (const issue of loaded.flatMap((l) => docSpelling(l.doc))) {
      const key = `${issue.word}→${issue.fix}`;
      const prev = merged.get(key);
      merged.set(key, prev ? { ...prev, count: prev.count + issue.count } : issue);
    }
    return [...merged.values()];
  }, [loaded]);

  const current = loaded[Math.min(at, loaded.length - 1)];
  /**
   * الجنس لم يُعرف يقينًا من الاسم ولم يختره الموظف: يُسأل قبل الطباعة (ج٤) —
   * «ذكرٌ» صامتًا كان يُخرج «الطالب رسل».
   */
  const genderGuess = needsGender && citizenName ? guessGender(citizenName, learned) : null;
  const genderUnsure = !merge && needsGender && !genderByHand && genderGuess !== null && !genderGuess.sure;

  /** ما يمنع الإصدار: حقلٌ إلزامي فارغ، أو جنسٌ لم يُحسم، أو دمجٌ بلا أسماء. */
  const blocked = merge ? rows.length === 0 : missing.length > 0 || genderUnsure;

  return { typedSpelling, templateSpelling, current, genderUnsure, blocked };
}
