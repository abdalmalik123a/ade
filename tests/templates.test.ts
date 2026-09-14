import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import {
  deleteDraft,
  deleteTemplate,
  getTemplate,
  isCodeTaken,
  listCategories,
  listDrafts,
  listTemplates,
  saveDraft,
  saveTemplate,
  templateStats,
  templateUsage
} from '../src/main/services/templates';
import { extractTokens, reconcileVariables, renderBody } from '../src/shared/template';
import type { TemplateInput } from '../src/shared/template';

function tpl(over: Partial<TemplateInput> = {}): TemplateInput {
  return {
    id: null,
    code: null,
    title: 'تأييد استمرار بالخدمة',
    subtitle: null,
    category: null,
    subjectLine: null,
    bodyHtml: 'نؤيد بأن {الاسم} الحامل للرقم {الرقم_الوطني} مستمر بالخدمة.',
    letterheadId: null,
    variables: [
      { token: 'الاسم', label: 'الاسم', source: 'citizen', required: true },
      { token: 'الرقم_الوطني', label: 'الرقم الوطني', source: 'citizen', required: true }
    ],
    ...over
  };
}

describe('استخراج المتغيّرات من المتن', () => {
  it('يلتقط كل وسم بصيغة {اسم}', () => {
    expect(extractTokens('نؤيد {الاسم} برقم {الرقم_الوطني}')).toEqual(['الاسم', 'الرقم_الوطني']);
  });

  it('لا يكرّر الوسم الواحد', () => {
    expect(extractTokens('{الاسم} و {الاسم}')).toEqual(['الاسم']);
  });

  it('يتجاهل الأقواس الفارغة والمسافات البادئة', () => {
    expect(extractTokens('{} { } نص')).toEqual([]);
  });

  it('لا يعتبر [الاسم] وسمًا — تلك صورة عرض لا صيغة محرّك', () => {
    expect(extractTokens('[الاسم]')).toEqual([]);
  });
});

describe('توفيق المتغيّرات مع المتن', () => {
  it('يصنّف حقول المواطن والحقول التلقائية تلقائيًا', () => {
    const vars = reconcileVariables('{الاسم} {رقم_الصادر} {شيء_آخر}', []);
    expect(vars.find((v) => v.token === 'الاسم')?.source).toBe('citizen');
    expect(vars.find((v) => v.token === 'رقم_الصادر')?.source).toBe('auto');
    expect(vars.find((v) => v.token === 'شيء_آخر')?.source).toBe('manual');
  });

  it('يحفظ تعديلات الموظف على المتغيّر القائم', () => {
    const first = reconcileVariables('{س}', []);
    const edited = first.map((v) => ({ ...v, label: 'تسمية مخصّصة', required: true }));
    const again = reconcileVariables('{س} {ص}', edited);
    expect(again.find((v) => v.token === 'س')?.label).toBe('تسمية مخصّصة');
    expect(again.find((v) => v.token === 'س')?.required).toBe(true);
  });

  it('يحذف المتغيّر إذا حُذف من المتن — فلا تتعارض القائمة مع النص', () => {
    const before = reconcileVariables('{س} {ص}', []);
    expect(before).toHaveLength(2);
    const after = reconcileVariables('{س}', before);
    expect(after.map((v) => v.token)).toEqual(['س']);
  });
});

describe('عرض المتن', () => {
  it('يعوّض القيم الموجودة', () => {
    const html = renderBody('السيد {الاسم}', { الاسم: 'علي' });
    expect(html).toContain('علي');
    expect(html).not.toContain('{الاسم}');
  });

  it('يُبقي الوسم ظاهرًا إذا لم تُملأ قيمته — فينتبه الموظف قبل الطباعة', () => {
    expect(renderBody('السيد {الاسم}', {})).toContain('{الاسم}');
  });

  it('يهرّب HTML فلا يُحقن وسم من بيانات المواطن', () => {
    const html = renderBody('{الاسم}', { الاسم: '<script>x</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('يحوّل أسطر المتن إلى فواصل مرئية', () => {
    expect(renderBody('سطر\nسطر', {})).toContain('<br/>');
  });
});

describe('حفظ النماذج', () => {
  it('تبدأ المكتبة فارغة', () => {
    const db = freshDb();
    expect(listTemplates(db)).toEqual([]);
    expect(templateStats(db)).toEqual({ activeTemplates: 0, drafts: 0, issuedThisMonth: 0 });
  });

  it('يحفظ النموذج بمتغيّراته ويستردّها بترتيبها', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    const loaded = getTemplate(db, saved.id);
    expect(loaded?.title).toBe('تأييد استمرار بالخدمة');
    expect(loaded?.variables.map((v) => v.token)).toEqual(['الاسم', 'الرقم_الوطني']);
    expect(loaded?.variables[0]?.required).toBe(true);
  });

  it('يرفض نموذجًا بلا عنوان', () => {
    const db = freshDb();
    expect(() => saveTemplate(db, tpl({ title: '   ' }))).toThrow('عنوان النموذج مطلوب');
  });

  it('يمنع تكرار الكود بين نموذجين', () => {
    const db = freshDb();
    saveTemplate(db, tpl({ code: 'DIW-1' }));
    expect(() => saveTemplate(db, tpl({ code: 'DIW-1', title: 'آخر' }))).toThrow('مستعمل');
  });

  it('يسمح بإبقاء الكود نفسه عند تعديل النموذج ذاته', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl({ code: 'DIW-1' }));
    expect(() => saveTemplate(db, tpl({ id: saved.id, code: 'DIW-1', title: 'معدّل' }))).not.toThrow();
    expect(getTemplate(db, saved.id)?.title).toBe('معدّل');
  });

  it('التعديل يستبدل المتغيّرات ولا يراكمها', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    saveTemplate(db, {
      ...tpl({ id: saved.id }),
      variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: false }]
    });
    expect(getTemplate(db, saved.id)?.variables).toHaveLength(1);
  });

  it('الكود الفارغ لا يعدّ تكرارًا', () => {
    const db = freshDb();
    saveTemplate(db, tpl({ code: '  ' }));
    expect(() => saveTemplate(db, tpl({ code: '', title: 'ثانٍ' }))).not.toThrow();
    expect(isCodeTaken(db, 'DIW-X', null)).toBe(false);
  });

  it('التصنيفات تُشتقّ من النماذج المحفوظة لا من قائمة مبرمَجة', () => {
    const db = freshDb();
    expect(listCategories(db)).toEqual([]);
    saveTemplate(db, tpl({ category: 'كتب التأييد' }));
    saveTemplate(db, tpl({ title: 'ثانٍ', category: 'كتب التأييد' }));
    saveTemplate(db, tpl({ title: 'ثالث', category: 'قرارات' }));
    expect(listCategories(db)).toEqual([
      { name: 'كتب التأييد', count: 2 },
      { name: 'قرارات', count: 1 }
    ]);
  });

  it('الترشيح بالتصنيف يعيد ما يخصّه فقط', () => {
    const db = freshDb();
    saveTemplate(db, tpl({ category: 'أ' }));
    saveTemplate(db, tpl({ title: 'ثانٍ', category: 'ب' }));
    expect(listTemplates(db, 'أ')).toHaveLength(1);
    expect(listTemplates(db, null)).toHaveLength(2);
  });

  it('الحذف يزيل النموذج ومتغيّراته', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    deleteTemplate(db, saved.id);
    expect(listTemplates(db)).toEqual([]);
    const orphans = db.prepare('SELECT COUNT(*) AS n FROM template_variables').get() as { n: number };
    expect(orphans.n).toBe(0);
  });

  it('يبلّغ كم كتابًا صدر عن النموذج قبل حذفه', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    expect(templateUsage(db, saved.id)).toBe(0);
    db.prepare(
      `INSERT INTO documents (serial, serial_year, serial_seq, template_id, body_html,
                              gregorian_date, sha256)
       VALUES ('م/2026/1', 2026, 1, ?, '', '2026-09-14', 'x')`
    ).run(saved.id);
    expect(templateUsage(db, saved.id)).toBe(1);
  });
});

describe('المسودات', () => {
  it('تبدأ فارغة وتُحفظ وتُحدَّث وتُحذف', () => {
    const db = freshDb();
    expect(listDrafts(db)).toEqual([]);

    const id = saveDraft(db, {
      id: null,
      templateId: null,
      citizenId: null,
      title: 'مسودة أولى',
      values: { الاسم: 'علي' },
      bodyHtml: 'نصّ'
    });
    expect(listDrafts(db)).toHaveLength(1);
    expect(JSON.parse(listDrafts(db)[0]!.valuesJson)).toEqual({ الاسم: 'علي' });

    saveDraft(db, {
      id,
      templateId: null,
      citizenId: null,
      title: 'معدّلة',
      values: {},
      bodyHtml: 'نصّ'
    });
    expect(listDrafts(db)).toHaveLength(1);
    expect(listDrafts(db)[0]!.title).toBe('معدّلة');

    deleteDraft(db, id);
    expect(listDrafts(db)).toEqual([]);
  });

  it('المسودة تعرض اسم النموذج والمواطن المرتبطين', () => {
    const db = freshDb();
    const t = saveTemplate(db, tpl({ title: 'نموذج مرتبط' }));
    const c = db
      .prepare("INSERT INTO citizens (full_name) VALUES ('علي حسن')")
      .run();
    saveDraft(db, {
      id: null,
      templateId: t.id,
      citizenId: Number(c.lastInsertRowid),
      title: 'مسودة',
      values: {},
      bodyHtml: ''
    });
    const row = listDrafts(db)[0]!;
    expect(row.templateTitle).toBe('نموذج مرتبط');
    expect(row.citizenName).toBe('علي حسن');
  });

  it('حذف النموذج لا يحذف مسوداته بل يفكّ ارتباطها', () => {
    const db = freshDb();
    const t = saveTemplate(db, tpl());
    saveDraft(db, {
      id: null,
      templateId: t.id,
      citizenId: null,
      title: 'مسودة',
      values: {},
      bodyHtml: ''
    });
    deleteTemplate(db, t.id);
    const rows = listDrafts(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.templateId).toBeNull();
  });
});
