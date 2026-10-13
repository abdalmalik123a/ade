/**
 * اختبارات الكتابة الذرية لملفات الحالة ومقاومة انقطاع الكهرباء (المرحلة A، ٤٫٥).
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { atomicWriteJson, readWithBackup } from '../src/main/services/stateFile';

describe('الكتابة الذرية لملفات الحالة ومقاومة انقطاع الكهرباء (٤٫٥)', () => {
  it('كتابة الملف ذريًّا وقراءته بنجاح مع عدم بقاء أي ملفات مؤقتة', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-state-test-'));
    const file = join(dir, 'state.json');

    atomicWriteJson(file, { key: 'value', num: 42 });

    expect(existsSync(file)).toBe(true);
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { key: string; num: number };
    expect(parsed).toEqual({ key: 'value', num: 42 });

    // لا توجد ملفات مؤقتة متبقية
    const temps = readdirSync(dir).filter((f) => f.includes('.tmp-'));
    expect(temps).toHaveLength(0);

    rmSync(dir, { recursive: true, force: true });
  });

  it('الكتابة المتتالية تحتفظ بنسخة احتياطية .bak من الحالة السابقة', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-state-test-'));
    const file = join(dir, 'state.json');
    const bakFile = `${file}.bak`;

    atomicWriteJson(file, { version: 1, text: 'الأولى' });
    expect(existsSync(file)).toBe(true);
    expect(existsSync(bakFile)).toBe(false);

    // كتابة ثانية
    atomicWriteJson(file, { version: 2, text: 'الثانية' });
    expect(existsSync(file)).toBe(true);
    expect(existsSync(bakFile)).toBe(true);

    const current = JSON.parse(readFileSync(file, 'utf8')) as { version: number };
    const backup = JSON.parse(readFileSync(bakFile, 'utf8')) as { version: number };
    expect(current.version).toBe(2);
    expect(backup.version).toBe(1);

    rmSync(dir, { recursive: true, force: true });
  });

  it('الرجوع إلى .bak وإصلاح الملف الأساسي عند تلفه أو انقطاع كتابته (ملف مبتور / فارغ)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-state-test-'));
    const file = join(dir, 'diwan-license.json');

    // كتابة نسختين لإنشاء .bak
    atomicWriteJson(file, { trialStart: '2026-10-01', seen: '2026-10-05' });
    atomicWriteJson(file, { trialStart: '2026-10-01', seen: '2026-10-06' });

    // محاكاة انقطاع الكهرباء أثناء الكتابة: ملف مبتور أو فارغ 0-byte
    writeFileSync(file, '{"trialStart": "2026-10-01", "seen": '); // JSON مبتور

    const result = readWithBackup(
      file,
      (raw) => JSON.parse(raw) as { trialStart: string; seen: string },
      { trialStart: '', seen: '' }
    );

    // قرأ بنجاح من .bak
    expect(result.seen).toBe('2026-10-05');

    // وأصلح الملف الأساسي ليصبح سليمًا مجددًا
    const repaired = JSON.parse(readFileSync(file, 'utf8')) as { seen: string };
    expect(repaired.seen).toBe('2026-10-05');

    rmSync(dir, { recursive: true, force: true });
  });

  it('الرجوع إلى .bak عند حذف الملف الأساسي وبقاء .bak', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-state-test-'));
    const file = join(dir, 'auto-backup.json');

    atomicWriteJson(file, { lastAt: '2026-10-01T10:00:00Z', foreign: false });
    atomicWriteJson(file, { lastAt: '2026-10-02T10:00:00Z', foreign: false });

    // حذف الملف الأساسي
    rmSync(file);

    const result = readWithBackup(
      file,
      (raw) => JSON.parse(raw) as { lastAt: string },
      { lastAt: 'none' }
    );

    expect(result.lastAt).toBe('2026-10-01T10:00:00Z');
    expect(existsSync(file)).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it('إعادة القيمة الافتراضية (fallback) عند غياب الملفين أو تلفهما معًا', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-state-test-'));
    const file = join(dir, 'missing.json');

    const res1 = readWithBackup(file, (raw) => JSON.parse(raw) as { ok: boolean }, { ok: false });
    expect(res1).toEqual({ ok: false });

    // تلف الملفين
    writeFileSync(file, 'corrupt-primary');
    writeFileSync(`${file}.bak`, 'corrupt-bak');

    const res2 = readWithBackup(file, (raw) => JSON.parse(raw) as { ok: boolean }, { ok: false });
    expect(res2).toEqual({ ok: false });

    rmSync(dir, { recursive: true, force: true });
  });
});
