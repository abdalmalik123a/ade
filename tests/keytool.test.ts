/**
 * قلب أداة المفاتيح (tools/keytool/core.mjs): المفتاح الخاص مشفّرٌ بكلمة المالك، والمفاتيح بخططها يقرؤها
 * البرنامج، والسجلّ يعدّ أوّل عشرة مشترين مدى الحياة.
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — وحدة ESM بلا أنواع، تُختبر كما تعمل في الأداة.
import * as core from '../tools/keytool/core.mjs';
import { deviceCode, readKey } from '../src/main/services/license';

const DEVICE = deviceCode('keytool-test-machine');

function vault(): { dir: string; publicPem: string } {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-keytool-'));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  writeFileSync(join(dir, core.PLAIN_KEY_FILE), privateKey.export({ type: 'pkcs8', format: 'pem' }));
  return { dir, publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString().trim() };
}

describe('المفتاح الخاص بكلمة السرّ', () => {
  it('أوّل فتح: يُشفَّر بكلمة المالك، ويُمحى غير المشفّر، والنسخة النصّية نصّ المشفّر', () => {
    const v = vault();
    expect(core.encryptExistingKey(v.dir, 'كلمة-سر-طويلة')).toBe(v.publicPem);
    expect(existsSync(join(v.dir, core.PLAIN_KEY_FILE))).toBe(false);
    const armored = readFileSync(join(v.dir, core.KEY_FILE), 'utf8');
    expect(armored).toContain('BEGIN DIWAN ENCRYPTED KEY');
    expect(armored).not.toContain('PRIVATE KEY-----');
    expect(readFileSync(join(v.dir, core.TEXT_COPY_FILE), 'utf8')).toContain(armored.trim().split('\n')[1]);
    expect(core.publicKeyPem(core.loadPrivateKey(v.dir, 'كلمة-سر-طويلة'))).toBe(v.publicPem);
  }, 30_000);

  it('وبغير كلمتها لا يُفتح — وكلمةٌ قصيرة لا تُقبل', () => {
    const v = vault();
    expect(() => core.encryptExistingKey(v.dir, 'قصيرة')).toThrow(/ثمانية أحرف/);
    core.encryptExistingKey(v.dir, 'الصحيحة-12345');
    expect(() => core.loadPrivateKey(v.dir, 'الخاطئة-12345')).toThrow(/كلمة السرّ خاطئة/);
    expect(() => core.loadPrivateKey(v.dir, '')).toThrow(/مشفّر/);
  }, 30_000);

  it('وتغيير الكلمة يُبقي المفتاح نفسه', () => {
    const v = vault();
    core.encryptExistingKey(v.dir, 'القديمة-12345');
    core.changePassword(v.dir, 'القديمة-12345', 'الجديدة-67890');
    expect(core.publicKeyPem(core.loadPrivateKey(v.dir, 'الجديدة-67890'))).toBe(v.publicPem);
    expect(() => core.loadPrivateKey(v.dir, 'القديمة-12345')).toThrow(/خاطئة/);
  }, 60_000);
});

describe('المفاتيح بخططها', () => {
  it('مدى الحياة يُرقَّم: أوّل عشرة يُكتبون في السجلّ «من أوّل ١٠»، والحادي عشر بلا ذلك', () => {
    const v = vault();
    const key = core.loadPrivateKey(v.dir);
    let last;
    for (let i = 1; i <= 11; i++) last = core.issue(v.dir, key, { device: DEVICE, plan: 'lifetime', office: `مكتب ${i}`, phone: '0770' });
    expect(last.buyer).toBe(11);
    const rows = core.readLedger(v.dir);
    expect(rows).toHaveLength(11);
    expect(rows[9].notes).toContain('أوّل 10');
    expect(rows[10].notes ?? '').not.toContain('أوّل');
    expect(core.countLifetime(v.dir)).toBe(11);
    expect(readKey(rows[0].key, v.publicPem)).toMatchObject({ ok: true, payload: { kind: 'full', device: DEVICE, office: 'مكتب 1' } });
  });

  it('والشهري والسنوي إلى يومهما — ويقرؤهما البرنامج اشتراكًا', () => {
    const v = vault();
    const key = core.loadPrivateKey(v.dir);
    const m = core.issue(v.dir, key, { device: DEVICE, plan: 'monthly', start: '2026-10-03', issued: '2026-10-03' });
    expect(m.payload).toMatchObject({ kind: 'sub', plan: 'monthly', until: '2026-11-02' });
    expect(readKey(m.key, v.publicPem)).toMatchObject({ ok: true, payload: { kind: 'sub', plan: 'monthly', until: '2026-11-02' } });
    const y = core.issue(v.dir, key, { device: DEVICE, plan: 'yearly', start: '2026-10-03' });
    expect(y.payload.until).toBe('2027-10-02');
    expect(m.buyer).toBeNull();
    expect(m.message).toContain(m.key);
    expect(m.message).toContain('الإعدادات ← التفعيل');
  });

  it('وآخر يوم الاشتراك لا يقفز شهرًا: ٣١ كانون الثاني إلى آخر شباط، و٢٩ شباط إلى ٢٨ منه', () => {
    expect(core.subscriptionUntil('monthly', '2027-01-31')).toBe('2027-02-28');
    expect(core.subscriptionUntil('monthly', '2026-12-15')).toBe('2027-01-14');
    expect(core.subscriptionUntil('yearly', '2028-02-29')).toBe('2029-02-28');
  });

  it('ورمز جهازٍ ناقص يُرفض بسببه', () => {
    const v = vault();
    expect(() => core.issue(v.dir, core.loadPrivateKey(v.dir), { device: 'DWN-1234', plan: 'lifetime' })).toThrow(/ستّة عشر حرفًا/);
  });
});

describe('السجلّ', () => {
  it('سجلٌّ بعناوين قديمة (سبعة أعمدة) يُعاد بعناوينه الجديدة ولا يضيع منه صفّ', () => {
    const v = vault();
    mkdirSync(v.dir, { recursive: true });
    writeFileSync(
      join(v.dir, core.LEDGER_FILE),
      '﻿"التاريخ","النوع","رمز الجهاز","المكتب","الهاتف","حتى","المفتاح"\r\n"2026-10-02","كامل","DWN-AAAA-AAAA-AAAA-AAAA","مكتب قديم","","","DIWAN-x.y"\r\n'
    );
    core.issue(v.dir, core.loadPrivateKey(v.dir), { device: DEVICE, plan: 'lifetime', office: 'مكتب جديد' });
    const rows = core.readLedger(v.dir);
    expect(rows.map((r: { office: string }) => r.office)).toEqual(['مكتب قديم', 'مكتب جديد']);
    expect(rows[1].buyer).toBe('2');
    expect(readFileSync(join(v.dir, core.LEDGER_FILE), 'utf8').split('\r\n')[0]).toContain('رقم المشتري');
  });
});

describe('مفتاح العرض (و٩)', () => {
  it('مدى الحياة موقَّعٌ يقرؤه البرنامج كغيره — ولا يُعدّ من أوّل ١٠: مشترٍ بعده «المشتري ١»', () => {
    const v = vault();
    const key = core.loadPrivateKey(v.dir);
    const demo = core.issue(v.dir, key, { device: DEVICE, plan: 'demo', office: 'جهاز المالك' });
    expect(demo.buyer).toBeNull();
    expect(demo.payload).toMatchObject({ kind: 'full', device: DEVICE });
    const read = readKey(demo.key, v.publicPem);
    expect(read.ok && read.payload.kind).toBe('full');
    expect(core.countLifetime(v.dir)).toBe(0);

    const buyer = core.issue(v.dir, key, { device: deviceCode('مكتب-حقيقي'), plan: 'lifetime', office: 'مكتب النور' });
    expect(buyer.buyer).toBe(1);
    expect(core.countLifetime(v.dir)).toBe(1);
  });

  it('ويُرى في السجلّ بنوعه «عرض» وملاحظته', () => {
    const v = vault();
    core.issue(v.dir, core.loadPrivateKey(v.dir), { device: DEVICE, plan: 'demo', notes: 'للمعرض' });
    const [row] = core.readLedger(v.dir);
    expect(row).toMatchObject({ kind: core.DEMO_KIND, plan: 'عرض (مدى الحياة)', buyer: '' });
    expect(row.notes).toBe('مفتاح عرض — لا يُعدّ من أوّل 10 — للمعرض');
  });

  it('وتنبيهٌ عند تكرار الجهاز أو المكتب أو الهاتف — لا منع', () => {
    const v = vault();
    const key = core.loadPrivateKey(v.dir);
    expect(core.issue(v.dir, key, { device: DEVICE, plan: 'lifetime', office: 'مكتب النور', phone: '07701234567' }).warnings).toEqual([]);
    const again = core.issue(v.dir, key, { device: DEVICE, plan: 'monthly', office: ' مكتب النور ', phone: '+964 770 123 4567', issued: '2026-10-09' });
    expect(again.warnings).toHaveLength(3);
    expect(again.warnings[0]).toMatch(/^هذا الجهاز .* صدر له مفتاحٌ قبلُ — آخرها «مدى الحياة»/);
    expect(again.warnings[1]).toMatch(/^المكتب «مكتب النور»/);
    expect(again.warnings[2]).toMatch(/^الهاتف \+964 770 123 4567/);
    // وأُصدر رغم التنبيه.
    expect(core.readLedger(v.dir)).toHaveLength(2);
    const other = core.issue(v.dir, key, { device: deviceCode('جهاز-آخر'), plan: 'lifetime', office: 'مدرسة الأمل' });
    expect(other.warnings).toEqual([]);
  });
});
