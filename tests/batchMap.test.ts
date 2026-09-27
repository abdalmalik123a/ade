/**
 * ربط أعمدة الدفعة يدويًّا ويتذكّره التصميم، وفحص ٥٠٠ بطاقة (هـ٥).
 */
import { describe, expect, it } from 'vitest';
import { parseRows } from '../src/shared/batch';
import { canvasDoc, emptyCanvas, textElement } from '../src/shared/canvas';
import { fieldRef, reconcileFields, run } from '../src/shared/doc';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { impose, planSheets, renderPlan } from '../src/shared/imposition';

const KEYS = ['الاسم', 'الصف', 'الرقم'];

describe('ربط الأعمدة بيد المكتب', () => {
  const list = ['اسم التلميذ\tالصف\tالمدرسة', 'زينب علي\tالخامس\tالنور', 'أحمد كريم\tالسادس\tالنور'].join('\n');

  it('بلا ربط: «اسم التلميذ» لا يُعرف فيُترك', () => {
    const p = parseRows(list, KEYS);
    expect(p.mapped).toEqual(['الصف']);
    expect(p.ignored).toEqual(['اسم التلميذ', 'المدرسة']);
    expect(p.columns.map((c) => [c.header, c.key, c.manual])).toEqual([
      ['اسم التلميذ', null, false],
      ['الصف', 'الصف', false],
      ['المدرسة', null, false]
    ]);
  });

  it('وبربط المكتب: يذهب إلى «الاسم» — والربط بعنوانه مطويًّا', () => {
    const p = parseRows(list, KEYS, { 'اسم التلميذ': 'الاسم' });
    expect(p.rows[0]).toEqual({ الاسم: 'زينب علي', الصف: 'الخامس' });
    expect(p.columns[0]).toMatchObject({ key: 'الاسم', manual: true });
    expect(p.ignored).toEqual(['المدرسة']);
  });

  it('وقائمة السنة القادمة بعناوينها نفسها تُربط وحدها — ولو لم يطابق عنوانٌ حقلًا', () => {
    const next = ['اسم التلميذ\tالمدرسة', 'رسل حسن\tالنور'].join('\n');
    const p = parseRows(next, KEYS, { 'اسم التلميذ': 'الاسم' });
    expect(p.headed).toBe(true);
    expect(p.rows).toEqual([{ الاسم: 'رسل حسن' }]);
  });

  it('و«اتركه» يُسقط عمودًا طابق حقلًا بالآلة', () => {
    const p = parseRows(list, KEYS, { الصف: null });
    expect(p.mapped).toEqual([]);
    expect(p.rows).toEqual([]);
  });

  it('وربطٌ إلى حقلٍ حُذف من التصميم لا يُكتب', () => {
    expect(parseRows(list, KEYS, { 'اسم التلميذ': 'حقلٌ محذوف' }).columns[0]!.key).toBeNull();
  });

  it('وبلا عناوين: الأعمدة بمواضعها «#1»', () => {
    const p = parseRows('الخامس\tزينب', KEYS, { '#1': 'الصف', '#2': 'الاسم' });
    expect(p.rows).toEqual([{ الصف: 'الخامس', الاسم: 'زينب' }]);
  });
});

describe('فحص ٥٠٠ بطاقة', () => {
  it('تُقرأ وتُرتَّب وتُرسم — بلا سقوطٍ وفي زمنٍ مقبول', () => {
    const canvas = emptyCanvas({ w: 85.6, h: 54 }, 2);
    canvas.elements = [
      textElement({ box: { x: 0.05, y: 0.1, w: 0.6, h: 0.15 }, inlines: [fieldRef('الاسم')] }),
      textElement({ box: { x: 0.05, y: 0.3, w: 0.6, h: 0.15 }, inlines: [run('الصف: '), fieldRef('الصف')] }),
      textElement({ box: { x: 0.05, y: 0.5, w: 0.6, h: 0.15 }, inlines: [fieldRef('الرقم')] })
    ];
    const doc = canvasDoc(canvas, { title: 'هوية' });
    doc.fields = reconcileFields(doc);

    const lines = ['الاسم\tالصف\tالرقم', ...Array.from({ length: 500 }, (_, i) => `طالب رقم ${i + 1}\tالخامس\t${1000 + i}`)];
    const t0 = performance.now();
    const parsed = parseRows(lines.join('\n'), KEYS);
    expect(parsed.rows).toHaveLength(500);

    const imp = impose(canvas.size, canvas.bleed);
    const plan = planSheets(imp, parsed.rows.map((_, i) => i));
    const pages = renderPlan(imp, plan, (i) => renderCanvasHtml(doc, parsed.rows[i]!, { dpi: 96, missing: 'blank', marks: false }));
    const ms = performance.now() - t0;

    expect(pages).toHaveLength(Math.ceil(500 / imp.per));
    expect(pages.join('')).toContain('طالب رقم 500');
    expect(pages.join('')).toContain('1499');
    expect(ms).toBeLessThan(3000);
  }, 20_000);
});
