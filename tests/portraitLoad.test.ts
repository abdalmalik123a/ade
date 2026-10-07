/**
 * مكتبة ONNX (إزالة الخلفية) لا تُسقط البرنامج حين تغيب مكتبات مايكروسوفت (مراجعة ٧ ت١).
 *
 * ملحقها الأصلي يستورد VCRUNTIME140 وMSVCP140. كان `import` علويًّا في أوّل سطور العملية الرئيسة قبل أن يُركَّب
 * معالج الأخطاء، فجهازٌ نظيف بلا تلك المكتبات يُسقط البرنامج كلّه بنافذة خطأٍ إنكليزية عند الإقلاع.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// الجهاز النظيف: التحميل يفشل كما يفشل الملحق الأصلي.
vi.mock('onnxruntime-node', () => {
  throw new Error('The specified module could not be found.\n\\?\C:\Diwan\onnxruntime_binding.node');
});

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

describe('مكتبة ONNX تُحمَّل عند الحاجة لا عند الإقلاع', () => {
  it('لا استيراد ثابتًا لها في العملية الرئيسة (نوعًا فقط) — وإلا عاد الإسقاط عند الإقلاع', () => {
    const offenders = walk('src/main')
      .filter((f) => /\.(ts|tsx|mts)$/.test(f))
      .filter((f) => /^\s*import\s+(?!type\b)[^;]*?from\s+['"]onnxruntime-node['"]/m.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('وغيابها يُقال بالعربية — لا استثناءٌ إنكليزي يسقط به كلّ شيء', async () => {
    const { matte, loadOrt } = await import('../src/main/services/portrait');
    await expect(loadOrt()).rejects.toThrow(/Visual C\+\+/);
    await expect(matte('model.onnx', new Uint8Array(4 * 4), 2, 2)).rejects.toThrow(/إزالة الخلفية/);
    // ولا تُحفظ المحاولة الفاشلة: قد يثبّتها المستخدم الآن، فتُعاد المحاولة لا الإخفاق نفسه.
    const again = loadOrt();
    await expect(again).rejects.toThrow(/Visual C\+\+/);
    expect(again).not.toBe(loadOrt());
  });
});
