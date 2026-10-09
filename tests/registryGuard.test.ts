/**
 * مرساة المدّة في السجلّ أثناء الفحص على البرنامج المحزوم (و٨) — بمشغّلٍ مزيّف، فلا يُلمس سجلّ الجهاز الحقيقي
 * (وفيه على جهاز المالك مرساة برنامجه المثبَّت).
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — أداةٌ بـJavaScript بلا أنواع.
import { REG_KEY, registryGuard } from '../tools/registryGuard.mjs';

/** سجلٌّ مزيّف: يقيّد الأوامر، والمفتاح موجودٌ أو لا. */
function fakeRegistry(exists: boolean, failOn: string | null = null) {
  const calls: string[] = [];
  let present = exists;
  const removed: string[] = [];
  const run = (args: string[]) => {
    calls.push(args.join(' '));
    if (args[0] === failOn) return false;
    if (args[0] === 'query') return present;
    if (args[0] === 'delete') {
      const was = present;
      present = false;
      return was;
    }
    if (args[0] === 'import') present = true;
    return true;
  };
  return { calls, run, removed, remove: (f: string) => removed.push(f), isPresent: () => present };
}

describe('مرساة المدّة في السجلّ أثناء الفحص (و٨)', () => {
  it('تُحفظ قبل الفحص، وتُمحى قبل كلّ تشغيل، وتعود كما كانت في النهاية', () => {
    const reg = fakeRegistry(true);
    const guard = registryGuard({ run: reg.run, file: 'C:\\tmp\\a.reg', remove: reg.remove });
    expect(guard.file).toBe('C:\\tmp\\a.reg');
    expect(reg.calls).toEqual([`query ${REG_KEY}`, `export ${REG_KEY} C:\\tmp\\a.reg /y`]);
    guard.clear();
    guard.clear();
    expect(reg.isPresent()).toBe(false);
    guard.restore();
    guard.restore(); // مرّةً واحدة
    expect(reg.calls.slice(-2)).toEqual([`delete ${REG_KEY} /f`, 'import C:\\tmp\\a.reg']);
    expect(reg.calls.filter((c) => c.startsWith('import'))).toHaveLength(1);
    expect(reg.isPresent()).toBe(true);
    expect(reg.removed).toEqual(['C:\\tmp\\a.reg']);
  });

  it('وجهازٌ بلا مرساة: لا حفظ، وما كتبته السيناريوهات يُمحى في النهاية', () => {
    const reg = fakeRegistry(false);
    const guard = registryGuard({ run: reg.run, file: 'x.reg', remove: reg.remove });
    expect(guard.file).toBeNull();
    reg.run(['add', REG_KEY]); // سيناريو كتب مرساته
    guard.restore();
    expect(reg.calls.some((c) => c.startsWith('export') || c.startsWith('import'))).toBe(false);
    expect(reg.calls.at(-1)).toBe(`delete ${REG_KEY} /f`);
  });

  it('وإن تعذّر الحفظ لا يُمسّ شيء — ولا يبدأ الفحص', () => {
    const reg = fakeRegistry(true, 'export');
    expect(() => registryGuard({ run: reg.run, file: 'x.reg' })).toThrow('لم يُلمس شيء');
    expect(reg.calls.some((c) => c.startsWith('delete'))).toBe(false);
  });

  it('وإن تعذّرت الإعادة يُقال كيف تُعاد يدويًّا — والملفّ باقٍ', () => {
    const reg = fakeRegistry(true, 'import');
    const guard = registryGuard({ run: reg.run, file: 'C:\\tmp\\b.reg', remove: reg.remove });
    expect(() => guard.restore()).toThrow('reg import "C:\\tmp\\b.reg"');
    expect(reg.removed).toEqual([]);
  });
});
