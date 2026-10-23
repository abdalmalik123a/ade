/**
 * الحفظ التلقائي بلا ضياعٍ ولا كتابةٍ فوق المحفوظ (D115 — S02، وD134).
 *
 * كان الحفظ التلقائي لورقة الأسئلة يكتب فوق الورقة المفتوحة بوسم `isAutosave` يتخطّى نسختها السابقة: تُفتح ورقةٌ محفوظة وتُعدَّل
 * بلا «حفظ» فيضيع أصلها. واليوم يكتب مسودّةً في الإعدادات (`papers:setDraft`)، وكلّ حفظٍ يغيّر الورقة يحفظ ما قبله نسخةً سابقة.
 * والمعاملة الجارية في الشبّاك (`autosave`) مسودّتُه لا معلّقةٌ تُعدّ.
 */
import { describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from './helpers';
import { deleteTemplate, getTemplate, saveTemplate } from '../src/main/services/templates';
import { listRevisions, revisionPayload } from '../src/main/services/revisions';
import { parkedCount, todayAgenda } from '../src/main/services/today';
import { prepareClients } from '../src/main/services/clients';
import { prepareDocuments } from '../src/main/services/documents';
import type { RevisionPayloads } from '../src/shared/api';
import type { TemplateInput } from '../src/shared/template';

const tpl = (over: Partial<TemplateInput> = {}): TemplateInput => ({
  id: null,
  code: null,
  title: 'أسئلة الفيزياء — الأصل',
  subtitle: 'مدرسة النور',
  category: 'أسئلة',
  subjectLine: null,
  bodyHtml: 'س١: الأصل — عرّف الكمية الفيزيائية.',
  letterheadId: null,
  variables: [],
  ...over
});

const setting = (db: Database, key: string, value: string) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
const draftOf = (db: Database) => (db.prepare("SELECT value FROM settings WHERE key = 'paperDraft'").get() as { value: string } | undefined)?.value;

describe('الحفظ لا يتخطّى النسخة السابقة (D134)', () => {
  it('كلّ حفظٍ يغيّر الورقة يحفظ ما قبله نسخةً سابقة — ولا وسم يتخطّاها', () => {
    const db = freshDb();
    const saved = saveTemplate(db, tpl());
    expect(listRevisions(db, 'template', saved.id)).toHaveLength(0);

    // حفظٌ ثانٍ بتغيير — ولو حمل الوسم القديم `isAutosave` (أُزيل): الأصل نسخةٌ سابقة.
    const second = { ...tpl({ id: saved.id, title: 'أسئلة الفيزياء — معدَّل', bodyHtml: 'س١: معدَّل' }), isAutosave: true } as TemplateInput;
    saveTemplate(db, second);
    const revs = listRevisions(db, 'template', saved.id);
    expect(revs).toHaveLength(1);
    const before = revisionPayload<RevisionPayloads['template']>(db, 'template', saved.id, revs[0]!.revision);
    expect(before?.title).toBe('أسئلة الفيزياء — الأصل');
    expect(before?.bodyHtml).toContain('الأصل');
    expect(getTemplate(db, saved.id)?.title).toBe('أسئلة الفيزياء — معدَّل');

    // حفظٌ بلا تغيير لا يزيدها.
    saveTemplate(db, second);
    expect(listRevisions(db, 'template', saved.id)).toHaveLength(1);
  });

  it('حذف الورقة يمحو مسودّتها وحدها — ومسودّةٌ فاسدة لا تمنع الحذف', () => {
    const db = freshDb();
    const paper = saveTemplate(db, tpl());
    const other = saveTemplate(db, tpl({ title: 'أسئلة الكيمياء' }));
    setting(db, 'paperDraft', JSON.stringify({ paperId: paper.id, head: {}, items: [] }));

    deleteTemplate(db, other.id);
    expect(draftOf(db)).toBeDefined();
    deleteTemplate(db, paper.id);
    expect(draftOf(db)).toBeUndefined();

    const third = saveTemplate(db, tpl({ title: 'أسئلة الأحياء' }));
    setting(db, 'paperDraft', '{not json');
    deleteTemplate(db, third.id);
    expect(getTemplate(db, third.id)).toBeNull();
    expect(draftOf(db)).toBe('{not json');
  });
});

describe('المعاملة الجارية في الشبّاك ليست معلّقة (D134)', () => {
  it('parkedCount و«التنبيهات» يستثنيان ما فيه autosave', () => {
    const db = freshDb();
    prepareClients(db);
    prepareDocuments(db);
    const parked = { key: 1001, label: 'سالم حسن', step: 'fill', picked: [1], values: { الاسم: 'سالم حسن' } };
    const running = { key: 2002, label: 'زينب علي حسن', step: 'fill', picked: [2], values: { الاسم: 'زينب علي حسن' }, autosave: true };

    setting(db, 'parkedTransactions', JSON.stringify([parked, running]));
    expect(parkedCount(db)).toBe(1);
    expect(todayAgenda(db, []).parked).toBe(1);

    setting(db, 'parkedTransactions', JSON.stringify([running]));
    expect(parkedCount(db)).toBe(0);
    expect(todayAgenda(db, []).parked).toBe(0);

    setting(db, 'parkedTransactions', JSON.stringify([null, parked]));
    expect(parkedCount(db)).toBe(2);
  });
});
