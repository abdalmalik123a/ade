/**
 * الهويّة الثابتة والنسخ (FOUNDATION §٣) — واتجاه المخاطبة في الكليشات (§٦).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { deleteTemplate, getTemplate, prepareTemplates, saveTemplate } from '../src/main/services/templates';
import {
  deleteLetterhead,
  duplicateLetterhead,
  getLetterhead,
  listLetterheads,
  prepareLetterheads,
  saveLetterhead
} from '../src/main/services/letterheads';
import { deleteClip, listClips, prepareClips, saveClip } from '../src/main/services/clips';
import { listRevisions, revisionPayload } from '../src/main/services/revisions';
import { guessAddressing, rankByAddressing } from '../src/shared/addressing';
import { emptyLayout } from '../src/shared/letterhead';
import type { TemplateInput } from '../src/shared/template';

const tpl = (over: Partial<TemplateInput> = {}): TemplateInput => ({
  id: null,
  code: null,
  title: 'تأييد استمرار بالخدمة',
  subtitle: null,
  category: null,
  subjectLine: null,
  bodyHtml: 'نؤيد بأن {الاسم} مستمر بالخدمة.',
  letterheadId: null,
  variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }],
  ...over
});

const uuidOf = (db: Database.Database, table: string, id: number) =>
  (db.prepare(`SELECT uuid FROM ${table} WHERE id = ?`).get(id) as { uuid: string | null }).uuid;

describe('النموذج: معرّفٌ ثابت ونسخٌ يُعاد إليها', () => {
  it('يولد بمعرّفٍ ونسخته الأولى', () => {
    const db = freshDb();
    const t = saveTemplate(db, tpl());
    expect(uuidOf(db, 'templates', t.id)).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.revision).toBe(1);
    expect(listRevisions(db, 'template', t.id)).toEqual([]);
  });

  it('كل حفظٍ غيّر شيئًا يرفع النسخة ويحفظ ما قبله — والمعرّف لا يتغيّر', () => {
    const db = freshDb();
    const t = saveTemplate(db, tpl());
    const id = uuidOf(db, 'templates', t.id);
    saveTemplate(db, tpl({ id: t.id, title: 'تأييد — معدَّل' }));
    const t3 = saveTemplate(db, tpl({ id: t.id, title: 'تأييد — ثالث', bodyHtml: 'متنٌ آخر {الاسم}' }));

    expect(t3.revision).toBe(3);
    expect(uuidOf(db, 'templates', t.id)).toBe(id);
    expect(listRevisions(db, 'template', t.id).map((r) => r.revision)).toEqual([2, 1]);
    // «نسخة أمس» كما كانت، بعنوانها ومتنها
    expect(revisionPayload<{ title: string }>(db, 'template', t.id, 1)?.title).toBe('تأييد استمرار بالخدمة');
    expect(revisionPayload<{ title: string }>(db, 'template', t.id, 2)?.title).toBe('تأييد — معدَّل');
  });

  it('وحفظٌ لم يغيّر شيئًا لا يُنشئ نسخة', () => {
    const db = freshDb();
    const t = saveTemplate(db, tpl());
    saveTemplate(db, tpl({ id: t.id }));
    saveTemplate(db, tpl({ id: t.id }));
    expect(getTemplate(db, t.id)?.revision).toBe(1);
    expect(listRevisions(db, 'template', t.id)).toEqual([]);
  });

  it('والاسترجاع حفظٌ جديد: لا يضيع ما قبله', () => {
    const db = freshDb();
    const t = saveTemplate(db, tpl());
    saveTemplate(db, tpl({ id: t.id, title: 'خطأ' }));
    const old = revisionPayload<{ title: string; bodyHtml: string }>(db, 'template', t.id, 1)!;
    const back = saveTemplate(db, tpl({ id: t.id, title: old.title, bodyHtml: old.bodyHtml }));
    expect(back.title).toBe('تأييد استمرار بالخدمة');
    expect(back.revision).toBe(3);
    expect(revisionPayload<{ title: string }>(db, 'template', t.id, 2)?.title).toBe('خطأ');
  });

  it('وحذف النموذج يحذف نسخه — لا يبقى أثرٌ مخفيّ', () => {
    const db = freshDb();
    const t = saveTemplate(db, tpl());
    saveTemplate(db, tpl({ id: t.id, title: 'ب' }));
    deleteTemplate(db, t.id);
    expect((db.prepare('SELECT COUNT(*) AS n FROM revisions').get() as { n: number }).n).toBe(0);
  });
});

describe('الترويسة: نسخها وهويّتها', () => {
  const head = (name: string, text: string) => {
    const layout = emptyLayout();
    layout.sections[0]!.blocks = [{ id: 'b1', kind: 'text', text, align: 'center', size: 14, bold: true } as never];
    return { id: null, name, authorityId: null, layout, category: null };
  };

  it('تعديل النصّ يرفع النسخة، والتفضيل لا', () => {
    const db = freshDb();
    prepareLetterheads(db);
    const h = saveLetterhead(db, head('تربية الأنبار', 'مديرية تربية الأنبار'));
    expect(h.revision).toBe(1);
    const edited = saveLetterhead(db, { ...head('تربية الأنبار', 'مديرية تربية ديالى'), id: h.id });
    expect(edited.revision).toBe(2);
    const old = revisionPayload<{ layout: { sections: { blocks: { text: string }[] }[] } }>(db, 'letterhead', h.id, 1);
    expect(old?.layout.sections[0]!.blocks[0]!.text).toBe('مديرية تربية الأنبار');
  });

  it('النسخة المكرَّرة قطعةٌ أخرى بمعرّفها', () => {
    const db = freshDb();
    prepareLetterheads(db);
    const h = saveLetterhead(db, head('أ', 'نص'));
    const copy = duplicateLetterhead(db, h.id)!;
    expect(uuidOf(db, 'letterheads', copy.id)).toBeTruthy();
    expect(uuidOf(db, 'letterheads', copy.id)).not.toBe(uuidOf(db, 'letterheads', h.id));
    expect(copy.revision).toBe(1);
  });

  it('والحذف يحذف نسخها', () => {
    const db = freshDb();
    prepareLetterheads(db);
    const h = saveLetterhead(db, head('أ', 'نص'));
    saveLetterhead(db, { ...head('أ', 'نص آخر'), id: h.id });
    deleteLetterhead(db, h.id);
    expect(getLetterhead(db, h.id)).toBeNull();
    expect((db.prepare('SELECT COUNT(*) AS n FROM revisions').get() as { n: number }).n).toBe(0);
  });
});

describe('قاعدة مكتبٍ سبقت الهويّة', () => {
  /** الجداول كما كانت: بلا uuid ولا revision ولا direction ولا revisions. */
  function aged(): Database.Database {
    const db = new Database(':memory:');
    const dir = join(process.cwd(), 'src', 'main', 'db');
    for (const file of ['schema.sql', 'search.sql']) db.exec(readFileSync(join(dir, file), 'utf8'));
    db.exec('DROP TABLE revisions');
    for (const table of ['templates', 'letterheads', 'clips']) {
      db.exec(`ALTER TABLE ${table} DROP COLUMN uuid`);
      db.exec(`ALTER TABLE ${table} DROP COLUMN revision`);
    }
    db.exec('ALTER TABLE clips DROP COLUMN direction');
    return db;
  }

  it('ما بناه المكتب يُعطى معرّفه ونسخته الأولى — ولا يسقط الإقلاع', () => {
    const db = aged();
    db.prepare("INSERT INTO templates (title, body_html) VALUES ('قديم', 'متن')").run();
    db.prepare("INSERT INTO letterheads (name, layout_json) VALUES ('قديمة', '{}')").run();
    db.prepare("INSERT INTO clips (title, body) VALUES ('قديمة', 'يرجى التفضل')").run();

    prepareTemplates(db);
    prepareLetterheads(db);
    prepareClips(db);

    for (const table of ['templates', 'letterheads', 'clips']) {
      const row = db.prepare(`SELECT uuid, revision FROM ${table}`).get() as { uuid: string; revision: number };
      expect(row.uuid).toMatch(/^[0-9a-f-]{36}$/);
      expect(row.revision).toBe(1);
    }
    expect(listLetterheads(db)).toHaveLength(1);
    // والكليشة القديمة بلا اتجاه — لا يُخمَّن لها بأثرٍ رجعي
    expect(listClips(db)[0]!.direction).toBeNull();
  });
});

describe('الكليشة باتجاه المخاطبة', () => {
  it('يُخمَّن الاتجاه من أفعالها', () => {
    expect(guessAddressing('يرجى التفضل بالاطلاع')).toBe('up');
    expect(guessAddressing('ويرجى تزويدنا بالبيانات')).toBe('up'); // الرجاء يحسم
    expect(guessAddressing('الرجاء إعلامنا')).toBe('up');
    expect(guessAddressing('تنسب تزويدنا بقائمة الأسماء')).toBe('down');
    expect(guessAddressing('إشارةً إلى كتابكم المرقّم')).toBe('peer');
    expect(guessAddressing('هذا ولكم التقدير مع الاحترام')).toBeNull();
    // جزء كلمة لا يُعدّ: «مرجوّة» ليست «يرجى»
    expect(guessAddressing('النتائج المرجوة')).toBeNull();
  });

  it('وتُحفظ به — أو بما اختاره الموظف، وعدمٌ صريح = لكلّ اتجاه', () => {
    const db = freshDb();
    expect(saveClip(db, { id: null, title: 'أ', body: 'يرجى التفضل بالموافقة' }).direction).toBe('up');
    expect(saveClip(db, { id: null, title: 'ب', body: 'يرجى التفضل', direction: 'peer' }).direction).toBe('peer');
    expect(saveClip(db, { id: null, title: 'ج', body: 'يرجى التفضل', direction: null }).direction).toBeNull();
  });

  it('وتعديلها يرفع نسختها، وحذفها يحذف نسخها', () => {
    const db = freshDb();
    const c = saveClip(db, { id: null, title: 'أ', body: 'يرجى التفضل' });
    const c2 = saveClip(db, { id: c.id, title: 'أ', body: 'يرجى التفضل بالاطلاع' });
    expect(c2.revision).toBe(2);
    expect(revisionPayload<{ body: string }>(db, 'clip', c.id, 1)?.body).toBe('يرجى التفضل');
    deleteClip(db, c.id);
    expect((db.prepare('SELECT COUNT(*) AS n FROM revisions').get() as { n: number }).n).toBe(0);
  });

  it('كتابٌ إلى جهةٍ أدنى: كليشاته أولًا، ثم ما يصلح لكلٍّ، ثم الباقي — ولا يُخفى شيء', () => {
    const clips = [
      { id: 1, direction: 'up' as const },
      { id: 2, direction: null },
      { id: 3, direction: 'down' as const },
      { id: 4, direction: 'down' as const },
      { id: 5, direction: 'peer' as const }
    ];
    expect(rankByAddressing(clips, 'down').map((c) => c.id)).toEqual([3, 4, 2, 1, 5]);
    expect(rankByAddressing(clips, null).map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
