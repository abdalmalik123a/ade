import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { run } from '../src/shared/doc';
import type { ListItem } from '../src/shared/doc';
import {
  deleteQuestion,
  listQuestions,
  markQuestionUsed,
  questionText,
  saveQuestion
} from '../src/main/services/questionBank';

const q = (text: string, kids: string[] = [], score?: number): ListItem => ({
  id: `q-${text}`,
  inlines: [run(text)],
  score,
  items: kids.map((k, i) => ({ id: `k-${i}`, inlines: [run(k)], score: 5 }))
});

describe('بنك الأسئلة', () => {
  it('يبدأ فارغًا', () => {
    expect(listQuestions(freshDb())).toEqual([]);
  });

  it('يحفظ السؤال بفروعه ودرجته، ويعيده كما هو', () => {
    const db = freshDb();
    const saved = saveQuestion(db, { item: q('عرّف ما يأتي:', ['الضغط الجوي', 'الكثافة']), subject: 'الفيزياء', grade: 'الثالث المتوسط' });
    expect(saved.score).toBe(10);
    expect(saved.text).toBe('عرّف ما يأتي:\n  الضغط الجوي\n  الكثافة');
    expect(listQuestions(db)[0]!.item.items).toHaveLength(2);
  });

  it('ولا يكرّر: النصّ نفسه في المادة نفسها يُحدَّث', () => {
    const db = freshDb();
    saveQuestion(db, { item: q('علّل ما يأتي', [], 10), subject: 'العلوم' });
    saveQuestion(db, { item: q('علّل ما يأتي', [], 20), subject: 'العلوم' });
    saveQuestion(db, { item: q('علّل ما يأتي'), subject: 'الكيمياء' });
    expect(listQuestions(db, { subject: 'العلوم' }).map((x) => x.score)).toEqual([20]);
    expect(listQuestions(db)).toHaveLength(2);
  });

  it('والبحث متساهل مع الهمزة، والمادة والصف مرشِّحان', () => {
    const db = freshDb();
    saveQuestion(db, { item: q('أجب عن الأسئلة الآتية'), subject: 'العربية', grade: 'الخامس' });
    saveQuestion(db, { item: q('اشرح قانون نيوتن'), subject: 'الفيزياء', grade: 'الخامس' });
    expect(listQuestions(db, { query: 'اجب' })).toHaveLength(1);
    expect(listQuestions(db, { grade: 'الخامس' })).toHaveLength(2);
  });

  it('والأكثر استعمالًا أوّلًا، والحذف يمحوه', () => {
    const db = freshDb();
    const a = saveQuestion(db, { item: q('الأول') });
    const b = saveQuestion(db, { item: q('الثاني') });
    markQuestionUsed(db, a.id);
    expect(listQuestions(db)[0]!.id).toBe(a.id);
    deleteQuestion(db, b.id);
    expect(listQuestions(db)).toHaveLength(1);
  });

  it('والسؤال الفارغ لا يُحفظ', () => {
    expect(() => saveQuestion(freshDb(), { item: q('  ') })).toThrow(/فارغ/);
    expect(questionText(q('س', ['ف']))).toBe('س\n  ف');
  });
});
