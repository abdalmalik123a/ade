/**
 * التحديث «أ+» (خطة Production، ٧٫١): ملفٌّ يصنعه المالك بأداته ويقرؤه البرنامج — بتوقيعه، وبإصدارٍ أحدث،
 * وبمثبّتٍ تطابق بصمته ما وُقّع.
 */
import { execFileSync } from 'node:child_process';
import { createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractInstaller, readUpdate } from '../src/main/services/update';
import { extractEntry, readZipIndex } from '../src/main/services/zip';

const TOOL = join(process.cwd(), 'tools', 'license', 'keygen.mjs');

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-update-'));
  const key = join(dir, 'owner.pem');
  execFileSync(process.execPath, [TOOL, 'init', '--key', key]);
  const pub = createPublicKey(createPrivateKey(readFileSync(key, 'utf8'))).export({ type: 'spki', format: 'pem' }).toString();
  const exe = join(dir, 'diwan-1.1.0-setup.exe');
  writeFileSync(exe, randomBytes(400_000));
  const notes = join(dir, 'notes.md');
  writeFileSync(notes, '- **جديد**: شيءٌ نافع\n- إصلاح');
  execFileSync(process.execPath, [TOOL, 'update', exe, '--version', '1.1.0', '--notes', notes, '--key', key]);
  return { dir, key, pub, exe, file: join(dir, 'diwan-1.1.0.diwanupdate') };
}

// كلّ فحصٍ يشغّل أداة المالك مرّتين (مفتاحٌ ثم توقيع) — وتحت حمل البناء تتجاوز الخمس ثوانٍ الافتراضية فتسقط بوّابة الإصدار.
describe('التحديث «أ+»', { timeout: 30_000 }, () => {
  it('ما صنعته أداة المالك يقرؤه البرنامج: إصداره و«ما الجديد»، والمثبّت كما هو', async () => {
    const s = setup();
    const opened = await readUpdate(s.file, s.pub, '1.0.0', join(s.dir, 'work'));
    expect(opened.manifest).toMatchObject({ version: '1.1.0', notes: '- **جديد**: شيءٌ نافع\n- إصلاح', size: 400_000 });
    const out = await extractInstaller(s.file, opened, join(s.dir, 'setup.exe'));
    expect(readFileSync(out).equals(readFileSync(s.exe))).toBe(true);
  });

  it('والمثبّت مرّةً أخرى أو أقدم لا يُقبل', async () => {
    const s = setup();
    await expect(readUpdate(s.file, s.pub, '1.1.0', s.dir)).rejects.toThrow(/مثبّتٌ الآن/);
    await expect(readUpdate(s.file, s.pub, '1.2.0', s.dir)).rejects.toThrow(/أقدم من المثبّت/);
  });

  it('وما لم يوقّعه المالك — مفتاحٌ آخر — يُرفض', async () => {
    const s = setup();
    const other = setup();
    await expect(readUpdate(s.file, other.pub, '1.0.0', s.dir)).rejects.toThrow(/غير موقّعٍ من المطوّر/);
  });

  it('ومثبّتٌ بُدّل في الطريق يُرفض ولا يبقى منه شيء', async () => {
    const s = setup();
    const bytes = readFileSync(s.file);
    // يُقلب بايتٌ في وسط المثبّت المخزَّن: الحجم كما هو والبصمة لا.
    bytes[bytes.length - 200_000] ^= 0xff;
    writeFileSync(s.file, bytes);
    const opened = await readUpdate(s.file, s.pub, '1.0.0', s.dir);
    const dest = join(s.dir, 'bad.exe');
    await expect(extractInstaller(s.file, opened, dest)).rejects.toThrow(/معطوب|بصمة/);
    expect(existsSync(dest)).toBe(false);
  });

  it('وما ليس تحديثًا يُرفض', async () => {
    const s = setup();
    await expect(readUpdate(s.exe, s.pub, '1.0.0', s.dir)).rejects.toThrow(/ليس تحديثًا/);
  });
});

describe('التحديث بمفاتيح المالك (و١٠)', () => {
  it('موقَّعٌ بأيّ مفتاحٍ في قائمة التحديث يُقبل، وبمفتاحٍ خارجها يُرفض', async () => {
    const s = setup();
    const other = setup();
    const opened = await readUpdate(s.file, [other.pub, s.pub], '1.0.0', join(s.dir, 'work'));
    expect(opened.manifest.version).toBe('1.1.0');
    await expect(readUpdate(s.file, [other.pub], '1.0.0', s.dir)).rejects.toThrow(/غير موقّعٍ من المطوّر/);
    // ومفتاحٌ عامٌّ تالف في القائمة لا يُسقط الفحص بغيره.
    expect((await readUpdate(s.file, ['ليس مفتاحًا', s.pub], '1.0.0', join(s.dir, 'work2'))).manifest.version).toBe('1.1.0');
    await expect(readUpdate(s.file, [], '1.0.0', s.dir)).rejects.toThrow(/غير موقّعٍ من المطوّر/);
  }, 30_000);
});

/** `update.json` كما في الملفّ — بقارئ البرنامج نفسه. */
async function head(file: string, dir: string): Promise<{ signature: string; signatures?: string[] }> {
  const entry = (await readZipIndex(file)).find((e) => e.name === 'update.json')!;
  const out = join(dir, `head-${Date.now()}.json`);
  await extractEntry(file, entry, out);
  return JSON.parse(readFileSync(out, 'utf8'));
}

/** مفتاحٌ آخر بأداة المالك — ملفّه وعامُّه. */
function extraKey(dir: string, name: string): { key: string; pub: string } {
  const key = join(dir, `${name}.pem`);
  execFileSync(process.execPath, [TOOL, 'init', '--key', key]);
  return { key, pub: createPublicKey(createPrivateKey(readFileSync(key, 'utf8'))).export({ type: 'spki', format: 'pem' }).toString() };
}

describe('مفتاح التحديث بجانب مفتاح التراخيص (البند ٣٣)', { timeout: 60_000 }, () => {
  it('ملفٌّ واحد بتوقيعين: يقبله القديم (مفتاح التراخيص) والجديد (مفتاح التحديث وحده)، ويرفضه ثالث', async () => {
    const s = setup();
    const upd = extraKey(s.dir, 'update');
    const out = join(s.dir, 'dual.diwanupdate');
    execFileSync(process.execPath, [TOOL, 'update', s.exe, '--version', '1.1.0', '--notes', join(s.dir, 'notes.md'), '--key', s.key, '--update-key', upd.key, '--out', out]);
    expect((await head(out, s.dir)).signatures).toHaveLength(1);
    // إصدارٌ حتى 1.7.1 يعرف مفتاح التراخيص وحده (`both`) — فيقرأ `signature`.
    expect((await readUpdate(out, [s.pub], '1.0.0', join(s.dir, 'w1'))).manifest.version).toBe('1.1.0');
    // وما بعده يقبل التحديث بمفتاح التحديث وحده — فيقرأ `signatures`.
    expect((await readUpdate(out, [upd.pub], '1.0.0', join(s.dir, 'w2'))).manifest.version).toBe('1.1.0');
    await expect(readUpdate(out, [extraKey(s.dir, 'third').pub], '1.0.0', s.dir)).rejects.toThrow(/غير موقّعٍ من المطوّر/);
    // والملفّ بلا مفتاح تحديثٍ كما كان: بلا `signatures`.
    expect((await head(s.file, s.dir)).signatures).toBeUndefined();
  });

  it('وتوقيعٌ بمفتاحٍ لا يعرفه البرنامج في القائمة لا يقبل الملفّ ولا يمنع قبوله بالمعروف', async () => {
    const s = setup();
    const stranger = extraKey(s.dir, 'stranger');
    const out = join(s.dir, 'stranger.diwanupdate');
    execFileSync(process.execPath, [TOOL, 'update', s.exe, '--version', '1.1.0', '--notes', join(s.dir, 'notes.md'), '--key', s.key, '--update-key', stranger.key, '--out', out]);
    const other = extraKey(s.dir, 'other');
    await expect(readUpdate(out, [other.pub], '1.0.0', s.dir)).rejects.toThrow(/غير موقّعٍ من المطوّر/);
    expect((await readUpdate(out, [other.pub, s.pub], '1.0.0', join(s.dir, 'w3'))).manifest.version).toBe('1.1.0');
  });
});
