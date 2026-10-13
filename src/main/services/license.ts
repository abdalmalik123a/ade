/**
 * التفعيل بلا شبكة (خطة Production، ٦٫٢ — قرارات المالك ٢٩ أيلول و٢ تشرين الأول ٢٠٢٦).
 *
 * - **رمز الجهاز** من معرّف ويندوز للجهاز (MachineGuid) مبصومًا: يرسله المكتب إلى المالك بواتساب.
 * - **المفتاح** يوقّعه المالك بمفتاحه الخاصّ (Ed25519) لذلك الرمز وحده: «كامل» مدى الحياة، أو «اشتراك» شهريٌّ
 *   أو سنويٌّ إلى يومٍ بعينه (قرار المالك ٣ تشرين الأول ٢٠٢٦: أوّل عشرة مدى الحياة، وبعدهم يُسعَّر الشهري والسنوي
 *   ومدى الحياة)، أو «تمديد» للمدّة التجريبية. وفيه يوم إصداره — فسياسةٌ تتغيّر يومًا لا تمسّ ما صدر قبلها.
 * - **والاشتراك حين ينتهي** كالمدّة التجريبية حين تنتهي: تنبيهٌ قبله بأسبوع، ثم يتوقّف الإصدار والطباعة ويبقى
 *   العرض والنسخ حتى يُلصق مفتاح التجديد.
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
/** توقيعٌ لا يصحّ — أو مفتاحٌ مقطوع. */
const BAD_KEY = 'المفتاح غير صحيح — انسخه كاملًا كما وصلك';

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

export type SubscriptionPlan = 'monthly' | 'yearly';

export type LicensePayload = {
  v: 1;
  device: string;
  /** كامل مدى الحياة، أو اشتراكٌ إلى يوم، أو تمديدٌ للمدّة التجريبية. */
  kind: 'full' | 'sub' | 'extend';
  /** يوم الإصدار YYYY-MM-DD. */
  issued: string;
  /** للاشتراك: شهريٌّ أو سنوي. */
  plan?: SubscriptionPlan;
  /** للاشتراك والتمديد: آخر يومٍ يعمل فيه (شاملًا). */
  until?: string;
  /** اسم المكتب كما كتبه المالك — يُعرض في «التفعيل». */
  office?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** الحمولة بترتيبٍ ثابت — فما يوقّعه المالك هو ما يتحقّق منه البرنامج حرفًا بحرف. */
export function canonicalPayload(p: LicensePayload): string {
  const ordered: Record<string, unknown> = { v: p.v, device: p.device, kind: p.kind, issued: p.issued };
  if (p.plan) ordered['plan'] = p.plan;
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
  if (!good) return { ok: false, reason: BAD_KEY };
  let p: LicensePayload;
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LicensePayload;
  } catch {
    return { ok: false, reason: BAD_KEY };
  }
  if (p?.v !== 1 || typeof p.device !== 'string' || !['full', 'sub', 'extend'].includes(p.kind) || !DAY.test(p.issued ?? '')) {
    return { ok: false, reason: 'مفتاحٌ بصيغةٍ لا يعرفها هذا الإصدار — حدّث البرنامج' };
  }
  if (p.kind === 'extend' && !DAY.test(p.until ?? '')) return { ok: false, reason: 'مفتاح التمديد بلا يومٍ ينتهي إليه' };
  if (p.kind === 'sub' && (!DAY.test(p.until ?? '') || (p.plan !== 'monthly' && p.plan !== 'yearly'))) {
    return { ok: false, reason: 'مفتاح الاشتراك بلا خطّته أو يومٍ ينتهي إليه' };
  }
  return { ok: true, payload: p };
}

/**
 * يتحقّق من المفتاح بأيٍّ من مفاتيح المالك العامّة (و١٠) — أوّلُ توقيعٍ يصحّ يُقبل. وما فشل بغير التوقيع (ليس مفتاح
 * ديوان، أو صيغةٌ لا يعرفها الإصدار بتوقيعٍ صحيح) يُقال سببه كما هو؛ وإلا فـ«غير صحيح».
 */
export function readKeyWith(raw: string, publicKeys: readonly (string | KeyObject)[]): KeyCheck {
  for (const k of publicKeys) {
    const r = readKey(raw, k);
    if (r.ok || r.reason !== BAD_KEY) return r;
  }
  return { ok: false, reason: BAD_KEY };
}

/**
 * المفاتيح المحفوظة قائمةَ نصوص (و٣) — في القاعدة نصُّ JSON، وفي ملفّ الترخيص قائمة. وما فسد منها (ليس JSON، أو
 * ليس قائمة، أو فيها غير النصوص) فارغٌ لا خطأ: كان `JSON.parse` بلا حماية يرمي في `requireProductive` فيتوقّف الإصدار
 * كلّه — ولو كان المفتاح الصحيح في ملفّ الترخيص.
 */
export function keyList(raw: unknown): string[] {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((k): k is string => typeof k === 'string' && k.trim() !== '') : [];
}

/**
 * ملفّ الترخيص (`diwan-license.json`) مقروءًا بأنواعه (المحادثة ٦، البند ٢٦): وما فسد منه — ليس كائنًا (`null` أو قائمة أو نصّ)،
 * أو تاريخٌ ليس تاريخًا، أو مفاتيح ليست قائمة نصوص — يُترك ولا يُسقط حال الترخيص. كان `null` في الملفّ يرمي عند أوّل حقلٍ يُقرأ
 * فيتوقّف «التفعيل» وما يمرّ به من طباعةٍ وحفظ.
 */
export { RENEW_WARN_DAYS, MACHINE_GRACE_DAYS } from '@shared/license';
import { MACHINE_GRACE_DAYS } from '@shared/license';

/**
 * دالّة قراءة معرّف الجهاز (HKLM MachineGuid) القابلة للحقن مع إعادة المحاولة.
 */
export function readMachineGuid(reader: () => string | null, retries = 3): string | null {
  for (let i = 0; i < retries; i++) {
    try {
      const guid = reader();
      if (guid && typeof guid === 'string' && guid.trim()) {
        return guid.trim();
      }
    } catch {
      // إعادة المحاولة عند الفشل المؤقت
    }
  }
  return null;
}

/**
 * ملفّ الترخيص (`diwan-license.json`) مقروءًا بأنواعه: وما فسد منه يُترك ولا يُسقط حال الترخيص.
 */
export function storedLicense(raw: unknown): { trialStart?: string; lastSeen?: string; lastVerified?: string; keys: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { keys: [] };
  const r = raw as Record<string, unknown>;
  const date = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined);
  return { trialStart: date(r.trialStart), lastSeen: date(r.lastSeen), lastVerified: date(r.lastVerified), keys: keyList(r.keys) };
}

export type LicenseState =
  | { status: 'activated'; office: string | null; issued: string; unverified?: boolean; deviceWarning?: string }
  | { status: 'subscribed'; plan: SubscriptionPlan; daysLeft: number; lastDay: string; office: string | null; issued: string; unverified?: boolean; deviceWarning?: string; graceDaysLeft?: number }
  | { status: 'trial'; daysLeft: number; lastDay: string; extended: boolean; unverified?: boolean; deviceWarning?: string }
  /** `ended`: ما انتهى — المدّة التجريبية أم الاشتراك — فيُقال لصاحبه ما يفعل. */
  | { status: 'expired'; lastDay: string; ended: 'trial' | 'subscription' }
  | { status: 'unverified'; reason: 'machine_error'; lastDay?: string; deviceWarning?: string };

/** رقم اليوم بتقويم الجهاز — فالمدّة أيّامٌ تقويمية لا ساعات. */
export function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}
const dayOf = (s: string) => Math.floor(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86_400_000);
const dayString = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/**
 * حال البرنامج على هذا الجهاز مع معالجة فشل قراءة معرّف الجهاز (المرحلة A — ٤٫٢ والجواب ١ في §٨):
 * ١. إن تعذّرت القراءة وكانت التجربة سارية: تستمر التجربة مع تنبيه هادئ.
 * ٢. إن تعذّرت ومع البرنامج مفتاح سبق التحقق منه: مهلة سماح ٧ أيام من أقدم تاريخ تحقق محفوظ.
 * ٣. بعد انتهاء المهلة أو بلا مفتاح سابق: حجب المخرجات برسالة تعذر القراءة لا انتهاء الصلاحية.
 * ٤. ما فُعّل على البديل hostname|username يبقى مفعّلًا.
 */
export function evaluate(opts: {
  now: Date;
  trialStart: Date;
  lastSeen?: Date | null;
  keys: LicensePayload[];
  device: string;
  fallbackDevice?: string;
  machineGuidVerified?: boolean;
  lastVerified?: Date | null;
}): LicenseState {
  const isMachineVerified = opts.machineGuidVerified !== false;
  let matchedOnFallback = false;
  let mine: LicensePayload[] = [];

  if (isMachineVerified) {
    mine = opts.keys.filter((k) => k.device === opts.device || (opts.fallbackDevice && k.device === opts.fallbackDevice));
  } else {
    // فشلت قراءة معرّف الجهاز
    if (opts.fallbackDevice && opts.keys.some((k) => k.device === opts.fallbackDevice)) {
      mine = opts.keys.filter((k) => k.device === opts.fallbackDevice);
      matchedOnFallback = true;
    } else if (opts.lastVerified) {
      // مفتاح سبق التحقق منه على هذا الجهاز ومعه تاريخ آخر تحقق
      mine = opts.keys;
    }
  }

  const today = Math.max(dayNumber(opts.now), opts.lastSeen ? dayNumber(opts.lastSeen) : -Infinity);
  const trialEnd = dayNumber(opts.trialStart) + TRIAL_DAYS;
  const full = mine.filter((k) => k.kind === 'full').sort((a, b) => a.issued.localeCompare(b.issued))[0];

  if (full) {
    if (!isMachineVerified && !matchedOnFallback) {
      const daysSinceVerified = opts.lastVerified ? Math.max(0, today - dayNumber(opts.lastVerified)) : Infinity;
      if (daysSinceVerified <= MACHINE_GRACE_DAYS) {
        return {
          status: 'activated',
          office: full.office ?? null,
          issued: full.issued,
          unverified: true,
          deviceWarning: 'تعذّر التحقّق من الجهاز — أعد تشغيل البرنامج، وإن استمرّ فاتّصل بالمطوّر'
        };
      }
      return {
        status: 'unverified',
        reason: 'machine_error',
        deviceWarning: 'تعذّر قراءة معرّف الجهاز — أعد المحاولة، وإن استمرّ العطل فاتّصل بالمطوّر'
      };
    }
    return { status: 'activated', office: full.office ?? null, issued: full.issued };
  }

  // الاشتراك: أبعد يومٍ في مفاتيحه
  const subs = mine.filter((k) => k.kind === 'sub').sort((a, b) => a.until!.localeCompare(b.until!));
  const latest = subs.at(-1);
  const subEnd = latest ? dayOf(latest.until!) + 1 : -Infinity;
  if (latest && today < subEnd) {
    if (!isMachineVerified && !matchedOnFallback) {
      const daysSinceVerified = opts.lastVerified ? Math.max(0, today - dayNumber(opts.lastVerified)) : Infinity;
      if (daysSinceVerified <= MACHINE_GRACE_DAYS) {
        return {
          status: 'subscribed',
          plan: latest.plan!,
          daysLeft: subEnd - today,
          lastDay: latest.until!,
          office: latest.office ?? null,
          issued: latest.issued,
          unverified: true,
          graceDaysLeft: MACHINE_GRACE_DAYS - daysSinceVerified,
          deviceWarning: 'تعذّر التحقّق من الجهاز — أعد تشغيل البرنامج، وإن استمرّ فاتّصل بالمطوّر'
        };
      }
      return {
        status: 'unverified',
        reason: 'machine_error',
        deviceWarning: 'تعذّر قراءة معرّف الجهاز — أعد المحاولة، وإن استمرّ العطل فاتّصل بالمطوّر'
      };
    }
    return { status: 'subscribed', plan: latest.plan!, daysLeft: subEnd - today, lastDay: latest.until!, office: latest.office ?? null, issued: latest.issued };
  }

  const extended = Math.max(...mine.filter((k) => k.kind === 'extend').map((k) => dayOf(k.until!) + 1), -Infinity);
  const end = Math.max(trialEnd, extended);
  if (today < end) {
    return {
      status: 'trial',
      daysLeft: end - today,
      lastDay: dayString(end - 1),
      extended: extended > trialEnd,
      unverified: !isMachineVerified,
      deviceWarning: !isMachineVerified ? 'تعذّر التحقّق من الجهاز' : undefined
    };
  }

  if (!isMachineVerified) {
    return {
      status: 'unverified',
      reason: 'machine_error',
      lastDay: dayString(end - 1),
      deviceWarning: 'تعذّر قراءة معرّف الجهاز — أعد المحاولة، وإن استمرّ العطل فاتّصل بالمطوّر'
    };
  }

  return latest && subEnd >= end
    ? { status: 'expired', lastDay: latest.until!, ended: 'subscription' }
    : { status: 'expired', lastDay: dayString(end - 1), ended: 'trial' };
}
