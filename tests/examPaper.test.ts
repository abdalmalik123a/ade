import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { listTemplates, saveTemplate } from '../src/main/services/templates';
import { listScore, run, type ListItem, type ParagraphBlock } from '../src/shared/doc';
import { normalizeDoc } from '../src/shared/docNormalize';
import { renderDocHtml } from '../src/shared/docHtml';
import {
  EXAM_CATEGORY,
  EXAM_PRESETS,
  HEAD_INPUTS,
  emptyHead,
  examDoc,
  examList,
  headOf,
  newQuestion,
  paperTitle,
  questionsOf, VERSION_KEY, versionItems, splitExamItems, questionWeight, examPageFooterText, examPageFooterBlocks, examContinuationBlocks, splitExamPagesHtml } from '../src/shared/examPaper';

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

describe('نماذج الرأس السريعة', () => {
  /** كانت تكتب مدرسةً ومحافظةً وتاريخًا مخترَعة فوق ما كتبه المدرّس. */
  it('لا تمسّ المدرسة ولا المادة ولا الصف ولا التاريخ ولا العام', () => {
    const own = ['المحافظة', 'القضاء', 'المدرسة', 'المادة', 'الصف', 'الشعبة', 'التاريخ', 'العام الدراسي', 'مدرس المادة'];
    for (const preset of EXAM_PRESETS) for (const key of own) expect(preset.head).not.toHaveProperty(key);
  });
});

describe('ورقة الأسئلة بالوجهين وترقيم الصفحات (S14)', () => {
  it('ترقيم الصفحة يعيد «الصفحة ١ من ٢» و«الصفحة ٢ من ٢»', () => {
    expect(examPageFooterText(1, 2)).toBe('الصفحة ١ من ٢');
    expect(examPageFooterText(2, 2)).toBe('الصفحة ٢ من ٢');
  });

  it('كتل التذييل ورأس المتابعة تظهر عند وجود وجهين', () => {
    expect(examPageFooterBlocks(1, 1)).toEqual([]);
    const blocks = examPageFooterBlocks(1, 2);
    expect(blocks).toHaveLength(2);
    const p = blocks[1] as ParagraphBlock;
    expect((p.inlines[0] as any).text).toContain('الصفحة ١ من ٢');
    expect((p.inlines[0] as any).text).toContain('اقلب الصفحة');
    const cont = examContinuationBlocks(filledHead());
    expect(cont).toHaveLength(2);
    expect(((cont[0] as ParagraphBlock).inlines[0] as any).text).toContain('الوجه الثاني');
  });

  it('احتساب وزن السؤال يتأثر بالفروع والإجابات', () => {
    const single = q('سؤال قصير');
    const withBranches = q('سؤال رئيسي', { items: [q('أ'), q('ب')] });
    expect(questionWeight(withBranches)).toBeGreaterThan(questionWeight(single));
  });

  it('تقسيم الأسئلة: أسئلة قليلة بلا خيار الوجهين تبقى صفحة واحدة', () => {
    const items = [q('عرّف ما يأتي'), q('حلّ المعادلة')];
    const res = splitExamItems(items);
    expect(res.isDuplex).toBe(false);
    expect(res.page1).toHaveLength(2);
    expect(res.page2).toHaveLength(0);
  });

  it('تفعيل خيار الوجهين صراحة يقسم الأسئلة بالتناصف حتى لو كانت قليلة', () => {
    const items = [q('س1'), q('س2')];
    const res = splitExamItems(items, { duplex: true });
    expect(res.isDuplex).toBe(true);
    expect(res.page1).toHaveLength(1);
    expect(res.page2).toHaveLength(1);
  });

  it('تجاوز سعة الصفحة يقسم الأسئلة تلقائيًّا مع بقاء الترقيم المتتابع', () => {
    const items = [
      q('س1', { items: [q('أ'), q('ب'), q('ج')] }),
      q('س2', { items: [q('أ'), q('ب'), q('ج')] }),
      q('س3', { items: [q('أ'), q('ب'), q('ج')] }),
      q('س4', { items: [q('أ'), q('ب'), q('ج')] }),
      q('س5', { items: [q('أ'), q('ب')] })
    ];
    const res = splitExamItems(items);
    expect(res.isDuplex).toBe(true);
    expect(res.page1.length).toBeGreaterThan(0);
    expect(res.page2.length).toBeGreaterThan(0);
    expect(res.page1.length + res.page2.length).toBe(5);
  });

  it('تقسيم علامات HTML للوجهين يضع «الصفحة ١ من ٢» في الأولى و«الصفحة ٢ من ٢» في الثانية', () => {
    const items = [q('س1'), q('س2'), q('س3'), q('س4')];
    const doc = examDoc(filledHead(), examList(items));
    const fullHtml = renderDocHtml(doc, filledHead(), { missing: 'blank', paragraphs: 'blocks' });
    const { page1Html, page2Html } = splitExamPagesHtml(fullHtml, 2, filledHead(), 2);
    expect(page1Html).toContain('الصفحة ١ من ٢');
    expect(page2Html).toContain('الصفحة ٢ من ٢');
  });
});

describe('صورةٌ داخل السؤال في ورقة الأسئلة (S15 · ر157)', () => {
  it('يدعم وجود صورة في السؤال وتصييرها داخل علامات HTML مع رابطها وعرضها', () => {
    const items = [
      q('س1: بالاعتماد على الشكل الآتي، أوجد شدة التيار:', {
        image: { path: 'circuits/diagram1.png', width: 320 }
      })
    ];
    const doc = examDoc(filledHead(), examList(items));
    const html = renderDocHtml(doc, filledHead(), { missing: 'blank', paragraphs: 'blocks' });
    expect(html).toContain('data-question-image');
    expect(html).toContain('diwan://store/circuits/diagram1.png');
    expect(html).toContain('width:320px');
  });

  it('يدعم صورة في الفرع وتصييرها مع الإجابة والدرجة', () => {
    const items = [
      q('س1:', {
        items: [
          q('أ) بيّن أجزاء الخلية النباتية في الرسم:', {
            image: { path: 'cells/plant.png' },
            score: 10
          })
        ]
      })
    ];
    const doc = examDoc(filledHead(), examList(items));
    const html = renderDocHtml(doc, filledHead(), { missing: 'blank', paragraphs: 'blocks' });
    expect(html).toContain('diwan://store/cells/plant.png');
    expect(html).toContain('max-height:160px');
  });

  it('احتساب وزن السؤال يزداد عند وجود صورة', () => {
    const plain = q('س1');
    const withImg = q('س1', { image: { path: 'img.png' } });
    expect(questionWeight(withImg)).toBeGreaterThan(questionWeight(plain));
  });

  it('نموذج ب يحافظ على صورة السؤال وفروعه عند خلط الفروع', () => {
    const items = [
      q('س1', {
        items: [
          q('فرع 1', { image: { path: 'f1.png' } }),
          q('فرع 2', { image: { path: 'f2.png' } })
        ]
      })
    ];
    const vB = versionItems(items);
    const bBranches = vB[0]!.items!;
    expect(bBranches.some((b) => b.image?.path === 'f1.png')).toBe(true);
    expect(bBranches.some((b) => b.image?.path === 'f2.png')).toBe(true);
  });
});
