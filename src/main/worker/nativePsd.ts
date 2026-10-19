/**
 * الموضع الواحد لتحميل إضافة Rust الأصلية (A20، D103) — يحمّلها العامل من مرشّحين:
 * out/main في البناء والحزمة، وsrc/main/worker في الاختبار.
 *
 * يعيد الإضافة أو سبب تعذّرها، ولا يرمي أبدًا.
 * ولا يستورد electron ولا db/ ولا ipc/ (قواعد structure.test.ts).
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export interface NativePsd {
  psdEngineVersion(): string;
}

export type NativePsdResult = {
  addon: NativePsd | null;
  error: string | null;
};

const req = typeof require === 'function' ? require : createRequire(import.meta.url);

let cached: NativePsdResult | null = null;

export function loadNativePsd(): NativePsdResult {
  if (cached) return cached;

  const candidates = [
    // out/main في البناء والبرنامج المحزوم
    resolve(__dirname, '../../native/diwan-psd/diwan_psd.node'),
    // مسار الحزمة المفكوكة خارج asar
    resolve(__dirname.replace(/([/\\])app\.asar([/\\]|$)/, '$1app.asar.unpacked$2'), '../../native/diwan-psd/diwan_psd.node'),
    // src/main/worker في الاختبار
    resolve(__dirname, '../../../native/diwan-psd/diwan_psd.node')
  ];

  const unique = [...new Set(candidates)];
  for (const candidate of unique) {
    if (existsSync(candidate)) {
      try {
        const addon = req(candidate) as NativePsd;
        if (typeof addon?.psdEngineVersion === 'function') {
          cached = { addon, error: null };
          return cached;
        }
      } catch (e) {
        cached = { addon: null, error: e instanceof Error ? e.message : String(e) };
        return cached;
      }
    }
  }

  cached = { addon: null, error: 'تعذّر العثور على إضافة Rust (diwan_psd.node)' };
  return cached;
}
