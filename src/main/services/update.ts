/**
 * التحديث «أ+» (خطة Production، ٧٫١ — قرار المالك ٢ تشرين الأول ٢٠٢٦): المثبّت الكامل في ملفٍّ واحد
 * (`.diwanupdate`) يوقّعه المالك — ولا تحديث من الإنترنت.
 *
 * الملف أرشيفٌ فيه `update.json` (الإصدار، وبصمة المثبّت SHA-256 وحجمه، و«ما الجديد»، ويوم الإصدار —
 * وتوقيع المالك عليها كلّها بمفتاح التحديث، ومعه توقيعٌ بمفتاح التراخيص للإصدارات حتى ١٫٧٫١ — ر109) والمثبّت
 * `setup.exe`. والبرنامج يتحقّق من التوقيع، ولا يقبل
 * إصدارًا مثبّتًا أو أقدم، ويُطابق بصمة المثبّت بعد فكّه — فمثبّتٌ بُدّل في الطريق لا يُشغَّل.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { compareVersions } from '@shared/version';
import { extractEntry, readZipIndex, type ZipEntry } from './zip';

export type UpdateManifest = { app: 'diwan'; kind: 'update'; version: string; sha256: string; size: number; notes: string; issued: string };

/** الحمولة بترتيبٍ ثابت — ما يوقّعه المالك هو ما يُتحقّق منه. */
export function canonicalManifest(m: UpdateManifest): string {
  return JSON.stringify({ app: m.app, kind: m.kind, version: m.version, sha256: m.sha256, size: m.size, notes: m.notes, issued: m.issued });
}

export type OpenedUpdate = { manifest: UpdateManifest; installer: ZipEntry };

/** يقرأ ملفّ التحديث ويتحقّق من توقيعه وإصداره — قبل أن يُفكّ المثبّت أو يُسأل المكتب. */
export async function readUpdate(path: string, publicKeys: string | readonly string[], current: string, workDir: string): Promise<OpenedUpdate> {
  let entries: ZipEntry[];
  try {
    entries = await readZipIndex(path);
  } catch {
    throw new Error('الملف ليس تحديثًا لديوان');
  }
  const head = entries.find((e) => e.name === 'update.json');
  const installer = entries.find((e) => e.name === 'setup.exe');
  if (!head || !installer || head.size > 1 << 20) throw new Error('الملف ليس تحديثًا لديوان');
  mkdirSync(workDir, { recursive: true });
  const file = join(workDir, `update-${process.pid}-${Date.now()}.json`);
  let parsed: { manifest: UpdateManifest; signature: string; signatures?: unknown };
  try {
    await extractEntry(path, head, file);
    parsed = JSON.parse(readFileSync(file, 'utf8')) as { manifest: UpdateManifest; signature: string; signatures?: unknown };
  } catch {
    throw new Error('ملف التحديث معطوب');
  } finally {
    rmSync(file, { force: true });
  }
  const m = parsed?.manifest;
  // بأيٍّ من مفاتيح التحديث (و١٠: `update|both`) وأيٍّ من التوقيعات: `signature` تقرؤه الإصدارات كلّها، و`signatures`
  // (البند ٣٣) بمفتاح التحديث — فملفٌّ واحد للقديم والجديد. ومفتاحٌ عامٌّ تالف أو توقيعٌ تالف لا يُسقط الفحص بغيره.
  const signatures = [parsed?.signature, ...(Array.isArray(parsed?.signatures) ? parsed.signatures : [])].map((s) => String(s));
  let signed = false;
  for (const publicKey of typeof publicKeys === 'string' ? [publicKeys] : publicKeys) {
    for (const signature of signatures) {
      try {
        signed = verify(null, Buffer.from(canonicalManifest(m), 'utf8'), createPublicKey(publicKey), Buffer.from(signature, 'base64url'));
      } catch {
        signed = false;
      }
      if (signed) break;
    }
    if (signed) break;
  }
  if (!signed || m.app !== 'diwan' || m.kind !== 'update') throw new Error('التحديث غير موقّعٍ من المطوّر — لا يُثبَّت');
  if (compareVersions(m.version, current) <= 0) {
    throw new Error(compareVersions(m.version, current) === 0 ? `الإصدار ${m.version} مثبّتٌ الآن` : `هذا تحديثٌ إلى ${m.version} — أقدم من المثبّت (${current})`);
  }
  if (installer.size !== m.size) throw new Error('المثبّت في الملف غير ما وقّعه المطوّر — لا يُثبَّت');
  return { manifest: m, installer };
}

/** يفكّ المثبّت ويُطابق بصمته الموقّعة — وإلا مُحي ولم يُشغَّل. */
export async function extractInstaller(path: string, opened: OpenedUpdate, dest: string): Promise<string> {
  await extractEntry(path, opened.installer, dest);
  const hash = createHash('sha256');
  await pipeline(createReadStream(dest), hash);
  if (hash.digest('hex') !== opened.manifest.sha256) {
    rmSync(dest, { force: true });
    throw new Error('بصمة المثبّت لا تطابق ما وقّعه المطوّر — لا يُثبَّت');
  }
  return dest;
}
