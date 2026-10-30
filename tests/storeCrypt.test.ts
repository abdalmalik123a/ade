/**
 * تشفير ملفّات المخزن الخاصّة (D238): ما يُشفَّر وما يبقى، والفكّ، والوسم المعطوب، والترحيل الذي يُستأنف.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }));
const { bytesFor, isPrivate, isSealedBytes, openBytes, sealBytes, sealExisting } = await import('../src/main/services/storeCrypt');

const KEY = randomBytes(32);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), randomBytes(5000)]);

describe('ما يُشفَّر', () => {
  it('المستمسكات والصور والكتب الصادرة والمسوح العابرة — لا أصول التصميم', () => {
    for (const rel of ['attachments/scan.png', 'photos/a.png', 'documents/1-2026.pdf', 'tmp/scan.png', 'attachments\\x.jpg']) expect(isPrivate(rel), rel).toBe(true);
    for (const rel of ['images/a.png', 'fonts/x.woff2', 'letterheads/h.png', 'logos/l.png', 'suits/s.png', 'designs/d.json', 'elements/e.svg']) expect(isPrivate(rel), rel).toBe(false);
    expect(bytesFor('images/a.png', PNG, KEY)).toBe(PNG);
    expect(isSealedBytes(bytesFor('photos/a.png', PNG, KEY))).toBe(true);
    expect(bytesFor('photos/a.png', PNG, null)).toBe(PNG);
  });
});

describe('الفكّ', () => {
  it('المشفَّر يُفكّ كما كان، والواضح القديم يُقرأ كما هو', () => {
    const sealed = sealBytes(PNG, KEY);
    expect(sealed.subarray(0, 4).equals(PNG.subarray(0, 4))).toBe(false);
    expect(openBytes(sealed, KEY).equals(PNG)).toBe(true);
    expect(openBytes(PNG, null).equals(PNG)).toBe(true);
  });

  it('وسمٌ معطوب أو مفتاحٌ آخر أو لا مفتاح: خطأٌ لا بايتاتٌ فاسدة', () => {
    const sealed = sealBytes(PNG, KEY);
    const broken = Buffer.from(sealed);
    broken[broken.length - 1] ^= 0xff;
    expect(() => openBytes(broken, KEY)).toThrow(/معطوب/);
    expect(() => openBytes(sealed, randomBytes(32))).toThrow(/معطوب/);
    expect(() => openBytes(sealed, null)).toThrow(/لا مفتاح/);
  });
});

describe('ترحيل ما كُتب واضحًا', () => {
  it('يشفّر الخاصّ ملفًّا ملفًّا ويترك غيره، ويتخطّى المشفَّر، ويمحو بقايا نسخٍ انقطع', async () => {
    const root = mkdtempSync(join(tmpdir(), 'diwan-storecrypt-'));
    for (const d of ['attachments/2026', 'photos', 'images', 'tmp']) mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, 'attachments', '2026', 'scan.png'), PNG);
    writeFileSync(join(root, 'photos', 'face.png'), PNG);
    writeFileSync(join(root, 'photos', 'old.png'), sealBytes(PNG, KEY));
    writeFileSync(join(root, 'photos', 'face.png.sealing'), 'نصف نسخة');
    writeFileSync(join(root, 'images', 'logo.png'), PNG);
    writeFileSync(join(root, 'tmp', 'scan.png'), PNG);
    let seen = 0;
    const out = await sealExisting(root, KEY, () => seen++);
    expect(out).toEqual({ sealed: 2, skipped: 1 });
    expect(seen).toBe(2);
    for (const rel of ['attachments/2026/scan.png', 'photos/face.png', 'photos/old.png']) {
      const data = readFileSync(join(root, rel));
      expect(isSealedBytes(data), rel).toBe(true);
      expect(openBytes(data, KEY).equals(PNG), rel).toBe(true);
    }
    expect(readFileSync(join(root, 'images', 'logo.png')).equals(PNG)).toBe(true);
    expect(readFileSync(join(root, 'tmp', 'scan.png')).equals(PNG)).toBe(true);
    expect(existsSync(join(root, 'photos', 'face.png.sealing'))).toBe(false);
    expect(await sealExisting(root, KEY)).toEqual({ sealed: 0, skipped: 3 });
  });
});
