import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import {
  applyImportPlan,
  formsOf,
  letterheadKey,
  planFolderImport,
  type ImportPlan
} from '../src/main/services/importFolder';
import { listTemplates, prepareTemplates, templateDoc } from '../src/main/services/templates';
import { listLetterheads, prepareLetterheads } from '../src/main/services/letterheads';
import { docText, emptyDoc, normalizeDoc, paragraph, run, type Block } from '../src/shared/doc';

const FIXTURE = join(__dirname, 'fixtures', 'school-warning.docx');

/** مجلد مكتب: نسخٌ من ورقة حقيقية بأسماء مختلفة — كما يفعل Word فعلًا. */
function officeFolder(names: string[], extra: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-folder-'));
  for (const name of names) copyFileSync(FIXTURE, join(dir, name));
  for (const [name, body] of Object.entries(extra)) writeFileSync(join(dir, name), body, 'utf8');
  return dir;
}

describe('مشي المجلد', () => {
  it('يقرأ ملفات Word ويترك ما ليس منها', async () => {
    const dir = officeFolder(['انذار.docx'], {
      'ملاحظات.txt': 'ليس مستندًا',
      '~$انذار.docx': 'ملف Word مؤقّت'
    });

    const plan = await planFolderImport(dir);
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]!.file).toBe('انذار.docx');
    expect(plan.failed).toEqual([]);
  });

  it('ولا يمسّ القاعدة — الخطّة قراءةٌ تُعرض قبل أن تصير', async () => {
    const db = freshDb();
    await planFolderImport(officeFolder(['أ.docx']));
    expect(listTemplates(db)).toEqual([]);
    expect(listLetterheads(db)).toEqual([]);
  });

  it('يحمل كل مرشَّح ورقته بتنسيقها وحقولها المستنتجة — كالملفّ الواحد', async () => {
    const plan = await planFolderImport(officeFolder(['انذار.docx']));
    const c = plan.candidates[0]!;

    // الورقة كما يرسمها قارئ Word: صفّا الرأس أعمدةٌ — وكانت تُبنى من النصّ فتصير أسطرًا.
    expect(c.doc.blocks.some((b) => b.kind === 'columns')).toBe(true);
    expect(c.headCount).toBe(4);
    expect(c.doc.fields.map((f) => f.label)).toEqual(expect.arrayContaining(['اسم التلميذ', 'الصف', 'عدد الغيابات']));
    // و«التلميذ» في موضعين خانةٌ واحدة تُكتب مرّة.
    expect(c.doc.fields.filter((f) => f.label === 'اسم التلميذ')).toHaveLength(1);
    // وفراغ «التاريخ: / / 20» في الرأس لا يصير خانة: الرأس ترويسة، وفراغاته يملؤها القلم.
    expect(c.doc.fields.map((f) => f.label)).not.toContain('التاريخ');
    // ولكل حقل مستنتَج درجته وسببه — فيراجعه الموظف على بيّنة.
    expect(c.suggestions).toHaveLength(c.doc.fields.length);
    expect(c.suggestions.find((s) => s.value.endsWith('اسم التلميذ'))?.reason).toBe('اسمُ شخص');
    expect(c.doc.fields.every((f) => f.fillMode === 'hand')).toBe(true);
  });

  it('ملفٌ تالف لا يُسقط المجلد كلّه — يُقيَّد ويمضي', async () => {
    const dir = officeFolder(['سليم.docx'], { 'تالف.docx': 'ليس حزمة Word' });
    const plan = await planFolderImport(dir);

    expect(plan.candidates).toHaveLength(1);
    expect(plan.failed).toHaveLength(1);
    expect(plan.failed[0]!.file).toBe('تالف.docx');
    expect(plan.failed[0]!.error).toMatch(/\S/);
  });

  it('يحترم سقف الدفعة الواحدة', async () => {
    const dir = officeFolder(['أ.docx', 'ب.docx', 'ج.docx']);
    expect((await planFolderImport(dir, { limit: 2 })).candidates).toHaveLength(2);
  });
});

describe('الترويسة الواحدة تُكتشف', () => {
  it('ترويسة تتكرّر في الملفات تُعرض ترويسةً واحدة بعددها', async () => {
    const plan = await planFolderImport(officeFolder(['أ.docx', 'ب.docx', 'ج.docx']));

    expect(plan.sharedLetterhead).not.toBeNull();
    expect(plan.sharedLetterhead!.count).toBe(3);
    expect(letterheadKey(plan.sharedLetterhead!.layout)).toContain('مدرسة الصحوة الابتدائية');
    // وكلّها تشير إلى البصمة نفسها.
    expect(new Set(plan.candidates.map((c) => c.letterheadKey)).size).toBe(1);
  });

  it('وملفٌ واحد لا ترويسةَ مشتركة له', async () => {
    const plan = await planFolderImport(officeFolder(['وحيد.docx']));
    expect(plan.sharedLetterhead).toBeNull();
  });
});

describe('كشف المكرّر في المجلد', () => {
  it('«انذار.docx» و«انذار2.docx» و«انذار نهائي.docx» مجموعةٌ واحدة', async () => {
    const plan = await planFolderImport(
      officeFolder(['انذار.docx', 'انذار2.docx', 'انذار نهائي.docx'])
    );

    expect(plan.duplicates).toHaveLength(1);
    expect(plan.duplicates[0]!.ids).toHaveLength(3);
    expect(plan.duplicates[0]!.confidence).toBeGreaterThanOrEqual(0.95);
  });
});

describe('تنفيذ ما قبِله الموظف', () => {
  const ready = async (names: string[]) => {
    const db = freshDb();
    prepareTemplates(db);
    prepareLetterheads(db);
    const plan = await planFolderImport(officeFolder(names));
    return { db, plan };
  };

  const acceptAll = (plan: ImportPlan) => plan.candidates.map((c) => c.id);
  const savedDocs = (db: ReturnType<typeof freshDb>) =>
    (db.prepare('SELECT doc_json AS docJson, body_html AS bodyHtml FROM templates').all() as { docJson: string | null; bodyHtml: string }[]).map(
      (row) => templateDoc(row)
    );

  it('يحفظ المقبول وحده، ولا يحفظ ما تُرك', async () => {
    const { db, plan } = await ready(['أ.docx', 'ب.docx', 'ج.docx']);

    const out = applyImportPlan(db, plan, {
      accept: [plan.candidates[0]!.id],
      useSharedLetterhead: false
    });

    expect(out.templates).toBe(1);
    expect(out.skipped).toBe(2);
    expect(listTemplates(db)).toHaveLength(1);
  });

  it('الترويسة المتكرّرة تُحفظ مرّة ويُربط بها الجميع', async () => {
    const { db, plan } = await ready(['أ.docx', 'ب.docx', 'ج.docx']);

    const out = applyImportPlan(db, plan, {
      accept: acceptAll(plan),
      useSharedLetterhead: true,
      sharedName: 'مدرسة الصحوة'
    });

    // ثلاث بطاقات وترويسة واحدة — لا ثلاث ترويسات.
    expect(out.templates).toBe(3);
    expect(listLetterheads(db)).toHaveLength(1);
    expect(listLetterheads(db)[0]!.name).toBe('مدرسة الصحوة');
    expect(listTemplates(db).every((t) => t.letterheadId === out.letterheadId)).toBe(true);
    // والترويسة رأسُ الورقة بتنسيقه (أعمدته)، والرأس فُصل عن الأوراق فلا يُطبع مرّتين.
    expect(listLetterheads(db)[0]!.layout.sheet?.some((b) => b.kind === 'columns')).toBe(true);
    const saved = savedDocs(db);
    expect(saved.every((d) => !docText(d).includes('مدرسة الصحوة الابتدائية'))).toBe(true);
    expect(saved.every((d) => d.fields.some((f) => f.label === 'اسم التلميذ'))).toBe(true);
  });

  it('وإن رفضها الموظف بقيت البطاقات بلا ترويسة — وكلٌّ برأسه كما كان، لا يضيع', async () => {
    const { db, plan } = await ready(['أ.docx', 'ب.docx']);
    const out = applyImportPlan(db, plan, {
      accept: acceptAll(plan),
      useSharedLetterhead: false
    });

    expect(out.letterheadId).toBeNull();
    expect(listLetterheads(db)).toHaveLength(0);
    expect(listTemplates(db).every((t) => t.letterheadId === null)).toBe(true);
    // وكان الرأس يُستخرج من المتن ثم يضيع إن لم يُربط.
    expect(savedDocs(db).every((d) => docText(d).includes('مدرسة الصحوة الابتدائية'))).toBe(true);
  });

  it('الوثيقة تُحفظ بتنسيقها وتعود كما بُنيت — لا مُرحَّلةً من نصّ', async () => {
    const { db, plan } = await ready(['انذار.docx']);
    applyImportPlan(db, plan, { accept: acceptAll(plan), useSharedLetterhead: false });

    const saved = listTemplates(db)[0]!;
    const row = db
      .prepare('SELECT doc_json AS docJson, body_html AS bodyHtml FROM templates WHERE id = ?')
      .get(saved.id) as { docJson: string | null; bodyHtml: string };

    expect(row.docJson).not.toBeNull();
    const doc = templateDoc(row);

    // الأعمدة لا تنجو من الترحيل النصّي — فوجودها دليل أن الورقة حُفظت بتنسيقها.
    expect(doc.blocks.some((b) => b.kind === 'columns')).toBe(true);
    expect(doc.fields.map((f) => f.label)).toContain('اسم التلميذ');
    // وعرض الفراغ كما كتبه المكتب.
    expect(Math.max(...doc.fields.map((f) => f.width))).toBeGreaterThan(20);
  });

  it('والتصنيف الذي اختاره الموظف يلحق بالبطاقات والترويسة', async () => {
    const { db, plan } = await ready(['أ.docx', 'ب.docx']);
    applyImportPlan(db, plan, {
      accept: acceptAll(plan),
      useSharedLetterhead: true,
      category: 'مدارس'
    });

    expect(listTemplates(db).every((t) => t.category === 'مدارس')).toBe(true);
    expect(listLetterheads(db)[0]!.category).toBe('مدارس');
  });
});

describe('الملفّ الواحد مكتبة', () => {
  const p = (text: string) => paragraph(text ? [run(text)] : []);
  const logo = (id: string): Block => ({ id, kind: 'image', src: 'seals/logo.png', width: 80, align: 'center' });

  it('تكرارُ أوّل سطرٍ في الورقة حدُّ استمارةٍ أخرى — والشعار قبله يتبعه، وفاصل الصفحة في آخرها يُترك', () => {
    const doc = {
      ...emptyDoc(),
      blocks: [
        logo('a'),
        p('مدرسة النور'),
        p('إنذار'),
        p('نصّ الأولى'),
        { id: 'pb', kind: 'pageBreak' } as Block,
        logo('b'),
        p('مدرسة النـــور'),
        p('تأييد'),
        p('نصّ الثانية'),
        p('')
      ]
    };
    const forms = formsOf(doc);
    expect(forms.map((f) => docText(f).split(String.fromCharCode(10)).filter(Boolean))).toEqual([
      ['مدرسة النور', 'إنذار', 'نصّ الأولى'],
      ['مدرسة النـــور', 'تأييد', 'نصّ الثانية']
    ]);
    expect(forms[1]!.blocks[0]!.kind).toBe('image');
    expect(forms.every((f) => f.blocks.at(-1)!.kind === 'paragraph' && docText({ ...f, blocks: [f.blocks.at(-1)!] }).trim())).toBe(true);
  });

  it('وورقةٌ لا يتكرّر أوّلها استمارةٌ واحدة كما هي', () => {
    const doc = { ...emptyDoc(), blocks: [p('مدرسة النور'), p('نصّ')] };
    expect(formsOf(doc)).toEqual([doc]);
  });
});

describe('قراءة الوثيقة المحفوظة', () => {
  it('نموذجٌ حُفظ قبل النواة يُقرأ من ظلّه النصّي', () => {
    const doc = templateDoc({ docJson: null, bodyHtml: 'نؤيد أن {الاسم} موظف' });
    expect(doc.fields.map((f) => f.key)).toEqual(['الاسم']);
  });

  it('وبنية تالفة لا تمنع فتح النموذج', () => {
    const doc = templateDoc({ docJson: '}{ ليس JSON', bodyHtml: 'متن {س}' });
    expect(doc.fields.map((f) => f.key)).toEqual(['س']);
  });

  it('والمحفوظ كتلًا يُقرأ كما هو', () => {
    const built = normalizeDoc({
      id: 'd1',
      blocks: [{ id: 'sp', kind: 'spacer', height: 90 }],
      fields: []
    });
    const doc = templateDoc({ docJson: JSON.stringify(built), bodyHtml: '' });
    expect(doc.id).toBe('d1');
    expect(doc.blocks).toHaveLength(1);
  });
});
