/**
 * «خطوط ديوان» في القاعدة والمخزن (DESIGNS.md ٠٫٧): الاستيراد يُفحص ويُنسخ ببصمته ويُفهرس وجهًا لكلّ ملفّ، والوجه نفسه
 * يُستبدل لا يُكرَّر، والمحزوم لا يُستورد، والحذف يمحو ملفّاته — وخطوط Windows بعائلاتها من مجلّدٍ يُعدّه الاختبار.
 *
 * والخطّ المستورد «Amirx»: أميري المحزوم باسمٍ آخر (الحرف الأخير)، مفكوكًا إلى TTF — فلا يتعلّق الاختبار بخطوط الجهاز.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';

const root = mkdtempSync(join(tmpdir(), 'diwan-fonts-'));
vi.mock('electron', () => ({ app: { getPath: () => root } }));
const windowsDir = join(root, 'windows-fonts');
mkdirSync(windowsDir, { recursive: true });
(process.env as Record<string, string>)['DIWAN_TEST_WINDOWS_FONTS'] = windowsDir;
// مجلّد البيانات يحلّه الإقلاع (D236) — وهنا كما كان: `data` تحت المجلّد المؤقّت.
(await import('../src/main/db')).setDataDir(join(root, 'data'));

const { importFaces, importWindowsFamily, listFaces, removeFamily, windowsFamilies, importedFontCss } = await import('../src/main/services/fonts');

/** WOFF ← TTF، والعائلة «Amiri» ← «Amirx» بالطول نفسه (فلا تتغيّر المواضع). */
function renamedTtf(file: string): Buffer {
  const w = readFileSync(join(__dirname, '..', 'node_modules', '@fontsource', 'amiri', 'files', file));
  const n = w.readUInt16BE(12);
  const tables = Array.from({ length: n }, (_, i) => {
    const at = 44 + i * 20;
    const raw = w.subarray(w.readUInt32BE(at + 4), w.readUInt32BE(at + 4) + w.readUInt32BE(at + 8));
    return { tag: w.subarray(at, at + 4), data: w.readUInt32BE(at + 8) < w.readUInt32BE(at + 12) ? inflateSync(raw) : Buffer.from(raw) };
  });
  const head = Buffer.alloc(12 + 16 * n);
  head.writeUInt32BE(w.readUInt32BE(4), 0);
  head.writeUInt16BE(n, 4);
  let offset = head.length;
  const bodies = tables.map((t, i) => {
    let data = t.data;
    if (t.tag.toString('latin1') === 'name') {
      const be = (s: string) => Buffer.from(s, 'utf16le').swap16();
      data = Buffer.from(data.toString('latin1').split(be('Amiri').toString('latin1')).join(be('Amirx').toString('latin1')).split('Amiri').join('Amirx'), 'latin1');
    }
    t.tag.copy(head, 12 + i * 16);
    head.writeUInt32BE(offset, 12 + i * 16 + 8);
    head.writeUInt32BE(data.length, 12 + i * 16 + 12);
    const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
    data.copy(padded);
    offset += padded.length;
    return padded;
  });
  return Buffer.concat([head, ...bodies]);
}

const db = new Database(':memory:');
db.exec(readFileSync(join(__dirname, '..', 'src', 'main', 'db', 'schema.sql'), 'utf8'));
const regular = join(root, 'Amirx-Regular.ttf');
const bold = join(root, 'Amirx-Bold.ttf');
writeFileSync(regular, renamedTtf('amiri-arabic-400-normal.woff'));
writeFileSync(bold, renamedTtf('amiri-arabic-700-normal.woff'));
const store = (rel: string) => join(root, 'data', 'store', rel);

describe('خطوط ديوان في القاعدة والمخزن', () => {
  it('يُستورد وجهًا بعائلته ووزنه، وملفّه في المخزن ببصمته', () => {
    const out = importFaces(db, [regular, bold], 'file');
    expect(out.errors).toEqual([]);
    expect(out.added.map((f) => [f.family, f.weight, f.italic, f.source, f.originalName])).toEqual([
      ['Amirx', 400, false, 'file', 'Amirx-Regular.ttf'],
      ['Amirx', 700, false, 'file', 'Amirx-Bold.ttf']
    ]);
    for (const f of out.added) {
      expect(f.file).toMatch(/^fonts\/[0-9a-f]{32}\.ttf$/);
      expect(existsSync(store(f.file))).toBe(true);
    }
    expect(importedFontCss(db)).toContain("font-family:'Amirx';src:url('diwan://store/fonts/");
  });

  it('والوجه نفسه يُستبدل لا يُكرَّر', () => {
    importFaces(db, [regular], 'file');
    expect(listFaces(db).map((f) => f.weight)).toEqual([400, 700]);
  });

  it('والمحزوم وما ليس خطًّا يُرفضان باسمهما وسببهما، ولا يمنعان غيرهما', () => {
    const amiri = join(root, 'Amiri.woff');
    writeFileSync(amiri, readFileSync(join(__dirname, '..', 'node_modules', '@fontsource', 'amiri', 'files', 'amiri-arabic-400-normal.woff')));
    const junk = join(root, 'ليس-خطًّا.ttf');
    writeFileSync(junk, 'نصٌّ لا خطّ');
    const out = importFaces(db, [amiri, junk, regular], 'file');
    expect(out.added).toHaveLength(1);
    expect(out.errors).toEqual([
      { name: 'Amiri.woff', reason: '«Amiri» من خطوط ديوان المحزومة أصلًا' },
      { name: 'ليس-خطًّا.ttf', reason: 'ليس ملفّ خطّ يُعرف (TTF أو OTF أو WOFF)' }
    ]);
  });

  it('والحذف يمحو العائلة وملفّاتها', () => {
    const files = listFaces(db).map((f) => f.file);
    removeFamily(db, 'amirx');
    expect(listFaces(db)).toEqual([]);
    for (const f of files) expect(existsSync(store(f))).toBe(false);
  });

  it('خطوط Windows بعائلاتها، والعائلة كلّها بضغطة — وما لا يُقرأ يُتخطّى', () => {
    writeFileSync(join(windowsDir, 'amirx.ttf'), readFileSync(regular));
    writeFileSync(join(windowsDir, 'amirxbd.ttf'), readFileSync(bold));
    writeFileSync(join(windowsDir, 'broken.ttf'), 'xx');
    writeFileSync(join(windowsDir, 'readme.txt'), 'ليس خطًّا');
    expect(windowsFamilies()).toEqual([
      { family: 'Amirx', arabic: true, faces: [
        { path: join(windowsDir, 'amirx.ttf'), weight: 400, italic: false },
        { path: join(windowsDir, 'amirxbd.ttf'), weight: 700, italic: false }
      ] }
    ]);
    const out = importWindowsFamily(db, 'Amirx');
    expect(out.added.map((f) => [f.weight, f.source])).toEqual([[400, 'windows'], [700, 'windows']]);
    expect(importWindowsFamily(db, 'Tahoma').errors[0]?.reason).toContain('ليس في خطوط Windows');
  });
});
