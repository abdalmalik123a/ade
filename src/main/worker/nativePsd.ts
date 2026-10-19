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
import type { PsdImage } from '../services/psd';

export interface NativePsdRead {
  width: number;
  height: number;
  dpi: number | null;
  rgba: Buffer | null;
  planes?: Buffer[] | null;
  warnings: string[];
}

export interface NativePsd {
  psdEngineVersion(): string;
  readPsd(bytes: Buffer): NativePsdRead | null;
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

/**
 * تحويل رموز التنبيهات القادمة من Rust إلى النصوص العربية نفسها في psd.ts (A20، D104).
 */
export function translateWarning(code: string): string {
  if (code === 'truncated') return 'الملف مبتور';
  if (code.startsWith('depth:')) {
    const depth = code.slice(6);
    return `عمقُ الملف ${depth} بتًّا — تُقرأ ثمانيةٌ وحدها`;
  }
  if (code.startsWith('mode:')) {
    const mode = code.slice(5);
    return `نمط ألوان الملف (${mode}) غير مدعوم — يُدعم RGB و CMYK و Grayscale`;
  }
  if (code === 'unreadable') return 'تعذّرت قراءة الصورة المسطَّحة';
  if (code === 'zip') return 'صورةُ الملف مضغوطةٌ بصيغةٍ لا تُقرأ (ZIP)';
  return code;
}

/**
 * باني دالّة قراءة PSD الأصلية من إضافة Rust مع تحويل الأنواع والتنبيهات (A20، D104).
 */
export function createNativePsdReader(addon: NativePsd): (bytes: Uint8Array) => PsdImage | null {
  return (bytes: Uint8Array): PsdImage | null => {
    const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const res = addon.readPsd(buf);
    if (!res) return null;
    return {
      width: res.width,
      height: res.height,
      dpi: res.dpi ?? null,
      rgba: res.rgba ? new Uint8Array(res.rgba.buffer, res.rgba.byteOffset, res.rgba.byteLength) : null,
      planes: res.planes ? res.planes.map((p) => new Uint8Array(p.buffer, p.byteOffset, p.byteLength)) : undefined,
      warnings: res.warnings.map(translateWarning)
    };
  };
}

