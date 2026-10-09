/**
 * مرساة المدّة التجريبية في سجلّ ويندوز (`HKCU\Software\Diwan`) أثناء الفحص على البرنامج المحزوم (و٨).
 *
 * البرنامج المحزوم يكتب أوّل يومٍ رآه في السجلّ ويأخذ **الأقدم** من القاعدة والملفّ والسجلّ — فبعد ١٤ يومًا من أوّل
 * فحصٍ محزوم صار كلّ سيناريو يُنتج ورقةً يفشل فشلًا كاذبًا («انتهت المدّة التجريبية»). وعلى جهاز المالك فيه مرساة
 * برنامجه المثبَّت نفسه. فتُحفظ المرساة قبل الفحص، وتُمحى قبل كلّ تشغيل، وتعود كما كانت في النهاية.
 *
 * `run` يُمرَّر في الاختبار (`tests/registryGuard.test.ts`) فلا يُلمس السجلّ الحقيقي.
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const REG_KEY = 'HKCU\\Software\\Diwan';

const reg = (args) => spawnSync('reg', args, { stdio: 'ignore', windowsHide: true }).status === 0;

export function registryGuard({ run = reg, file = join(tmpdir(), `diwan-registry-${Date.now()}.reg`), remove = (f) => rmSync(f, { force: true }) } = {}) {
  const existed = run(['query', REG_KEY]);
  if (existed && !run(['export', REG_KEY, file, '/y'])) throw new Error(`تعذّر حفظ ${REG_KEY} قبل الفحص — لم يُلمس شيء`);
  let restored = false;
  return {
    /** ملفّ المرساة المحفوظة — يُطبع ليُعاد يدويًّا إن قُطع الفحص قطعًا لا يُدرَك. */
    file: existed ? file : null,
    /** قبل كلّ تشغيل: لا مرساة من تشغيلٍ سابق — فكلّ سيناريو يبدأ في أوّل المدّة. */
    clear() {
      run(['delete', REG_KEY, '/f']);
    },
    /** في النهاية (مرّةً واحدة): ما كتبته السيناريوهات يُمحى، والأصل يعود كما كان. */
    restore() {
      if (restored) return;
      restored = true;
      run(['delete', REG_KEY, '/f']);
      if (!existed) return;
      if (!run(['import', file])) throw new Error(`تعذّرت إعادة ${REG_KEY} — أعدها يدويًّا: reg import "${file}"`);
      remove(file);
    }
  };
}
