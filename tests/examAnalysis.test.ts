/**
 * تحليل أسئلة ورقة الدوائر، و«الدور الثاني» من البنك (د٩).
 */
import { describe, expect, it } from 'vitest';
import { itemAnalysis, itemNote, secondRound } from '../src/shared/examAnalysis';
import type { ListItem } from '../src/shared/doc';

/** عشرون ورقة: السؤال ١ سهل، و٢ يفرّق، و٣ مفتاحه مقلوب (المتفوّقون يختارون ب). */
function sheets() {
  const key = [0, 1, 2];
  const out: { answers: number[] }[] = [];
  for (let s = 0; s < 20; s++) {
    const strong = s < 10;
    out.push({
      answers: [
        0, // الكلّ يصيب الأول
        strong ? 1 : 3, // المتفوّقون وحدهم يصيبون الثاني
        strong ? 1 : 2 // الضعاف «يصيبون» الثالث — والمتفوّقون يختارون ب: المفتاح خطأ
      ]
    });
  }
  return { key, out };
}

describe('تحليل الأسئلة', () => {
  it('الصعوبة والتمييز وأكثر خطأٍ اختير — والمفتاح المقلوب يُقال', () => {
    const { key, out } = sheets();
    const [q1, q2, q3] = itemAnalysis(out, key);
    expect(q1).toMatchObject({ q: 1, difficulty: 1, flags: ['easy'] });
    expect(q2).toMatchObject({ q: 2, difficulty: 0.5, discrimination: 1, topWrong: { choice: 3, share: 0.5 } });
    expect(q2!.flags).toEqual([]);
    expect(q3!.discrimination).toBeLessThan(0);
    expect(q3!.flags).toContain('key?');
    expect(itemNote(q3!)).toContain('راجع مفتاحه');
    expect(itemNote(q1!)).toContain('سهل');
  });

  it('وما لا مفتاح له لا يُحلَّل، ولا أوراق لا تحليل', () => {
    expect(itemAnalysis([{ answers: [0, 1] }], [0, -1])).toHaveLength(1);
    expect(itemAnalysis([], [0])).toEqual([]);
  });
});

describe('الدور الثاني من البنك', () => {
  const q = (text: string, score: number): ListItem => ({ id: text, inlines: [{ kind: 'run', text }], score }) as ListItem;
  const first = [q('عرّف الفعل', 10), q('أعرب ما يأتي', 20)];
  const bank = [
    { id: 1, item: q('عرّف الفعل', 10), score: 10, useCount: 0 }, // من الدور الأول — لا يُعاد
    { id: 2, item: q('عرّف الاسم', 10), score: 10, useCount: 5 },
    { id: 3, item: q('عرّف الحرف', 10), score: 10, useCount: 1 },
    { id: 4, item: q('أعرب الجملة', 20), score: 20, useCount: 0 }
  ];

  it('بدرجته، لا من الدور الأول، والأقلّ استعمالًا أولًا', () => {
    const r = secondRound(first, bank);
    expect(r.picks.map((p) => p.id)).toEqual([3, 4]);
    expect(r.missing).toEqual([]);
  });

  it('وما لا بديل له يُقال — لا يُكرَّر سؤالٌ صامتًا', () => {
    const r = secondRound(first, bank.slice(0, 2));
    expect(r.picks.map((p) => p.id)).toEqual([2]);
    expect(r.missing).toEqual([2]);
  });
});
