import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AlignmentType,
  Document,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';
import { describe, expect, it } from 'vitest';
import { importTemplateFile } from '../src/main/services/import';

const dir = mkdtempSync(join(tmpdir(), 'diwan-import-'));

/** فقرة بمحاذاة معلومة — الترويسات المكتوبة نصًّا تُعرف بمحاذاتها. */
function para(text: string, alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]) {
  return new Paragraph({
    alignment,
    bidirectional: true,
    children: [new TextRun({ text, rightToLeft: true })]
  });
}

function cell(lines: string[]) {
  return new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    children: lines.map((t) => para(t, AlignmentType.CENTER))
  });
}

async function writeDocx(doc: Document): Promise<string> {
  const buffer = await Packer.toBuffer(doc);
  const path = join(dir, `t-${Math.random().toString(36).slice(2)}.docx`);
  writeFileSync(path, buffer);
  return path;
}

async function makeDocx(lines: string[]): Promise<string> {
  const doc = new Document({
    sections: [
      {
        children: lines.map(
          (t) => new Paragraph({ children: [new TextRun({ text: t, rightToLeft: true })] })
        )
      }
    ]
  });
  const buffer = await Packer.toBuffer(doc);
  const path = join(dir, `t-${Math.random().toString(36).slice(2)}.docx`);
  writeFileSync(path, buffer);
  return path;
}

function makeFile(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content, 'utf8');
  return path;
}

describe('استيراد نموذج من Word', () => {
  it('يقرأ مستند .docx حقيقيًا بلا تشغيل Word', async () => {
    const path = await makeDocx([
      'تأييد استمرار بالخدمة',
      'م / تأييد استمرار',
      'نؤيد لكم بأن السيد {الاسم} مستمر بالخدمة.'
    ]);
    const result = await importTemplateFile(path);
    expect(result.title).toBe('تأييد استمرار بالخدمة');
    expect(result.body).toContain('{الاسم}');
    expect(result.subjectLine).toBe('تأييد استمرار');
  });

  it('يحفظ العربية بمحارفها دون تشويه', async () => {
    const path = await makeDocx(['عنوان', 'مُحَمَّد وأحمد وإبراهيم — نصٌّ عربي']);
    const result = await importTemplateFile(path);
    expect(result.body).toContain('مُحَمَّد وأحمد وإبراهيم');
  });

  it('يستورد الملف ورقةً واحدة بتنسيقه، ويقول ذلك', async () => {
    const path = await makeDocx(['عنوان', 'متن']);
    const result = await importTemplateFile(path);
    expect(result.warnings.join(' ')).toContain('ورقةً واحدة بتنسيقه');
    const text = (result.doc?.blocks ?? [])
      .flatMap((b) => (b.kind === 'paragraph' ? b.inlines : []))
      .map((i) => (i.kind === 'run' ? i.text : ''))
      .join('|');
    expect(text).toContain('عنوان');
    expect(text).toContain('متن');
  });

  it('يرفض مستندًا فارغًا برسالة مفهومة', async () => {
    const path = await makeDocx(['', '   ']);
    await expect(importTemplateFile(path)).rejects.toThrow('فارغ');
  });

  it('يرفض ملفًا ليس حزمة Word', async () => {
    const path = makeFile('fake.docx', 'هذا ليس ملف Word');
    await expect(importTemplateFile(path)).rejects.toThrow('تعذّر فتح ملف Word');
  });

  it('يرفض الصيغ غير المدعومة', async () => {
    const path = makeFile('x.txt', 'نص');
    await expect(importTemplateFile(path)).rejects.toThrow('الملف ليس Word ولا XML');
  });
});

describe('استيراد نموذج من XML', () => {
  it('يقرأ وسوم صيغتنا', async () => {
    const path = makeFile(
      'a.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<template>
  <code>DIW-1</code>
  <title>كتاب عدم ممانعة</title>
  <category>كتب عدم الممانعة</category>
  <subject>عدم ممانعة</subject>
  <body>لا مانع لدينا من تعيين {الاسم}.</body>
</template>`
    );
    const result = await importTemplateFile(path);
    expect(result.code).toBe('DIW-1');
    expect(result.title).toBe('كتاب عدم ممانعة');
    expect(result.category).toBe('كتب عدم الممانعة');
    expect(result.subjectLine).toBe('عدم ممانعة');
    expect(result.body).toContain('{الاسم}');
  });

  it('يقبل الوسوم العربية أيضًا', async () => {
    const path = makeFile(
      'b.xml',
      '<نموذج><عنوان>تأييد سكن</عنوان><متن>يسكن {الاسم} في {العنوان}.</متن></نموذج>'
    );
    const result = await importTemplateFile(path);
    expect(result.title).toBe('تأييد سكن');
    expect(result.body).toContain('{العنوان}');
  });

  it('يفكّ كيانات XML فلا تظهر &amp; في الكتاب الرسمي', async () => {
    const path = makeFile('c.xml', '<template><title>أ &amp; ب</title><body>نص</body></template>');
    const result = await importTemplateFile(path);
    expect(result.title).toBe('أ & ب');
  });

  it('ينبّه إذا غاب وسم المتن ويستخرج النصّ', async () => {
    const path = makeFile('d.xml', '<x><y>نصّ حرّ</y></x>');
    const result = await importTemplateFile(path);
    expect(result.warnings.join(' ')).toContain('لم يُعثر على وسم');
    expect(result.body).toContain('نصّ حرّ');
  });
});

describe('استخراج الترويسة من ملفات Word', () => {
  it('يقرأ ترويسة الصفحة الحقيقية (headerN.xml)', async () => {
    const path = await writeDocx(
      new Document({
        sections: [
          {
            headers: {
              default: new Header({
                children: [
                  para('جمهورية العراق', AlignmentType.RIGHT),
                  para('وزارة التربية', AlignmentType.RIGHT)
                ]
              })
            },
            children: [para('م / تأييد'), para('نؤيد لكم أن السيد فلانًا موظف لدينا.')]
          }
        ]
      })
    );

    const result = await importTemplateFile(path);
    expect(result.letterhead).not.toBeNull();
    const blocks = result.letterhead!.sections[0].blocks.map((b) => b.value);
    expect(blocks).toEqual(['جمهورية العراق', 'وزارة التربية']);
    expect(result.warnings.join(' ')).toContain('استُخرجت ترويسة');
  });

  it('يقرأ الترويسة من جدول في رأس المستند — خليّة لكل قسم', async () => {
    const path = await writeDocx(
      new Document({
        sections: [
          {
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      cell(['جمهورية العراق', 'وزارة التربية']),
                      cell(['شعار']),
                      cell(['العدد:', 'التاريخ:'])
                    ]
                  })
                ]
              }),
              para('إلى / مصرف الرافدين'),
              para('نؤيد لكم أن السيد فلانًا مستمر بالخدمة.')
            ]
          }
        ]
      })
    );

    const result = await importTemplateFile(path);
    expect(result.letterhead?.columns).toBe(3);
    expect(result.letterhead!.sections[0].blocks[0]?.value).toBe('جمهورية العراق');
    expect(result.letterhead!.sections[2].blocks[0]?.value).toBe('العدد:');
    // نصّ الترويسة لا يتسرّب إلى المتن.
    expect(result.body).not.toContain('جمهورية العراق');
    expect(result.body).toContain('مستمر بالخدمة');
  });

  it('يلتقط ترويسة كُتبت نصًّا في أول المستند — وهي الحالة الغالبة', async () => {
    const path = await writeDocx(
      new Document({
        sections: [
          {
            children: [
              para('جمهورية العراق', AlignmentType.CENTER),
              para('وزارة التربية / المديرية العامة لتربية بغداد', AlignmentType.CENTER),
              para(''),
              para('إلى / مصرف الرافدين'),
              para('نؤيد لكم أن السيد فلانًا مستمر بالخدمة الفعلية.'),
              para('مع التقدير.')
            ]
          }
        ]
      })
    );

    const result = await importTemplateFile(path);
    expect(result.letterhead).not.toBeNull();
    expect(result.letterhead!.sections[0].blocks.map((b) => b.value)).toEqual([
      'جمهورية العراق',
      'وزارة التربية / المديرية العامة لتربية بغداد'
    ]);
    expect(result.body).not.toContain('جمهورية العراق');
    expect(result.body).toContain('مستمر بالخدمة الفعلية');
  });

  it('يوزّع أسطر الترويسة على الأقسام بحسب محاذاتها', async () => {
    const path = await writeDocx(
      new Document({
        sections: [
          {
            children: [
              para('جمهورية العراق', AlignmentType.RIGHT),
              para('وزارة التربية', AlignmentType.CENTER),
              para('الرصافة الأولى', AlignmentType.LEFT),
              para(''),
              para('إلى / جهة'),
              para('متن الكتاب الرسمي هنا.')
            ]
          }
        ]
      })
    );

    const result = await importTemplateFile(path);
    expect(result.letterhead?.columns).toBe(3);
    expect(result.letterhead!.sections[0].blocks[0]?.value).toBe('جمهورية العراق');
    expect(result.letterhead!.sections[1].blocks[0]?.value).toBe('وزارة التربية');
    expect(result.letterhead!.sections[2].blocks[0]?.value).toBe('الرصافة الأولى');
  });

  it('لا يقتطع من المتن ما ليس ترويسة', async () => {
    // كتاب يبدأ بالمخاطبة مباشرةً: لا ترويسة فيه.
    const direct = await importTemplateFile(
      await makeDocx(['إلى / مصرف الرافدين', 'نؤيد لكم أن السيد فلانًا موظف لدينا.', 'مع التقدير'])
    );
    expect(direct.letterhead).toBeNull();
    expect(direct.body).toContain('نؤيد لكم');

    // مستند قصير: ما بعد السطرين لا يكفي متنًا، فلا يُسرق منه شيء.
    const short = await importTemplateFile(await makeDocx(['عنوان قصير', 'سطر واحد']));
    expect(short.letterhead).toBeNull();

    // سطر طويل ليس ترويسة مهما كان موضعه.
    const long = await importTemplateFile(
      await makeDocx([
        'نؤيد لكم بأن السيد المذكور أدناه موظف لدينا ومستمر بالخدمة الفعلية حتى تاريخه وبناءً على طلبه زُوّد بهذا',
        'سطر ثانٍ',
        'سطر ثالث'
      ])
    );
    expect(long.letterhead).toBeNull();
  });
});

/** أصغر GIF صالح — يقوم مقام شعار الدائرة في الاختبار. */
const TINY_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

describe('ترويسة كُتبت بمسافات — وهي الشكل الغالب في كتب الدوائر', () => {
  /**
   * محاكاة ملف حقيقي من مدرسة: فقرة فارغة في أوّله، ثم سطران يفصل فيهما
   * فراغٌ طويلٌ يمينَ الترويسة عن يسارها، ثم سطر ثالث، ثم شعار، ثم المتن.
   */
  async function schoolLetter(): Promise<string> {
    return writeDocx(
      new Document({
        sections: [
          {
            children: [
              para(''),
              para('        ادارة                                        العدد: '),
              para('  مدرسة الصحوة الابتدائية                        التاريخ: / / 20'),
              para('للبنيـــــــن'),
              para(''),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: 'gif',
                    data: TINY_GIF,
                    transformation: { width: 60, height: 60 }
                  })
                ]
              }),
              para(''),
              para('الى / ولي امر التلميذ ............................'),
              para('م/ انـــــــــذار', AlignmentType.CENTER),
              para('بالنظر لوصول غيابات التلميذ ............ في الصف ........'),
              para('لذا تقرر نقص ....... من درجة المواظبة وانذاره.')
            ]
          }
        ]
      })
    );
  }

  it('لا تمنعها الفقرة الفارغة في أول المستند', async () => {
    const result = await importTemplateFile(await schoolLetter());
    expect(result.letterhead).not.toBeNull();
  });

  it('يفصل يمين الترويسة عن يسارها بالفراغ الذي كتبه الموظف', async () => {
    const result = await importTemplateFile(await schoolLetter());
    const layout = result.letterhead!;

    expect(layout.columns).toBe(2);
    expect(layout.sections[0].blocks.map((b) => b.value)).toEqual([
      'ادارة',
      'مدرسة الصحوة الابتدائية',
      // والمدّ يُحذف: ورقتنا تعيد الصفّ بنفسها فيخرج مهلهلًا إن بقي.
      'للبنين'
    ]);
  });

  it('ينتزع العدد والتاريخ إلى حقلَي السجل — لا يتركهما نصًّا ميّتًا', async () => {
    const result = await importTemplateFile(await schoolLetter());
    const layout = result.letterhead!;

    // بغيرها لا يعرف البرنامج أين يطبع رقم الصادر.
    expect(layout.registry).toEqual({ show: true, mode: 'manual' });
    expect(layout.sections[1].blocks).toEqual([]);
    // ويبقى القسم الأخير موضعًا لهما ولو خلا من الكتل.
    expect(layout.columns).toBe(2);
  });

  it('ينقل شعار الدائرة إلى مخزن التطبيق', async () => {
    const saved: { bytes: number; ext: string }[] = [];
    const result = await importTemplateFile(await schoolLetter(), (bytes, ext) => {
      saved.push({ bytes: bytes.length, ext });
      return `letterheads/seal${ext}`;
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]!.ext).toBe('.gif');
    expect(saved[0]!.bytes).toBeGreaterThan(20);

    const images = result
      .letterhead!.sections.flatMap((s) => s.blocks)
      .filter((b) => b.kind === 'image');
    expect(images.map((b) => b.value)).toEqual(['letterheads/seal.gif']);
  });

  it('الشعار يُترك إن لم يكن هناك مكان يُحفظ فيه', async () => {
    const result = await importTemplateFile(await schoolLetter());
    const images = result
      .letterhead!.sections.flatMap((s) => s.blocks)
      .filter((b) => b.kind === 'image');
    expect(images).toHaveLength(0);
    // وبقيّة الترويسة تُستخرج على كل حال.
    expect(result.letterhead!.sections[0].blocks).not.toHaveLength(0);
  });

  it('العنوان من سطر الموضوع، ولا يتكرّر الموضوع في المتن', async () => {
    const result = await importTemplateFile(await schoolLetter());
    expect(result.title).toBe('انذار');
    expect(result.subjectLine).toBe('انذار');
    expect(result.body).not.toContain('م/ ان');
    expect(result.body.startsWith('الى / ولي امر التلميذ')).toBe(true);
    expect(result.body).toContain('المواظبة');
    // ولا يتسرّب شيء من الترويسة إلى المتن.
    expect(result.body).not.toContain('مدرسة الصحوة');
    expect(result.body).not.toContain('العدد:');
  });
});
