/**
 * النسخة التلقائية (تعميق الموجود ٢): مرآةٌ في مجلّدٍ يختاره المكتب — القاعدة إن تغيّرت
 * وتُبقى آخرها، والجديد من المخزن وحده، ومشفّرةً لكلّ ملفٍّ إن اختير. ويُسترجع منها.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ForeignMirrorError, MIRROR, mirrorInfo, mirrorSnapshots, readMirror, runAutoBackup } from '../src/main/services/autoBackup';

function office() {
  const base = mkdtempSync(join(tmpdir(), 'diwan-auto-'));
  const store = join(base, 'store');
  const usb = join(base, 'usb');
  const data = join(base, 'data');
  mkdirSync(join(store, 'attachments'), { recursive: true });
  mkdirSync(usb);
  mkdirSync(data);
  writeFileSync(join(store, 'attachments', 'scan-1.png'), Buffer.alloc(5000, 7));
  writeFileSync(join(store, 'logo.png'), Buffer.from('LOGO'));
  let db = Buffer.from('قاعدة ١');
  return {
    store,
    usb,
    data,
    setDb: (text: string) => (db = Buffer.from(text)),
    run: (password: string | null = null, keep = 3, at = '2026-09-28T10:00:00Z', appVersion?: string, expectId?: string | null) =>
      runAutoBackup({
        target: usb,
        storeRoot: store,
        tempDir: data,
        snapshotDb: (f) => writeFileSync(f, db),
        password,
        keep,
        now: new Date(at),
        appVersion,
        expectId
      })
  };
}

describe('النسخة التلقائية مرآةً', () => {
  it('الأولى تنسخ القاعدة والمخزن كلّه — والتالية بلا تغيير لا تنسخ شيئًا', () => {
    const o = office();
    const first = o.run();
    expect(first).toMatchObject({ dbChanged: true, filesCopied: 2, snapshots: 1 });
    expect(first.root).toBe(join(o.usb, MIRROR));
    expect(readFileSync(join(first.root, 'store', 'attachments', 'scan-1.png')).length).toBe(5000);
    const again = o.run(null, 3, '2026-09-28T11:00:00Z');
    expect(again).toMatchObject({ dbChanged: false, filesCopied: 0, bytesCopied: 0 });
  });

  it('الجديد وحده يُنسخ، والقاعدة المتغيّرة نسخةٌ جديدة — وتُبقى آخر ما حُدِّد', () => {
    const o = office();
    o.run(null, 2, '2026-09-28T10:00:00Z');
    writeFileSync(join(o.store, 'attachments', 'scan-2.png'), Buffer.alloc(300, 1));
    o.setDb('قاعدة ٢');
    expect(o.run(null, 2, '2026-09-28T11:00:00Z')).toMatchObject({ dbChanged: true, filesCopied: 1 });
    o.setDb('قاعدة ٣');
    o.run(null, 2, '2026-09-28T12:00:00Z');
    const snaps = readdirSync(join(o.usb, MIRROR, 'db')).sort();
    expect(snaps).toEqual(['diwan-2026-09-28-11-00-00.db', 'diwan-2026-09-28-12-00-00.db']);
    // والملف الذي تغيّر حجمه يُنسخ من جديد.
    writeFileSync(join(o.store, 'logo.png'), Buffer.from('LOGO-2'));
    expect(o.run(null, 2, '2026-09-28T13:00:00Z').filesCopied).toBe(1);
  });

  it('مشفّرةً: لا يُقرأ منها شيءٌ بلا كلمتها، وبها تعود كما كانت', () => {
    const o = office();
    o.setDb('قاعدة فيها أرقام الناس');
    o.run('كلمة-المكتب');
    const root = join(o.usb, MIRROR);
    const sealed = readFileSync(join(root, 'store', 'attachments', 'scan-1.png.enc'));
    expect(sealed.length).toBe(5000 + 28);
    expect(sealed.includes(Buffer.alloc(64, 7))).toBe(false);
    expect(mirrorInfo(o.usb)).toMatchObject({ encrypted: true });

    expect(() => readMirror(o.usb, null)).toThrow('مشفّرة');
    expect(() => readMirror(o.usb, 'خطأ')).toThrow('خاطئة');
    const back = readMirror(o.usb, 'كلمة-المكتب');
    expect(Buffer.from(back.db).toString()).toBe('قاعدة فيها أرقام الناس');
    expect(back.files).toBe(2);
    const to = join(o.usb, 'restored');
    back.writeStore(to);
    expect(readFileSync(join(to, 'attachments', 'scan-1.png'))).toEqual(Buffer.alloc(5000, 7));
    expect(readFileSync(join(to, 'logo.png')).toString()).toBe('LOGO');
  });

  it('لا يُخلط المشفّر بغيره في مجلّدٍ واحد، والكلمة الأخرى لا تكتب فيه', () => {
    const o = office();
    o.run('كلمة-المكتب');
    expect(() => o.run(null)).toThrow('مشفّرة');
    expect(() => o.run('كلمةٌ أخرى')).toThrow('خاطئة');
    const plain = office();
    plain.run(null);
    expect(() => plain.run('كلمة')).toThrow('غير مشفّرة');
  });

  it('والفلاشة غير الموصولة تُقال — ولا مجلّد يُصنع مكانها', () => {
    const o = office();
    const missing = join(o.usb, 'E-drive-not-here');
    expect(() => runAutoBackup({ target: missing, storeRoot: o.store, tempDir: o.data, snapshotDb: () => undefined, password: null, keep: 3 })).toThrow('فلاشة');
    expect(existsSync(missing)).toBe(false);
    expect(() => mirrorInfo(o.usb)).toThrow('ليس نسخةً');
  });
});

describe('اختيار النسخة عند الاسترجاع (خطة Production، ٤٫٢)', () => {
  it('نسخ القاعدة أحدثها أوّلًا بوقتها وإصدارها — ويُسترجع منها ما يُختار لا آخرها وحده', () => {
    const o = office();
    o.setDb('قاعدة الاثنين');
    o.run(null, 5, '2026-09-28T10:00:00Z', '1.0.0');
    o.setDb('قاعدة الثلاثاء');
    o.run(null, 5, '2026-09-29T10:00:00Z', '1.1.0');
    const snaps = mirrorSnapshots(o.usb);
    expect(snaps.map((x) => [x.at, x.appVersion])).toEqual([
      ['2026-09-29T10:00:00Z', '1.1.0'],
      ['2026-09-28T10:00:00Z', '1.0.0']
    ]);
    expect(Buffer.from(readMirror(o.usb, null).db).toString()).toBe('قاعدة الثلاثاء');
    const older = readMirror(o.usb, null, snaps[1]!.name);
    expect(Buffer.from(older.db).toString()).toBe('قاعدة الاثنين');
    expect(older.appVersion).toBe('1.0.0');
    expect(() => readMirror(o.usb, null, 'diwan-1999-01-01-00-00-00.db')).toThrow(/لم تعد في المجلّد/);
  });

  it('وما حذفه «تُبقى آخر…» يُحذف إصداره معه', () => {
    const o = office();
    for (const [i, at] of ['2026-09-28T10:00:00Z', '2026-09-28T11:00:00Z', '2026-09-28T12:00:00Z'].entries()) {
      o.setDb(`قاعدة ${i}`);
      o.run(null, 2, at, `1.0.${i}`);
    }
    const manifest = JSON.parse(readFileSync(join(o.usb, MIRROR, 'manifest.json'), 'utf8')) as { versions: Record<string, string> };
    expect(Object.values(manifest.versions).sort()).toEqual(['1.0.1', '1.0.2']);
    expect(mirrorSnapshots(o.usb)).toHaveLength(2);
  });
});

describe('المرآة لها هويّة — فلاشة غريبة بحرف فلاشة النسخ لا يُكتب عليها شيء (مراجعة ٧ ت١)', () => {
  it('الأولى تكتب هويّةً وتعيدها، وبها تتوالى النسخ', () => {
    const o = office();
    const first = o.run();
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(readFileSync(join(first.root, 'manifest.json'), 'utf8')).id).toBe(first.id);
    expect(o.run(null, 3, '2026-09-28T11:00:00Z', undefined, first.id).id).toBe(first.id);
  });

  it('قرصٌ آخر بالمسار نفسه — فارغٌ أو فيه مرآةٌ أخرى — يُرفض ولا يُصنع عليه مجلّد', () => {
    const o = office();
    const id = o.run().id;
    // فلاشة زبون دخلت بحرف فلاشة النسخ: لا مرآة عليها.
    const foreign = mkdtempSync(join(tmpdir(), 'diwan-foreign-'));
    writeFileSync(join(foreign, 'ملف الزبون.docx'), 'x');
    const attempt = () =>
      runAutoBackup({ target: foreign, storeRoot: o.store, tempDir: o.data, snapshotDb: (f) => writeFileSync(f, 'db'), password: null, keep: 3, expectId: id });
    expect(attempt).toThrow(ForeignMirrorError);
    expect(attempt).toThrow(/لم يُكتب عليه شيء/);
    expect(readdirSync(foreign)).toEqual(['ملف الزبون.docx']);
    // ومرآةُ مكتبٍ آخر بهويّةٍ أخرى كذلك.
    const other = office();
    other.run();
    const manifestOf = () => readFileSync(join(other.usb, MIRROR, 'manifest.json'), 'utf8');
    const before = manifestOf();
    expect(() => runAutoBackup({ target: other.usb, storeRoot: o.store, tempDir: o.data, snapshotDb: (f) => writeFileSync(f, 'db'), password: null, keep: 3, expectId: id })).toThrow(ForeignMirrorError);
    expect(manifestOf()).toBe(before);
  });

  it('وبلا هويّةٍ معتمدة اعتمادٌ أوّل: مجلّدٌ فارغ، أو مرآةٌ قديمة بلا هويّة تُكتب لها هويّة', () => {
    const o = office();
    const first = o.run();
    // مرآةٌ من إصدارٍ سبق هذا: نزع الهويّة من ملفّها.
    const file = join(first.root, 'manifest.json');
    const old = JSON.parse(readFileSync(file, 'utf8'));
    delete old.id;
    writeFileSync(file, JSON.stringify(old));
    const adopted = o.run(null, 3, '2026-09-28T11:00:00Z');
    expect(adopted.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(readFileSync(file, 'utf8')).id).toBe(adopted.id);
    // ومن اعتمد هويّةً ثم فقد القرص هويّته لا يُكتب عليه كأنّه جديد.
    delete old.id;
    writeFileSync(file, JSON.stringify(old));
    expect(() => o.run(null, 3, '2026-09-28T12:00:00Z', undefined, adopted.id)).toThrow(ForeignMirrorError);
  });
});
