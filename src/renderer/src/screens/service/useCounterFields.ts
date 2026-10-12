/**
 * حقول ورقة الإدخال (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو: اتحاد ما تطلبه المختارات، والسؤال عن الجنس وما تعلّمه المكتب منه، واختيار أسماء الدمج،
 * والقيم كما تُطبع.
 */
import { type DocField, mergeFields } from '@shared/doc';
import { useMemo, useState, useCallback } from 'react';
import { docHasChoices } from '@shared/gender';
import { useLearnedGenders } from '../../lib/useLearnedGenders';
import { derivedWords } from '@shared/tafqeet';
import { formValues } from '@shared/imageForm';
import type { Loaded } from './types';

export function useCounterFields(
  ctx: {
    loaded: Loaded[];
    values: Record<string, string>;
  }
) {
  const { loaded, values } = ctx;

  /** الحقول التي تُعرض: اتحاد ما تطلبه المختارات، بلا تكرار. */
  const fields: DocField[] = useMemo(() => mergeFields(loaded.map((l) => l.doc)), [loaded]);

  /**
   * القيم كما تُطبع: ما كتبه الموظف، وحقولُ «الكتابة» الفارغة مملوءةً من أرقامها —
   * «الدرجة» ٩٥ تكتب «خمس وتسعون درجة»، و«المبلغ» يُفقَّط. وما كُتب باليد يغلب.
   */
  const keys = useMemo(() => fields.map((f) => f.key), [fields]);

  /** أفي الأوراق المختارة «{الطالب|الطالبة}»؟ فيُسأل عن الجنس — ويُقترح من الاسم. */
  const needsGender = useMemo(() => loaded.some((l) => docHasChoices(l.doc)), [loaded]);
  /** اختاره الموظف بيده؟ فلا يغيّره الاقتراح بعدها. */
  const [genderByHand, setGenderByHand] = useState(false);
  /** ما تعلّمه المكتب من التذكير والتأنيث — ويُضاف إليه ما يُجاب هنا (ج٤). */
  const [learned, remember] = useLearnedGenders();
  /** اختيار أسماء القائمة من السجل (د١٢). */
  const [mergePicker, setMergePicker] = useState(false);
  /** أسماء القائمة التي لم يُعرف جنسها — تُسأل قبل أن تُطبع الدفعة. */
  const [genderReview, setGenderReview] = useState<{ names: string[]; print: boolean } | null>(null);
  // والاستمارة المصوّرة: المجموع يُجمع والمربّع ✓ قبل أن تُكتب الأرقام كلماتٍ (المرحلة ٤).
  const asPrinted = useCallback((v: Record<string, string>) => derivedWords(formValues(fields, v), keys), [keys, fields]);
  const effective = useMemo(() => asPrinted(values), [asPrinted, values]);

  return {
    fields, needsGender, genderByHand, learned, setGenderByHand, asPrinted, remember, setGenderReview, effective, setMergePicker,
    mergePicker, genderReview
  };
}
