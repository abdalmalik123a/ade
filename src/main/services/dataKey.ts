/**
 * مفتاح بيانات المكتب ورمز استرداده (D237، ر190 §٢–٣).
 *
 * لكلّ مكتبٍ مفتاحٌ عشوائيّ واحد (٣٢ بايتًا) تُشفَّر به بياناته (D238 وD239). يُحفظ في `keys.json` بمجلّد البيانات
 * **مرّتين**: محميًّا بحماية ويندوز (DPAPI عبر `safeStorage` — يُحقن هنا فيُختبر بلا برنامج)، ومحميًّا بمفتاحٍ من
 * scrypt على **رمز الاسترداد** الذي يُعطى للمكتب مرّة. فإن أُعيد تنصيب ويندوز أو تغيّر الحساب فلا تفتحه DPAPI،
 * ويفتحه الرمز ثم يُعاد تغليفه لحماية ويندوز الجديدة.
 *
 * ومفتاحٌ مفقود والبيانات مشفّرة (`sealed.flag`، يكتبه أوّل تشفير) خطأٌ صريح — لا مفتاحٌ جديد يجعل القديم لا يُقرأ.
 * والرمز نفسه يُحفظ بحماية ويندوز وحدها لتعرضه الإعدادات، ولا يُكتب في سجلٍّ ولا تقرير.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const KEYS_NAME = 'keys.json';
/** يكتبه أوّل تشفيرٍ لبيانات المكتب (D238): بعده لا يُنشأ مفتاحٌ جديد بدل مفقود. */
export const SEALED_NAME = 'sealed.flag';
/** أبجديةٌ بلا ما يلتبس (0/O و1/I/L): ٢٤ حرفًا منها نحو ١١٨ بتًّا. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 24;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const CHECK = 'diwan-office-key';

/** حماية ويندوز (DPAPI): `safeStorage` في البرنامج، وبديلٌ في الاختبار. */
export interface Protector {
  encrypt(text: string): Buffer;
  /** يرمي إن تعذّر الفكّ (حسابٌ آخر أو ويندوز أُعيد تنصيبه). */
  decrypt(data: Buffer): string;
}

interface KeysFile {
  v: 1;
  /** المفتاح بحماية ويندوز. */
  dpapiKey: string;
  /** الرمز بحماية ويندوز — لتعرضه الإعدادات. */
  dpapiCode: string;
  /** المفتاح مشفّرًا بمفتاحٍ من الرمز. */
  recovery: { salt: string; sealed: string };
  /** نصٌّ معروفٌ مشفّرٌ بالمفتاح: يُعرف به أنّ ما فُكّ هو مفتاح هذا المكتب. */
  check: string;
  /** أقرّ المكتب أنّه حفظ الرمز — وإلا عُرض عليه. */
  acknowledged: boolean;
}

export class KeyMissingError extends Error {
  constructor() {
    super('مفتاح بيانات المكتب مفقود أو تالف، والبيانات مشفّرة به — لن يُنشأ مفتاحٌ جديد يجعلها لا تُقرأ');
    this.name = 'KeyMissingError';
  }
}

/** تعذّرت حماية ويندوز نفسها (PowerShell مقيّدٌ أو غائب) — لا المفتاح ولا الرمز (D240). */
export class ProtectorError extends Error {
  constructor(cause: unknown) {
    super(`تعذّرت حماية ويندوز (DPAPI) لمفتاح بيانات المكتب: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'ProtectorError';
  }
}

function protect(protector: Protector, text: string): string {
  try {
    return protector.encrypt(text).toString('base64');
  } catch (e) {
    throw new ProtectorError(e);
  }
}

export function seal(plain: Uint8Array, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function unseal(data: Uint8Array, key: Buffer): Buffer {
  const buf = Buffer.from(data);
  const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

/** رمزٌ جديد: ٢٤ حرفًا في ستّ مجموعات (`ABCD-EFGH-…`). */
export function newRecoveryCode(random: (n: number) => Buffer = randomBytes): string {
  const out: string[] = [];
  while (out.length < CODE_LENGTH) {
    for (const b of random(CODE_LENGTH)) {
      // رفضٌ لما فوق مضاعف طول الأبجدية: توزيعٌ متساوٍ بلا انحياز.
      if (b < 248 && out.length < CODE_LENGTH) out.push(ALPHABET[b % ALPHABET.length]!);
    }
  }
  return out.join('').match(/.{4}/g)!.join('-');
}

/** ما كتبه المكتب بحروفٍ صغيرة أو بلا شرطات أو بمسافات — يُقرأ كما هو. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const codeKey = (code: string, salt: Buffer): Buffer => scryptSync(normalizeCode(code), salt, 32, SCRYPT);

const keysFile = (dir: string): string => join(dir, KEYS_NAME);

export const hasKeys = (dir: string): boolean => existsSync(keysFile(dir));
export const isSealed = (dir: string): boolean => existsSync(join(dir, SEALED_NAME));

function readKeys(dir: string): KeysFile {
  try {
    const raw = JSON.parse(readFileSync(keysFile(dir), 'utf8')) as Partial<KeysFile>;
    if (raw.v !== 1 || !raw.dpapiKey || !raw.recovery?.salt || !raw.recovery.sealed || !raw.check) throw new Error('صيغة');
    return raw as KeysFile;
  } catch {
    throw new KeyMissingError();
  }
}

function writeKeys(dir: string, keys: KeysFile): void {
  const file = keysFile(dir);
  writeFileSync(`${file}.tmp`, JSON.stringify(keys, null, 2), 'utf8');
  renameSync(`${file}.tmp`, file);
}

const isOfficeKey = (keys: KeysFile, key: Buffer): boolean => {
  try {
    return unseal(Buffer.from(keys.check, 'base64'), key).toString() === CHECK;
  } catch {
    return false;
  }
};

function wrapCode(key: Buffer, code: string): KeysFile['recovery'] {
  const salt = randomBytes(16);
  return { salt: salt.toString('base64'), sealed: seal(key, codeKey(code, salt)).toString('base64') };
}

/** أوّل مرّة: مفتاحٌ ورمزٌ جديدان. لا يُكتب فوق مفتاحٍ قائم، ولا يُنشأ والبيانات مشفّرة بلا مفتاح. */
export function createKey(dir: string, protector: Protector): { key: Buffer; code: string } {
  if (hasKeys(dir)) throw new Error('لمكتبٍ واحدٍ مفتاحٌ واحد — والمفتاح موجود');
  if (isSealed(dir)) throw new KeyMissingError();
  const key = randomBytes(32);
  const code = newRecoveryCode();
  // التغليف قبل الكتابة: تعذُّر حماية ويندوز (ProtectorError) لا يترك keys.json ناقصًا.
  const dpapiKey = protect(protector, key.toString('base64'));
  const dpapiCode = protect(protector, code);
  writeKeys(dir, {
    v: 1,
    dpapiKey,
    dpapiCode,
    recovery: wrapCode(key, code),
    check: seal(Buffer.from(CHECK), key).toString('base64'),
    acknowledged: false
  });
  return { key, code };
}

/** بحماية ويندوز — و`null` إن تعذّرت (فيُطلب الرمز). */
export function unlockWithProtector(dir: string, protector: Protector): Buffer | null {
  const keys = readKeys(dir);
  try {
    const key = Buffer.from(protector.decrypt(Buffer.from(keys.dpapiKey, 'base64')), 'base64');
    return isOfficeKey(keys, key) ? key : null;
  } catch {
    return null;
  }
}

/** بالرمز — ثم يُعاد تغليف المفتاح والرمز لحماية ويندوز الحاليّة. ورمزٌ خاطئ يرمي ولا يغيّر شيئًا. */
export function unlockWithCode(dir: string, code: string, protector: Protector): Buffer {
  const keys = readKeys(dir);
  let key: Buffer;
  try {
    key = unseal(Buffer.from(keys.recovery.sealed, 'base64'), codeKey(code, Buffer.from(keys.recovery.salt, 'base64')));
  } catch {
    throw new Error('رمز الاسترداد غير صحيح');
  }
  if (!isOfficeKey(keys, key)) throw new Error('رمز الاسترداد غير صحيح');
  // إعادة التغليف لحماية ويندوز الحاليّة جهدٌ لا شرط (D240): إن تعذّرت فُتحت البيانات وبقي الملفّ، ويُسأل الرمز في التشغيل التالي.
  try {
    writeKeys(dir, { ...keys, dpapiKey: protect(protector, key.toString('base64')), dpapiCode: protect(protector, code) });
  } catch (e) {
    if (!(e instanceof ProtectorError)) throw e;
  }
  return key;
}

/** الرمز الحاليّ لتعرضه الإعدادات — و`null` إن تعذّرت حماية ويندوز. */
export function storedCode(dir: string, protector: Protector): string | null {
  try {
    return protector.decrypt(Buffer.from(readKeys(dir).dpapiCode, 'base64'));
  } catch {
    return null;
  }
}

/** رمزٌ جديد يُبطل القديم، ويُعرض حتى يقرّ المكتب بحفظه. */
export function renewCode(dir: string, key: Buffer, protector: Protector): string {
  const keys = readKeys(dir);
  if (!isOfficeKey(keys, key)) throw new Error('ليس مفتاح هذا المكتب');
  const code = newRecoveryCode();
  writeKeys(dir, { ...keys, dpapiCode: protect(protector, code), recovery: wrapCode(key, code), acknowledged: false });
  return code;
}

export const needsAcknowledge = (dir: string): boolean => hasKeys(dir) && !readKeys(dir).acknowledged;

export function acknowledge(dir: string): void {
  writeKeys(dir, { ...readKeys(dir), acknowledged: true });
}

let officeKey: Buffer | null = null;

/** المفتاح المفتوح في هذه الجلسة (يضبطه الإقلاع) — ولا يُكتب إلى قرصٍ ولا سجلّ. */
export function rememberKey(key: Buffer | null): void {
  officeKey = key;
}

export function currentKey(): Buffer | null {
  return officeKey;
}
