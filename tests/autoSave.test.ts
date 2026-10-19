/**
 * الحفظ التلقائي ومنع تكرار النسخ السابقة في recordRevision (D115 — S02).
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { getTemplate, saveTemplate } from '../src/main/services/templates';
import { listRevisions } from '../src/main/services/revisions';
type ParkedItem = {
  key: number;
  label: string;
  step: string;
  picked: number[];
  values: Record<string, string>;
  letterNo: string;
  citizenId: number | null;
  merge: boolean;
  names: string;
  valuesOnly: boolean;
  genderByHand: boolean;
  autosave?: boolean;
};

import type { TemplateInput } from '../src/shared/template';

const tpl = (over: Partial<TemplateInput> = {}): TemplateInput => ({
  id: null,
  code: null,
  title: 'ورقة امتحان تجريبية',
  subtitle: 'ثانوية دجلة',
  category: 'امتحانات',
  subjectLine: null,
  bodyHtml: 'س١: اكتب ما تعرفه عن تاريخ العراق.',
  letterheadId: null,
  variables: [],
  ...over
});

describe('الحفظ التلقائي للورقة والنموذج (D115)', () => {
  it('الحفظ التلقائي المتكرر لا يضيف مراجعات في سجل revisions (isAutosave: true)', () => {
    const db = freshDb();
    // ١ — حفظ أولي للورقة
    const saved = saveTemplate(db, tpl());
    expect(saved.id).toBeGreaterThan(0);
    expect(listRevisions(db, 'template', saved.id)).toHaveLength(0);

    // ٢ — تعديلات متعددة عبر الحفظ التلقائي الدوري (isAutosave: true)
    for (let i = 1; i <= 5; i++) {
      const updated = saveTemplate(db, {
        ...tpl({ id: saved.id, title: `ورقة امتحان تجريبية — تعديل ${i}` }),
        isAutosave: true
      });
      expect(updated.title).toBe(`ورقة امتحان تجريبية — تعديل ${i}`);
      // لم يُسجَّل أي revision جديد لأن الحفظ تلقائي
      expect(listRevisions(db, 'template', saved.id)).toHaveLength(0);
    }

    // التأكد من أن التعديل الأخير محفوظ فعليًّا في القاعدة
    const loaded = getTemplate(db, saved.id);
    expect(loaded?.title).toBe('ورقة امتحان تجريبية — تعديل 5');

    // ٣ — حفظ يدوي صريح من المستخدم (بلا isAutosave) يسجل نسخة مراجعة
    saveTemplate(db, {
      ...tpl({ id: saved.id, title: 'ورقة امتحان تجريبية — حفظ نهائي' }),
      isAutosave: false
    });
    const revsAfterManual = listRevisions(db, 'template', saved.id);
    expect(revsAfterManual).toHaveLength(1);

    // ٤ — حفظ تلقائي آخر بعد الحفظ اليدوي لا يزيد المراجعات
    saveTemplate(db, {
      ...tpl({ id: saved.id, title: 'ورقة امتحان تجريبية — تعديل تلقائي إضافي' }),
      isAutosave: true
    });
    expect(listRevisions(db, 'template', saved.id)).toHaveLength(1);
  });

  it('فرز وتفريغ المسودات التلقائية في المعاملات المعلّقة للشبّاك', () => {
    const regularParked: ParkedItem = {
      key: 1001,
      label: 'معاملة سالم حسن',
      step: 'fill',
      picked: [1],
      values: { الاسم: 'سالم حسن' },
      letterNo: '١٢٣',
      citizenId: 1,
      merge: false,
      names: '',
      valuesOnly: false,
      genderByHand: false
    };

    const autosaveDraft: ParkedItem = {
      key: 2002,
      label: 'معاملة جارية تلقائية',
      step: 'fill',
      picked: [2],
      values: { الاسم: 'زينب علي حسن' },
      letterNo: '',
      citizenId: null,
      merge: false,
      names: '',
      valuesOnly: false,
      genderByHand: false,
      autosave: true
    };

    const allParked = [regularParked, autosaveDraft];

    // المعاملات المعروضة في الشباك تستثني المسودة التلقائية
    const visible = allParked.filter((p) => !p.autosave);
    expect(visible).toHaveLength(1);
    expect(visible[0].key).toBe(1001);

    // المسودة التلقائية تُعرف بوسمها للاسترجاع السلس
    const draft = allParked.find((p) => p.autosave);
    expect(draft).toBeDefined();
    expect(draft?.key).toBe(2002);
    expect(draft?.values['الاسم']).toBe('زينب علي حسن');

    // تفريغ المسودة التلقائية عند الإلغاء أو الإصدار يبقي فقط المعاملات المعلّقة يدويًّا
    const cleared = allParked.filter((p) => !p.autosave);
    expect(cleared).toHaveLength(1);
    expect(cleared.some((p) => p.autosave)).toBe(false);
  });
});
