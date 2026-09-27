/**
 * الأرشيف: الإبطال بسببه (د٣)، وسجلّ التدقيق (د٤)، وسلسلة البصمات والتحقّق (د٥)،
 * والبحث الشامل فيما سوى الكتب (د٢).
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import {
  CHAIN_GENESIS,
  chainLink,
  getDocument,
  issueDocument,
  listAudit,
  listDocuments,
  prepareDocuments,
  recordReprint,
  verifyArchive,
  voidDocument
} from '../src/main/services/documents';
import { addAttachment, ensureSearchColumn, saveCitizen, setAttachmentOcr } from '../src/main/services/citizens';
import { saveTemplate } from '../src/main/services/templates';
import { searchOthers } from '../src/main/services/search';
import type { CitizenInput, IssueInput } from '../src/shared/api';

const issue = (name: string, patch: Partial<IssueInput> = {}): IssueInput => ({
  sheetHtml: `<div class="a4-sheet"><p>نؤيد أن ${name} مستمر بالخدمة</p></div>`,
  templateId: null,
  citizenId: null,
  authorityId: null,
  citizenName: name,
  nationalId: null,
  docType: 'تأييد',
  destination: 'مصرف الرشيد',
  purpose: null,
  values: {},
  copies: 1,
  copyKind: null,
  fee: 0,
  gregorianDate: '27 أيلول 2026',
  hijriDate: null,
  operator: 'علي',
  printer: null,
  serialPrefix: 'م',
  serialYear: 2026,
  letterheadId: null,
  ...patch
});

describe('إبطال كتابٍ صادر', () => {
  it('يبقى برقمه وبصمته، ومعه سببه ومن أبطله — ويُقيَّد', () => {
    const db = freshDb();
    const a = issueDocument(db, issue('أحمد'));
    const v = voidDocument(db, a.id, 'صدر باسمٍ خاطئ', 'علي');
    expect(v.status).toBe('void');
    expect(v.serial).toBe(a.serial);
    expect(v.sha256).toBe(a.sha256);
    expect(v.voidReason).toBe('صدر باسمٍ خاطئ');
    expect(v.voidedBy).toBe('علي');
    expect(listDocuments(db)[0]).toMatchObject({ status: 'void', voidReason: 'صدر باسمٍ خاطئ' });
    const log = listAudit(db, { documentId: a.id }).map((e) => e.action);
    expect(log).toEqual(['void', 'issue']);
  });

  it('ولا يُبطَل بلا سبب، ولا مرّتين', () => {
    const db = freshDb();
    const a = issueDocument(db, issue('أحمد'));
    expect(() => voidDocument(db, a.id, '   ', null)).toThrow(/سبب/);
    voidDocument(db, a.id, 'خطأ', null);
    expect(() => voidDocument(db, a.id, 'ثانية', null)).toThrow(/من قبل/);
  });

  it('والمُبطَل لا يُعاد طبعه — ولا يُستهلك رقمه لغيره', () => {
    const db = freshDb();
    const a = issueDocument(db, issue('أحمد'));
    voidDocument(db, a.id, 'خطأ', null);
    expect(() => recordReprint(db, a.id, { copies: 1, printer: null, operator: null })).toThrow(/مُبطَل/);
    const b = issueDocument(db, issue('زينب'));
    expect(b.serial).toBe('م/2026/2');
    expect(getDocument(db, a.id)?.printedCopies).toBe(1);
  });
});

describe('سلسلة البصمات و«تحقّق من سلامة الأرشيف»', () => {
  it('كل كتابٍ حلقةٌ بعد ما قبله، والأرشيف السليم لا مشكلة فيه', () => {
    const db = freshDb();
    const a = issueDocument(db, issue('أحمد'));
    const b = issueDocument(db, issue('زينب'));
    const chain = (id: number) => (db.prepare('SELECT chain FROM documents WHERE id = ?').get(id) as { chain: string }).chain;
    expect(chain(a.id)).toBe(chainLink(CHAIN_GENESIS, a.sha256, a.serial));
    expect(chain(b.id)).toBe(chainLink(chain(a.id), b.sha256, b.serial));
    const check = verifyArchive(db);
    expect(check).toMatchObject({ checked: 2, problems: [], head: chain(b.id) });
  });

  it('والإبطال لا يكسرها — هو حكمٌ لا تعديل', () => {
    const db = freshDb();
    const a = issueDocument(db, issue('أحمد'));
    issueDocument(db, issue('زينب'));
    voidDocument(db, a.id, 'خطأ', null);
    expect(verifyArchive(db).problems).toEqual([]);
  });

  it('متنٌ عُدّل في القاعدة بعد صدوره يُكشف', () => {
    const db = freshDb();
    const a = issueDocument(db, issue('أحمد'));
    db.prepare("UPDATE documents SET body_html = replace(body_html, 'مستمر', 'منقطع') WHERE id = ?").run(a.id);
    const problems = verifyArchive(db).problems;
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ serial: a.serial, kind: 'content' });
  });

  it('وكتابٌ حُذف من وسطه يكسر السلسلة عند ما بعده، ويُعدّ رقمه غائبًا', () => {
    const db = freshDb();
    issueDocument(db, issue('أ'));
    const b = issueDocument(db, issue('ب'));
    const c = issueDocument(db, issue('ج'));
    db.prepare('DELETE FROM document_prints WHERE document_id = ?').run(b.id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(b.id);
    const problems = verifyArchive(db).problems;
    expect(problems.find((p) => p.kind === 'chain')).toMatchObject({ serial: c.serial });
    expect(problems.find((p) => p.kind === 'gap')).toMatchObject({ serial: 'م/2026/2' });
    // الكسر يُذكر مرّةً عند موضعه، لا في كل ما بعده
    expect(problems.filter((p) => p.kind === 'chain')).toHaveLength(1);
  });

  it('والأرشيف الذي سبق السلسلة يُسلسَل كما هو، مرّةً واحدة', () => {
    const db = freshDb();
    const a = issueDocument(db, issue('أحمد'));
    const b = issueDocument(db, issue('زينب'));
    db.exec('UPDATE documents SET chain = NULL');
    prepareDocuments(db);
    expect(verifyArchive(db).problems).toEqual([]);
    const head = verifyArchive(db).head;
    expect(head).toBe(chainLink(chainLink(CHAIN_GENESIS, a.sha256, a.serial), b.sha256, b.serial));
  });
});

describe('البحث الشامل فيما سوى الكتب', () => {
  it('المواطن والنموذج ونصّ المستمسك — كلٌّ في بابه', () => {
    const db = freshDb();
    ensureSearchColumn(db);
    const c = saveCitizen(db, { id: null, fullName: 'حسين علي جاسم', verified: false } as CitizenInput);
    saveTemplate(db, {
      id: null,
      code: null,
      title: 'تأييد سكن حسين',
      subtitle: null,
      category: null,
      subjectLine: null,
      bodyHtml: 'نؤيد سكن {الاسم}',
      letterheadId: null,
      variables: []
    });
    const a = addAttachment(db, { citizenId: c.id, docType: 'بطاقة السكن', filePath: 'x.png', fileFormat: 'PNG', dpi: 300, sha256: null });
    setAttachmentOcr(db, a.id, 'جمهورية العراق — بطاقة السكن — محلة 312 زقاق 14 دار 7', 0.9);

    const hits = searchOthers(db, 'حسين');
    expect(hits.citizens.map((x) => x.fullName)).toEqual(['حسين علي جاسم']);
    expect(hits.templates.map((x) => x.title)).toEqual(['تأييد سكن حسين']);

    const byText = searchOthers(db, 'محله 312');
    expect(byText.attachments).toHaveLength(1);
    expect(byText.attachments[0]).toMatchObject({ citizenName: 'حسين علي جاسم', docType: 'بطاقة السكن' });
    expect(byText.attachments[0]!.snippet).toContain('محلة 312');
    expect(searchOthers(db, '').citizens).toEqual([]);
  });
});
