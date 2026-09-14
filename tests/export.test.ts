import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { libraryToXml, splitLibraryXml, templateToDocx, templateToXml } from '../src/main/services/export';
import { importTemplateFile, parseTemplateXml } from '../src/main/services/import';
import { getTemplate, listTemplates, saveTemplate } from '../src/main/services/templates';
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

describe('تصدير النموذج واسترجاعه', () => {
  it('الدورة كاملة: تصدير ثم استيراد يعيد النموذج كما كان', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    const xml = templateToXml(getTemplate(db, saved.id)!);
    const parsed = parseTemplateXml(xml);

    expect(parsed.code).toBe('DIW-1');
    expect(parsed.title).toBe('تأييد استمرار بالخدمة');
    expect(parsed.subtitle).toBe('موجَّه إلى المصارف');
    expect(parsed.category).toBe('كتب التأييد');
    expect(parsed.subjectLine).toBe('تأييد استمرار');
    expect(parsed.body).toBe(tpl().bodyHtml);
  });

  it('يحفظ المتغيّرات بمصادرها وإلزاميتها — وإلا ضاع معنى النموذج', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    const parsed = parseTemplateXml(templateToXml(getTemplate(db, saved.id)!));

    expect(parsed.variables).toHaveLength(2);
    expect(parsed.variables[0]).toEqual({
      token: 'الاسم',
      label: 'الاسم الرباعي',
      source: 'citizen',
      required: true
    });
    expect(parsed.variables[1]?.required).toBe(false);
  });

  it('يهرّب المحارف الخاصة فلا يكسر XML', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl({ title: 'أ & ب <ج>', bodyHtml: 'نص "مقتبس" & رمز' }));
    const parsed = parseTemplateXml(templateToXml(getTemplate(db, saved.id)!));
    expect(parsed.title).toBe('أ & ب <ج>');
    expect(parsed.body).toBe('نص "مقتبس" & رمز');
  });

  it('يحفظ أسطر المتن كما هي', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    const parsed = parseTemplateXml(templateToXml(getTemplate(db, saved.id)!));
    expect(parsed.body.split('\n')).toHaveLength(2);
  });
});

describe('تصدير المكتبة كاملة', () => {
  it('يجمع كل النماذج ويفكّها كما كانت', () => {
    const db = freshDb();
    saveTemplate(db, tpl({ code: 'A', title: 'أول' }));
    saveTemplate(db, tpl({ code: 'B', title: 'ثانٍ' }));
    saveTemplate(db, tpl({ code: 'C', title: 'ثالث' }));

    const all = listTemplates(db).map((t) => getTemplate(db, t.id)!);
    const xml = libraryToXml(all);
    const chunks = splitLibraryXml(xml);

    expect(chunks).toHaveLength(3);
    const titles = chunks.map((c) => parseTemplateXml(c).title).sort();
    expect(titles).toEqual(['أول', 'ثالث', 'ثانٍ'].sort());
  });

  it('الاسترجاع في قاعدة نظيفة يعيد بناء المكتبة', () => {
    const source = freshDb();
    saveTemplate(source, tpl({ code: 'A', title: 'أول' }));
    saveTemplate(source, tpl({ code: 'B', title: 'ثانٍ' }));
    const xml = libraryToXml(listTemplates(source).map((t) => getTemplate(source, t.id)!));

    const target = freshDb();
    for (const chunk of splitLibraryXml(xml)) {
      const p = parseTemplateXml(chunk);
      saveTemplate(target, {
        id: null,
        code: p.code,
        title: p.title,
        subtitle: p.subtitle,
        category: p.category,
        subjectLine: p.subjectLine,
        bodyHtml: p.body,
        letterheadId: null,
        variables: p.variables
      });
    }

    expect(listTemplates(target)).toHaveLength(2);
    const restored = getTemplate(target, listTemplates(target)[0]!.id)!;
    expect(restored.variables).toHaveLength(2);
  });

  it('مكتبة فارغة تنتج ملفًا صالحًا بلا نماذج', () => {
    expect(splitLibraryXml(libraryToXml([]))).toEqual([]);
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
