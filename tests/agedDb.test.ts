/**
 * قاعدةٌ مُسنّة (المرحلة ٧ — البيانات): مكتبٌ يعمل بالإصدار الذي سبق التطوير كلّه
 * يحدّث برنامجه — فتُفتح قاعدته كما هي، ولا يضيع منها شيء.
 *
 * `fixtures/aged-60ad42f.db` بناها **الإصدار القديم نفسه** (commit 60ad42f، قبل
 * التطوير ١) بمخططه وخدماته وترحيلات إقلاعه: مواطنان، وترويسة، ونموذجان (أحدهما نصٌّ
 * قديمٌ بلا وثيقة)، ومسودة، وعبارة، وخمسة كتبٍ في سنتين (منها معاملةٌ بورقتين) — وأوراقها
 * تحمل ما كان يُطبع يومها: رقم المكتب ورمز QR والبصمة.
 *
 * فتُفتح بإقلاع اليوم (المخطط، ثم ترحيل كلّ خدمة، ثم الفهارس)، ويُعمل عليها كما يُعمل.
 */
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { ensureSearchColumn, getCitizen, listCitizens } from '../src/main/services/citizens';
import { getDocument, issueDocument, listDocuments, prepareDocuments, verifyArchive } from '../src/main/services/documents';
import { getTemplate, listDrafts, listTemplates, prepareTemplates } from '../src/main/services/templates';
import { listLetterheads, prepareLetterheads } from '../src/main/services/letterheads';
import { listClips } from '../src/main/services/clips';
import { prepareSearch } from '../src/main/services/searchIndex';
import type { IssueInput } from '../src/shared/api';

/** يفتح نسخةً من القاعدة المُسنّة كما يفتحها إقلاع البرنامج اليوم. */
function openAged(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-aged-'));
  const file = join(dir, 'diwan.db');
  copyFileSync(join(__dirname, 'fixtures', 'aged-60ad42f.db'), file);
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const f of ['schema.sql', 'search.sql']) db.exec(readFileSync(join(process.cwd(), 'src', 'main', 'db', f), 'utf8'));
  ensureSearchColumn(db);
  prepareDocuments(db);
  prepareLetterheads(db);
  prepareTemplates(db);
  prepareSearch(db);
  return db;
}

describe('قاعدة الإصدار الأوّل تُفتح بإصدار اليوم', () => {
  const db = openAged();

  it('سليمةٌ بعد ترحيلها، وإقلاعٌ ثانٍ لا يُعيد الترحيل ولا يكسر شيئًا', () => {
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(() => {
      ensureSearchColumn(db);
      prepareDocuments(db);
      prepareLetterheads(db);
      prepareTemplates(db);
      prepareSearch(db);
    }).not.toThrow();
  });

  it('الكتب الخمسة كلّها بأرقامها وأوراقها كما طُبعت', () => {
    const docs = listDocuments(db, { limit: 50 });
    expect(docs.map((d) => d.serial).sort()).toEqual(['م/2025/1', 'م/2026/1', 'م/2026/2', 'م/2026/3', 'م/2026/4']);
    const first = getDocument(db, docs.find((d) => d.serial === 'م/2026/1')!.id)!;
    expect(first.citizenName).toBe('زينب علي حسن الربيعي');
    expect(first.bodyHtml).toContain('نؤيد لكم أن السيد زينب علي حسن الربيعي');
    // وما طُبع يومها باقٍ كما طُبع: رقم المكتب في موضعه.
    expect(first.bodyHtml).toContain('data-slot="serial"');
  });

  it('وسلسلة البصمات تُبنى للأرشيف القديم مرّةً فيُتحقَّق منه', () => {
    const check = verifyArchive(db);
    expect(check.checked).toBe(5);
    expect(check.problems).toEqual([]);
    expect(check.head).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ولا يُعمي التحقّقَ القديمُ: كلمةٌ غُيّرت في متن كتابٍ قديم تُكشف', () => {
    const tampered = openAged();
    tampered.prepare("UPDATE documents SET body_html = replace(body_html, 'يعمل لدينا', 'كان يعمل لدينا') WHERE serial = 'م/2026/2'").run();
    const check = verifyArchive(tampered);
    expect(check.problems.map((p) => [p.serial, p.kind])).toEqual([['م/2026/2', 'content']]);
  });

  it('والبحث يجد القديم: بالاسم متساهلًا، وبرقم الصادر', () => {
    expect(listDocuments(db, { query: 'زينب الربيعي' }).map((d) => d.serial)).toEqual(['م/2026/1']);
    expect(listDocuments(db, { query: 'م/2025/1' }).map((d) => d.citizenName)).toEqual(['هدى عباس كاظم']);
    expect(listCitizens(db, { query: 'زينب' }).map((c) => c.fullName)).toEqual(['زينب علي حسن الربيعي']);
  });

  it('والمواطن بملفّه، والنماذج تُفتح (والنصّ القديم وثيقةً)، والمسودة والترويسة والعبارة باقية', () => {
    const zainab = listCitizens(db, { query: 'زينب' })[0]!;
    expect(getCitizen(db, zainab.id)).toMatchObject({ nationalId: '199011112222', jobTitle: 'محاسبة', category: 'موظفو الدائرة' });
    const templates = listTemplates(db);
    expect(templates.map((t) => t.title).sort()).toEqual(['تأييد استمرار بالخدمة', 'تأييد سكن']);
    const legacy = getTemplate(db, templates.find((t) => t.title === 'تأييد استمرار بالخدمة')!.id)!;
    expect(legacy.bodyHtml).toContain('{الاسم}');
    expect(listDrafts(db).map((d) => d.title)).toEqual(['مسودة زينب']);
    expect(listLetterheads(db).map((l) => l.name)).toEqual(['رأس المديرية']);
    // والقديم يُعطى معرّفه الثابت ورقم نسخته (§٣) حين يُفتح أوّل مرّة.
    const clip = listClips(db)[0]!;
    expect(clip.body).toBe('مع وافر الشكر والتقدير.');
  });

  it('والإصدار يكمل الترقيم من حيث وقف — بلا تكرارٍ ولا ثقب', () => {
    const input: IssueInput = {
      sheetHtml: '<div class="a4-sheet"><div>نؤيد أن السيد علي حسين يعمل لدينا.</div></div>',
      templateId: null,
      citizenId: null,
      authorityId: null,
      citizenName: 'علي حسين',
      nationalId: null,
      docType: 'تأييد',
      destination: null,
      purpose: null,
      values: {},
      copies: 1,
      copyKind: 'نسخة أصلية',
      fee: 0,
      gregorianDate: '',
      hijriDate: '',
      operator: 'مشغّل',
      printer: null,
      serialPrefix: 'م',
      serialYear: 2026,
      letterheadId: null
    };
    expect(issueDocument(db, input).serial).toBe('م/2026/5');
    expect(verifyArchive(db).problems).toEqual([]);
  });
});
