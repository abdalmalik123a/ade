/**
 * النسخة الاحتياطية (د١، وخطة Production ٤٫١–٤٫٢): تُكتب ملفًّا ملفًّا وتُشفَّر وتُفتح وتُفحص قبل أن
 * تُسترجع — وما أُخذ بالصيغة القديمة (كلّها في الذاكرة) يُفتح كما هو.
 */
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { freshDb } from './helpers';
import { assertRestorable, inspectDbFile, isEncrypted, openBackup, writeBackup } from '../src/main/services/backup';
import { issueDocument, prepareDocuments } from '../src/main/services/documents';
import type { IssueInput } from '../src/shared/api';

const text = (s: string) => new TextEncoder().encode(s);

/** قاعدة مكتبٍ فيها كتابان — في ملف. */
function officeDb(dir: string): string {
  const db = freshDb();
  prepareDocuments(db);
  const input = (name: string): IssueInput => ({
    sheetHtml: `<p>نؤيد أن ${name} مستمر</p>`,
    templateId: null,
    citizenId: null,
    authorityId: null,
    citizenName: name,
    nationalId: null,
    docType: 'تأييد',
    destination: null,
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
    letterheadId: null
  });
  issueDocument(db, input('أحمد'));
  issueDocument(db, input('زينب'));
  const file = join(dir, 'office.db');
  writeFileSync(file, db.serialize());
  return file;
}

/** مخزنٌ فيه ملفّان في مجلّدين — أحدهما باسمٍ عربيّ. */
function store(dir: string): string {
  const root = join(dir, 'store');
  mkdirSync(join(root, 'documents'), { recursive: true });
  mkdirSync(join(root, 'attachments'), { recursive: true });
  writeFileSync(join(root, 'documents', 'م-2026-1.pdf'), text('%PDF-1.7 كتاب'));
  writeFileSync(join(root, 'attachments', 'a.png'), randomBytes(200_000));
  return root;
}

/** الصيغة القديمة كما كانت تُكتب: zipSync في الذاكرة، ثم AES-GCM والوسم قبل المشفَّر. */
function legacyBackup(dbFile: string, files: Record<string, Uint8Array>, password: string | null): Uint8Array {
  const zipped = zipSync({ 'diwan.db': new Uint8Array(readFileSync(dbFile)), ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`store/${k}`, v])) }, { level: 6 });
  if (!password) return zipped;
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(password.normalize('NFC'), salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }), iv);
  const body = Buffer.concat([cipher.update(zipped), cipher.final()]);
  return Buffer.concat([Buffer.from('DIWANENC', 'ascii'), Buffer.from([1]), salt, iv, cipher.getAuthTag(), body]);
}

const walk = (root: string, prefix = ''): string[] =>
  readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(root, `${prefix}${e.name}/`) : [`${prefix}${e.name}`]
  );

describe('النسخة ملفًّا ملفًّا', () => {
  it('القاعدة والمخزن يعودان كما كُتبا بايتًا ببايت — مشفّرةً أو لا — ومعها إصدارها', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-backup-'));
    const dbFile = officeDb(dir);
    const storeRoot = store(dir);
    for (const password of [null, 'كلمة سرّ']) {
      const target = join(dir, `b-${password ? 'enc' : 'plain'}.zip`);
      const out = await writeBackup({ target, dbFile, storeRoot, password, appVersion: '1.2.0', now: new Date('2026-10-02T09:00:00Z') });
      expect(out.files).toBe(2);
      expect(isEncrypted(readFileSync(target).subarray(0, 16))).toBe(Boolean(password));
      expect(readdirSync(dir).some((f) => f.endsWith('.part'))).toBe(false);

      const opened = await openBackup(target, password, join(dir, 'work'));
      try {
        expect(opened.meta).toMatchObject({ app: 'diwan', appVersion: '1.2.0', createdAt: '2026-10-02T09:00:00.000Z', files: 2 });
        const restored = join(dir, `restored-${password ? 'enc' : 'plain'}`);
        await opened.extractDb(join(dir, 'r.db'));
        expect(readFileSync(join(dir, 'r.db')).equals(readFileSync(dbFile))).toBe(true);
        await opened.extractStore(restored);
        expect(walk(restored).sort()).toEqual(['attachments/a.png', 'documents/م-2026-1.pdf']);
        for (const rel of walk(restored)) expect(readFileSync(join(restored, rel)).equals(readFileSync(join(storeRoot, rel)))).toBe(true);
      } finally {
        opened.dispose();
      }
      // ما فُكّ مؤقّتًا يُمحى.
      expect(readdirSync(join(dir, 'work')).filter((f) => f.startsWith('restore-'))).toEqual([]);
    }
  });

  it('وما أُخذ بالصيغة القديمة يُفتح — مشفّرًا أو لا', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-backup-'));
    const dbFile = officeDb(dir);
    for (const password of [null, 'قديمة']) {
      const file = join(dir, `old-${password ? 'enc' : 'plain'}.zip`);
      writeFileSync(file, legacyBackup(dbFile, { 'scans/a.png': text('PNG') }, password));
      const opened = await openBackup(file, password, join(dir, 'work'));
      try {
        expect(opened.meta).toBeNull();
        expect(opened.files.map((f) => f.name)).toEqual(['store/scans/a.png']);
        await opened.extractDb(join(dir, 'old.db'));
        expect(readFileSync(join(dir, 'old.db')).equals(readFileSync(dbFile))).toBe(true);
      } finally {
        opened.dispose();
      }
    }
  });

  it('المشفّرة بلا كلمة تُسأل كلمتها، وبغير كلمتها لا تُفتح ولا يبقى منها شيء', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-backup-'));
    const target = join(dir, 'b.diwan');
    await writeBackup({ target, dbFile: officeDb(dir), storeRoot: store(dir), password: 'صحيحة', appVersion: '1.0.0' });
    await expect(openBackup(target, null, join(dir, 'work'))).rejects.toThrow(/مشفّرة/);
    await expect(openBackup(target, 'خاطئة', join(dir, 'work'))).rejects.toThrow(/كلمة المرور خاطئة/);
    expect(readdirSync(join(dir, 'work'))).toEqual([]);
  });

  it('ما ليس نسخةً من ديوان يُرفض قبل أن يُمسّ شيء، ومسارٌ يخرج من المخزن لا يُكتب', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-backup-'));
    const notZip = join(dir, 'x.zip');
    writeFileSync(notZip, text('ليس أرشيفًا'));
    await expect(openBackup(notZip, null, dir)).rejects.toThrow(/ليس نسخةً/);
    const noDb = join(dir, 'y.zip');
    writeFileSync(noDb, zipSync({ 'other.txt': text('x') }));
    await expect(openBackup(noDb, null, dir)).rejects.toThrow(/لا قاعدة/);
    const evil = join(dir, 'z.zip');
    writeFileSync(evil, zipSync({ 'diwan.db': text('DB'), 'store/../../evil.exe': text('x'), 'store/ok.png': text('p') }));
    const opened = await openBackup(evil, null, dir);
    expect(opened.files.map((f) => f.name)).toEqual(['store/ok.png']);
    opened.dispose();
  });

  it('وملفٌّ عُبث ببايتٍ منه يُرفض عند فكّه — لا يُسترجع معطوبًا', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-backup-'));
    const target = join(dir, 'b.zip');
    await writeBackup({ target, dbFile: officeDb(dir), storeRoot: store(dir), password: null, appVersion: '1.0.0' });
    const bytes = readFileSync(target);
    const at = bytes.indexOf(Buffer.from('%PDF-1.7'));
    bytes[at + 2] ^= 0xff;
    writeFileSync(target, bytes);
    const opened = await openBackup(target, null, join(dir, 'work'));
    await expect(opened.extractStore(join(dir, 'out'))).rejects.toThrow(/معطوب/);
    opened.dispose();
  });
});

describe('الفحص قبل الاسترجاع', () => {
  it('يُري ما فيها: سليمة، وكتبها، وإلى أين تصل، ومن أيّ إصدار', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-backup-'));
    const summary = inspectDbFile(officeDb(dir), 1, { appVersion: '1.0.0', createdAt: '2026-10-02T09:00:00.000Z' }, '1.0.0');
    expect(summary).toMatchObject({ ok: true, integrity: 'ok', documents: 2, files: 1, appVersion: '1.0.0', fromNewer: false });
    expect(summary.lastIssuedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(() => assertRestorable(summary, '1.0.0')).not.toThrow();
  });

  it('ونسخةٌ من إصدارٍ أحدث لا تُسترجع — والأقدم والقديمة بلا إصدارٍ تُسترجع', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-backup-'));
    const file = officeDb(dir);
    const newer = inspectDbFile(file, 0, { appVersion: '1.10.0', createdAt: null }, '1.9.3');
    expect(newer.fromNewer).toBe(true);
    expect(() => assertRestorable(newer, '1.9.3')).toThrow(/إصدارٍ أحدث \(1\.10\.0\)/);
    expect(inspectDbFile(file, 0, { appVersion: '1.2.0', createdAt: null }, '1.9.3').fromNewer).toBe(false);
    expect(inspectDbFile(file, 0, null, '1.9.3').fromNewer).toBe(false);
  });

  it('وقاعدةٌ معطوبة لا تُسترجع', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-backup-'));
    const broken = join(dir, 'broken.db');
    writeFileSync(broken, readFileSync(officeDb(dir)).subarray(0, 3000));
    expect(() => inspectDbFile(broken, 0, null, '1.0.0')).toThrow(/معطوبة|ليست قاعدة/);
  });
});
