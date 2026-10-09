/**
 * قاعدة الإصدار المبيع (خطة Production، ٧٫٣): مكتبٌ اشترى ١٫٠٫٠ وعمل به يحدّث برنامجه — فتُفتح قاعدته
 * بإقلاع اليوم (المخطط، ثم ترحيل كلّ خدمة، ثم الفهارس) ولا يضيع منها شيء، ويُعمل عليها كما يُعمل.
 *
 * `fixtures/release-1.0.0.db` كتبها ١٫٠٫٠ نفسه، و`release-1.1.0.db` حتى `release-1.4.1.db` كتبها إصدارها
 * (`makeReleaseDb.test.ts`) — ولا تُعاد. ولكلّ إصدارٍ يُباع بعدها قاعدته، ويُضاف إصداره إلى `SOLD`.
 */
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { ensureSearchColumn, listCitizens } from '../src/main/services/citizens';
import { documentStyle, issueDocument, listDocuments, prepareDocuments, verifyArchive } from '../src/main/services/documents';
import { listDrafts, listTemplates, prepareTemplates } from '../src/main/services/templates';
import { listLetterheads, prepareLetterheads } from '../src/main/services/letterheads';
import { listClips, prepareClips } from '../src/main/services/clips';
import { listClients, prepareClients } from '../src/main/services/clients';
import { listOrders, saveOrder } from '../src/main/services/orders';
import { weekSummary } from '../src/main/services/today';
import { workBetween } from '../src/main/services/workLog';
import { prepareLearning } from '../src/main/services/learning';
import { prepareSearch } from '../src/main/services/searchIndex';
import { collectContent } from '../src/main/services/contentPack';
import { guardDataVersion, readDataVersion } from '../src/main/services/dataVersion';
import { normalizePrintRoles } from '../src/shared/printRoles';
import { normalizeHidden } from '../src/shared/sections';
import type { IssueInput } from '../src/shared/api';
import { listFaces } from '../src/main/services/fonts';
import { listElements } from '../src/main/services/elements';
import { getTemplate, saveTemplate, templateDoc } from '../src/main/services/templates';
import { designPackLevel } from '../src/shared/canvas';
import { isDesignDraft, readDesignDraft } from '../src/shared/design/draft';

/** القواعد المفتوحة تُغلق بعد كلّ فحص — فيُمحى مجلّدها المؤقّت ولا يبقى ملفّ WAL ممسوكًا. */
const opened: Database.Database[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) if (db.open) db.close();
});

function openRelease(version: string): { db: Database.Database; dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-release-'));
  const file = join(dir, 'diwan.db');
  copyFileSync(join(__dirname, 'fixtures', `release-${version}.db`), file);
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const f of ['schema.sql', 'search.sql']) db.exec(readFileSync(join(process.cwd(), 'src', 'main', 'db', f), 'utf8'));
  ensureSearchColumn(db);
  prepareDocuments(db);
  prepareLetterheads(db);
  prepareTemplates(db);
  prepareClips(db);
  prepareClients(db);
  prepareLearning(db);
  prepareSearch(db);
  opened.push(db);
  return { db, dir, file };
}

/** الإصدارات التي لكلٍّ منها قاعدته في `fixtures` — بالمحتوى نفسه، كتبه كلُّ إصدارٍ بشيفرته. */
const SOLD = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.4.1'] as const;

/** إصدارٌ أحدث منه بخطوة — كما يحدّث المكتب برنامجه. */
const nextPatch = (v: string) => v.replace(/\d+$/, (n) => String(Number(n) + 1));

describe.each(SOLD)('قاعدة %s المبيعة', (version) => {
  it('تحمل إصدارها، والإصدار الأحدث يأخذ منها نسخةً قبل الترحيل', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-release-'));
    const file = join(dir, 'diwan.db');
    copyFileSync(join(__dirname, 'fixtures', `release-${version}.db`), file);
    expect(readDataVersion(file)).toBe(version);
    expect(guardDataVersion({ file, current: nextPatch(version), snapshotDir: join(dir, 'before-update') })).toMatchObject({ kind: 'upgrade', from: version });
  });

  it('تُفتح بإقلاع اليوم ولا يضيع منها شيء', () => {
    const { db } = openRelease(version);
    expect(listCitizens(db, {}).map((c) => c.fullName).sort()).toEqual(['أحمد كريم جاسم', 'زينب علي حسن الربيعي'].sort());
    expect((db.prepare('SELECT COUNT(*) AS n FROM attachments').get() as { n: number }).n).toBe(1);
    expect(listLetterheads(db).map((l) => l.name)).toEqual(['مديرية تربية الأنبار']);
    expect(listTemplates(db).map((t) => t.title)).toEqual(['تأييد استمرار بالخدمة']);
    // مسودّة الكتاب — ومسودّة التصميم (١٫٤٫٠) في «ما جاء به».
    expect(listDrafts(db).filter((d) => !isDesignDraft(d.valuesJson))).toHaveLength(1);
    expect(listClips(db).map((c) => c.title)).toEqual(['ختام']);
    const docs = listDocuments(db, { limit: 100 });
    expect(docs).toHaveLength(8);
    expect(docs.filter((d) => d.status === 'void')).toHaveLength(1);
  });

  it('والأرشيف سليمٌ ببصماته وسلسلته، والكتب بأنماطها يوم صدرت', () => {
    const { db } = openRelease(version);
    const check = verifyArchive(db);
    expect(check.problems).toEqual([]);
    const first = listDocuments(db, { limit: 100 }).at(-1)!;
    expect(documentStyle(db, first.id)).toEqual({ css: '.a4-sheet{font-family:"IBM Plex Sans Arabic"}', bodyClass: 'font-body-md' });
  });

  it('وإعداداته تُقرأ: أدوار الطابعات والأقسام المخفيّة', () => {
    const { db } = openRelease(version);
    const get = (k: string) => (db.prepare('SELECT value FROM settings WHERE key = ?').get(k) as { value: string }).value;
    expect(normalizePrintRoles(JSON.parse(get('printRoles')), null).documents).toEqual({ normal: 'ليزر المكتب', color: 'ملوّنة', dialog: false });
    expect(normalizeHidden(JSON.parse(get('hiddenSections')))).toEqual(['designs']);
  });

  it('ويُعمل عليها: يصدر كتابٌ يكمل الترقيم والسلسلة، ويُصدَّر محتواها بمعرّفاته', () => {
    const { db, dir } = openRelease(version);
    const input: IssueInput = {
      sheetHtml: '<div class="a4-sheet">بعد التحديث</div>', templateId: null, citizenId: null, authorityId: null, citizenName: 'بعد التحديث',
      nationalId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0,
      gregorianDate: '1 كانون الثاني 2027', hijriDate: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null
    };
    const issued = issueDocument(db, input);
    expect(issued.serial).toMatch(/\/9$/);
    expect(verifyArchive(db).problems).toEqual([]);
    const { pkg } = collectContent(db, join(dir, 'store'), nextPatch(version));
    expect(pkg.templates[0]!.letterheadUuid).toBe(pkg.letterheads[0]!.uuid);
  });
});

describe('ما جاء به ١٫٢٫٠ (الموجة ٢)', () => {
  it('قاعدته: ملفّ المدرسة، وطلبٌ بما تركه الزبون، والطبعة حين تمّت، وعدّاد ما خرج', () => {
    const { db } = openRelease('1.2.0');
    expect(listClients(db).find((c) => c.name === 'مدرسة الرافدين')).toMatchObject({ schoolGender: 'للبنين', governorate: 'الأنبار' });
    expect(listOrders(db, {}).map((o) => [o.title, o.received])).toEqual(
      expect.arrayContaining([['هويّات الطلبة', 'قائمة الأسماء وصور الطلبة'], ['صور شخصية', 'صورة الهوية']])
    );
    // كتابٌ واحد طُبع — والسبعة الباقية حُفظت بلا طباعة: لا نسخ لها
    expect(db.prepare('SELECT COUNT(DISTINCT document_id) AS docs, SUM(copies) AS copies FROM document_prints').get()).toEqual({ docs: 1, copies: 1 });
    expect(workBetween(db, '2026-10-03', '2026-10-10')).toEqual({ sheets: 17, files: 2 });
    expect(weekSummary(db, new Date(2026, 9, 7, 10)).thisWeek).toMatchObject({ sheets: 17, files: 2 });
  });

  it('وقاعدة ١٫١٫٠ تُفتح بأعمدته الجديدة: الطلب بما تركه الزبون، والعدّاد', () => {
    const { db } = openRelease('1.1.0');
    const o = saveOrder(db, { id: null, clientId: null, customer: 'سالم حسن', title: 'هويّة', received: 'صورتان' });
    expect(o.received).toBe('صورتان');
    expect(listOrders(db, { query: String(o.id) }).map((x) => x.id)).toEqual([o.id]);
    expect(workBetween(db, '2026-01-01', '2027-01-01')).toEqual({ sheets: 0, files: 0 });
  });
});

describe('ما جاء به ١٫٣٫٠ (الحزمة الصغيرة الآمنة)', () => {
  it('قاعدته: الطلب مربوطٌ بملفّ الزبون، والطبعة بنسخها عند الشبّاك', () => {
    const { db } = openRelease('1.3.0');
    const zainab = listCitizens(db, {}).find((c) => c.fullName === 'زينب علي حسن الربيعي')!;
    expect(listOrders(db, { citizenId: zainab.id }).map((o) => [o.title, o.citizenId])).toEqual([['صور جواز', zainab.id]]);
    expect(db.prepare('SELECT COUNT(DISTINCT document_id) AS docs, SUM(copies) AS copies FROM document_prints').get()).toEqual({ docs: 1, copies: 3 });
  });

  it('وقاعدة ١٫٢٫٠ تُفتح بعموده الجديد: الطلب يُربط بالزبون', () => {
    const { db } = openRelease('1.2.0');
    const zainab = listCitizens(db, {}).find((c) => c.fullName === 'زينب علي حسن الربيعي')!;
    const o = saveOrder(db, { id: null, clientId: null, citizenId: zainab.id, customer: zainab.fullName, title: 'هويّة' });
    expect(o.citizenId).toBe(zainab.id);
    expect(listOrders(db, { citizenId: zainab.id }).map((x) => x.id)).toEqual([o.id]);
  });
});

describe('ما جاء به ١٫٤٫٠ (التصاميم، المرحلة ١)', () => {
  it('قاعدته: التصميم بعناصره الجديدة كما حُفظ، ومسودّة التصميم بقيمها، والخطّ والعنصر في مكتبتيهما', () => {
    const { db, dir } = openRelease('1.4.0');
    const row = listTemplates(db, 'تصاميم', 'print-only').find((t) => t.title === 'هوية مدرسة الرافدين')!;
    const doc = templateDoc(getTemplate(db, row.id)!);
    const els = doc.canvas!.elements;
    expect(els.map((e) => e.kind)).toEqual(['path', 'image', 'text', 'text', 'table']);
    expect(els.find((e) => e.id === 'name')).toMatchObject({ arc: 40, outline: { color: '#ffffff' }, group: 'g1' });
    expect(els.find((e) => e.id === 'photo')).toMatchObject({ shape: 'circle', frame: { rings: 2 } });
    expect(els.find((e) => e.id === 'imsak')).toMatchObject({ borders: 'rows', hideHeader: true });
    expect(designPackLevel(doc)).toBe(2);
    expect(collectContent(db, join(dir, 'store'), '1.4.1').pkg.format).toBe(2);
    const draft = listDrafts(db).find((d) => d.title === 'تصميمٌ لم يُحفظ')!;
    expect(readDesignDraft(draft.valuesJson)?.values).toEqual({ 'العام الدراسي': '٢٠٢٦ – ٢٠٢٧' });
    expect(listFaces(db).map((f) => [f.family, f.source])).toEqual([['Diwani Office', 'windows']]);
    expect(listElements(db).map((e) => [e.name, e.category])).toEqual([['زخرفة الزاوية', 'زخارف']]);
  });

  it('وقاعدة ١٫٣٫٠ تُفتح بمكتبتي الخطوط والعناصر فارغتين، ويُحفظ فيها تصميمٌ بالمرحلة ١', () => {
    const { db } = openRelease('1.3.0');
    expect(listFaces(db)).toEqual([]);
    expect(listElements(db)).toEqual([]);
    const source = openRelease('1.4.0').db;
    const row = listTemplates(source, 'تصاميم', 'print-only')[0]!;
    const doc = templateDoc(getTemplate(source, row.id)!);
    const saved = saveTemplate(db, { id: null, code: null, title: row.title, subtitle: null, category: 'تصاميم', subjectLine: null, bodyHtml: '', letterheadId: null, variables: [], doc });
    expect(templateDoc(getTemplate(db, saved.id)!).canvas!.elements.find((e) => e.id === 'name')).toMatchObject({ arc: 40 });
  });
});
