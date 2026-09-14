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

  async goto(routeIndex) {
    await this.eval(`
      const links = [...document.querySelectorAll('aside a[data-path]')];
      links[${routeIndex}]?.click();
    `);
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

export async function drive(scenario, { userDataDir, shotsDir } = {}) {
  const profile = userDataDir ?? join(process.env.TEMP ?? '.', `diwan-drive-${Date.now()}`);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });

  const child = spawn(
    ELECTRON,
    ['.', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`],
    { stdio: ['ignore', 'pipe', 'pipe'] }
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
  const out = await drive(mod.default, { shotsDir: process.env.SHOT_DIR });
  if (out !== undefined) console.log(out);
  process.exit(0);
}
