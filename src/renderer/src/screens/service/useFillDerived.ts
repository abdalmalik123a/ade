/**
 * ما يُشتقّ من ورقة الإدخال (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو: اسم صاحب العلاقة، والحقول الناقصة، ورأس الورقة وحقول الترويسة، واقتراح الجنس من
 * الاسم، وأسماء قائمة الدمج.
 */
import type { DocField } from '@shared/doc';
import { isChoiceKey, guessGender, GENDER_KEY, type LearnedGenders } from '@shared/gender';
import { formatGregorian, formatHijri } from '@shared/dates';
import { asksLetterNumber } from '@shared/letterhead';
import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { Loaded } from './types';

export function useFillDerived(
  ctx: {
    fields: DocField[];
    values: Record<string, string>;
    letterNo: string;
    loaded: Loaded[];
    needsGender: boolean;
    genderByHand: boolean;
    learned: LearnedGenders;
    setValues: Dispatch<SetStateAction<Record<string, string>>>;
    names: string;
  }
) {
  const { fields, values, letterNo, loaded, needsGender, genderByHand, learned, setValues, names } = ctx;

  const byRole = (role: DocField['role']) => {
    const f = fields.find((x) => x.role === role);
    return f ? (values[f.key]?.trim() ?? '') : '';
  };

  /** اسم صاحب العلاقة: من حقلٍ بدوره، وإلا من أول حقل مملوء. */
  // وخانةُ «{الطالب|الطالبة}» ليست حقلًا يُملأ، فلا تُعدّ أوّلَ الحقول.
  const firstField = fields.find((f) => f.source === 'fullName') ?? fields.find((f) => !isChoiceKey(f.key));
  const citizenName =
    byRole('name') || values[firstField?.key ?? '']?.trim() || '';

  const missing = fields.filter((f) => f.required && !isChoiceKey(f.key) && !values[f.key]?.trim());

  /** رأس الورقة: تاريخ اليوم، والعدد كما أعطاه الزبون — وفارغًا فراغٌ منقوط للجهة. */
  const registry = { number: letterNo.trim(), date: formatGregorian(new Date()) };
  const printsRegistry = loaded.some((l) => asksLetterNumber(l.layout));

  /**
   * حقول الترويسة التلقائية: التاريخان، والعدد على الكتاب، وما سواها من قيم
   * المعاملة. وما لا قيمة له يُطبع فارغًا — لا وسمًا بين قوسين على الورق.
   */
  const resolveHead = (text: string): string =>
    text.replace(/\{([^{}]+)\}/g, (_m, raw: string) => {
      const key = raw.trim();
      if (key === 'رقم_الصادر') return letterNo.trim();
      if (key === 'التاريخ_الميلادي') return formatGregorian(new Date());
      if (key === 'التاريخ_الهجري') return formatHijri(new Date());
      return values[key] ?? values[key.replace(/_/g, ' ')] ?? '';
    });

  // الجنس يُقترح من الاسم ما لم يختره الموظف — وهو ظاهرٌ يُقلب بضغطة.
  useEffect(() => {
    if (!needsGender || genderByHand || !citizenName) return;
    const guess = guessGender(citizenName, learned);
    if (guess && values[GENDER_KEY] !== guess.gender) setValues((prev) => ({ ...prev, [GENDER_KEY]: guess.gender }));
    // الجنس يُقترح حين يتغيّر الاسم أو اختيار الموظف، والقيم تُقرأ حين يجري — لا يُعاد مع كلّ قيمة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGender, genderByHand, citizenName, learned]);

  /** حقل الاسم: عليه يدور الدمج، وبغيره لا معنى لقائمة أسماء. */
  const nameField = fields.find((f) => f.role === 'name') ?? null;

  /** أسماء القائمة: سطرٌ لكل اسم، وتُهمل الفارغة والمكرَّرة. */
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return names
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n && !seen.has(n) && seen.add(n));
  }, [names]);

  return { byRole, citizenName, nameField, rows, missing, printsRegistry, registry, resolveHead };
}
