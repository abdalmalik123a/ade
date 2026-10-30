/**
 * مشغّل التطبيق الحقيقي عبر بروتوكول Chrome DevTools.
 *
 * يشغّل «ديوان» المبني — بعمليته الرئيسية وقاعدة بياناته الفعلية — ثم يضغط الأزرار
 * ويقرأ الشاشة ويلتقط الصور. الغرض: التحقق أن الأزرار تعمل، لا أن العلامات موجودة.
 *
 * الاستعمال:
 *   node tools/drive.mjs <script.mjs>     يشغّل سيناريو ويخرج
 *
 * - **استثناءٌ غير ممسوك** في الواجهة (أو وعدٌ رُفض بلا من يلتقطه) يُفشل السيناريو
 *   كائنًا ما كان: خطأٌ يُبلع صامتًا هو ما لا يراه الموظف ولا نحن.
 * - `afterRestart` في السيناريو: يُقتل التطبيق فجأةً بعد السيناريو (كانقطاع الكهرباء)
 *   ثم يُشغَّل على الملف الشخصي نفسه، فيُتفقَّد ما بقي.
 * - `betweenRestarts({ profile })` في السيناريو: بعد القتل وقبل الفتح الثاني، والبرنامج مغلق — يُصنع فيه ما لا
 *   يُصنع والقاعدة مفتوحة (ملفٌّ غاب من مكانه، أثرٌ تركه استرجاعٌ متعثّر…).
 * - `DIWAN_EXE`: يُشغَّل التطبيق المُثبَّت (المبني بـelectron-builder) لا نسخة التطوير.
 * - `appDir` في السيناريو: تطبيقٌ آخر من المشروع بدل ديوان — «أداة مفاتيح ديوان» (tools/keytool)، ومبنيّةً
 *   بـ`DIWAN_KEYTOOL_EXE`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = 9223;
const ELECTRON = resolve('node_modules/electron/dist/electron.exe');
/** التطبيق المُثبَّت إن طُلب — ويُشغَّل بلا مسار المشروع. */
const EXE = process.env.DIWAN_EXE ? resolve(process.env.DIWAN_EXE) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * يُقتل التطبيق بشجرته: الأداة المحمولة (portable) مُطلِقٌ يفكّ البرنامج ويشغّله ابنًا — وقتلُ المُطلِق
 * وحده يُبقي الابن حيًّا ممسكًا منفذ البروتوكول ومجلّد التشغيل.
 */
function killTree(child) {
  if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  child.kill();
}

async function fetchJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      /* لم يبدأ الاستماع بعد */
    }
    await sleep(500);
  }
  throw new Error(`تعذّر الاتصال بـ ${url}`);
}

class Page {
  #ws;
  #id = 0;
  #pending = new Map();
  /** الاستثناءات غير الممسوكة في الصفحة، بنصّها. */
  exceptions = [];

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.exceptions.push(d.exception?.description?.split('\n')[0] ?? d.text);
        return;
      }
      const entry = this.#pending.get(msg.id);
      if (entry) {
        this.#pending.delete(msg.id);
        if (msg.error) entry.reject(new Error(msg.error.message));
        else entry.resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** ينفّذ تعبيرًا في الصفحة وينتظر الوعد إن كان وعدًا. */
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(
        res.exceptionDetails.exception?.description ?? res.exceptionDetails.text ?? 'خطأ في الصفحة'
      );
    }
    return res.result.value;
  }

  /** ينقر أول عنصر يطابق النص المعطى. */
  async clickText(text, selector = 'button, a') {
    const clicked = await this.eval(`
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const el = els.find(e => (e.textContent || '').includes(${JSON.stringify(text)}));
      if (!el) return false;
      el.click();
      return true;
    `);
    if (!clicked) throw new Error(`لم يُعثر على عنصر نصّه: ${text}`);
    await sleep(250);
  }

  /**
   * ينقر عنصرًا نصّه يطابق المعطى تمامًا.
   *
   * clickText تبحث عن «يحتوي»، وكلمة قصيرة مثل «تم» تقع داخل كلمات أخرى
   * («المستمسكات» مثلًا) — فينقر المِقْود شيئًا غير المقصود ويمضي صامتًا.
   */
  async clickExact(text, selector = 'button, a') {
    const clicked = await this.eval(`
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const el = els.find(e => (e.textContent || '').trim() === ${JSON.stringify(text)});
      if (!el) return false;
      el.click();
      return true;
    `);
    if (!clicked) throw new Error(`لم يُعثر على عنصر نصّه تمامًا: ${text}`);
    await sleep(250);
  }

  /**
   * يضغط مفتاحًا ضغطةً حقيقية عبر CDP.
   *
   * لا يكفي `dispatchEvent` من داخل الصفحة لما يُنصت له على `window` بالرمز —
   * فمفاتيح مثل F4 تُقاد من خارج الصفحة لا من داخلها.
   */
  async key(code, { ctrl = false, shift = false } = {}) {
    const KEYS = { F4: 115, Enter: 13, Backspace: 8, Escape: 27, KeyZ: 90, KeyY: 89, KeyB: 66, KeyU: 85, KeyA: 65, KeyI: 73, KeyF: 70 };
    for (let d = 1; d <= 9; d++) KEYS[`Digit${d}`] = 48 + d;
    const vk = KEYS[code];
    if (!vk) throw new Error(`مفتاح غير معروف: ${code}`);
    const modifiers = (ctrl ? 2 : 0) | (shift ? 8 : 0);
    const base = {
      code,
      key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
      modifiers
    };
    await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    await sleep(200);
  }

  /**
   * يكتب حرفًا حرفًا بلوحة المفاتيح كما يكتب الإنسان — keydown ثم الحرف: فمعالجٌ يمنع الحرف يُرى
   * (`type` يضع القيمة مباشرةً فلا يراه — فاتت به كلمة سرّ الأداة لا تُكتب).
   */
  async typeKeys(selector, text) {
    const ok = await this.eval(`const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); return document.activeElement === el;`);
    if (!ok) throw new Error(`لا حقل يُكتب فيه: ${selector}`);
    for (const ch of text) {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    }
    await sleep(100);
  }

  /** يكتب في حقل — عبر مُعيِّن React ليصل التغيير إلى الحالة. */
  async type(selector, value) {
    const ok = await this.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    if (!ok) throw new Error(`لم يُعثر على الحقل: ${selector}`);
    await sleep(150);
  }

  /**
   * ينتقل إلى شاشة بمسارها (data-path).
   *
   * والمسار في أيّ مكان: السكّة بوجهاتها الخمس، وتبويبات الوجهة (أشخاص وجهات…)، وبطاقات الشبّاك
   * للأدوات (المرحلة ٢ من UPGRADE.md). وما ليس ظاهرًا الآن يُبلغ من وجهته أوّلًا: تبويب «جهات»
   * يُرى في «الزبائن»، فيُفتح الزبائن ثم التبويب.
   */
  async goto(route) {
    const click = (path) =>
      this.eval(`
        const el = document.querySelector('[data-path=' + JSON.stringify(${JSON.stringify(path)}) + ']');
        el?.click();
        return Boolean(el);
      `);
    let found = await click(route);
    if (!found) {
      // تبويبٌ لم يُرسم بعد: يُفتح أوّل ما في وجهته ثم يُعاد.
      const viaDest = { 'clients-directory': 'citizens-identity-records', 'audit-log-integrity': 'transactions-archive-ledger', 'header-seal-configuration': 'templates-library-drafts', 'diwan-fonts': 'templates-library-drafts', 'diwan-elements': 'templates-library-drafts' }[route];
      if (viaDest && (await click(viaDest))) {
        await sleep(500);
        found = await click(route);
      }
    }
    if (!found) throw new Error(`لا شاشة بهذا المسار: ${route}`);
    await sleep(700);
  }

  async text() {
    return this.eval(`return document.body.innerText;`);
  }

  /** ينتظر شرطًا في الصفحة حتى يصدق أو تمضي المهلة — بدل مهلةٍ ثابتة تخون الجهاز المثقل (D170). */
  async until(condition, ms = 10000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try {
        if (await this.eval(condition)) return true;
      } catch {
        // الصفحة لم تُرسم بعد، أو `window.diwan` لم يُعرَّف.
      }
      await sleep(150);
    }
    return false;
  }

  async shot(path) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(res.data, 'base64'));
  }
}

export async function drive(scenario, { userDataDir, shotsDir, env, keepOnboarding = false, keepRecovery = false, keepProfile = false, appDir = '.', exe = EXE } = {}) {
  const profile = userDataDir ?? join(process.env.TEMP ?? '.', `diwan-drive-${Date.now()}`);
  if (!keepProfile) rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });

  // نافذة الفحص تعمل كأنها ظاهرة ولو غطّتها نافذةٌ أخرى: Chromium يُبطئ مؤقّتات النافذة المحجوبة إلى
  // نحو ثانية، فيقرأ السيناريو الإطار قبل أن يُعاد رسمه (تقلّب فحص صورة المعاملة بها).
  const args = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ];
  const child = spawn(exe ?? ELECTRON, exe ? args : [appDir, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    // «none»: لا ماسح تحت المِقْود إلا ما يعطيه السيناريو صورةً — فماسحٌ موصولٌ بجهاز
    // الاختبار لا يمسح ما على زجاجه (مسح بطاقةً حقيقية مرّة) ولا يغيّر النتيجة.
    env: { ...process.env, DIWAN_TEST_SCAN_FILE: 'none', ...(env ?? {}) }
  });
  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));

  try {
    // المنفذ يجيب قبل النافذة؛ والإقلاع قد يعمل قبلها (نقل مجلّد البيانات، D236) — فتُنتظر الصفحة كما يُنتظر المنفذ.
    let target;
    for (let i = 0; i < 60 && !target; i++) {
      target = (await fetchJson(`http://127.0.0.1:${PORT}/json/list`)).find((t) => t.type === 'page');
      if (!target) await sleep(500);
    }
    if (!target) throw new Error('لم تُفتح صفحة');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    const page = new Page(ws);
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    // الواجهة مرسومة: معالج البداية ظاهر، أو السكّة والمكتب قد بدأ من قبل — انتظارٌ على شرطٍ لا مهلةٌ ثابتة
    // (كانت ١٫٥ ث، فبقي المعالج مفتوحًا فوق الشاشات حين تأخّر الرسم على جهازٍ مثقل، D170).
    await page.until(
      `return Boolean(document.querySelector('[data-act="onboarding-skip"]')) || (Boolean(document.querySelector('[data-sidebar="rail"]')) && (await window.diwan.settings.get()).onboarded === true);`
    );

    // معالج البداية يظهر على كل ملفٍّ جديد — ويُتخطّى هنا إلا لسيناريو يفحصه هو.
    if (!keepOnboarding) {
      await page.eval(`document.querySelector('[data-act="onboarding-skip"]')?.click(); return true;`);
      await page.until(`return !document.querySelector('[data-act="onboarding-skip"]');`, 3000);
    }
    // ورمز الاسترداد يُعرض أوّل مرّةٍ على كلّ ملفٍّ جديد (D237) — ويُقَرّ به هنا إلا لسيناريو يفحصه هو. والقنوات تجري
    // بترتيبها، فسؤال الحوار عن الرمز قد أُجيب حين يعود الإقرار؛ ثم يُغلق إن ظهر.
    if (!keepRecovery && (await page.eval(`return Boolean(window.diwan?.dataKey);`))) {
      await page.eval(`await window.diwan.dataKey.acknowledge().catch(() => false); await new Promise((r) => setTimeout(r, 100)); document.querySelector('[data-act="recovery-done"]')?.click(); return true;`);
    }

    // `kill` يقتل البرنامج فورًا من خارج البروتوكول: والعملية الرئيسة مشغولةٌ بقيدٍ
    // متزامن لا تمرّر رسائل البروتوكول حتى تفرغ — فلا يُقتل «في منتصف القيد» من داخله.
    const raw = await scenario(page, { profile, shotsDir, kill: () => killTree(child) });
    // وسيناريو يعيد فحوصه قائمةً تُجمع نصًّا: كانت تُطبع قائمةً فلا يعدّها الفحص الشامل ولا يُسقطه ✗ فيها (إصدار ١٫٧٫٠).
    const result = Array.isArray(raw) ? raw.join('\n') : raw;
    await sleep(300);
    ws.close();
    // خطأٌ لم يلتقطه أحد يُقال — ولو مرّت فحوص السيناريو كلّها.
    const thrown = page.exceptions.map((e) => `✗ استثناءٌ غير ممسوك في الواجهة: ${e}`);
    return typeof result === 'string' && thrown.length ? [result, ...thrown].join('\n') : result;
  } finally {
    killTree(child);
    await sleep(400);
  }
}

// تشغيل مباشر: node tools/drive.mjs scenario.mjs
if (process.argv[2]) {
  // كلّ ما يكتبه التشغيل — الملف الشخصي، ومجلّدات السيناريو (تُبنى من TEMP)، وما يحفظه التطبيق —
  // في مجلّدٍ واحد يُمحى في آخره ولو سقط السيناريو: كانت تبقى في TEMP حتى بلغت أربعة آلاف مجلّد.
  // و`KEEP_RUN=1` يُبقيه للتحقيق. وبلا `DIWAN_TEST_SAVE_DIR` يُعطى مجلّدًا فيه: فحوص الحفظ لا
  // تُتخطّى صامتةً.
  // ما يُفسد التشغيل من خارجه (L58) يوقفه قبل الإقلاع: جلسةٌ أخرى على المنفذ فيتّصل السيناريو ببرنامجها، و`DIWAN_TEST_PRINT_LOG`
  // من الطرفية يقبل أيّ طابعة فيُبطل `printResume`. وما يضبطه السيناريو في `prepare` يبقى (يمرّ إلى البرنامج لا إلى الطرفية).
  const busy = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
  if (busy) {
    console.log('✗ المنفذ ٩٢٢٣ محجوز — جلسةٌ أخرى تعمل');
    process.exit(1);
  }
  if (process.env.DIWAN_TEST_PRINT_LOG) {
    console.log('✗ DIWAN_TEST_PRINT_LOG مضبوطٌ في الطرفية — يقبل أيّ طابعة فيُبطل سيناريو printResume؛ يُضبط في env السيناريو (prepare) لا في الطرفية');
    process.exit(1);
  }
  const root = mkdtempSync(join(process.env.TEMP ?? tmpdir(), 'diwan-run-'));
  process.env.TEMP = process.env.TMP = root;
  process.env.DIWAN_TEST_SAVE_DIR ??= join(root, 'save');
  let out;
  try {
    const mod = await import(pathToFileURL(resolve(process.argv[2])).href);
    // سيناريو يحتاج تهيئةً قبل إقلاع التطبيق (ملفًا يُبنى، أو متغيّر بيئة يُضبط).
    const env = mod.prepare ? await mod.prepare() : undefined;
    const profile = join(root, `diwan-drive-${Date.now()}`);
    out = await drive(mod.default, {
      userDataDir: profile,
      shotsDir: process.env.SHOT_DIR,
      env,
      keepOnboarding: mod.keepOnboarding === true,
      keepRecovery: mod.keepRecovery === true,
      ...(mod.appDir ? { appDir: resolve(mod.appDir), exe: process.env.DIWAN_KEYTOOL_EXE ? resolve(process.env.DIWAN_KEYTOOL_EXE) : null } : {})
    });
    // «أُغلق فجأةً ثم فُتح»: الملف الشخصي نفسه، وتطبيقٌ قُتل لا أُغلق.
    if (mod.afterRestart) {
      if (mod.betweenRestarts) await mod.betweenRestarts({ profile });
      const again = await drive(mod.afterRestart, {
        userDataDir: profile,
        keepProfile: true,
        shotsDir: process.env.SHOT_DIR,
        env,
        keepOnboarding: true,
        keepRecovery: mod.keepRecovery === true
      });
      out = [out, again].filter((x) => typeof x === 'string').join('\n');
    }
    if (out !== undefined) console.log(out);
  } catch (e) {
    out = `✗ سقط السيناريو: ${e?.stack ?? e}`;
    console.log(out);
  } finally {
    if (process.env.KEEP_RUN !== '1') {
      try {
        // عمليات Electron الفرعية قد تمسك ملفًّا لحظاتٍ بعد القتل — فيُعاد المحو.
        rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      } catch (e) {
        console.error(`لم يُمحَ مجلّد التشغيل ${root}: ${e.message}`);
      }
    }
  }
  // فحصٌ واحدٌ فاشل يُفشل السيناريو كلّه — وإلا مرّ ✗ في سجلٍّ لا يقرؤه أحد.
  process.exit(typeof out === 'string' && out.includes('✗') ? 1 : 0);
}
