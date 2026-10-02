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

describe('التحديث «أ+»', () => {
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
