import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { listTemplates, saveTemplate } from '../src/main/services/templates';
import { listScore, normalizeDoc, run, type ListItem } from '../src/shared/doc';
import { renderDocHtml } from '../src/shared/docHtml';
import {
  EXAM_CATEGORY,
  HEAD_INPUTS,
  emptyHead,
  examDoc,
  examList,
  headOf,
  newQuestion,
  paperTitle,
  questionsOf, VERSION_KEY } from '../src/shared/examPaper';

const filledHead = () => ({
  ...emptyHead(),
  المحافظة: 'بغداد / الرصافة الأولى',
  القضاء: 'الأعظمية',
  المدرسة: 'ثانوية الرشيد للبنين',
  المادة: 'الرياضيات',
  الصف: 'الثالث المتوسط',
  الزمن: 'ساعتان',
  التاريخ: '2026/1/12',
  'نوع الامتحان': 'نصف السنة',
  'العام الدراسي': '2025 - 2026'
});

const q = (text: string, patch: Partial<ListItem> = {}): ListItem => ({
  ...newQuestion(),
  inlines: [run(text)],
  ...patch
});

describe('ورقة الأسئلة: رأسٌ ثابتٌ ومتنٌ يُركَّب', () => {
  it('الرأس كلّه متغيّراتٌ معدودة — ولا حقل خارجها إلا سطر النموذج', () => {
    const doc = examDoc(filledHead(), examList([q('عرّف ما يأتي:')]));
    const keys = doc.fields.map((f) => f.key).sort();
    // «النموذج» لا خانة له في لوح الرأس: يُملأ «أ» و«ب» عند طباعة نموذجين وحدها.
    expect(keys).toEqual([...HEAD_INPUTS.map((i) => i.key), VERSION_KEY].sort());
  });

  it('والثابت يبقى ثابتًا وإن خلت المتغيّرات', () => {
    const doc = examDoc(emptyHead(), examList([q('س')]));
    const html = renderDocHtml(doc, emptyHead(), { missing: 'blank', paragraphs: 'blocks' });

    // النصّ الثابت مطبوعٌ دائمًا…
    expect(html).toContain('المديرية العامة لتربية');
    expect(html).toContain('أسئلة امتحان');
    expect(html).toContain('المادة:');
    // …ومكان المتغيّر فراغٌ بطوله لا وسمٌ ولا اختفاء.
    expect(html).not.toContain('{المادة}');
    expect(html).toContain('border-bottom:1px dotted');
  });

  it('والسطر الذي لا متغيّر له لا يُطبع فارغًا', () => {
    const bare = renderDocHtml(examDoc(emptyHead(), examList([q('س')])), emptyHead(), {
      missing: 'blank',
      paragraphs: 'blocks'
    });
    expect(bare).not.toContain('الشعبة');
    expect(bare).not.toContain('الدور ');

    const head = { ...filledHead(), الشعبة: 'أ', الدور: 'الأول', الملاحظة: 'أجب عن خمسة فقط' };
    const full = renderDocHtml(examDoc(head, examList([q('س')])), head, {
      missing: 'blank',
      paragraphs: 'blocks'
    });
    expect(full).toContain('الشعبة:');
    expect(full).toContain('الدور ');
    expect(full).toContain('أجب عن خمسة فقط');
  });

  it('وتُطبع ولا تُقيَّد — فلا تجاور الكتب', () => {
    const doc = examDoc(filledHead(), examList([q('س')]));
    expect(doc.issuing).toBe('print-only');
    expect(doc.meta.category).toBe(EXAM_CATEGORY);
    expect(doc.pageSetup.letterheadMode).toBe('none');
  });

  it('وعنوانها يُشتقّ من مادّتها وصفّها', () => {
    expect(paperTitle(filledHead())).toBe('أسئلة الرياضيات — الثالث المتوسط — نصف السنة');
    expect(paperTitle(emptyHead())).toBe('ورقة أسئلة');
  });
});

describe('الترقيم يُحسب، والدرجات تُجمع على المطلوب', () => {
  const doc = () =>
    examDoc(
      filledHead(),
      examList([
        q('عرّف ما يأتي:', {
          items: [q('العدد الأولي'), q('العدد النسبي'), q('المضاعف المشترك')],
          pick: 2,
          score: undefined
        }),
        q('حلّ ما يأتي:', { score: 40 })
      ])
    );

  it('سؤالٌ ففرعٌ ففرعُ فرعٍ — عمقٌ لا ثلاثة أنواع', () => {
    const html = renderDocHtml(doc(), filledHead(), { paragraphs: 'blocks' });
    expect(html).toContain('س1:');
    expect(html).toContain('س2:');
    expect(html).toContain('أ)');
    expect(html).toContain('ب)');
    expect(html).toContain('أجب عن 2 فقط:');
  });

  it('ودرجةُ السؤال مجموعُ فروعه إن لم تُذكر', () => {
    const paper = examDoc(
      filledHead(),
      examList([
        q('عرّف:', { items: [q('أ', { score: 10 }), q('ب', { score: 10 }), q('ج', { score: 10 })] }),
        q('حلّ:', { score: 40 })
      ])
    );
    const list = questionsOf(paper)!;
    expect(listScore(list)).toBe(70);
  });

  it('وإن كان «أجب عن ن» حُسب المطلوب لا الكل', () => {
    const paper = examDoc(
      filledHead(),
      examList([
        q('عرّف:', {
          pick: 2,
          items: [q('أ', { score: 10 }), q('ب', { score: 10 }), q('ج', { score: 10 })]
        })
      ])
    );
    expect(listScore(questionsOf(paper)!)).toBe(20);
  });

  it('و«أجب عن ن أسئلة» على الورقة كلّها كذلك', () => {
    const list = examList([q('أ', { score: 25 }), q('ب', { score: 25 }), q('ج', { score: 25 })]);
    list.pick = 2;
    expect(listScore(questionsOf(examDoc(filledHead(), list))!)).toBe(50);
  });

  it('والإجابة النموذجية تُخفى في ورقة الطالب وتظهر في ورقة المصحّح', () => {
    const paper = examDoc(filledHead(), examList([q('2 + 2 = ؟', { answer: [run('4')] })]));
    const student = renderDocHtml(paper, filledHead(), { paragraphs: 'blocks' });
    const marker = renderDocHtml(paper, filledHead(), { paragraphs: 'blocks', answers: 'show' });
    expect(student).not.toContain('الإجابة:');
    expect(marker).toContain('الإجابة:');
  });
});

describe('ما حُفظ يُفتح فتعود القيم إلى خاناتها', () => {
  it('الرأس من `meta.head` والأسئلة من آخر قائمة', () => {
    const head = { ...filledHead(), الشعبة: 'ب' };
    const before = examDoc(head, examList([q('عرّف:', { items: [q('أ')] }), q('حلّ:')]));

    const after = normalizeDoc(JSON.parse(JSON.stringify(before)));

    expect(headOf(after)).toEqual(head);
    expect(after.issuing).toBe('print-only');
    const list = questionsOf(after)!;
    expect(list.items).toHaveLength(2);
    expect(list.items[0]?.items).toHaveLength(1);
  });

  it('وخاناتُ رأسٍ حُفظ ناقصًا تعود فارغةً لا مفقودة', () => {
    const doc = examDoc({ المادة: 'الفيزياء' }, examList([q('س')]));
    const head = headOf(normalizeDoc(JSON.parse(JSON.stringify(doc))));
    expect(Object.keys(head).sort()).toEqual(HEAD_INPUTS.map((i) => i.key).sort());
    expect(head['المادة']).toBe('الفيزياء');
    expect(head['المدرسة']).toBe('');
  });
});

describe('الفصل بالحكم لا بالتصنيف', () => {
  function db(): Database.Database {
    const conn = new Database(':memory:');
    const dir = join(process.cwd(), 'src', 'main', 'db');
    for (const file of ['schema.sql', 'search.sql']) {
      conn.exec(readFileSync(join(dir, file), 'utf8'));
    }
    return conn;
  }

  it('مكتبة الكتب لا تُري أوراق الأسئلة، والعكس', () => {
    const conn = db();
    const base = {
      id: null,
      code: null,
      subtitle: null,
      subjectLine: null,
      letterheadId: null,
      variables: []
    };

    saveTemplate(conn, {
      ...base,
      title: 'تأييد استمرار بالخدمة',
      category: 'تأييدات',
      bodyHtml: 'نؤيد أن {الاسم} موظف لدينا'
    });

    const paper = examDoc(filledHead(), examList([q('عرّف ما يأتي:')]));
    saveTemplate(conn, {
      ...base,
      title: paperTitle(filledHead()),
      category: EXAM_CATEGORY,
      bodyHtml: 'عرّف ما يأتي:',
      doc: paper
    });

    const letters = listTemplates(conn);
    const papers = listTemplates(conn, null, 'print-only');

    expect(letters.map((t) => t.title)).toEqual(['تأييد استمرار بالخدمة']);
    expect(papers.map((t) => t.title)).toEqual(['أسئلة الرياضيات — الثالث المتوسط — نصف السنة']);
  });

  it('وقاعدةُ مكتبٍ أُنشئت قبل العمود تُرحَّل ولا تسقط', () => {
    const conn = db();
    conn.exec('ALTER TABLE templates DROP COLUMN issuing');
    expect(() => listTemplates(conn)).not.toThrow();
    expect(listTemplates(conn)).toEqual([]);
  });
});
