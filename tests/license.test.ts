/**
 * التفعيل بلا شبكة (خطة Production، ٦٫٢–٦٫٣): رمز الجهاز، والمفتاح بتوقيع المالك، والمدّة التجريبية
 * بأيّامها التقويمية — وأداة المالك تصنع ما يقرؤه البرنامج.
 */
import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deviceCode, encodeKey, evaluate, normalizeDeviceCode, readKey, readKeyWith, readMachineGuid, RENEW_WARN_DAYS, MACHINE_GRACE_DAYS, type LicensePayload } from '../src/main/services/license';
import { getMachineInfo, parseRegistryValues, resetMachineIdCacheForTesting } from '../src/main/ipc/license';
import { OWNER_KEYS, OWNER_PUBLIC_KEY, OWNER_UPDATE_PUBLIC_KEY, keysFor } from '../src/main/license/ownerKey';

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

describe('مفاتيح المالك بأدوارها (و١٠)', () => {
  const pair = () => {
    const k = generateKeyPairSync('ed25519');
    return { priv: k.privateKey, pem: k.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
  };
  const full: LicensePayload = { v: 1, device: DEVICE, kind: 'full', issued: '2026-10-09', office: 'مكتب النور' };

  it('بصمة القائمة المدمجة «ذهبية» — تعديلٌ غير مقصود يفشل هنا', () => {
    // البند ٣٣ (١٢ ت١): الأوّل (2026-10-02) صار `license` — به صدرت كلّ مفاتيح التفعيل — ومفتاح التحديث الذي صنعه المالك
    // `update`. وكانت البصمة e17dcaa1… والأوّل `both` وحده. لا تُغيَّر إلا بمفتاحٍ أعطاه المالك عمدًا — في إصدارٍ جديد.
    expect(createHash('sha256').update(JSON.stringify(OWNER_KEYS)).digest('hex')).toBe('1e541a13785e7ec89e01f44b38058b4253d61dca751a73902852e97864e8d750');
    expect(OWNER_KEYS).toEqual([
      { id: 'owner-2026-10-02', role: 'license', publicKey: OWNER_PUBLIC_KEY },
      { id: 'update-2026-10-12', role: 'update', publicKey: OWNER_UPDATE_PUBLIC_KEY }
    ]);
  });

  it('والمفتاحان مفصولان: التفعيل بالأوّل وحده، والتحديث بمفتاح التحديث وحده — ولا يصلح أحدهما للآخر', () => {
    expect(keysFor('license')).toEqual([OWNER_PUBLIC_KEY]);
    expect(keysFor('update')).toEqual([OWNER_UPDATE_PUBLIC_KEY]);
    expect(OWNER_UPDATE_PUBLIC_KEY).not.toBe(OWNER_PUBLIC_KEY);
    // مفاتيح Ed25519 صالحة.
    for (const k of [OWNER_PUBLIC_KEY, OWNER_UPDATE_PUBLIC_KEY]) expect(createPublicKey(k).asymmetricKeyType).toBe('ed25519');
  });

  it('التفعيل يجرّب `license|both`، والتحديث `update|both`', () => {
    const keys = [
      { id: 'a', role: 'both' as const, publicKey: 'A' },
      { id: 'b', role: 'license' as const, publicKey: 'B' },
      { id: 'c', role: 'update' as const, publicKey: 'C' }
    ];
    expect(keysFor('license', keys)).toEqual(['A', 'B']);
    expect(keysFor('update', keys)).toEqual(['A', 'C']);
  });

  it('مفتاحٌ موقَّعٌ بأيّ مفتاحٍ في القائمة يُقبل، وبثالثٍ خارجها يُرفض', () => {
    const [k1, k2, k3] = [pair(), pair(), pair()];
    const by = (k: { priv: Parameters<typeof sign>[2] }) => encodeKey(full, (d) => sign(null, d, k.priv));
    expect(readKeyWith(by(k1), [k1.pem, k2.pem])).toEqual({ ok: true, payload: full });
    expect(readKeyWith(by(k2), [k1.pem, k2.pem])).toEqual({ ok: true, payload: full });
    expect(readKeyWith(by(k3), [k1.pem, k2.pem])).toEqual({ ok: false, reason: 'المفتاح غير صحيح — انسخه كاملًا كما وصلك' });
    expect(readKeyWith('ليس مفتاحًا', [k1.pem])).toMatchObject({ ok: false, reason: expect.stringMatching(/ليس مفتاح/) });
    // وصيغةٌ لا يعرفها الإصدار بتوقيعٍ صحيح يُقال سببها — لا «غير صحيح».
    const odd = encodeKey({ ...full, kind: 'gift' as LicensePayload['kind'] }, (d) => sign(null, d, k2.priv));
    expect(readKeyWith(odd, [k1.pem, k2.pem])).toMatchObject({ ok: false, reason: expect.stringMatching(/حدّث البرنامج/) });
    expect(readKeyWith(by(k1), [])).toMatchObject({ ok: false });
  });
});

describe('معرّف الجهاز البديل وفشل القراءة ومهلة السماح (المرحلة A — ٤٫٢ والجواب ١)', () => {
  const start = at('2026-10-02');
  const now = at('2026-10-20');
  const fullKey: LicensePayload = { v: 1, device: DEVICE, kind: 'full', issued: '2026-10-05', office: 'مكتب الرافدين' };
  const fallbackRaw = 'testhost|testuser';
  const fallbackDevice = deviceCode(fallbackRaw);
  const fallbackKey: LicensePayload = { v: 1, device: fallbackDevice, kind: 'full', issued: '2026-10-05', office: 'مكتب الرافدين' };

  it('دالّة قراءة معرّف الجهاز تعيد المحاولة عند الفشل المؤقت', () => {
    let attempts = 0;
    const flakeyReader = () => {
      attempts++;
      if (attempts < 3) throw new Error('temporary failure');
      return 'guid-1234';
    };
    expect(readMachineGuid(flakeyReader, 3)).toBe('guid-1234');
    expect(attempts).toBe(3);

    const failingReader = () => {
      throw new Error('permanent failure');
    };
    expect(readMachineGuid(failingReader, 3)).toBeNull();
  });

  it('ثبات المعرّف داخل الجلسة: ما قُرئ بنجاح لا يغيّره فشلٌ عابر', () => {
    resetMachineIdCacheForTesting();
    const info1 = getMachineInfo(false, () => 'my-guid-111');
    expect(info1.verified).toBe(true);
    expect(info1.rawMachineId).toBe('my-guid-111');

    // محاولة تالية بقارئ يفشل: المعرّف المحفوظ يبقى
    const info2 = getMachineInfo(false, () => null);
    expect(info2.verified).toBe(true);
    expect(info2.rawMachineId).toBe('my-guid-111');
    resetMachineIdCacheForTesting();
  });

  it('فشل القراءة والتجربة سارية: تستمر التجربة مع تنبيه هادئ', () => {
    const res = evaluate({
      now: at('2026-10-10'),
      trialStart: start,
      keys: [],
      device: fallbackDevice,
      fallbackDevice,
      machineGuidVerified: false
    });
    expect(res).toMatchObject({
      status: 'trial',
      daysLeft: 6,
      unverified: true,
      deviceWarning: 'تعذّر التحقّق من الجهاز'
    });
  });

  it('ما فُعّل على البديل hostname|username يبقى مفعّلًا بلا مهلة', () => {
    const res = evaluate({
      now,
      trialStart: start,
      keys: [fallbackKey],
      device: fallbackDevice,
      fallbackDevice,
      machineGuidVerified: false
    });
    expect(res).toEqual({
      status: 'activated',
      office: 'مكتب الرافدين',
      issued: '2026-10-05'
    });
  });

  it('مفتاح سبق التحقق منه داخل مهلة السماح (٧ أيام) يعمل مع تحذير', () => {
    const res = evaluate({
      now: at('2026-10-20'),
      trialStart: start,
      keys: [fullKey],
      device: fallbackDevice,
      fallbackDevice,
      machineGuidVerified: false,
      lastVerified: at('2026-10-15')
    });
    expect(res).toMatchObject({
      status: 'activated',
      unverified: true,
      deviceWarning: expect.stringContaining('تعذّر التحقّق من الجهاز')
    });
  });

  it('بعد انتهاء مهلة السماح (أكثر من ٧ أيام) يُحجب بحالة تعذّر قراءة المعرّف لا انتهاء الصلاحية', () => {
    const res = evaluate({
      now: at('2026-10-25'),
      trialStart: start,
      keys: [fullKey],
      device: fallbackDevice,
      fallbackDevice,
      machineGuidVerified: false,
      lastVerified: at('2026-10-15')
    });
    expect(res).toEqual({
      status: 'unverified',
      reason: 'machine_error',
      deviceWarning: 'تعذّر قراءة معرّف الجهاز — أعد المحاولة، وإن استمرّ العطل فاتّصل بالمطوّر'
    });
  });

  it('فشل دائم بلا مفتاح سابق بعد انتهاء التجربة: حالة unverified وزر المحاولة', () => {
    const res = evaluate({
      now,
      trialStart: start,
      keys: [],
      device: fallbackDevice,
      fallbackDevice,
      machineGuidVerified: false
    });
    expect(res).toEqual({
      status: 'unverified',
      reason: 'machine_error',
      lastDay: '2026-10-15',
      deviceWarning: 'تعذّر قراءة معرّف الجهاز — أعد المحاولة، وإن استمرّ العطل فاتّصل بالمطوّر'
    });
  });

  it('الحماية من التلاعب: أقدم تاريخ بين المخازن هو المعتمد', () => {
    const earliest = (xs: (string | undefined)[]) => xs.filter((x): x is string => Boolean(x && !Number.isNaN(Date.parse(x)))).sort()[0];
    const fileLastVerified = '2026-10-24T10:00:00Z';
    const regLastVerified = '2026-10-10T10:00:00Z';
    const effective = earliest([fileLastVerified, regLastVerified]);
    expect(effective).toBe(regLastVerified);

    const res = evaluate({
      now: at('2026-10-25'),
      trialStart: start,
      keys: [fullKey],
      device: fallbackDevice,
      fallbackDevice,
      machineGuidVerified: false,
      lastVerified: new Date(effective!)
    });
    expect(res.status).toBe('unverified');
  });

  it('قراءة ناجحة بعد الفشل تعيد الحال الطبيعية كاملة', () => {
    const res = evaluate({
      now,
      trialStart: start,
      keys: [fullKey],
      device: DEVICE,
      machineGuidVerified: true
    });
    expect(res).toEqual({
      status: 'activated',
      office: 'مكتب الرافدين',
      issued: '2026-10-05'
    });
  });
});

describe('ثوابت الترخيص الموحّدة (المرحلة A — ٤٫٧)', () => {
  it('ثابت التنبيه قبل نهاية الاشتراك ٧ أيام وثابت مهلة السماح ٧ أيام', () => {
    expect(RENEW_WARN_DAYS).toBe(7);
    expect(MACHINE_GRACE_DAYS).toBe(7);
  });
});

describe('قراءة السجل الموحّدة باستعلام واحد (E06, D111)', () => {
  it('تستخرج القيم الثلاث عند وجودها في مخرج reg query', () => {
    const raw = `
HKEY_CURRENT_USER\\Software\\Diwan
    TrialStart    REG_SZ    2026-10-02T15:18:04.716Z
    LastSeen    REG_SZ    2026-10-19T03:27:30.671Z
    LastVerified    REG_SZ    2026-10-15T10:00:00.000Z
`;
    expect(parseRegistryValues(raw)).toEqual({
      trialStart: '2026-10-02T15:18:04.716Z',
      lastSeen: '2026-10-19T03:27:30.671Z',
      lastVerified: '2026-10-15T10:00:00.000Z'
    });
  });

  it('تعيد undefined للقيم الغائبة عند وجود بعضها فقط', () => {
    const raw = `
HKEY_CURRENT_USER\\Software\\Diwan
    TrialStart    REG_SZ    2026-10-02T15:18:04.716Z
    LastSeen    REG_SZ    2026-10-19T03:27:30.671Z
`;
    expect(parseRegistryValues(raw)).toEqual({
      trialStart: '2026-10-02T15:18:04.716Z',
      lastSeen: '2026-10-19T03:27:30.671Z',
      lastVerified: undefined
    });
  });

  it('تعيد undefined لجميع القيم عند خلو المخرج أو تعذّر العثور على المفتاح', () => {
    expect(parseRegistryValues('')).toEqual({
      trialStart: undefined,
      lastSeen: undefined,
      lastVerified: undefined
    });
    expect(parseRegistryValues('ERROR: The system was unable to find the specified registry key or value.')).toEqual({
      trialStart: undefined,
      lastSeen: undefined,
      lastVerified: undefined
    });
  });

  it('تتعامل بسلاسة مع التبويبات والمسافات المختلفة ونهايات الأسطر', () => {
    const raw = 'HKEY_CURRENT_USER\\Software\\Diwan\r\n\tTrialStart\tREG_SZ\t2026-10-01T00:00:00.000Z\r\n';
    expect(parseRegistryValues(raw)).toEqual({
      trialStart: '2026-10-01T00:00:00.000Z',
      lastSeen: undefined,
      lastVerified: undefined
    });
  });
});


