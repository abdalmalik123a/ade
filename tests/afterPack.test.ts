/**
 * حارس التحزيم (D142، `tools/afterPack.cjs`): كلّ ملحقٍ أصليّ (`*.node`) يجد ما يستورده من VC++ بجانبه — فويندوز يبحث بجانب الملحق
 * لا بجانب Diwan.exe، ومحرّك Rust سقط هكذا في صندوق D141. وعلى ملفّاتٍ حقيقية: `diwan_psd.node` (بـCRT ساكن) و`onnxruntime_binding.node`
 * (يستورد VC++)؛ ولا تخطّي إن غاب أحدهما.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

type Missing = { addon: string; dll: string };
const afterPack = createRequire(import.meta.url)('../tools/afterPack.cjs') as {
  default: (context: { electronPlatformName: string; appOutDir: string }) => Promise<void>;
  importsOf: (file: string) => string[];
  runtimeNotBeside: (dir: string) => Missing[];
};

const ROOT = join(__dirname, '..');
const PSD = join(ROOT, 'native', 'diwan-psd', 'diwan_psd.node');
const ONNX_DIR = join('node_modules', 'onnxruntime-node', 'bin', 'napi-v6', 'win32', 'x64');
const ONNX = join(ROOT, ONNX_DIR, 'onnxruntime_binding.node');
const lower = (names: string[]) => names.map((n) => n.toLowerCase());

const temps: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-afterpack-'));
  temps.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('قارئ الاستيراد (importsOf)', () => {
  it('الملفّان الحقيقيان موجودان (npm run build:native و npm install)', () => {
    expect(existsSync(PSD), PSD).toBe(true);
    expect(existsSync(ONNX), ONNX).toBe(true);
  });

  it('محرّك Rust بـCRT ساكن: لا vcruntime ولا msvcp ولا api-ms-win-crt', () => {
    const names = lower(afterPack.importsOf(PSD));
    expect(names).toContain('kernel32.dll');
    expect(names.filter((n) => /^(vcruntime|msvcp|api-ms-win-crt)/.test(n))).toEqual([]);
  });

  it('ملحق ONNX يستورد VC++ ومكتبته', () => {
    const names = lower(afterPack.importsOf(ONNX));
    expect(names).toEqual(expect.arrayContaining(['onnxruntime.dll', 'vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll']));
  });

  it('ملفٌّ ليس تنفيذيًّا يُرفض', () => {
    const dir = temp();
    const file = join(dir, 'x.node');
    writeFileSync(file, Buffer.alloc(256));
    expect(() => afterPack.importsOf(file)).toThrow(/ليس ملفًّا تنفيذيًّا/);
  });
});

describe('ما ليس بجانب الملحق (runtimeNotBeside)', () => {
  it('ملحقٌ يستورد VC++ وحده في مجلّده ← يُسمّى ما ينقصه، فإن وُضع بجانبه سلم', () => {
    const dir = temp();
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    copyFileSync(ONNX, join(dir, 'a', 'b', 'binding.node'));
    copyFileSync(PSD, join(dir, 'a', 'diwan_psd.node'));
    const missing = afterPack.runtimeNotBeside(dir);
    expect(missing.every((m) => m.addon.endsWith('binding.node'))).toBe(true);
    expect(lower(missing.map((m) => m.dll)).sort()).toEqual(['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll']);
    for (const m of missing) writeFileSync(join(dir, 'a', 'b', m.dll), '');
    expect(afterPack.runtimeNotBeside(dir)).toEqual([]);
  });
});

describe('afterPack على مجلّد تحزيمٍ مصنوع', () => {
  /** `appOutDir` كما يصنعه electron-builder: مجلّد ONNX ومحرّك PSD تحت `app.asar.unpacked`. */
  const appOut = (engine: string) => {
    const out = temp();
    const unpacked = join(out, 'resources', 'app.asar.unpacked');
    mkdirSync(join(unpacked, ONNX_DIR), { recursive: true });
    mkdirSync(join(unpacked, 'native', 'diwan-psd'), { recursive: true });
    copyFileSync(ONNX, join(unpacked, ONNX_DIR, 'onnxruntime_binding.node'));
    copyFileSync(engine, join(unpacked, 'native', 'diwan-psd', 'diwan_psd.node'));
    return out;
  };

  it('بمحرّكٍ يستورد VC++ (كالقديم قبل D142) ← يسقط ويسمّي الملحق والملفّ', async () => {
    await expect(afterPack.default({ electronPlatformName: 'win32', appOutDir: appOut(ONNX) })).rejects.toThrow(
      /native[\\/]diwan-psd[\\/]diwan_psd\.node ← VCRUNTIME140\.dll/i
    );
  });

  it('بمحرّك اليوم ← يمرّ، وVC++ بجانب البرنامج وملحق ONNX', async () => {
    const out = appOut(PSD);
    await afterPack.default({ electronPlatformName: 'win32', appOutDir: out });
    expect(existsSync(join(out, 'vcruntime140.dll'))).toBe(true);
    expect(existsSync(join(out, 'resources', 'app.asar.unpacked', ONNX_DIR, 'msvcp140.dll'))).toBe(true);
    expect(existsSync(join(out, 'resources', 'app.asar.unpacked', 'native', 'diwan-psd', 'vcruntime140.dll'))).toBe(false);
  });
});
