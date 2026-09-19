import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  HABIT,
  learned,
  learningStats,
  prefer,
  prepareLearning,
  recordCorrection,
  recordCorrections
} from '../src/main/services/learning';
import { applyHabits } from '../src/main/services/importFolder';
import { APPLY_THRESHOLD, docFromLegacy, type Suggestion } from '../src/shared/doc';
import type { ImportPlan } from '../src/shared/api';

function db(): Database.Database {
  const conn = new Database(':memory:');
  const dir = join(process.cwd(), 'src', 'main', 'db');
  for (const file of ['schema.sql', 'search.sql']) conn.exec(readFileSync(join(dir, file), 'utf8'));
  return conn;
}

const teach = (conn: Database.Database, times: number, chosen = 'اسم الطالب') =>
  recordCorrections(
    conn,
    Array.from({ length: times }, () => ({
      kind: 'fieldName' as const,
      input: 'اسم',
      suggested: 'اسم',
      chosen
    }))
  );

describe('الذكاء المحلي: يتعلّم من تصحيحات مكتبه', () => {
  it('يبدأ فارغًا — والبرنامج كاملُ الوظيفة بلا شيء منه', () => {
    const conn = db();
    expect(learned(conn, 'fieldName', 'اسم')).toBeNull();
    expect(learningStats(conn)).toEqual({ total: 0, byKind: [], habits: 0 });
  });

  it('ويقيّد ما غُيّر — ولا يقيّد ما قُبل', () => {
    const conn = db();
    // قبِل الاقتراح: لم يعلّمنا جديدًا.
    expect(
      recordCorrection(conn, { kind: 'fieldName', input: 'اسم', suggested: 'اسم', chosen: 'اسم' })
    ).toBe(false);
    // غيّره: علّمنا اسم مكتبه.
    expect(
      recordCorrection(conn, {
        kind: 'fieldName',
        input: 'اسم',
        suggested: 'اسم',
        chosen: 'اسم الطالب'
      })
    ).toBe(true);
    expect(learningStats(conn).total).toBe(1);
  });

  it('ولا يقيّد اختيارًا فارغًا', () => {
    const conn = db();
    expect(
      recordCorrection(conn, { kind: 'fieldName', input: 'اسم', suggested: null, chosen: '   ' })
    ).toBe(false);
  });

  /**
   * الثقةُ تنمو بالتكرار وترسخ عند العادة.
   *
   * فواحدةٌ قد تكون زلّة، واثنتان صدفة، وثلاثٌ عادة — وعندها تتجاوز عتبة التطبيق.
   */
  it('والثقةُ تنمو بالتكرار حتى تبلغ العادةَ فتتجاوز عتبة التطبيق', () => {
    const one = db();
    teach(one, 1);
    const a = learned(one, 'fieldName', 'اسم')!;
    expect(a.value).toBe('اسم الطالب');
    expect(a.confidence).toBeLessThan(APPLY_THRESHOLD);

    const many = db();
    teach(many, HABIT);
    const b = learned(many, 'fieldName', 'اسم')!;
    expect(b.confidence).toBeGreaterThanOrEqual(APPLY_THRESHOLD);
    expect(b.reason).toContain('اعتاده مكتبك');
  });

  it('ولا تبلغ اليقين أبدًا — فالموظف يحكم', () => {
    const conn = db();
    teach(conn, 40);
    expect(learned(conn, 'fieldName', 'اسم')!.confidence).toBeLessThanOrEqual(0.95);
  });

  it('والاختلافُ يُضعف الثقة', () => {
    const agreed = db();
    teach(agreed, 6);

    const split = db();
    teach(split, 3);
    teach(split, 3, 'اسم الموظف');

    expect(learned(split, 'fieldName', 'اسم')!.confidence).toBeLessThan(
      learned(agreed, 'fieldName', 'اسم')!.confidence
    );
  });

  it('وتُوحَّد الفراغات فلا يفترق سطران بمسافة', () => {
    const conn = db();
    recordCorrection(conn, {
      kind: 'fieldName',
      input: '  اسم   المواطن ',
      suggested: null,
      chosen: 'الاسم الرباعي'
    });
    expect(learned(conn, 'fieldName', 'اسم المواطن')!.value).toBe('الاسم الرباعي');
  });

  it('وكلُّ نوعٍ في بابه', () => {
    const conn = db();
    recordCorrection(conn, { kind: 'fieldName', input: 'س', suggested: null, chosen: 'أ' });
    recordCorrection(conn, { kind: 'letterheadEdge', input: 's', suggested: null, chosen: '4' });
    expect(learned(conn, 'letterheadEdge', 'س')).toBeNull();
    expect(learningStats(conn).byKind.map((k) => k.kind).sort()).toEqual([
      'fieldName',
      'letterheadEdge'
    ]);
  });
});

describe('الترجيح: القاعدة والعادة، وكلتاهما تُعلَّل', () => {
  const rule: Suggestion<string> = { value: 'اسم', confidence: 0.55, reason: 'آخر كلمة قبل الفراغ' };

  it('بلا عادةٍ تبقى القاعدة', () => {
    expect(prefer(rule, null)).toBe(rule);
  });

  it('وبلا قاعدةٍ تُؤخذ العادة', () => {
    const habit: Suggestion<string> = { value: 'اسم الطالب', confidence: 0.6, reason: 'مكتبك' };
    expect(prefer(null, habit)).toBe(habit);
  });

  it('والعادةُ الراسخة تسبق القاعدة', () => {
    const conn = db();
    teach(conn, HABIT);
    const habit = learned(conn, 'fieldName', 'اسم')!;
    expect(prefer(rule, habit)!.value).toBe('اسم الطالب');
  });

  it('وعادةٌ لم ترسخ لا تزيح قاعدةً أوثق منها', () => {
    const conn = db();
    teach(conn, 1);
    const habit = learned(conn, 'fieldName', 'اسم')!;
    const strong: Suggestion<string> = { value: 'اسم', confidence: 0.95, reason: 'نقطتان' };
    expect(prefer(strong, habit)!.value).toBe('اسم');
  });

  it('ولكلٍّ سببٌ يُقرأ — فالتعلّم لا يكون صامتًا', () => {
    const conn = db();
    teach(conn, HABIT);
    expect(learned(conn, 'fieldName', 'اسم')!.reason).toMatch(/مكتبك/);
  });
});

describe('الخطّة تُبنى بالقواعد ثم تُطبَّق عليها العادة', () => {
  function plan(): ImportPlan {
    const doc = docFromLegacy('نؤيد أن {اسم} موظف لدينا');
    return {
      candidates: [
        {
          id: 'c1',
          file: 'a.docx',
          formIndex: 0,
          formCount: 1,
          title: 'تأييد',
          subjectLine: null,
          doc,
          letterheadKey: null,
          letterhead: null,
          notes: [],
          warnings: [],
          suggestions: []
        }
      ],
      sharedLetterhead: null,
      duplicates: [],
      failed: []
    };
  }

  it('بلا عادةٍ لا تتغيّر الخطّة', () => {
    const conn = db();
    const before = plan();
    const after = applyHabits(conn, before);
    expect(after.candidates[0]!.doc.fields[0]!.label).toBe('اسم');
    expect(after.candidates[0]!.suggestions).toHaveLength(0);
  });

  it('وتصحيحٌ واحد لا يُطبَّق — فقد يكون زلّة', () => {
    const conn = db();
    teach(conn, 1);
    const after = applyHabits(conn, plan());
    // ولو طُبِّق لما رأى الموظفُ الاسمَ الأول ثانيةً، فلم يتعلّم البرنامج بعدها شيئًا.
    expect(after.candidates[0]!.doc.fields[0]!.label).toBe('اسم');
  });

  it('وبعادةٍ راسخة يُعاد تسمية الحقل ويُقال السبب', () => {
    const conn = db();
    teach(conn, HABIT);
    const after = applyHabits(conn, plan());

    expect(after.candidates[0]!.doc.fields[0]!.label).toBe('اسم الطالب');
    const why = after.candidates[0]!.suggestions[0]!;
    expect(why.reason).toContain('«اسم» ← «اسم الطالب»');
    expect(why.reason).toContain('اعتاده مكتبك');
    // والقيمة مفتاحُ الحقل: بها تربط الشاشة السببَ بسطره.
    expect(why.value).toBe(after.candidates[0]!.doc.fields[0]!.key);
    // والمفتاح لا يتغيّر، فلا ينكسر ما في المتن.
    expect(after.candidates[0]!.doc.fields[0]!.key).toBe('اسم');
  });

  it('ولا تُمسّ الخطّة الأصلية — فالتطبيق لا يكتب فوق ما بُني', () => {
    const conn = db();
    teach(conn, HABIT);
    const before = plan();
    applyHabits(conn, before);
    expect(before.candidates[0]!.doc.fields[0]!.label).toBe('اسم');
  });
});

describe('الجدول يُنشأ على قاعدةٍ لم تعرفه', () => {
  it('يُرحَّل ولا يسقط', () => {
    const conn = db();
    conn.exec('DROP TABLE corrections');
    expect(() => learningStats(conn)).not.toThrow();
    prepareLearning(conn);
    expect(learningStats(conn).total).toBe(0);
  });
});
