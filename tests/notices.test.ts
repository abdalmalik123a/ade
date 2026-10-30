/**
 * الإشعارات القانونية (R04، D187): «عن البرنامج» يذكر كلّ حزمةٍ تُحزم فعلًا — كلّ حزمة تشغيلٍ في ملفّ القفل بإصدارها، وما تبنيه الواجهة،
 * والنماذج — ونصوص الرخص كاملةً في `resources/THIRD-PARTY-NOTICES.txt` (يولّدهما `tools/make-notices.mjs`، وكانت القائمة التبعيّات المباشرة وحدها).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { BUILTIN_SUITS } from '../src/shared/suits';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
type Notice = { name: string; version: string; license: string; home: string };
const notices = JSON.parse(readFileSync(join(ROOT, 'src/renderer/src/assets/notices.json'), 'utf8')) as Notice[];
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')).packages as Record<string, { version?: string; dev?: boolean; devOptional?: boolean }>;
const text = readFileSync(join(ROOT, 'resources/THIRD-PARTY-NOTICES.txt'), 'utf8');
const has = (name: string, version?: string) => notices.some((n) => n.name === name && (!version || n.version === version));

describe('الإشعارات القانونية من ملفّ القفل كلّه', () => {
  it('كلّ حزمة تشغيلٍ في ملفّ القفل باسمها وإصدارها', () => {
    const runtime = Object.entries(lock).filter(([at, p]) => at && !p.dev && !p.devOptional);
    expect(runtime.length).toBeGreaterThan(100);
    const missing = runtime.filter(([at, p]) => !has(at.slice(at.lastIndexOf('node_modules/') + 13), p.version)).map(([at]) => at);
    expect(missing).toEqual([]);
  });

  it('وما تبنيه الواجهة من أدوات التطوير وما تجرّه، وElectron', () => {
    for (const name of ['react', 'react-dom', 'scheduler', 'pdfjs-dist', 'material-symbols', 'prosemirror-view', 'prosemirror-model', 'orderedmap', 'electron']) expect(has(name), name).toBe(true);
    expect(notices.some((n) => n.name.startsWith('@fontsource/'))).toBe(true);
  });

  it('والنماذج وبيانات القراءة — ومنها RTMPose-t (D173)', () => {
    for (const model of ['MODNet', 'BiRefNet', 'YuNet', 'RTMPose-t', 'Tesseract']) expect(notices.some((n) => n.name.startsWith(model)), model).toBe(true);
  });

  it('إشعار القاط يطابق الكتالوج الخالي ولا ينسب صورًا لمصدر غير ثابت', () => {
    expect(BUILTIN_SUITS).toHaveLength(0);
    expect(readdirSync(join(ROOT, 'src/renderer/src/assets/suits')).filter((f) => /\.(png|webp|jpe?g|avif)$/i.test(f))).toEqual([]);
    const suit = notices.find((n) => n.name === 'صور القاط في «الصور الشخصية»');
    expect(suit?.license).toBe('لا صور قاط مدمجة؛ قاط المكتب والحزم المستوردة وفق حقوق أصحابها');
    expect(text).toContain(suit!.license);
    expect(text).not.toContain('من مكتبةٍ مفتوحة المصدر — مسموحٌ استعمالها (قرار المالك)');
  });

  it('ولا رخصة فارغة, ولكلّ حزمةٍ قسمٌ في النصوص الكاملة', () => {
    expect(notices.filter((n) => !n.license.trim()).map((n) => n.name)).toEqual([]);
    const npm = notices.filter((n) => !/resources\/|القاط/.test(n.name));
    expect(npm.filter((n) => !text.includes(`\n${n.name} ${n.version} — `)).map((n) => n.name)).toEqual([]);
    expect(text).toContain('Copyright (c) Electron contributors');
    expect(text).toContain('Copyright (c) Facebook, Inc. and its affiliates.');
  });

  it('ولا حزمة بلا رخصةٍ أو بلا نصّها، وإشعارات onnxruntime معها (D234، ر188)', () => {
    expect(notices.filter((n) => n.license === 'غير مذكورة في الحزمة — انظر مستودعها').map((n) => n.name)).toEqual([]);
    expect(text).not.toContain('(لا ملفّ رخصةٍ في الحزمة');
    expect(has('buffers')).toBe(false);
    expect(text).toContain('THIRD PARTY SOFTWARE NOTICES AND INFORMATION');
  });
});
