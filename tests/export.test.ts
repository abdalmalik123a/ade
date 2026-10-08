import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { templateToDocx } from '../src/main/services/export';
import { importTemplateFile, parseTemplateXml } from '../src/main/services/import';
import { getTemplate, saveTemplate } from '../src/main/services/templates';
import type { TemplateInput } from '../src/shared/template';

const dir = mkdtempSync(join(tmpdir(), 'diwan-export-'));

function tpl(over: Partial<TemplateInput> = {}): TemplateInput {
  return {
    id: null,
    code: 'DIW-1',
    title: 'تأييد استمرار بالخدمة',
    subtitle: 'موجَّه إلى المصارف',
    category: 'كتب التأييد',
    subjectLine: 'تأييد استمرار',
    bodyHtml: 'نؤيد بأن {الاسم} برقم {الرقم_الوطني} مستمر بالخدمة.\nمع التقدير.',
    letterheadId: null,
    variables: [
      { token: 'الاسم', label: 'الاسم الرباعي', source: 'citizen', required: true },
      { token: 'الرقم_الوطني', label: 'الرقم الوطني', source: 'citizen', required: false }
    ],
    ...over
  };
}

/**
 * ملفّ XML كما كان ديوان يكتبه قبل د٩ (حُذف تصديره، وبقي قارئه لما صُدّر قبله) — ثابتٌ هنا بصيغته
 * حرفًا بحرف، فلا يتغيّر القارئ عمّا يقرؤه المكتب.
 */
const OLD_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<template>',
  '  <code>DIW-1</code>',
  '  <title>تأييد استمرار بالخدمة</title>',
  '  <subtitle>موجَّه إلى المصارف</subtitle>',
  '  <category>كتب التأييد</category>',
  '  <subject>تأييد استمرار</subject>',
  '  <body>نؤيد بأن {الاسم} برقم {الرقم_الوطني} مستمر بالخدمة.\nمع التقدير.</body>',
  '  <variables>',
  '    <variable token="الاسم" label="الاسم الرباعي" source="citizen" required="true"/>',
  '    <variable token="الرقم_الوطني" label="الرقم الوطني" source="citizen" required="false"/>',
  '  </variables>',
  '</template>',
  ''
].join('\n');

describe('ملفّات XML القديمة تُقرأ (التصدير إليها حُذف — د٩)', () => {
  it('يُقرأ النموذج كما صُدّر', () => {
    const parsed = parseTemplateXml(OLD_XML);
    expect(parsed.code).toBe('DIW-1');
    expect(parsed.title).toBe('تأييد استمرار بالخدمة');
    expect(parsed.subtitle).toBe('موجَّه إلى المصارف');
    expect(parsed.category).toBe('كتب التأييد');
    expect(parsed.subjectLine).toBe('تأييد استمرار');
    expect(parsed.body).toBe(tpl().bodyHtml);
    expect(parsed.body.split('\n')).toHaveLength(2);
  });

  it('بمتغيّراته ومصادرها وإلزاميتها — وإلا ضاع معنى النموذج', () => {
    const parsed = parseTemplateXml(OLD_XML);
    expect(parsed.variables).toHaveLength(2);
    expect(parsed.variables[0]).toEqual({ token: 'الاسم', label: 'الاسم الرباعي', source: 'citizen', required: true });
    expect(parsed.variables[1]?.required).toBe(false);
  });

  it('والمحارف المهرَّبة تعود كما كانت', () => {
    const xml = OLD_XML.replace('<title>تأييد استمرار بالخدمة</title>', '<title>أ &amp; ب &lt;ج&gt;</title>').replace(
      /<body>[\s\S]*<\/body>/,
      '<body>نص &quot;مقتبس&quot; &amp; رمز</body>'
    );
    const parsed = parseTemplateXml(xml);
    expect(parsed.title).toBe('أ & ب <ج>');
    expect(parsed.body).toBe('نص "مقتبس" & رمز');
  });

  it('والتصدير لم يعد يكتب XML: لا كاتب له في الوحدة', async () => {
    const mod = (await import('../src/main/services/export')) as Record<string, unknown>;
    expect(mod.templateToXml).toBeUndefined();
  });
});

describe('تصدير Word', () => {
  it('ينتج ملف .docx صالحًا يُقرأ ثانيةً', async () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    const buffer = await templateToDocx(getTemplate(db, saved.id)!, null);

    // توقيع حزمة ZIP — أي أن الملف مستند Word حقيقي
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');

    const path = join(dir, 'out.docx');
    writeFileSync(path, buffer);
    const back = await importTemplateFile(path);
    expect(back.body).toContain('{الاسم}');
  });

  it('يبقي المتغيّرات كما هي فيُعاد استعمال المستند نموذجًا', async () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    const path = join(dir, 'vars.docx');
    writeFileSync(path, await templateToDocx(getTemplate(db, saved.id)!, null));
    const back = await importTemplateFile(path);
    expect(back.body).toContain('{الرقم_الوطني}');
  });
});
