/**
 * إصدار البيانات (خطة Production، ٧٫٢): إصدارٌ أقدم لا يفتح بيانات أحدث، والتحديث يأخذ نسخةً قبل الترحيل.
 */
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { guardDataVersion, readDataVersion, runBootSequence, stampDataVersion } from '../src/main/services/dataVersion';

function office(version: string | null) {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-dataversion-'));
  const file = join(dir, 'diwan.db');
  const db = new Database(file);
  db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT); CREATE TABLE documents (id INTEGER PRIMARY KEY, serial TEXT); INSERT INTO documents (serial) VALUES ('م/2026/1');");
  if (version) stampDataVersion(db, version);
  db.close();
  return { dir, file, snapshots: join(dir, 'before-update') };
}

describe('إصدار البيانات', () => {
  it('جهازٌ جديد لا قاعدة فيه: لا نسخة ولا منع', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-dataversion-'));
    expect(guardDataVersion({ file: join(dir, 'diwan.db'), current: '1.0.0', snapshotDir: join(dir, 'x') })).toEqual({ kind: 'fresh' });
  });

  it('بالإصدار نفسه تُفتح كما هي', () => {
    const o = office('1.0.0');
    expect(guardDataVersion({ file: o.file, current: '1.0.0', snapshotDir: o.snapshots })).toEqual({ kind: 'same', version: '1.0.0' });
    expect(existsSync(o.snapshots)).toBe(false);
  });

  it('وإصدارٌ أحدث يأخذ نسخةً كاملةً منها قبل الترحيل', () => {
    const o = office('1.0.0');
    const g = guardDataVersion({ file: o.file, current: '1.1.0', snapshotDir: o.snapshots, now: new Date('2026-12-01T10:00:00Z') });
    expect(g).toMatchObject({ kind: 'upgrade', from: '1.0.0' });
    const snap = new Database((g as { snapshot: string }).snapshot, { readonly: true });
    expect((snap.prepare('SELECT serial FROM documents').get() as { serial: string }).serial).toBe('م/2026/1');
    snap.close();
  });

  it('وقاعدةٌ قبل أن يُكتب فيها إصدارٌ تُعدّ أقدم — فتُنسخ', () => {
    const o = office(null);
    expect(readDataVersion(o.file)).toBeNull();
    expect(guardDataVersion({ file: o.file, current: '1.0.0', snapshotDir: o.snapshots })).toMatchObject({ kind: 'upgrade', from: null });
  });

  it('وإصدارٌ أقدم لا يفتح بيانات أحدث — ولا يمسّها', () => {
    const o = office('1.10.0');
    expect(guardDataVersion({ file: o.file, current: '1.9.3', snapshotDir: o.snapshots })).toEqual({ kind: 'newer', from: '1.10.0' });
    expect(readDataVersion(o.file)).toBe('1.10.0');
  });

  it('وتُبقى آخر ثلاث نسخٍ قبل التحديث', () => {
    const o = office('1.0.0');
    for (const [i, v] of ['1.0.1', '1.0.2', '1.0.3', '1.0.4'].entries()) {
      guardDataVersion({ file: o.file, current: v, snapshotDir: o.snapshots, now: new Date(Date.UTC(2026, 11, 1 + i)) });
      const db = new Database(o.file);
      stampDataVersion(db, v);
      db.close();
    }
    const left = readdirSync(o.snapshots).sort();
    expect(left).toHaveLength(3);
    expect(left.some((f) => f.startsWith('1.0.0-'))).toBe(false);
  });

  describe('حراسة ترقيات قاعدة البيانات وتسلسل الإقلاع (٤٫٤)', () => {
    it('تنفيذ الترقيات بالترتيب وتسجيل الإصدار بعد اكتمالها بنجاح', () => {
      const o = office('1.0.0');
      const order: string[] = [];

      const res = runBootSequence({
        dbFile: o.file,
        currentVersion: '1.1.0',
        snapshotDir: o.snapshots,
        openDb: (file) => new Database(file),
        migrations: [
          (db) => {
            order.push('step1');
            db.exec('CREATE TABLE migration_1 (id INT PRIMARY KEY)');
          },
          (db) => {
            order.push('step2');
            db.exec("INSERT INTO migration_1 VALUES (100)");
          }
        ]
      });

      expect(res.kind).toBe('ready');
      expect(order).toEqual(['step1', 'step2']);

      const db = (res as { db: Database.Database }).db;
      expect(readDataVersion(o.file)).toBe('1.1.0');
      expect(db.prepare('SELECT id FROM migration_1').get()).toEqual({ id: 100 });
      db.close();
    });

    it('التراجع الكامل (Rollback) عند فشل أي ترقية وعدم تسجيل الإصدار الجديد', () => {
      const o = office('1.0.0');

      expect(() => {
        runBootSequence({
          dbFile: o.file,
          currentVersion: '1.1.0',
          snapshotDir: o.snapshots,
          openDb: (file) => new Database(file),
          migrations: [
            (db) => {
              db.exec('CREATE TABLE partial_table (val TEXT)');
              db.exec("INSERT INTO partial_table VALUES ('will_be_undone')");
            },
            () => {
              throw new Error('عطل متعمّد في الترقية الثانية');
            }
          ]
        });
      }).toThrow('تعذّرت ترقية قاعدة البيانات');

      // لم يُكتب الإصدار الجديد وبقي الإصدار السابق
      expect(readDataVersion(o.file)).toBe('1.0.0');

      // الجدول الذي أنشأته الخطوة الأولى أُلغي تمامًا بالتراجع
      const db = new Database(o.file, { readonly: true });
      const hasTable = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'partial_table'").get());
      expect(hasTable).toBe(false);
      db.close();
    });

    it('أمان إعادة التشغيل بعد فشل الترقية ثم نجاحها لاحقًا', () => {
      const o = office('1.0.0');

      // المحاولة الأولى تفشل
      expect(() => {
        runBootSequence({
          dbFile: o.file,
          currentVersion: '1.1.0',
          snapshotDir: o.snapshots,
          openDb: (file) => new Database(file),
          migrations: [
            () => {
              throw new Error('خطأ مؤقت');
            }
          ]
        });
      }).toThrow();

      expect(readDataVersion(o.file)).toBe('1.0.0');

      // إعادة التشغيل والمحاولة الثانية تنجح (إصلاح العطل)
      const retry = runBootSequence({
        dbFile: o.file,
        currentVersion: '1.1.0',
        snapshotDir: o.snapshots,
        openDb: (file) => new Database(file),
        migrations: [
          (db) => {
            db.exec('CREATE TABLE fixed_table (id INT)');
          }
        ]
      });

      expect(retry.kind).toBe('ready');
      expect(readDataVersion(o.file)).toBe('1.1.0');
      (retry as { db: Database.Database }).db.close();
    });

    it('رفض الإقلاع إذا كانت البيانات من إصدار أحدث دون تشغيل ترقيات أو كتابة', () => {
      const o = office('2.0.0');
      let ranMigration = false;

      const res = runBootSequence({
        dbFile: o.file,
        currentVersion: '1.5.0',
        snapshotDir: o.snapshots,
        openDb: (file) => new Database(file),
        migrations: [
          () => {
            ranMigration = true;
          }
        ]
      });

      expect(res).toEqual({ kind: 'newer', from: '2.0.0' });
      expect(ranMigration).toBe(false);
      expect(readDataVersion(o.file)).toBe('2.0.0');
    });
  });
});
