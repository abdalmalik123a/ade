/**
 * التفعيل بلا شبكة (خطة Production، ٦٫٢–٦٫٣): رمز الجهاز، والمفتاح بتوقيع المالك، والمدّة التجريبية
 * بأيّامها التقويمية — وأداة المالك تصنع ما يقرؤه البرنامج.
 */
import { execFileSync } from 'node:child_process';
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deviceCode, encodeKey, evaluate, normalizeDeviceCode, readKey, type LicensePayload } from '../src/main/services/license';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const signer = (data: Buffer) => sign(null, data, privateKey);
const DEVICE = deviceCode('760f248f-78f7-4f67-ab27-530781064d79');
const at = (s: string) => new Date(`${s}T10:00:00`);

describe('رمز الجهاز', () => {
  it('ثابتٌ لجهازه، ومختلفٌ لغيره، بحروفٍ لا تُخلط', () => {
    expect(DEVICE).toMatch(/^DWN-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(deviceCode('760F248F-78F7-4F67-AB27-530781064D79 ')).toBe(DEVICE);
    expect(deviceCode('another-machine')).not.toBe(DEVICE);
  });

  it('ويُقرأ كما يكتبه الناس: صغيرًا وبمسافات وبـO مكان الصفر', () => {
    const typed = DEVICE.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o');
    expect(normalizeDeviceCode(typed)).toBe(DEVICE);
  });
});

describe('المفتاح', () => {
  const full: LicensePayload = { v: 1, device: DEVICE, kind: 'full', issued: '2026-10-02', office: 'مكتب الرافدين' };

  it('يُقرأ بتوقيعه — ولو لُصق من واتساب بأسطرٍ ومسافات', () => {
    const key = encodeKey(full, signer);
    const wrapped = key.replace(/(.{40})/g, '$1\n ');
    expect(readKey(wrapped, pub)).toEqual({ ok: true, payload: full });
  });

  it('وما عُبث بحرفٍ منه، أو وقّعه غير المالك، يُرفض', () => {
    const key = encodeKey(full, signer);
    const body = key.slice(6, key.indexOf('.'));
    const forged = Buffer.from(Buffer.from(body, 'base64url').toString().replace('مكتب الرافدين', 'مكتب آخر')).toString('base64url');
    expect(readKey(key.replace(body, forged), pub).ok).toBe(false);
    const other = generateKeyPairSync('ed25519').privateKey;
    expect(readKey(encodeKey(full, (d) => sign(null, d, other)), pub).ok).toBe(false);
    expect(readKey('ليس مفتاحًا', pub)).toMatchObject({ ok: false, reason: expect.stringMatching(/ليس مفتاح/) });
  });
});

describe('المدّة التجريبية', () => {
  const start = at('2026-10-02');
  const base = { trialStart: start, keys: [] as LicensePayload[], device: DEVICE };

  it('أربعة عشر يومًا تقويمية: اليوم الأوّل ١٤، والأخير ١، ثم تنتهي', () => {
    expect(evaluate({ ...base, now: at('2026-10-02') })).toMatchObject({ status: 'trial', daysLeft: 14, lastDay: '2026-10-15' });
    expect(evaluate({ ...base, now: new Date('2026-10-15T23:59:00') })).toMatchObject({ status: 'trial', daysLeft: 1 });
    expect(evaluate({ ...base, now: new Date('2026-10-16T00:01:00') })).toEqual({ status: 'expired', lastDay: '2026-10-15', ended: 'trial' });
  });

  it('وإرجاع الساعة لا يُطيلها: أحدث يومٍ رآه البرنامج هو اليوم', () => {
    expect(evaluate({ ...base, now: at('2026-10-03'), lastSeen: at('2026-10-20') }).status).toBe('expired');
  });

  it('ومفتاح التمديد يمدّها إلى يومه شاملًا — لجهازه وحده', () => {
    const ext: LicensePayload = { v: 1, device: DEVICE, kind: 'extend', issued: '2026-10-14', until: '2026-10-31' };
    expect(evaluate({ ...base, now: at('2026-10-31'), keys: [ext] })).toMatchObject({ status: 'trial', daysLeft: 1, extended: true });
    expect(evaluate({ ...base, now: at('2026-11-01'), keys: [ext] }).status).toBe('expired');
    expect(evaluate({ ...base, now: at('2026-10-20'), keys: [{ ...ext, device: deviceCode('x') }] }).status).toBe('expired');
  });

  it('والمفتاح الكامل يفعّله مدى الحياة — ولو انتهت المدّة', () => {
    const full: LicensePayload = { v: 1, device: DEVICE, kind: 'full', issued: '2026-12-01', office: 'مكتب الرافدين' };
    expect(evaluate({ ...base, now: at('2031-01-01'), keys: [full] })).toEqual({ status: 'activated', office: 'مكتب الرافدين', issued: '2026-12-01' });
  });
});

describe('أداة المالك', () => {
  it('تصنع مفتاحًا يقرؤه البرنامج — بمفتاحٍ خاصٍّ مؤقّت لا مفتاح المالك', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-keygen-'));
    const keyPath = join(dir, 'test.pem');
    const tool = join(process.cwd(), 'tools', 'license', 'keygen.mjs');
    execFileSync(process.execPath, [tool, 'init', '--key', keyPath], { encoding: 'utf8' });
    const testPub = createPublicKey(createPrivateKey(readFileSync(keyPath, 'utf8'))).export({ type: 'spki', format: 'pem' }).toString();
    const typed = DEVICE.toLowerCase();
    const issued = execFileSync(process.execPath, [tool, 'issue', typed, '--office', 'مكتب الاختبار', '--key', keyPath], { encoding: 'utf8' }).trim();
    expect(readKey(issued, testPub)).toMatchObject({ ok: true, payload: { device: DEVICE, kind: 'full', office: 'مكتب الاختبار' } });
    const ext = execFileSync(process.execPath, [tool, 'extend', DEVICE, '--until', '2026-12-31', '--key', keyPath], { encoding: 'utf8' }).trim();
    expect(readKey(ext, testPub)).toMatchObject({ ok: true, payload: { kind: 'extend', until: '2026-12-31' } });
    // ومفتاحٌ صنعه مفتاحٌ غير مفتاح البرنامج لا يُقبل.
    expect(readKey(issued, pub).ok).toBe(false);
  });
});

describe('الاشتراك الشهري والسنوي (قرار المالك ٣ تشرين الأول ٢٠٢٦)', () => {
  const start = at('2026-10-02');
  const sub = (until: string, plan: 'monthly' | 'yearly' = 'monthly', issued = '2026-10-10'): LicensePayload => ({ v: 1, device: DEVICE, kind: 'sub', plan, issued, until, office: 'مكتب الرافدين' });

  it('مشتركٌ إلى يومه بأيّامه، ثم ينتهي كما تنتهي التجربة — ويُقال إنه الاشتراك', () => {
    const keys = [sub('2026-11-09')];
    expect(evaluate({ now: at('2026-11-03'), trialStart: start, keys, device: DEVICE })).toMatchObject({ status: 'subscribed', plan: 'monthly', daysLeft: 7, lastDay: '2026-11-09' });
    expect(evaluate({ now: at('2026-11-10'), trialStart: start, keys, device: DEVICE })).toEqual({ status: 'expired', lastDay: '2026-11-09', ended: 'subscription' });
  });

  it('والتجديد مفتاحٌ إلى يومٍ أبعد يُضاف — والأبعد هو ما يُعمل به', () => {
    const keys = [sub('2026-11-09'), sub('2027-11-09', 'yearly', '2026-11-08')];
    expect(evaluate({ now: at('2026-12-01'), trialStart: start, keys, device: DEVICE })).toMatchObject({ status: 'subscribed', plan: 'yearly', lastDay: '2027-11-09' });
  });

  it('ومدى الحياة يغلب الاشتراك', () => {
    const full: LicensePayload = { v: 1, device: DEVICE, kind: 'full', issued: '2026-12-01' };
    expect(evaluate({ now: at('2030-01-01'), trialStart: start, keys: [sub('2026-11-09'), full], device: DEVICE }).status).toBe('activated');
  });

  it('ومفتاح اشتراكٍ بلا خطّته أو يومه يُرفض', () => {
    expect(readKey(encodeKey(sub('2026-11-09'), signer), pub).ok).toBe(true);
    expect(readKey(encodeKey({ ...sub('2026-11-09'), plan: undefined }, signer), pub).ok).toBe(false);
    expect(readKey(encodeKey({ ...sub('2026-11-09'), until: undefined }, signer), pub).ok).toBe(false);
  });
});
