/**
 * التعلّم فيما سوى أسماء الحقول (ج١٣): حدّ الترويسة، وتصنيف النموذج، والمتشابه.
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { HABIT, learned, recordCorrection, suggestCategory } from '../src/main/services/learning';
import { applyHabits } from '../src/main/services/importFolder';
import { saveTemplate } from '../src/main/services/templates';
import { APPLY_THRESHOLD, docFromLegacy, emptyDoc, paragraph, run } from '../src/shared/doc';
import { headFingerprint } from '../src/shared/sheetHead';
import { similarityBucket } from '../src/shared/learningKeys';
import type { ImportPlan } from '../src/shared/api';

const template = (title: string, category: string | null) => ({
  id: null,
  code: null,
  title,
  subtitle: null,
  category,
  subjectLine: null,
  bodyHtml: `متن ${title}`,
  letterheadId: null,
  variables: []
});

describe('تصنيف النموذج من عنوانه — من نماذج المكتب نفسه', () => {
  it('بلا نماذج مصنَّفة لا اقتراح', () => {
    const db = freshDb();
    expect(suggestCategory(db, 'تأييد استمرار بالخدمة')).toBeNull();
  });

  it('يقترح التصنيف الذي تشترك نماذجه مع العنوان — ويقول لماذا', () => {
    const db = freshDb();
    saveTemplate(db, template('تأييد استمرار بالخدمة', 'تربية'));
    saveTemplate(db, template('تأييد خدمة معلم', 'تربية'));
    saveTemplate(db, template('طلب جواز سفر', 'جوازات'));
    const s = suggestCategory(db, 'تأييد استمرار معلمة');
    expect(s?.value).toBe('تربية');
    expect(s?.reason).toContain('تربية');
    // اقتراحٌ لا حكم: دون عتبة التطبيق
    expect(s!.confidence).toBeLessThan(APPLY_THRESHOLD);
    expect(suggestCategory(db, 'تجديد جواز السفر')?.value).toBe('جوازات');
  });

  it('وما صحّحه الموظف لعنوانٍ بعينه يغلب حين يرسخ', () => {
    const db = freshDb();
    saveTemplate(db, template('تأييد سكن', 'بلدية'));
    for (let i = 0; i < HABIT; i++) {
      recordCorrection(db, { kind: 'category', input: 'تاييد سكن معنون', suggested: 'بلدية', chosen: 'أحوال مدنية' });
    }
    expect(suggestCategory(db, 'تأييد سكن معنون')?.value).toBe('أحوال مدنية');
  });
});

describe('حدّ الترويسة بعادة المكتب', () => {
  it('بصمة أعلى الورقة: أوّل سطرين مطويّين — فكتب الجهة الواحدة بصمتها واحدة', () => {
    const doc = (body: string) => ({
      ...emptyDoc(),
      blocks: [paragraph([run('إدارة مدرسة الصحوة')]), paragraph([run('')]), paragraph([run('العدد: ')]), paragraph([run(body)])]
    });
    expect(headFingerprint(doc('نؤيد أن أحمد'))).toBe(headFingerprint(doc('نؤيد أن زينب')));
    expect(headFingerprint(doc('x'))).toBe('اداره مدرسه الصحوه | العدد:');
  });

  it('ما صحّحه الموظف يُقترح لها ثالثةً فصاعدًا', () => {
    const db = freshDb();
    for (let i = 0; i < HABIT; i++) recordCorrection(db, { kind: 'letterheadEdge', input: 'بصمة', suggested: '2', chosen: '4' });
    const s = learned(db, 'letterheadEdge', 'بصمة');
    expect(s?.value).toBe('4');
    expect(s!.confidence).toBeGreaterThanOrEqual(APPLY_THRESHOLD);
  });
});

describe('المتشابه الذي يُبقيه المكتب', () => {
  const plan = (): ImportPlan => {
    const c = (id: string) => ({
      id,
      file: `${id}.docx`,
      formIndex: 0,
      formCount: 1,
      title: 'تأييد',
      subjectLine: null,
      doc: docFromLegacy('نؤيد أن {اسم} طالب'),
      letterheadKey: null,
      letterhead: null,
      notes: [],
      warnings: [],
      suggestions: []
    });
    return { candidates: [c('a'), c('b')], sharedLetterhead: null, duplicates: [{ ids: ['a', 'b'], confidence: 0.96 }], failed: [] };
  };

  it('الشريحة: ٩٦٪ و٩٥٪ واحدة، و٩٤٪ غيرها', () => {
    expect(similarityBucket(0.96)).toBe('95');
    expect(similarityBucket(0.95)).toBe('95');
    expect(similarityBucket(0.94)).toBe('90');
  });

  it('بلا عادةٍ يُنزع اختيار النسخة كما كان', () => {
    expect(applyHabits(freshDb(), plan()).duplicates).toHaveLength(1);
  });

  it('ومكتبٌ اعتاد إبقاءها: لا يُنزع — ويُقال لماذا', () => {
    const db = freshDb();
    for (let i = 0; i < HABIT; i++) recordCorrection(db, { kind: 'duplicate', input: '95', suggested: 'copy', chosen: 'keep' });
    const after = applyHabits(db, plan());
    expect(after.duplicates).toEqual([]);
    expect(after.candidates[1]!.suggestions.map((s) => s.reason).join(' ')).toContain('ويُبقيهما مكتبك');
  });
});
