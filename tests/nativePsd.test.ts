/**
 * فحص محرّك Rust الأصلي (A20، D103):
 * - الإضافة تُحمَّل من موضعها الواحد (worker/nativePsd.ts)
 * - psdEngineVersion() يساوي إصدار Cargo.toml
 * - JOBS.ping() يعيد رقم إصدار المحرّك وpsdError فارغ
 * - يسقط إن غابت الإضافة ولا يتخطّاها (لا skip).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadNativePsd } from '../src/main/worker/nativePsd';
import { JOBS } from '../src/main/worker/index';

describe('محرّك Rust الأصلي (diwan-psd)', () => {
  const cargoToml = readFileSync(join(__dirname, '..', 'native', 'diwan-psd', 'Cargo.toml'), 'utf8');
  const match = cargoToml.match(/version\s*=\s*"([^"]+)"/);
  const expectedVersion = match?.[1];

  it('إصدار Cargo.toml معروف', () => {
    expect(expectedVersion).toBeDefined();
    expect(typeof expectedVersion).toBe('string');
  });

  it('الإضافة تُحمَّل بنجاح ودالّة psdEngineVersion تعيد الإصدار المطابق', () => {
    const { addon, error } = loadNativePsd();
    expect(error, `فشل تحميل الإضافة: ${error}`).toBeNull();
    expect(addon, 'كائن الإضافة فارغ — تحقّق من بناء native/diwan-psd/diwan_psd.node').not.toBeNull();
    expect(addon!.psdEngineVersion()).toBe(expectedVersion);
  });

  it('عمل ping في العامل يعيد رقم إصدار المحرّك', async () => {
    const res = await JOBS.ping(null);
    expect(res.psd).toBe(expectedVersion);
    expect(res.psdError).toBeNull();
  });

  it('دالّة readPsd متاحة في الإضافة', () => {
    const { addon } = loadNativePsd();
    expect(typeof addon?.readPsd).toBe('function');
  });
});

