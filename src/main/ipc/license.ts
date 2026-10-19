/**
 * التفعيل بلا شبكة — أين يُحفظ، وما يُمنع بعد المدّة التجريبية (خطة Production، ٦٫٢). الحساب في
 * services/license.ts.
 *
 * **أوّل تشغيلٍ وأحدث يومٍ** يُحفظان في ثلاثة أماكن: إعدادات القاعدة، وملفٌّ في بيانات البرنامج، وسجلّ
 * ويندوز للمستخدم (في المثبّت وحده) — ويُؤخذ أقدم أوّلٍ وأحدث يوم. فإعادة التثبيت أو استرجاع نسخةٍ
 * قديمة لا تعيد المدّة، وإرجاع الساعة لا يُطيلها.
 *
 * **والمفاتيح** في القاعدة والملفّ معًا، ويُتحقّق من توقيعها في كلّ قراءة: ما لم يُوقّع لهذا الجهاز لا
 * يُعدّ — فقاعدةٌ نُقلت من جهازٍ مفعَّل إلى غيره لا تفعّله.
 *
 * **وأبواب المِقْود** (الوقت، ومعرّف الجهاز، والمفتاح العامّ للاختبار) في البرنامج غير المثبّت وحده:
 * لا تجاوز في النسخة المثبّتة.
 */
import { execFileSync } from 'node:child_process';
import { hostname, userInfo } from 'node:os';
import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import { now } from '../clock';
import { dataDir, getDb } from '../db';
import { keysFor } from '../license/ownerKey';
import { dayNumber, deviceCode, evaluate, keyList, readKeyWith, readMachineGuid, storedLicense, type LicensePayload, type LicenseState } from '../services/license';
import { logAudit } from '../services/documents';
import { atomicWriteJson, readWithBackup } from '../services/stateFile';
import type { LicenseStatus } from '@shared/api';
import { DEVELOPER } from '@shared/brand';
import { formatGregorian } from '@shared/dates';

/** رقم المطوّر للتفعيل — واتساب واتصال (قرار المالك). */
const DEVELOPER_PHONE = DEVELOPER.phoneDisplay;

/**
 * مفاتيح المالك العامّة لعملٍ (و١٠): التفعيل أو التحديث «أ+» — بأدوارها من `OWNER_KEYS`. وتحت المِقْود مفتاح الاختبار
 * وحده، في غير المثبّت وحده.
 */
const publicKeys = (role: 'license' | 'update'): string[] => {
  const testKey = __DIWAN_TEST_DOORS__ && !app?.isPackaged ? process.env['DIWAN_TEST_LICENSE_PUBKEY'] : undefined;
  return testKey ? [testKey] : keysFor(role);
};
export const ownerPublicKeys = publicKeys;

let cachedVerifiedGuid: string | null = null;

export function resetMachineIdCacheForTesting(): void {
  cachedVerifiedGuid = null;
  cached = null;
}

export function readSystemMachineGuid(): string | null {
  try {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true });
    return /MachineGuid\s+REG_SZ\s+(\S+)/.exec(out)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getMachineInfo(
  fresh = false,
  guidReader: () => string | null = readSystemMachineGuid
): {
  device: string;
  fallbackDevice: string;
  verified: boolean;
  rawMachineId: string;
} {
  const testMachine = __DIWAN_TEST_DOORS__ && !app?.isPackaged ? process.env['DIWAN_TEST_MACHINE_ID'] : undefined;
  const fallbackRaw = `${hostname()}|${userInfo().username}`;
  const fallbackDevice = deviceCode(fallbackRaw);

  if (testMachine) {
    return {
      device: deviceCode(testMachine),
      fallbackDevice,
      verified: true,
      rawMachineId: testMachine
    };
  }

  if (cachedVerifiedGuid && !fresh) {
    return {
      device: deviceCode(cachedVerifiedGuid),
      fallbackDevice,
      verified: true,
      rawMachineId: cachedVerifiedGuid
    };
  }

  const guid = readMachineGuid(guidReader, 3);
  if (guid) {
    cachedVerifiedGuid = guid;
    return {
      device: deviceCode(guid),
      fallbackDevice,
      verified: true,
      rawMachineId: guid
    };
  }

  if (cachedVerifiedGuid) {
    return {
      device: deviceCode(cachedVerifiedGuid),
      fallbackDevice,
      verified: true,
      rawMachineId: cachedVerifiedGuid
    };
  }

  return {
    device: fallbackDevice,
    fallbackDevice,
    verified: false,
    rawMachineId: fallbackRaw
  };
}

/** معرّف ويندوز للجهاز — يُقرأ بلا صلاحيات مدير. وإن تعذّر فاسم الجهاز والمستخدم. */
export function machineId(): string {
  return getMachineInfo().rawMachineId;
}

type Stored = { trialStart?: string; lastSeen?: string; lastVerified?: string; keys?: string[] };
const fileOf = () => join(dataDir(), 'diwan-license.json');
const REG = 'HKCU\\Software\\Diwan';

/** وما فسد من الملفّ يُقرأ من احتياطه .bak أو يُترك لا يُسقط الحال (`storedLicense`). */
function readFileStore(): Stored {
  return readWithBackup(
    fileOf(),
    (raw) => storedLicense(JSON.parse(raw) as unknown),
    { keys: [] }
  );
}

export function parseRegistryValues(out: string): Stored {
  const value = (name: string) => new RegExp(`${name}\\s+REG_SZ\\s+(\\S+)`).exec(out)?.[1];
  return { trialStart: value('TrialStart'), lastSeen: value('LastSeen'), lastVerified: value('LastVerified') };
}

function readRegistry(): Stored {
  if (!app.isPackaged) return {};
  try {
    const out = execFileSync('reg', ['query', REG], { encoding: 'utf8', windowsHide: true });
    return parseRegistryValues(out);
  } catch {
    return {};
  }
}

function writeRegistry(s: Stored): void {
  if (!app.isPackaged) return;
  for (const [name, v] of [
    ['TrialStart', s.trialStart],
    ['LastSeen', s.lastSeen],
    ['LastVerified', s.lastVerified]
  ] as const) {
    if (!v) continue;
    try {
      execFileSync('reg', ['add', REG, '/v', name, '/t', 'REG_SZ', '/d', v, '/f'], { windowsHide: true });
    } catch {
      // السجلّ مكانٌ من ثلاثة — تعذّره لا يمنع البرنامج.
    }
  }
}

function setting(key: string): string | undefined {
  return (getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
}
function putSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value);
}

const iso = (d: Date) => d.toISOString();
const earliest = (xs: (string | undefined)[]) => xs.filter((x): x is string => Boolean(x && !Number.isNaN(Date.parse(x)))).sort()[0];
const latest = (xs: (string | undefined)[]) => xs.filter((x): x is string => Boolean(x && !Number.isNaN(Date.parse(x)))).sort().at(-1);

let cached: { at: number; status: LicenseStatus } | null = null;

/** الحال الآن — ويُكتب أوّل تشغيلٍ وأحدث يومٍ في أماكنه الثلاثة. */
export function licenseStatus(fresh = false): LicenseStatus {
  if (!fresh && cached && Date.now() - cached.at < 60_000) return cached.status;
  const t = now();
  const file = readFileStore();
  const reg = readRegistry();
  const trialStart = earliest([setting('trialStart'), file.trialStart, reg.trialStart]) ?? iso(t);
  // أحدث يومٍ رآه البرنامج — يُكتب يومًا بيوم، لا مع كلّ سؤال.
  const stored = latest([setting('lastSeen'), file.lastSeen, reg.lastSeen]);
  const seen = !stored || dayNumber(t) > dayNumber(new Date(stored)) ? iso(t) : stored;
  const storedVerified = earliest([setting('lastVerified'), file.lastVerified, reg.lastVerified]);
  // وما فسد من القائمتين فارغٌ لا خطأ (و٣): كان يرمي هنا فيتوقّف الإصدار كلّه.
  const keys = [...new Set([...keyList(setting('licenseKeys')), ...keyList(file.keys)])];

  const mInfo = getMachineInfo(fresh);
  const device = mInfo.device;
  const fallbackDevice = mInfo.fallbackDevice;
  const machineGuidVerified = mInfo.verified;

  const valid: LicensePayload[] = [];
  for (const k of keys) {
    const r = readKeyWith(k, publicKeys('license'));
    if (r.ok) valid.push(r.payload);
  }

  const lastVerifiedDate = storedVerified ? new Date(storedVerified) : null;
  const state: LicenseState = evaluate({
    now: t,
    trialStart: new Date(trialStart),
    lastSeen: new Date(seen),
    keys: valid,
    device,
    fallbackDevice,
    machineGuidVerified,
    lastVerified: lastVerifiedDate
  });

  let lastVerified = storedVerified;
  if (machineGuidVerified && (state.status === 'activated' || state.status === 'subscribed')) {
    lastVerified = iso(t);
    if (setting('lastVerified') !== lastVerified) putSetting('lastVerified', lastVerified);
  }

  // يُكتب ما تغيّر وحده.
  if (setting('trialStart') !== trialStart) putSetting('trialStart', trialStart);
  if (setting('lastSeen') !== seen) putSetting('lastSeen', seen);
  if (
    file.trialStart !== trialStart ||
    file.lastSeen !== seen ||
    file.lastVerified !== lastVerified ||
    keyList(file.keys).length !== keys.length
  ) {
    try {
      atomicWriteJson(fileOf(), { trialStart, lastSeen: seen, lastVerified, keys });
    } catch {
      // مكانٌ من ثلاثة.
    }
  }
  if (
    reg.trialStart !== trialStart ||
    reg.lastSeen?.slice(0, 10) !== seen.slice(0, 10) ||
    reg.lastVerified !== lastVerified
  ) {
    writeRegistry({ trialStart, lastSeen: seen, lastVerified });
  }

  const status: LicenseStatus = { ...state, device, phone: DEVELOPER.phone, trialStart };
  cached = { at: Date.now(), status };
  return status;
}

/**
 * ما يُنتج ورقةً أو ملفًّا يُسلَّم (الإصدار والطباعة وPDF وWord والصورة) يتوقّف بعد المدّة التجريبية أو عند تعذّر قراءة المعرّف.
 * والعرض والبحث والنسخ الاحتياطي وتصدير البيانات تبقى — فلا تُقفل بيانات أحد.
 */
export function requireProductive(): void {
  const s = licenseStatus(true);
  if (s.status === 'unverified') {
    throw new Error(
      `تعذّر قراءة معرّف الجهاز — أعد المحاولة، وإن استمرّ العطل فاتّصل بالمطوّر: ${DEVELOPER_PHONE} (واتساب واتصال)`
    );
  }
  if (s.status !== 'expired') return;
  const day = formatGregorian(new Date(`${s.lastDay}T12:00:00`));
  throw new Error(
    (s.ended === 'subscription'
      ? `انتهى الاشتراك يوم ${day} — جدّده بمفتاحٍ من المطوّر في «الإعدادات ← التفعيل» ليعود الإصدار والطباعة. `
      : `انتهت المدّة التجريبية يوم ${day} — فعّل البرنامج من «الإعدادات ← التفعيل» ليعود الإصدار والطباعة. `) +
      `والعرض والبحث والنسخ الاحتياطي تعمل كما هي. للتفعيل والتجديد: ${DEVELOPER_PHONE} (واتساب واتصال)`
  );
}

export function registerLicenseIpc(): void {
  // أوّل تشغيلٍ يُكتب عند الإقلاع — لا حين تُسأل الواجهة.
  licenseStatus(true);
  ipcMain.handle('license:status', () => licenseStatus(true));

  ipcMain.handle('license:activate', (_e, raw: string): LicenseStatus => {
    const r = readKeyWith(String(raw ?? ''), publicKeys('license'));
    if (!r.ok) throw new Error(r.reason);
    const mInfo = getMachineInfo(true);
    const targetDevice = mInfo.verified ? mInfo.device : mInfo.fallbackDevice;
    if (r.payload.device !== targetDevice && r.payload.device !== mInfo.fallbackDevice) {
      throw new Error(`هذا المفتاح لجهازٍ آخر (${r.payload.device}) — ورمز هذا الجهاز ${targetDevice}`);
    }
    const key = String(raw).replace(/\s+/g, '');
    const keys = [...new Set([...keyList(setting('licenseKeys')), key])];
    putSetting('licenseKeys', JSON.stringify(keys));
    const nowIso = iso(now());
    if (mInfo.verified) {
      putSetting('lastVerified', nowIso);
    }
    const file = readFileStore();
    try {
      atomicWriteJson(fileOf(), { ...file, keys, ...(mInfo.verified ? { lastVerified: nowIso } : {}) });
    } catch {
      // في القاعدة يكفي.
    }
    if (mInfo.verified) {
      writeRegistry({ trialStart: file.trialStart, lastSeen: file.lastSeen, lastVerified: nowIso });
    }
    const p = r.payload;
    if (p.kind === 'full') logAudit(getDb(), 'license', 'activate', p.office ?? null);
    else if (p.kind === 'sub') logAudit(getDb(), 'license', 'subscribe', `${p.plan === 'yearly' ? 'سنوي' : 'شهري'} حتى ${p.until}${p.office ? ` — ${p.office}` : ''}`);
    else logAudit(getDb(), 'license', 'extend', `حتى ${p.until}`);
    return licenseStatus(true);
  });
}
