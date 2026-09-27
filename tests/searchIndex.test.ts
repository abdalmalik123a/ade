/**
 * فهارس البحث العربي (FTS5): تُملأ مع الكتابة، وتُطابَق عند الإقلاع، ويُعاد
 * بناء القديم منها — وإن تعذّرت فالبحث يعود إلى المسح ولا يسقط.
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { issueDocument, listDocuments, prepareDocuments } from '../src/main/services/documents';
import { deleteCitizen, ensureSearchColumn, listCitizens, saveCitizen } from '../src/main/services/citizens';
import { deleteTemplate, saveTemplate } from '../src/main/services/templates';
import { matchIds, prepareSearch, syncIndexes } from '../src/main/services/searchIndex';
import type { CitizenInput, IssueInput } from '../src/shared/api';

const issue = (name: string, body: string, patch: Partial<IssueInput> = {}): IssueInput => ({
  sheetHtml: `<div class="a4-sheet"><p>${body}</p></div>`,
  templateId: null,
  citizenId: null,
  authorityId: null,
  citizenName: name,
  nationalId: '199912345678',
  docType: 'تأييد استمرار بالخدمة',
  destination: 'مصرف الرشيد',
  purpose: null,
  values: {},
  copies: 1,
  copyKind: null,
  fee: 0,
  gregorianDate: '27 أيلول 2026',
  hijriDate: null,
  operator: null,
  printer: null,
  serialPrefix: 'م',
  serialYear: 2026,
  letterheadId: null,
  ...patch
});

const citizen = (fullName: string, patch: Partial<CitizenInput> = {}): CitizenInput =>
  ({ id: null, fullName, nationalId: null, verified: false, ...patch }) as CitizenInput;

describe('فهرس الكتب', () => {
  it('الكتاب يُفهرس حين يصدر: بدايةُ الاسم وكلمةٌ من المتن، متساهلًا مع الهمزة', () => {
    const db = freshDb();
    issueDocument(db, issue('أحمد عادل كريم', 'نؤيد استمراره بالخدمة الفعلية'));
    issueDocument(db, issue('زينب علي حسن', 'براءة ذمة من المصرف'));
    expect(prepareSearch(db)).toBe(true);
    expect(listDocuments(db, { query: 'احم' }).map((d) => d.citizenName)).toEqual(['أحمد عادل كريم']);
    expect(listDocuments(db, { query: 'الفعليه' })).toHaveLength(1); // التاء المربوطة هاءً
    expect(listDocuments(db, { query: 'زينب براءة' })).toHaveLength(1);
    expect(listDocuments(db, { query: 'زينب الفعلية' })).toHaveLength(0);
  });

  it('ورقم الصادر بصيغته، ووسطُ الرقم الوطني', () => {
    const db = freshDb();
    issueDocument(db, issue('أحمد', 'متن', { nationalId: '199912345678' }));
    issueDocument(db, issue('علي', 'متن', { nationalId: '200055554444' }));
    expect(listDocuments(db, { query: 'م/2026/2' }).map((d) => d.citizenName)).toEqual(['علي']);
    expect(listDocuments(db, { query: 'م/٢٠٢٦/١' }).map((d) => d.citizenName)).toEqual(['أحمد']);
    expect(listDocuments(db, { query: 'م/2026/' })).toHaveLength(2);
    expect(listDocuments(db, { query: '٥٥٥٥' }).map((d) => d.citizenName)).toEqual(['علي']);
  });

  it('وقاعدةٌ سبقت الفهرس: يُبنى من كتبها عند الإقلاع', () => {
    const db = freshDb();
    prepareDocuments(db);
    // كتابان كُتبا كما كان الإصدار قبل الفهارس: في الجدول لا في الفهرس
    db.exec('DROP TABLE documents_fts');
    db.exec(
      "CREATE VIRTUAL TABLE documents_fts USING fts5(serial, doc_type, destination, purpose, citizen_name, body_text, content='', prefix='2 3 4', detail='none')"
    );
    db.prepare(
      `INSERT INTO documents (serial, serial_year, serial_seq, citizen_name, body_html, gregorian_date, sha256)
       VALUES ('م/2025/1', 2025, 1, 'حسين جاسم', '<p>تأييد سكن</p>', 'x', 'x'), ('م/2025/2', 2025, 2, 'مريم', '<p>كفالة</p>', 'x', 'x')`
    ).run();

    expect(prepareSearch(db)).toBe(true);
    const def = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'documents_fts'").get() as { sql: string };
    expect(def.sql).toContain('contentless_delete');
    expect(matchIds(db, 'documents', 'حسين')).toHaveLength(1);
    expect(listDocuments(db, { query: 'كفاله' }).map((d) => d.serial)).toEqual(['م/2025/2']);
  });

  it('والمطابقة تُكمل ما فات الفهرس', () => {
    const db = freshDb();
    issueDocument(db, issue('أحمد', 'متن'));
    db.exec('DELETE FROM documents_fts');
    expect(syncIndexes(db)).toContain('documents');
    expect(matchIds(db, 'documents', 'احمد')).toHaveLength(1);
    expect(syncIndexes(db)).toEqual([]);
  });

  it('وإن تعذّر الفهرس فالبحث يعود إلى المسح — أبطأ لكنه يجد', () => {
    const db = freshDb();
    prepareDocuments(db);
    db.exec('DROP TABLE documents_fts');
    db.exec('CREATE VIEW documents_fts AS SELECT 1 AS x'); // ما لا يُبنى فوقه فهرس
    issueDocument(db, issue('أحمد عادل', 'متن الكتاب'));
    expect(prepareSearch(db)).toBe(false);
    expect(matchIds(db, 'documents', 'احمد')).toBeNull();
    expect(listDocuments(db, { query: 'احمد' })).toHaveLength(1);
  });

  it('وسريعٌ على أرشيفٍ كبير', () => {
    const db = freshDb();
    prepareDocuments(db);
    prepareSearch(db);
    const words = ['تأييد', 'استمرار', 'بالخدمة', 'سكن', 'براءة', 'ذمة', 'كفالة', 'راتب', 'نقل', 'إجازة'];
    db.transaction(() => {
      for (let i = 0; i < 4000; i++) {
        const body = Array.from({ length: 60 }, (_, k) => words[(i + k * 7) % words.length]).join(' ');
        issueDocument(db, issue(`مواطن ${i}`, `${body} رقم${i}`));
      }
    })();
    const t0 = performance.now();
    const hits = listDocuments(db, { query: 'رقم3999' });
    const ms = performance.now() - t0;
    expect(hits.map((d) => d.citizenName)).toEqual(['مواطن 3999']);
    expect(ms).toBeLessThan(150);
  }, 30_000); // الإدراج نفسه أربعة آلاف كتاب — والمقيس البحث وحده
});

describe('فهرس المواطنين والنماذج', () => {
  it('تعديل المواطن يُحدّث فهرسه، وحذفه يُخرجه', () => {
    const db = freshDb();
    ensureSearchColumn(db);
    const c = saveCitizen(db, citizen('سجاد كاظم'));
    expect(listCitizens(db, { query: 'سجاد' })).toHaveLength(1);
    saveCitizen(db, { ...citizen('سجاد كاظم محمد'), id: c.id, jobTitle: 'معلم' } as CitizenInput);
    expect(listCitizens(db, { query: 'معلم' })).toHaveLength(1);
    expect(matchIds(db, 'citizens', 'محمد')).toEqual([c.id]);
    deleteCitizen(db, c.id);
    expect(matchIds(db, 'citizens', 'سجاد')).toEqual([]);
  });

  it('والرقم الوطني يُجد بآخره', () => {
    const db = freshDb();
    ensureSearchColumn(db);
    saveCitizen(db, citizen('نور الهدى', { nationalId: '199887766554' }));
    expect(listCitizens(db, { query: '6655' }).map((c) => c.fullName)).toEqual(['نور الهدى']);
  });

  it('النموذج يُفهرس بعنوانه ومتنه، وحذفه يُخرجه', () => {
    const db = freshDb();
    const t = saveTemplate(db, {
      id: null,
      code: null,
      title: 'تأييد استمرار بالخدمة',
      subtitle: null,
      category: 'تربية',
      subjectLine: null,
      bodyHtml: 'نؤيد بأن {الاسم} مستمر بالخدمة الفعلية',
      letterheadId: null,
      variables: []
    });
    expect(matchIds(db, 'templates', 'استمرار')).toEqual([t.id]);
    expect(matchIds(db, 'templates', 'تربيه')).toEqual([t.id]);
    deleteTemplate(db, t.id);
    expect(matchIds(db, 'templates', 'استمرار')).toEqual([]);
  });
});
