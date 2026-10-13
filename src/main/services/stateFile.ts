/**
 * كتابة الملفات الذرية وحمايتها من انقطاع الكهرباء (المرحلة A، ٤٫٥).
 *
 * النمط الذري المقاوم لانقطاع الطاقة:
 * ١. الكتابة إلى ملف مؤقت (.tmp) في المجلد نفسه.
 * ٢. مزامنة القرص الصلب فورًا (fsync) لضمان كتابة البيانات على وسيط التخزين.
 * ٣. الاحتفاظ بنسخة احتياطية (.bak) من الملف الأصلي القائم قبل الاستبدال.
 * ٤. استبدال الملف الأصلي ذريًّا (renameSync).
 * ٥. القراءة الآمنة: إذا تلف الملف الأساسي (بايتات مبتورة أو تلف عند انقطاع الكهرباء)،
 *    تُقرأ النسخة الاحتياطية (.bak) تلقائيًّا ويُستعاد الملف الأساسي منها.
 */
import { closeSync, copyFileSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export function atomicWriteWithBackup(target: string, content: string): void {
  const dir = dirname(target);
  const base = basename(target);
  const temp = join(dir, `${base}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  const fd = openSync(temp, 'w');
  try {
    writeSync(fd, content, undefined, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  const bak = `${target}.bak`;
  if (existsSync(target)) {
    try {
      copyFileSync(target, bak);
    } catch {
      // تعذّر نسخ الاحتياط لا يمنع التحديث
    }
  }

  try {
    renameSync(temp, target);
  } catch (err) {
    rmSync(temp, { force: true });
    throw err;
  }
}

export function atomicWriteJson(target: string, data: unknown): void {
  atomicWriteWithBackup(target, JSON.stringify(data, null, 2));
}

export function readWithBackup<T>(
  target: string,
  parseAndValidate: (raw: string) => T,
  fallback: T
): T {
  if (existsSync(target)) {
    try {
      const raw = readFileSync(target, 'utf8');
      return parseAndValidate(raw);
    } catch {
      // تلف في الملف الأساسي — ننتقل إلى النسخة الاحتياطية .bak
    }
  }

  const bak = `${target}.bak`;
  if (existsSync(bak)) {
    try {
      const raw = readFileSync(bak, 'utf8');
      const recovered = parseAndValidate(raw);
      // محاولة استعادة الملف الأساسي من النسخة الاحتياطية
      try {
        atomicWriteWithBackup(target, raw);
      } catch {
        // لا بأس إذا تعذّرت إعادة الكتابة الآن
      }
      return recovered;
    } catch {
      // كلا الملفين تالف
    }
  }

  return fallback;
}
