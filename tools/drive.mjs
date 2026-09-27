/**
 * مشغّل التطبيق الحقيقي عبر بروتوكول Chrome DevTools.
 *
 * يشغّل «ديوان» المبني — بعمليته الرئيسية وقاعدة بياناته الفعلية — ثم يضغط الأزرار
 * ويقرأ الشاشة ويلتقط الصور. الغرض: التحقق أن الأزرار تعمل، لا أن العلامات موجودة.
 *
 * الاستعمال:
 *   node tools/drive.mjs <script.mjs>     يشغّل سيناريو ويخرج
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = 9223;
const ELECTRON = resolve('node_modules/electron/dist/electron.exe');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
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
    const KEYS = { F4: 115, Enter: 13, Backspace: 8, Escape: 27, KeyZ: 90, KeyY: 89, KeyB: 66, KeyU: 85 };
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
   * ينتقل إلى شاشة بمسارها (data-path) أو برقمها.
   *
   * والمسار أولى: إضافة شاشة إلى الشريط تُزحزح الأرقام فتكسر كل سيناريو.
   */
  async goto(route) {
    const found = await this.eval(`
      const links = [...document.querySelectorAll('aside a[data-path]')];
      const el = typeof ${JSON.stringify(route)} === 'number'
        ? links[${JSON.stringify(route)}]
        : links.find((a) => a.dataset.path === ${JSON.stringify(route)});
      el?.click();
      return Boolean(el);
    `);
    if (!found) throw new Error(`لا شاشة بهذا المسار: ${route}`);
    await sleep(700);
  }

  async text() {
    return this.eval(`return document.body.innerText;`);
  }

  async shot(path) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(res.data, 'base64'));
  }
}

export async function drive(scenario, { userDataDir, shotsDir, env, keepOnboarding = false } = {}) {
  const profile = userDataDir ?? join(process.env.TEMP ?? '.', `diwan-drive-${Date.now()}`);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });

  const child = spawn(
    ELECTRON,
    ['.', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`],
    { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(env ?? {}) } }
  );
  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));

  try {
    const targets = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
    const target = targets.find((t) => t.type === 'page');
    if (!target) throw new Error('لم تُفتح صفحة');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    const page = new Page(ws);
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    await sleep(1500);

    // معالج البداية يظهر على كل ملفٍّ جديد — ويُتخطّى هنا إلا لسيناريو يفحصه هو.
    if (!keepOnboarding) {
      await page.eval(`document.querySelector('[data-act="onboarding-skip"]')?.click(); return true;`);
      await sleep(500);
    }

    const result = await scenario(page, { profile, shotsDir });
    ws.close();
    return result;
  } finally {
    child.kill();
    await sleep(400);
  }
}

// تشغيل مباشر: node tools/drive.mjs scenario.mjs
if (process.argv[2]) {
  const mod = await import(pathToFileURL(resolve(process.argv[2])).href);
  // سيناريو يحتاج تهيئةً قبل إقلاع التطبيق (ملفًا يُبنى، أو متغيّر بيئة يُضبط).
  const env = mod.prepare ? await mod.prepare() : undefined;
  const out = await drive(mod.default, {
    shotsDir: process.env.SHOT_DIR,
    env,
    keepOnboarding: mod.keepOnboarding === true
  });
  if (out !== undefined) console.log(out);
  // فحصٌ واحدٌ فاشل يُفشل السيناريو كلّه — وإلا مرّ ✗ في سجلٍّ لا يقرؤه أحد.
  process.exit(typeof out === 'string' && out.includes('✗') ? 1 : 0);
}
