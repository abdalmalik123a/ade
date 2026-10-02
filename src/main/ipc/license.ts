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
import { readFileSync, writeFileSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import { dataDir, getDb } from '../db';
import { OWNER_PUBLIC_KEY } from '../license/ownerKey';
import { dayNumber, deviceCode, evaluate, readKey, type LicensePayload, type LicenseState } from '../services/license';
import { logAudit } from '../services/documents';
import type { LicenseStatus } from '@shared/api';
import { DEVELOPER } from '@shared/brand';
import { formatGregorian } from '@shared/dates';

/** رقم المطوّر للتفعيل — واتساب واتصال (قرار المالك). */
const DEVELOPER_PHONE = DEVELOPER.phoneDisplay;

const test = (name: string): string | undefined => (app.isPackaged ? undefined : process.env[name]);
/** الوقت — وتحت المِقْود من ملفٍّ يغيّره السيناريو وهو يعمل («بعد أسبوعين»)، في غير المثبّت وحده. */
function now(): Date {
  const file = test('DIWAN_TEST_NOW_FILE');
  if (file) {
    try {
      const t = new Date(readFileSync(file, 'utf8').trim());
      if (!Number.isNaN(t.getTime())) return t;
    } catch {
      // لا ملف: الوقت الحقيقي.
    }
  }
  return new Date();
}
const publicKey = (): string => test('DIWAN_TEST_LICENSE_PUBKEY') ?? OWNER_PUBLIC_KEY;
/** مفتاح المالك العامّ — للتفعيل وللتحديث «أ+» (وتحت المِقْود مفتاح الاختبار، في غير المثبّت وحده). */
export const ownerPublicKey = publicKey;

let machine: string | null = null;
/** معرّف ويندوز للجهاز — يُقرأ بلا صلاحيات مدير. وإن تعذّر فاسم الجهاز والمستخدم. */
function machineId(): string {
  if (test('DIWAN_TEST_MACHINE_ID')) return test('DIWAN_TEST_MACHINE_ID')!;
  if (machine) return machine;
  try {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true });
    machine = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(out)?.[1] ?? null;
  } catch {
    machine = null;
  }
  machine ??= `${hostname()}|${userInfo().username}`;
  return machine;
}

type Stored = { trialStart?: string; lastSeen?: string; keys?: string[] };
const fileOf = () => join(dataDir(), 'diwan-license.json');
const REG = 'HKCU\\Software\\Diwan';

function readFileStore(): Stored {
  try {
    return JSON.parse(readFileSync(fileOf(), 'utf8')) as Stored;
  } catch {
    return {};
  }
}

function readRegistry(): Stored {
  if (!app.isPackaged) return {};
  const value = (name: string) => {
    try {
      const out = execFileSync('reg', ['query', REG, '/v', name], { encoding: 'utf8', windowsHide: true });
      return new RegExp(`${name}\\s+REG_SZ\\s+(\\S+)`).exec(out)?.[1];
    } catch {
      return undefined;
    }
  };
  return { trialStart: value('TrialStart'), lastSeen: value('LastSeen') };
}

function writeRegistry(s: Stored): void {
  if (!app.isPackaged) return;
  for (const [name, v] of [
    ['TrialStart', s.trialStart],
    ['LastSeen', s.lastSeen]
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
  const keys = [...new Set([...(JSON.parse(setting('licenseKeys') ?? '[]') as string[]), ...(file.keys ?? [])])];

  // يُكتب ما تغيّر وحده.
  if (setting('trialStart') !== trialStart) putSetting('trialStart', trialStart);
  if (setting('lastSeen') !== seen) putSetting('lastSeen', seen);
  if (file.trialStart !== trialStart || file.lastSeen !== seen || (file.keys ?? []).length !== keys.length) {
    try {
      writeFileSync(fileOf(), JSON.stringify({ trialStart, lastSeen: seen, keys }, null, 2));
    } catch {
      // مكانٌ من ثلاثة.
    }
  }
  if (reg.trialStart !== trialStart || reg.lastSeen?.slice(0, 10) !== seen.slice(0, 10)) writeRegistry({ trialStart, lastSeen: seen });

  const device = deviceCode(machineId());
  const valid: LicensePayload[] = [];
  for (const k of keys) {
    const r = readKey(k, publicKey());
    if (r.ok && r.payload.device === device) valid.push(r.payload);
  }
  const state: LicenseState = evaluate({ now: t, trialStart: new Date(trialStart), lastSeen: new Date(seen), keys: valid, device });
  const status: LicenseStatus = { ...state, device, phone: DEVELOPER.phone, trialStart };
  cached = { at: Date.now(), status };
  return status;
}

/**
 * ما يُنتج ورقةً أو ملفًّا يُسلَّم (الإصدار والطباعة وPDF وWord والصورة) يتوقّف بعد المدّة التجريبية.
 * والعرض والبحث والنسخ الاحتياطي وتصدير البيانات تبقى — فلا تُقفل بيانات أحد.
 */
export function requireProductive(): void {
  const s = licenseStatus();
  if (s.status !== 'expired') return;
  throw new Error(
    `انتهت المدّة التجريبية يوم ${formatGregorian(new Date(`${s.lastDay}T12:00:00`))} — فعّل البرنامج من «الإعدادات ← التفعيل» ليعود الإصدار والطباعة. ` +
      `والعرض والبحث والنسخ الاحتياطي تعمل كما هي. للتفعيل: ${DEVELOPER_PHONE} (واتساب واتصال)`
  );
}

export function registerLicenseIpc(): void {
  // أوّل تشغيلٍ يُكتب عند الإقلاع — لا حين تُسأل الواجهة.
  licenseStatus(true);
  ipcMain.handle('license:status', () => licenseStatus(true));

  ipcMain.handle('license:activate', (_e, raw: string): LicenseStatus => {
    const r = readKey(String(raw ?? ''), publicKey());
    if (!r.ok) throw new Error(r.reason);
    const device = deviceCode(machineId());
    if (r.payload.device !== device) {
      throw new Error(`هذا المفتاح لجهازٍ آخر (${r.payload.device}) — ورمز هذا الجهاز ${device}`);
    }
    const key = String(raw).replace(/\s+/g, '');
    const keys = [...new Set([...(JSON.parse(setting('licenseKeys') ?? '[]') as string[]), key])];
    putSetting('licenseKeys', JSON.stringify(keys));
    const file = readFileStore();
    try {
      writeFileSync(fileOf(), JSON.stringify({ ...file, keys: [...new Set([...(file.keys ?? []), key])] }, null, 2));
    } catch {
      // في القاعدة يكفي.
    }
    logAudit(getDb(), 'license', r.payload.kind === 'full' ? 'activate' : 'extend', r.payload.kind === 'full' ? r.payload.office ?? null : `حتى ${r.payload.until}`);
    return licenseStatus(true);
  });
}
