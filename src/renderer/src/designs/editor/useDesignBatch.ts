/**
 * الدفعة: قائمةٌ تُطبع بطاقةً بطاقة — صفوفها، وربط أعمدتها بالحقول، وما جاءت به من طلبٍ أو من سجلّ الزبائن —
 * والبطاقات بقيمها، والتذكير والتأنيث لكلّ اسم.
 */
import { useMemo, useState } from 'react';
import type { Doc } from '@shared/doc';
import type { Photo } from '@shared/design/batch';
import { nameKeyOf } from '@shared/design/batch';
import { derivedWords } from '@shared/tafqeet';
import { GENDER_KEY, docHasChoices, guessGender, unsureNames, type Gender } from '@shared/gender';
import { useLearnedGenders } from '../../lib/useLearnedGenders';

/** حال الدفعة — قبل الوثيقة، فربط الأعمدة يُحفظ فيها. */
export function useBatchState() {
  /** صفوف الدفعة — وبغيرها تُطبع البطاقة بقيمها المكتوبة، نسخًا. */
  const [batchRows, setBatchRows] = useState<Record<string, string>[]>([]);
  /** ربط أعمدة الدفعة بالحقول (هـ٥) — من التصميم المفتوح، ويُحفظ فيه. */
  const [batchMap, setBatchMap] = useState<Record<string, string | null>>({});
  /** قائمةٌ جاءت مع طلب، ومفتاحٌ يعيد بناء لوح الدفعة بها. */
  const [batchSeed, setBatchSeed] = useState('');
  /** صور القائمة من ملفّات المواطنين (د١٥) — تُعطى للوح الدفعة مع نصّها. */
  const [batchPhotos, setBatchPhotos] = useState<Photo[]>([]);
  const [registryOpen, setRegistryOpen] = useState(false);
  const [batchKey, setBatchKey] = useState(0);
  return { batchRows, setBatchRows, batchMap, setBatchMap, batchSeed, setBatchSeed, batchPhotos, setBatchPhotos, registryOpen, setRegistryOpen, batchKey, setBatchKey };
}

type Inputs = { doc: Doc; values: Record<string, string>; copies: number; batchRows: Record<string, string>[] };

/** البطاقات بقيمها — وما لم يُعرف جنسه من الأسماء. */
export function useBatchCards({ doc, values, copies, batchRows }: Inputs) {
  /** التذكير والتأنيث في الدفعة (ج٤): ما تعلّمه المكتب، وما أجاب عنه الموظف لهذه القائمة. */
  const [learned, remember] = useLearnedGenders();
  const [genderDecisions, setGenderDecisions] = useState<Record<string, Gender>>({});
  /** ما يُنتظر بعد أن تُحسم الأسماء: الطباعة أو PDF. */
  const [genderReview, setGenderReview] = useState<'print' | 'pdf' | null>(null);
  const [afterReview, setAfterReview] = useState<'print' | 'pdf' | null>(null);

  /**
   * ما يُطبع: صفوف الدفعة كلٌّ ببطاقته، وبغيرها القيم المكتوبة مكرّرةً بعدد النسخ.
   *
   * والصفّ يرث القيم المكتوبة: «العام الدراسي» واحدٌ للصفّ كلّه، يُكتب مرّةً في
   * «املأ» ولا يُطلب عمودًا في Excel — وما في الصفّ يغلبه.
   */
  const cards = useMemo(() => {
    // وحقولُ «الكتابة» من أرقامها لكل بطاقة: درجةُ كلّ طالبٍ كتابةً في شهادته.
    const keys = doc.fields.map((f) => f.key);
    // والتذكير والتأنيث لكلّ بطاقةٍ من اسم صاحبها — وعمود «الجنس» في القائمة يغلب.
    const nameKey = docHasChoices(doc) ? nameKeyOf(keys) : undefined;
    return (batchRows.length ? batchRows.map((row) => ({ ...values, ...row })) : Array.from({ length: Math.max(1, copies) }, () => values)).map((card) => {
      const out = derivedWords(card, keys);
      if (nameKey && !out[GENDER_KEY] && out[nameKey]) {
        const name = out[nameKey]!.trim();
        const g = genderDecisions[name] ?? guessGender(name, learned)?.gender;
        if (g) out[GENDER_KEY] = g;
      }
      return out;
    });
  }, [batchRows, copies, values, doc, learned, genderDecisions]);

  /**
   * أسماء القائمة التي لم يُعرف جنسها يقينًا — ولا عمود «الجنس» يحسمها. تُسأل قبل
   * الطباعة (ج٤): «ذكرٌ» صامتًا كان يُخرج «الطالب رسل» في شهادةٍ لطالبة.
   */
  const unsureBatch = useMemo(() => {
    if (!batchRows.length || !docHasChoices(doc)) return [];
    const nameKey = nameKeyOf(doc.fields.map((f) => f.key));
    if (!nameKey) return [];
    const names = batchRows.filter((r) => !r[GENDER_KEY]?.trim()).map((r) => r[nameKey] ?? '');
    return unsureNames(names, learned, genderDecisions);
  }, [batchRows, doc, learned, genderDecisions]);

  return { learned, remember, setGenderDecisions, genderReview, setGenderReview, afterReview, setAfterReview, cards, unsureBatch };
}
