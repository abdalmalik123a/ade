/**
 * الأرشيف ملفًّا ملفًّا (خطة Production، ٤٫١): ما يكتبه `ZipWriter` يقرؤه `readZipIndex` و`extractEntry`
 * — بالصيغة العادية وبـZIP64 — ومضغوطًا ومخزَّنًا، بأسماءٍ عربية.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { ZipWriter, extractEntry, fileSink, readZipIndex, safeInnerPath } from '../src/main/services/zip';

async function build(dir: string, name: string, force64: boolean): Promise<{ zip: string; big: Buffer }> {
  const big = randomBytes(300_000);
  writeFileSync(join(dir, 'big.bin'), big);
  const zip = join(dir, name);
  const sink = await fileSink(zip);
  const w = new ZipWriter(sink, { force64 });
  await w.addBuffer('اقرأني.txt', Buffer.from('ديوان '.repeat(500)));
  await w.addFile('store/صور/big.bin', join(dir, 'big.bin'), false);
  await w.addBuffer('فارغ.txt', Buffer.alloc(0));
  await w.finish();
  await sink.close();
  return { zip, big };
}

describe('الأرشيف ملفًّا ملفًّا', () => {
  for (const force64 of [false, true]) {
    it(`يُقرأ ما كُتب${force64 ? ' بـZIP64' : ''}: الأسماء والأحجام والبايتات`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'diwan-zip-'));
      const { zip, big } = await build(dir, 'a.zip', force64);
      const entries = await readZipIndex(zip);
      expect(entries.map((e) => e.name)).toEqual(['اقرأني.txt', 'store/صور/big.bin', 'فارغ.txt']);
      expect(entries.map((e) => e.method)).toEqual([8, 0, 8]);
      expect(entries[1]!.size).toBe(big.length);
      await extractEntry(zip, entries[1]!, join(dir, 'out.bin'));
      expect(readFileSync(join(dir, 'out.bin')).equals(big)).toBe(true);
      await extractEntry(zip, entries[0]!, join(dir, 'out.txt'));
      expect(readFileSync(join(dir, 'out.txt'), 'utf8')).toBe('ديوان '.repeat(500));
      await extractEntry(zip, entries[2]!, join(dir, 'empty.txt'));
      expect(readFileSync(join(dir, 'empty.txt')).length).toBe(0);
    });
  }

  it('والعادية تفتحها مكتبةٌ أخرى كما هي — صيغةٌ قياسية لا خاصّة بالبرنامج', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-zip-'));
    const { zip, big } = await build(dir, 'b.zip', false);
    const files = unzipSync(readFileSync(zip));
    expect(Object.keys(files).sort()).toEqual(['store/صور/big.bin', 'اقرأني.txt', 'فارغ.txt'].sort());
    expect(Buffer.from(files['store/صور/big.bin']!).equals(big)).toBe(true);
  });

  it('ومسارٌ يخرج من مجلّده يُرفض', () => {
    for (const bad of ['../x', 'a/../../x', '/etc/x', 'C:/x', 'a//b', '']) expect(safeInnerPath(bad)).toBe(false);
    for (const ok of ['a.png', 'documents/م-1.pdf', 'a/b/c.txt']) expect(safeInnerPath(ok)).toBe(true);
  });
});
