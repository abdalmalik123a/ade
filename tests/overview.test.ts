/**
 * «نظرة عامة على ديوان» و«؟» الصفحات (الموجة ٢، بقرار المالك ٦ تشرين الأول).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OVERVIEW_STEPS, PAGE_HELP, overviewSteps, produced } from '../src/shared/overview';
import { ROUTES } from '../src/shared/routes';

/** شيفرة الواجهة كلّها — لتُطابَق بها أسماء ما تضيئه النظرة. */
function rendererSource(dir = join(__dirname, '../src/renderer/src')): string {
  return readdirSync(dir)
    .map((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return rendererSource(path);
      return /\.tsx?$/.test(name) ? readFileSync(path, 'utf8') : '';
    })
    .join('\n');
}

describe('شرح الصفحات', () => {
  it('لكلّ صفحةٍ شرحها — قصيرٌ يُقرأ في لحظة، والتفصيل في فيديوهات المالك', () => {
    expect(Object.keys(PAGE_HELP).sort()).toEqual(Object.keys(ROUTES).sort());
    for (const help of Object.values(PAGE_HELP)) {
      expect(help.title.trim()).not.toBe('');
      expect(help.body.length).toBeGreaterThan(30);
      expect(help.body.length).toBeLessThanOrEqual(220);
    }
  });
});

describe('النظرة العامة', () => {
  it('صفحاتٌ موجودة، وما تضيئه موجودٌ في الواجهة باسمه — وتنتهي بلا إضاءة', () => {
    const source = rendererSource();
    for (const step of OVERVIEW_STEPS) {
      expect(Object.keys(ROUTES)).toContain(step.route);
      if (!step.target) continue;
      const [, attr, value] = /^\[([\w-]+)(?:="([^"]+)")?\]$/.exec(step.target) ?? [];
      expect(attr, step.target).toBeTruthy();
      expect(source).toContain(attr);
      // قيمة data-act مكتوبةٌ في الواجهة؛ وقيمة data-dest مفتاح وجهةٍ في السكّة.
      if (value && attr === 'data-act') expect(source).toContain(`data-act="${value}"`);
      if (value && attr === 'data-dest') expect(source).toContain(`key: '${value}'`);
    }
    expect(OVERVIEW_STEPS.at(-1)!.target).toBeNull();
    expect(OVERVIEW_STEPS.length).toBeLessThanOrEqual(12); // دقيقتان لا أكثر
  });

  it('ومن «التنبيهات» أو «؟» لا تغادر صفحة الموظف: تضيء كلّ صفحةٍ في السكّة أو الشريط العلوي', () => {
    // ما يُرى من كلّ صفحة: وجهات السكّة وزرّ الإعدادات، والبحث والجرس في الشريط العلوي.
    const everywhere = /^(\[data-dest="(service|work|record|customers|library)"\]|\[data-act="(open-settings|notifications)"\]|\[data-global-search\])$/;
    const stay = overviewSteps(false, true);
    expect(stay.map((s) => s.title)).toEqual(OVERVIEW_STEPS.map((s) => s.title));
    for (const step of stay.slice(0, -1)) expect(step.target, step.title).toMatch(everywhere);
    expect(stay.at(-1)!.target).toBeNull();
    // ومرّةً بعد المعالج تمرّ على الصفحات نفسها بما فيها.
    expect(overviewSteps(false, false)).toBe(OVERVIEW_STEPS);
  });

  it('الخطوة الأخيرة تذكر «؟» ما دام في الصفحات — وبعد أوّل عملٍ لا تذكره', () => {
    expect(overviewSteps(false)).toBe(OVERVIEW_STEPS);
    expect(overviewSteps(false).at(-1)!.body).toContain('«؟»');
    const after = overviewSteps(true);
    expect(after).toHaveLength(OVERVIEW_STEPS.length);
    expect(after.at(-1)!.body).not.toContain('«؟»');
    expect(after.slice(0, -1)).toEqual(OVERVIEW_STEPS.slice(0, -1));
  });
});

describe('أوّل عملٍ يخرج من المكتب', () => {
  it('ما أُلغي أو فشل أو لا شيء فيه لا يُعدّ — فيبقى «؟»', () => {
    expect(produced(null)).toBe(false); // حوار حفظٍ أُغلق
    expect(produced(undefined)).toBe(false);
    expect(produced(false)).toBe(false);
    expect(produced([])).toBe(false);
    expect(produced({ ok: false, sent: 0, total: 3, reason: 'لم تُختر طابعة' })).toBe(false);
    expect(produced({ ok: true, sent: 0, total: 0 })).toBe(false); // طباعةٌ بلا ورقة
  });

  it('وما خرج يُعدّ: كتابٌ صدر، وملفٌّ حُفظ، وطباعةٌ تمّت', () => {
    expect(produced({ id: 7, serial: 'م/1/2026' })).toBe(true);
    expect(produced('C:\\كتب\\كتاب.pdf')).toBe(true);
    expect(produced({ ok: true, sent: 2, total: 2 })).toBe(true);
    expect(produced(['a.pdf'])).toBe(true);
  });
});
