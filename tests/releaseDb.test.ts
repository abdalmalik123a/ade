/**
 * قاعدة الإصدار المبيع (خطة Production، ٧٫٣): مكتبٌ اشترى ١٫٠٫٠ وعمل به يحدّث برنامجه — فتُفتح قاعدته
 * بإقلاع اليوم (المخطط، ثم ترحيل كلّ خدمة، ثم الفهارس) ولا يضيع منها شيء، ويُعمل عليها كما يُعمل.
 *
 * `fixtures/release-1.0.0.db` كتبها ١٫٠٫٠ نفسه (`makeReleaseDb.test.ts`) ولا تُعاد. ولكلّ إصدارٍ يُباع بعده
 * قاعدته، ويُضاف فحصها هنا.
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
import { prepareClients } from '../src/main/services/clients';
import { prepareLearning } from '../src/main/services/learning';
import { prepareSearch } from '../src/main/services/searchIndex';
import { collectContent } from '../src/main/services/contentPack';
import { guardDataVersion, readDataVersion } from '../src/main/services/dataVersion';
import { normalizePrintRoles } from '../src/shared/printRoles';
import { normalizeHidden } from '../src/shared/sections';
import type { IssueInput } from '../src/shared/api';

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

describe('قاعدة ١٫٠٫٠ المبيعة', () => {
  it('تحمل إصدارها، والإصدار الأحدث يأخذ منها نسخةً قبل الترحيل', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-release-'));
    const file = join(dir, 'diwan.db');
    copyFileSync(join(__dirname, 'fixtures', 'release-1.0.0.db'), file);
    expect(readDataVersion(file)).toBe('1.0.0');
    expect(guardDataVersion({ file, current: '1.0.1', snapshotDir: join(dir, 'before-update') })).toMatchObject({ kind: 'upgrade', from: '1.0.0' });
  });

  it('تُفتح بإقلاع اليوم ولا يضيع منها شيء', () => {
    const { db } = openRelease('1.0.0');
    expect(listCitizens(db, {}).map((c) => c.fullName).sort()).toEqual(['أحمد كريم جاسم', 'زينب علي حسن الربيعي'].sort());
    expect((db.prepare('SELECT COUNT(*) AS n FROM attachments').get() as { n: number }).n).toBe(1);
    expect(listLetterheads(db).map((l) => l.name)).toEqual(['مديرية تربية الأنبار']);
    expect(listTemplates(db).map((t) => t.title)).toEqual(['تأييد استمرار بالخدمة']);
    expect(listDrafts(db)).toHaveLength(1);
    expect(listClips(db).map((c) => c.title)).toEqual(['ختام']);
    const docs = listDocuments(db, { limit: 100 });
    expect(docs).toHaveLength(8);
    expect(docs.filter((d) => d.status === 'void')).toHaveLength(1);
  });

  it('والأرشيف سليمٌ ببصماته وسلسلته، والكتب بأنماطها يوم صدرت', () => {
    const { db } = openRelease('1.0.0');
    const check = verifyArchive(db);
    expect(check.problems).toEqual([]);
    const first = listDocuments(db, { limit: 100 }).at(-1)!;
    expect(documentStyle(db, first.id)).toEqual({ css: '.a4-sheet{font-family:"IBM Plex Sans Arabic"}', bodyClass: 'font-body-md' });
  });

  it('وإعداداته تُقرأ: أدوار الطابعات والأقسام المخفيّة', () => {
    const { db } = openRelease('1.0.0');
    const get = (k: string) => (db.prepare('SELECT value FROM settings WHERE key = ?').get(k) as { value: string }).value;
    expect(normalizePrintRoles(JSON.parse(get('printRoles')), null).documents).toEqual({ normal: 'ليزر المكتب', color: 'ملوّنة', dialog: false });
    expect(normalizeHidden(JSON.parse(get('hiddenSections')))).toEqual(['designs']);
  });

  it('ويُعمل عليها: يصدر كتابٌ يكمل الترقيم والسلسلة، ويُصدَّر محتواها بمعرّفاته', () => {
    const { db, dir } = openRelease('1.0.0');
    const input: IssueInput = {
      sheetHtml: '<div class="a4-sheet">بعد التحديث</div>', templateId: null, citizenId: null, authorityId: null, citizenName: 'بعد التحديث',
      nationalId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0,
      gregorianDate: '1 كانون الثاني 2027', hijriDate: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null
    };
    const issued = issueDocument(db, input);
    expect(issued.serial).toMatch(/\/9$/);
    expect(verifyArchive(db).problems).toEqual([]);
    const { pkg } = collectContent(db, join(dir, 'store'), '1.0.1');
    expect(pkg.templates[0]!.letterheadUuid).toBe(pkg.letterheads[0]!.uuid);
  });
});
