/**
 * فتح «الحزمة المختومة» (S48، D203) — الصيغة في `@shared/sealedPack`، والكاتب في `tools/keytool/core.mjs`.
 *
 * بالترتيب ولا يُقرأ شيءٌ من القطع قبله: الرأس وحدوده ← الختم بأيّ مفتاحٍ للتحديث ← بصمة الحمولة تدفّقًا ← الفكّ تدفّقًا إلى ملفٍّ
 * مؤقّت ووسم GCM ← القائمة وبصمة كلّ قطعة. ويعيد القطع ملفّاتٍ مؤقّتة و`cleanup` يحذفها — يُنادى دائمًا.
 */
import { createDecipheriv, createHash, createPublicKey, hkdfSync, verify, type KeyObject } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync, openSync, readSync, closeSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import {
  SEAL_CONTEXT,
  SEAL_ERRORS,
  SEAL_HKDF,
  SEAL_LIMITS,
  SEAL_MAGIC,
  validHead,
  validItems,
  type SealHead,
  type SealItemExt
} from '@shared/sealedPack';

export type OpenedSeal = { head: SealHead; items: { name: string; ext: SealItemExt; path: string }[]; cleanup: () => void };

const fail = (msg: string): never => {
  throw new Error(msg);
};

/** معرّف المفتاح ومفتاح التشفير من المفتاح العامّ (كما في الكاتب). */
export function sealKeys(publicKey: KeyObject | string): { keyId: string; content: Buffer } {
  const der = (typeof publicKey === 'string' ? createPublicKey(publicKey) : publicKey).export({ type: 'spki', format: 'der' });
  return {
    keyId: createHash('sha256').update(der).digest('hex').slice(0, 16),
    content: Buffer.from(hkdfSync('sha256', der, Buffer.from(SEAL_HKDF.salt), Buffer.from(SEAL_HKDF.info), 32))
  };
}

/** يقرأ `length` بايتًا من `at` — أو أقلّ عند نهاية الملفّ. */
function readAt(fd: number, at: number, length: number): Buffer {
  const buf = Buffer.alloc(length);
  const n = readSync(fd, buf, 0, length, at);
  return buf.subarray(0, n);
}

export async function openSealedPack(path: string, publicKeys: readonly string[], workDir: string): Promise<OpenedSeal> {
  const fileSize = statSync(path).size;
  if (fileSize > SEAL_LIMITS.pack + SEAL_LIMITS.head + SEAL_LIMITS.signature + 64) fail(SEAL_ERRORS.tooBig);
  const magic = Buffer.from(SEAL_MAGIC, 'utf8');

  // ── الرأس والختم ──────────────────────────────────────────────────────
  const fd = openSync(path, 'r');
  let head: SealHead;
  let headBytes: Buffer;
  let signature: Buffer;
  let bodyAt: number;
  try {
    if (!readAt(fd, 0, magic.length).equals(magic)) fail(SEAL_ERRORS.notPack);
    const headLen = readAt(fd, magic.length, 4).readUInt32BE(0);
    if (headLen < 2 || headLen > SEAL_LIMITS.head) fail(SEAL_ERRORS.notPack);
    headBytes = readAt(fd, magic.length + 4, headLen);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(headBytes.toString('utf8'));
    } catch {
      fail(SEAL_ERRORS.notPack);
    }
    head = validHead(parsed) ?? fail(SEAL_ERRORS.notPack);
    const sigAt = magic.length + 4 + headLen;
    const sigLen = readAt(fd, sigAt, 4).readUInt32BE(0);
    if (sigLen < 1 || sigLen > SEAL_LIMITS.signature) fail(SEAL_ERRORS.notPack);
    signature = readAt(fd, sigAt + 4, sigLen);
    bodyAt = sigAt + 4 + sigLen;
  } catch (e) {
    closeSync(fd);
    throw e instanceof RangeError ? new Error(SEAL_ERRORS.notPack) : e;
  }
  closeSync(fd);

  const signed = Buffer.concat([Buffer.from(SEAL_CONTEXT, 'utf8'), headBytes]);
  let content: Buffer | null = null;
  for (const pem of publicKeys) {
    try {
      const key = createPublicKey(pem);
      if (verify(null, signed, key, signature)) {
        content = sealKeys(key).content;
        break;
      }
    } catch {
      // مفتاحٌ عامٌّ تالف لا يُسقط الفحص بغيره.
    }
  }
  if (!content) fail(SEAL_ERRORS.unsigned);
  if (fileSize !== bodyAt + head.size) fail(SEAL_ERRORS.tampered);

  // ── بصمة الحمولة قبل الفكّ ───────────────────────────────────────────
  const hash = createHash('sha256');
  await pipeline(createReadStream(path, { start: bodyAt, end: fileSize - 1 }), hash);
  if (hash.digest('hex') !== head.sha256) fail(SEAL_ERRORS.tampered);

  // ── الفكّ إلى ملفٍّ مؤقّت ─────────────────────────────────────────────
  mkdirSync(workDir, { recursive: true });
  const dir = join(workDir, `seal-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  try {
    const tagAt = fileSize - 16;
    const tfd = openSync(path, 'r');
    const tag = readAt(tfd, tagAt, 16);
    closeSync(tfd);
    const decipher = createDecipheriv('aes-256-gcm', content!, Buffer.from(head.iv, 'base64url'));
    decipher.setAuthTag(tag);
    const plain = join(dir, 'payload.bin');
    try {
      await pipeline(createReadStream(path, { start: bodyAt, end: tagAt - 1 }), decipher, createWriteStream(plain));
    } catch {
      fail(SEAL_ERRORS.tampered);
    }

    // ── القائمة والقطع ──────────────────────────────────────────────────
    const pfd = openSync(plain, 'r');
    const plainSize = statSync(plain).size;
    let listLen: number;
    let list: unknown = null;
    try {
      listLen = readAt(pfd, 0, 4).readUInt32BE(0);
      if (listLen < 2 || listLen > SEAL_LIMITS.list || 4 + listLen > plainSize) fail(SEAL_ERRORS.tampered);
      try {
        list = JSON.parse(readAt(pfd, 4, listLen).toString('utf8'));
      } catch {
        fail(SEAL_ERRORS.tampered);
      }
    } finally {
      closeSync(pfd);
    }
    const items = validItems(list, plainSize - 4 - listLen!) ?? fail(SEAL_ERRORS.tampered);
    const out: OpenedSeal['items'] = [];
    let at = 4 + listLen!;
    for (const [i, it] of items.entries()) {
      const file = join(dir, `${String(i).padStart(4, '0')}.${it.ext}`);
      const h = createHash('sha256');
      const tee = new Transform({
        transform(chunk: Buffer, _enc, done) {
          h.update(chunk);
          done(null, chunk);
        }
      });
      await pipeline(createReadStream(plain, { start: at, end: at + it.size - 1 }), tee, createWriteStream(file));
      if (h.digest('hex') !== it.sha256) fail(SEAL_ERRORS.tampered);
      out.push({ name: it.name, ext: it.ext, path: file });
      at += it.size;
    }
    rmSync(plain, { force: true });
    return { head, items: out, cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}
