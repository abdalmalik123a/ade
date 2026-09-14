import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { describe, expect, it } from 'vitest';
import { importTemplateFile } from '../src/main/services/import';

const dir = mkdtempSync(join(tmpdir(), 'diwan-import-'));

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

  it('ينبّه أن التنسيق والصور لا تُستورد', async () => {
    const path = await makeDocx(['عنوان', 'متن']);
    const result = await importTemplateFile(path);
    expect(result.warnings.join(' ')).toContain('النصّ فقط');
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
    await expect(importTemplateFile(path)).rejects.toThrow('الصيغ المدعومة');
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
