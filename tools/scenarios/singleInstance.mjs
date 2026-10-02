/**
 * سيناريو: نسخةٌ واحدة من البرنامج (خطة Production، ١٫٤).
 *
 * نقرتان على الأيقونة كانتا تفتحان نسختين على القاعدة نفسها — نافذتان، وقائمة المعاملات
 * المعلّقة تكتبها كلٌّ فوق الأخرى. فيُشغَّل البرنامج ثانيةً على الملفّ الشخصي نفسه: تخرج الثانية
 * بلا نافذة، وتبقى الأولى تعمل ومعاملتها المعلّقة كما هي.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  // معاملةٌ معلّقة في الأولى — يُتحقَّق بعدُ أنّ الثانية لم تكتب فوقها.
  await page.eval(`await window.diwan.service.setParked([{ key: 1, label: 'زبونٌ ذهب يجلب مستمسكه' }]); return true;`);

  const exe = process.env.DIWAN_EXE ? resolve(process.env.DIWAN_EXE) : resolve('node_modules/electron/dist/electron.exe');
  const args = [...(process.env.DIWAN_EXE ? [] : ['.']), `--user-data-dir=${profile}`, '--remote-debugging-port=9224'];
  const second = spawn(exe, args, { stdio: 'ignore' });
  let exited = false;
  second.on('exit', () => (exited = true));
  for (let i = 0; i < 40 && !exited; i++) await sleep(250);
  ok('التشغيل الثاني يخرج وحده', exited);

  let pages = 0;
  try {
    pages = (await (await fetch('http://127.0.0.1:9224/json/list')).json()).filter((t) => t.type === 'page').length;
  } catch {
    // لا منفذ يجيب: لم تُفتح صفحةٌ ثانية أصلًا.
  }
  ok('ولا نافذة له', pages === 0);
  if (!exited) second.kill();

  const parked = await page.eval(`return await window.diwan.service.parked();`);
  ok('والأولى تعمل ومعاملتها المعلّقة كما هي', parked.length === 1 && parked[0].label === 'زبونٌ ذهب يجلب مستمسكه');
  return steps.join('\n');
}
