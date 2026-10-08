/**
 * مسوح الهويّات العابرة (مراجعة ٧ ت١): تُكتب في `store/tmp/` وتُحذف حين يُغلق حوارها وتُكنس عند الإقلاع،
 * ولا تدخل نسخةً احتياطية — فصور هويّات الزبائن لا تبقى في المخزن ولا تنتقل إلى الفلاشة بلا سجلّ.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discardTransient, isTransientPath, sweepTransient } from '../src/main/services/transient';
import { writeBackup } from '../src/main/services/backup';
import { runAutoBackup } from '../src/main/services/autoBackup';
import { freshDb } from './helpers';

function store() {
  const root = mkdtempSync(join(tmpdir(), 'diwan-transient-'));
  mkdirSync(join(root, 'tmp'), { recursive: true });
  mkdirSync(join(root, 'attachments'), { recursive: true });
  writeFileSync(join(root, 'tmp', 'scan-1.png'), 'وجه هويّة');
  writeFileSync(join(root, 'tmp', 'scan-2.png'), 'ظهر هويّة');
  writeFileSync(join(root, 'attachments', 'scan-9.png'), 'مستمسكٌ مقيَّد لزبون');
  return root;
}

describe('مسارٌ عابر', () => {
  it('`tmp/اسم` وحده — لا مجلّد آخر ولا فواصل أخرى ولا خروجٌ منه', () => {
    expect(isTransientPath('tmp/scan-1.png')).toBe(true);
    expect(isTransientPath('tmp\\scan-1.png')).toBe(true);
    expect(isTransientPath('attachments/scan-1.png')).toBe(false);
    expect(isTransientPath('tmp/a/b.png')).toBe(false);
    expect(isTransientPath('tmp/../diwan.db')).toBe(false);
    expect(isTransientPath('tmp/..\\x')).toBe(false);
    expect(isTransientPath(42)).toBe(false);
    expect(isTransientPath(null)).toBe(false);
  });
});

describe('حذف العابر عند إغلاق الحوار', () => {
  it('يحذف العابر وحده — ولو طُلب غيره بالاسم، أو بخروجٍ من المجلّد', () => {
    const root = store();
    const n = discardTransient(root, ['tmp/scan-1.png', 'attachments/scan-9.png', 'tmp/../attachments/scan-9.png', 7, null]);
    expect(n).toBe(1);
    expect(existsSync(join(root, 'tmp', 'scan-1.png'))).toBe(false);
    expect(existsSync(join(root, 'tmp', 'scan-2.png'))).toBe(true);
    expect(existsSync(join(root, 'attachments', 'scan-9.png'))).toBe(true);
  });

  it('وملفٌّ غائبٌ أصلًا لا يُسقط شيئًا', () => {
    expect(discardTransient(store(), ['tmp/غائب.png'])).toBe(0);
  });
});

describe('كنس الإقلاع', () => {
  it('يكنس `tmp/` كلّه، ويحذف `*.part` الأقدم من يوم، ولا يمسّ مستمسكًا مقيَّدًا', () => {
    const root = store();
    writeFileSync(join(root, 'attachments', 'قديم.png.part'), 'x');
    writeFileSync(join(root, 'attachments', 'جديد.png.part'), 'x');
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    utimesSync(join(root, 'attachments', 'قديم.png.part'), old, old);
    expect(sweepTransient(root)).toEqual({ tmp: 2, parts: 1 });
    expect(readdirSync(join(root, 'tmp'))).toEqual([]);
    expect(readdirSync(join(root, 'attachments')).sort()).toEqual(['جديد.png.part', 'scan-9.png'].sort());
  });

  it('ومخزنٌ بلا `tmp/` أو غائبٌ أصلًا لا يُسقط الإقلاع', () => {
    expect(sweepTransient(mkdtempSync(join(tmpdir(), 'diwan-empty-')))).toEqual({ tmp: 0, parts: 0 });
    expect(sweepTransient(join(tmpdir(), 'diwan-لا-وجود-له'))).toEqual({ tmp: 0, parts: 0 });
  });
});

describe('ولا يدخل نسخةً احتياطية', () => {
  it('اليدوية: ملفّات المخزن بلا `tmp/` ولا `*.part`', async () => {
    const root = store();
    writeFileSync(join(root, 'attachments', 'ناقص.png.part'), 'x');
    const dbFile = join(root, 'diwan.db');
    freshDb().exec('SELECT 1');
    writeFileSync(dbFile, 'قاعدة');
    const out = await writeBackup({ target: join(root, 'backup.zip'), dbFile, storeRoot: root, password: null, appVersion: '1.2.0' });
    // مستمسك الزبون المقيَّد وقاعدة التجربة هنا في جذر المخزن — لا العابر ولا المنقطع.
    expect(out.files).toBe(2);
  });

  it('والتلقائية: المرآة بلا `tmp/`', () => {
    const root = store();
    const usb = mkdtempSync(join(tmpdir(), 'diwan-usb-'));
    const r = runAutoBackup({ target: usb, storeRoot: root, snapshotDb: (f) => writeFileSync(f, 'db'), password: null, keep: 3 });
    expect(r.filesCopied).toBe(1);
    expect(existsSync(join(r.root, 'store', 'tmp'))).toBe(false);
    expect(existsSync(join(r.root, 'store', 'attachments', 'scan-9.png'))).toBe(true);
  });
});
