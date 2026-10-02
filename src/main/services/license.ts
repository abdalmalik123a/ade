/**
 * التفعيل بلا شبكة (خطة Production، ٦٫٢ — قرارات المالك ٢٩ أيلول و٢ تشرين الأول ٢٠٢٦).
 *
 * - **رمز الجهاز** من معرّف ويندوز للجهاز (MachineGuid) مبصومًا: يرسله المكتب إلى المالك بواتساب.
 * - **المفتاح** يوقّعه المالك بمفتاحه الخاصّ (Ed25519) لذلك الرمز وحده: «كامل» مدى الحياة، أو «تمديد»
 *   للمدّة التجريبية إلى يومٍ بعينه. وفيه يوم إصداره — فسياسةٌ تتغيّر يومًا لا تمسّ ما صدر قبلها.
 *   والبرنامج يحمل المفتاح العامّ وحده: لا يصنع مفتاحًا، ولا يتّصل بأحد.
 * - **المدّة التجريبية** ١٤ يومًا تقويمية من أوّل تشغيل: كلّ شيءٍ يعمل بلا علامةٍ على الورق. وبعدها يبقى
 *   العرض والبحث والنسخ والتصدير، ويتوقّف الإصدار والطباعة وإخراج الأوراق — ولا تُقفل بيانات أحد أبدًا.
 *
 * والحساب هنا خالصٌ يُختبر بلا Electron؛ وأين يُحفظ وما يُمنع ففي ipc/license.ts.
 */
import { createHash, createPublicKey, verify, type KeyObject } from 'node:crypto';

export const TRIAL_DAYS = 14;
/** Crockford: بلا I وL وO وU — فلا يُخلط حرفٌ برقمٍ حين يُقرأ على الهاتف. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIX = 'DIWAN-';

/** `DWN-XXXX-XXXX-XXXX-XXXX` — ٨٠ بتًّا من بصمة معرّف الجهاز. */
export function deviceCode(machineId: string): string {
  const bytes = createHash('sha256').update(`diwan-device|${machineId.trim().toLowerCase()}`).digest().subarray(0, 10);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return `DWN-${out.match(/.{4}/g)!.join('-')}`;
}

/** الرمز كما يكتبه الناس: صغيرًا، بمسافات، بـO مكان 0 — يُعاد إلى صيغته. */
export function normalizeDeviceCode(code: string): string {
  const body = code
    .toUpperCase()
    .replace(/^DWN/, '')
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return body.length === 16 ? `DWN-${body.match(/.{4}/g)!.join('-')}` : code.trim().toUpperCase();
}

export type LicensePayload = {
  v: 1;
  device: string;
  kind: 'full' | 'extend';
  /** يوم الإصدار YYYY-MM-DD. */
  issued: string;
  /** للتمديد: آخر يومٍ تعمل فيه المدّة (شاملًا). */
  until?: string;
  /** اسم المكتب كما كتبه المالك — يُعرض في «التفعيل». */
  office?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** الحمولة بترتيبٍ ثابت — فما يوقّعه المالك هو ما يتحقّق منه البرنامج حرفًا بحرف. */
export function canonicalPayload(p: LicensePayload): string {
  const ordered: Record<string, unknown> = { v: p.v, device: p.device, kind: p.kind, issued: p.issued };
  if (p.until) ordered['until'] = p.until;
  if (p.office) ordered['office'] = p.office;
  return JSON.stringify(ordered);
}

/** يصنع المفتاح من حمولةٍ وتوقيع — للأداة والاختبار؛ البرنامج نفسه لا يوقّع شيئًا. */
export function encodeKey(p: LicensePayload, sign: (data: Buffer) => Buffer): string {
  const body = Buffer.from(canonicalPayload(p), 'utf8').toString('base64url');
  return `${PREFIX}${body}.${sign(Buffer.from(body, 'utf8')).toString('base64url')}`;
}

export type KeyCheck = { ok: true; payload: LicensePayload } | { ok: false; reason: string };

/** يتحقّق من المفتاح بتوقيعه — ولو لُصق من واتساب بأسطرٍ ومسافات. */
export function readKey(raw: string, publicKey: string | KeyObject): KeyCheck {
  const key = raw.replace(/\s+/g, '');
  if (!key.startsWith(PREFIX) || !key.includes('.')) return { ok: false, reason: 'هذا ليس مفتاح تفعيلٍ لديوان' };
  const [body, sig] = key.slice(PREFIX.length).split('.', 2) as [string, string];
  let good = false;
  try {
    const pub = typeof publicKey === 'string' ? createPublicKey(publicKey) : publicKey;
    good = verify(null, Buffer.from(body, 'utf8'), pub, Buffer.from(sig, 'base64url'));
  } catch {
    good = false;
  }
  if (!good) return { ok: false, reason: 'المفتاح غير صحيح — انسخه كاملًا كما وصلك' };
  let p: LicensePayload;
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LicensePayload;
  } catch {
    return { ok: false, reason: 'المفتاح غير صحيح — انسخه كاملًا كما وصلك' };
  }
  if (p?.v !== 1 || typeof p.device !== 'string' || (p.kind !== 'full' && p.kind !== 'extend') || !DAY.test(p.issued ?? '')) {
    return { ok: false, reason: 'مفتاحٌ بصيغةٍ لا يعرفها هذا الإصدار — حدّث البرنامج' };
  }
  if (p.kind === 'extend' && !DAY.test(p.until ?? '')) return { ok: false, reason: 'مفتاح التمديد بلا يومٍ ينتهي إليه' };
  return { ok: true, payload: p };
}

export type LicenseState =
  | { status: 'activated'; office: string | null; issued: string }
  | { status: 'trial'; daysLeft: number; lastDay: string; extended: boolean }
  | { status: 'expired'; lastDay: string };

/** رقم اليوم بتقويم الجهاز — فالمدّة أيّامٌ تقويمية لا ساعات. */
export function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}
const dayOf = (s: string) => Math.floor(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86_400_000);
const dayString = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/**
 * حال البرنامج على هذا الجهاز. و`lastSeen` أحدث يومٍ رآه البرنامج: ساعةٌ أُرجعت لا تُطيل المدّة.
 * والمفاتيح ما تحقّق توقيعه منها لهذا الجهاز وحده.
 */
export function evaluate(opts: { now: Date; trialStart: Date; lastSeen?: Date | null; keys: LicensePayload[]; device: string }): LicenseState {
  const mine = opts.keys.filter((k) => k.device === opts.device);
  const full = mine.filter((k) => k.kind === 'full').sort((a, b) => a.issued.localeCompare(b.issued))[0];
  if (full) return { status: 'activated', office: full.office ?? null, issued: full.issued };
  const today = Math.max(dayNumber(opts.now), opts.lastSeen ? dayNumber(opts.lastSeen) : -Infinity);
  const trialEnd = dayNumber(opts.trialStart) + TRIAL_DAYS;
  const extended = Math.max(...mine.filter((k) => k.kind === 'extend').map((k) => dayOf(k.until!) + 1), -Infinity);
  const end = Math.max(trialEnd, extended);
  const lastDay = dayString(end - 1);
  return today < end ? { status: 'trial', daysLeft: end - today, lastDay, extended: extended > trialEnd } : { status: 'expired', lastDay };
}
