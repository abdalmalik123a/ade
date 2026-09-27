/**
 * النسخة الاحتياطية (د١): تُحزم وتُشفَّر وتُفكّ وتُفحص قبل أن تُسترجع.
 */
import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { freshDb } from './helpers';
import { decrypt, encrypt, inspectBackup, isEncrypted, packBackup, unpackBackup } from '../src/main/services/backup';
import { issueDocument, prepareDocuments } from '../src/main/services/documents';
import type { IssueInput } from '../src/shared/api';

const text = (s: string) => new TextEncoder().encode(s);

/** قاعدة مكتبٍ فيها كتابان — بايتاتها كما تُحزم. */
function officeDb(): Uint8Array {
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
  return new Uint8Array(db.serialize());
}

describe('التشفير', () => {
  it('يُفكّ بكلمته، ويُعرف أنه مشفّر من بدايته', () => {
    const sealed = encrypt(text('بيانات المكتب'), 'كلمة سرّ');
    expect(isEncrypted(sealed)).toBe(true);
    expect(new TextDecoder().decode(decrypt(sealed, 'كلمة سرّ'))).toBe('بيانات المكتب');
  });

  it('وبغير كلمته لا يُفكّ — ويُقال ذلك', () => {
    const sealed = encrypt(text('بيانات'), 'صحيحة');
    expect(() => decrypt(sealed, 'خاطئة')).toThrow(/كلمة المرور خاطئة/);
  });

  it('والملحُ والمتّجه جديدان كل مرّة: نسختان من البيانات نفسها لا تتشابهان', () => {
    expect(Buffer.from(encrypt(text('x'), 'k')).equals(Buffer.from(encrypt(text('x'), 'k')))).toBe(false);
  });
});

describe('الحزمة', () => {
  it('القاعدة والمخزن يعودان كما حُزما — مشفّرةً أو لا', () => {
    const db = text('DB');
    const store = { 'documents/م-2026-1.pdf': text('%PDF'), 'scans/a.png': text('PNG') };
    for (const password of [null, 'سرّ']) {
      const packed = packBackup(db, store, password);
      expect(isEncrypted(packed)).toBe(Boolean(password));
      const back = unpackBackup(packed, password);
      expect(new TextDecoder().decode(back.db)).toBe('DB');
      expect(Object.keys(back.store).sort()).toEqual(['documents/م-2026-1.pdf', 'scans/a.png']);
    }
  });

  it('المشفّرة بلا كلمة تُسأل كلمتها', () => {
    expect(() => unpackBackup(packBackup(text('DB'), {}, 'سرّ'), null)).toThrow(/مشفّرة/);
  });

  it('ما ليس نسخةً من ديوان يُرفض قبل أن يُمسّ شيء', () => {
    expect(() => unpackBackup(text('ليس أرشيفًا'))).toThrow(/ليس نسخةً/);
    expect(() => unpackBackup(zipSync({ 'other.txt': text('x') }))).toThrow(/لا قاعدة/);
  });

  it('ومسارٌ يخرج من المخزن لا يُكتب', () => {
    const evil = zipSync({ 'diwan.db': text('DB'), 'store/../../evil.exe': text('x'), 'store/ok.png': text('p') });
    expect(Object.keys(unpackBackup(evil).store)).toEqual(['ok.png']);
  });
});

describe('الفحص قبل الاسترجاع', () => {
  it('يُري ما فيها: سليمة، وكتبها، وإلى أين تصل', () => {
    const summary = inspectBackup(unpackBackup(packBackup(officeDb(), { 'a.png': text('p') })));
    expect(summary).toMatchObject({ ok: true, integrity: 'ok', documents: 2, files: 1 });
    expect(summary.lastIssuedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('وقاعدةٌ معطوبة لا تُسترجع', () => {
    const broken = officeDb().slice(0, 3000);
    expect(() => inspectBackup({ db: broken, store: {} })).toThrow(/معطوبة|ليست قاعدة/);
  });
});
