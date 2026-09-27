import { describe, expect, it } from 'vitest';
import { emptyDoc, fieldRef, paragraph, run } from '../src/shared/doc';
import { applySpelling, docSpelling, fixDocSpelling, spellingIssues } from '../src/shared/spelling';

describe('التنبيه الإملائي', () => {
  it('الياء مكان المقصورة، والهاء مكان التاء، والكلمة كاملةً', () => {
    const issues = spellingIssues('يرجى تحويل الطالب الى المدرسه الثانويه حتي نهاية السنه');
    expect(issues.map((i) => `${i.word}→${i.fix}`)).toEqual(
      expect.arrayContaining(['الى→إلى', 'المدرسه→المدرسة', 'الثانويه→الثانوية', 'حتي→حتى', 'السنه→السنة'])
    );
  });

  it('وما قد يكون صوابًا لا يُقترح: «علي» اسمًا، و«التوجيه» مصدرًا', () => {
    expect(spellingIssues('السيد علي حسين — مديرية التوجيه')).toEqual([]);
  });

  it('الترقيم اللاتيني في نصٍّ عربي، والمسافة قبل العلامة', () => {
    const text = 'نشكركم , ونرجو تزويدنا ?';
    const fixed = applySpelling(text, spellingIssues(text));
    expect(fixed).toBe('نشكركم، ونرجو تزويدنا؟');
  });

  it('يُصلح نصّ الوثيقة الثابت ولا يمسّ الحقول', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('يرجى تحويل '), fieldRef('الاسم'), run(' الى المدرسه')])];
    const issues = docSpelling(doc);
    expect(issues).toHaveLength(2);
    const fixed = fixDocSpelling(doc, issues);
    const p = fixed.blocks[0]!;
    expect(p.kind === 'paragraph' && p.inlines.map((n) => (n.kind === 'run' ? n.text : `{${n.kind === 'field' ? n.ref : ''}}`)).join('')).toBe(
      'يرجى تحويل {الاسم} إلى المدرسة'
    );
  });
});
