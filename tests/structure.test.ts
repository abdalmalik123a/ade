/**
 * اختبار الهيكل (ز١) — يحرس ترتيب البرنامج كلّه في أقلّ من ثانية، ورسالة كلّ فشلٍ تقول الملفّ والقاعدة بالعربية:
 *
 * ١. **الطبقات**: `shared` لا يستورد Electron ولا وحدات Node ولا الواجهة ولا العملية الرئيسة؛ والواجهة لا تستورد العملية
 *    الرئيسة ولا Electron ولا Node؛ وخدمات العملية الرئيسة لا تستورد قنواتها؛ و`child_process` في ملفّاتٍ معروفة؛
 *    و`shell.openExternal` في `harden.ts` وحده؛ و`utilityProcess.fork` في `workerHost.ts` وحده، والعامل (`src/main/worker/`)
 *    لا يستورد Electron ولا `db/` ولا `ipc/`؛ و«أزل الخلفية» في العامل وحده (A18).
 * ٢. **متغيّرات البيئة** في `src/main`: كلّ مفتاحٍ في قائمةٍ صريحة — ومفتاحٌ جديد يستلزم تعديلها عمدًا.
 * ٣. **`new BrowserWindow(`** في ملفّاتٍ معروفة وحدها.
 * ٤. **القنوات**: كلّ `invoke` في `preload` لها `ipcMain.handle` (أو `handleChecked`) والعكس، وكذلك `send` ↔ `ipcMain.on`، و`on` ↔ `.send`.
 * ٥. **الحجم**: ملفٌّ فوق ٤٠٠ سطر مسجَّلٌ في `structure.allow.json` بحجمه — فلا يظهر ملفٌّ جديدٌ فوقه ولا ينمو مسجَّل.
 *    السقف ينخفض ولا يرتفع: `DIWAN_STRUCTURE_RATCHET=<مسار>[,<مسار>…] npx vitest run tests/structure.test.ts` يكتب
 *    الأحجام الأصغر لهذه الملفّات وحدها ويُسقط منها ما نزل تحت ٤٠٠ — ولا يضيف ملفًّا ولا يرفع رقمًا. و`=1` كان يخفض
 *    السقوف كلّها لا سقف ملفّك (L60)، فيسقط اليوم برسالةٍ ولا يكتب شيئًا.
 * ٦. **المخطط**: `CREATE TABLE` و`ALTER TABLE` في `schema.sql` و`search.sql` وملفّات `prepare*`/`ensure*` المعروفة.
 * ٧. **المساعدات المشتركة** (ز٢): لا تعريف لـ`toIndic` ولا `escapeHtml` خارج `shared/arabic.ts` و`shared/html.ts` —
 *    إلا نسخ مجلّد التصاميم الخمس (تُنقل في خطّة التصاميم، DESIGNS.md؛ والقائمة تتناقص).
 * ٨. **الأبواب الواحدة** (A04، D68): لا شبكة — لا وحدات الشبكة ولا `fetch(` ولا `XMLHttpRequest`/`WebSocket` في Node، و`net.fetch`
 *    في `main/index.ts` وحده، و`fetch(` الواجهة لـ`diwan://` وحده، و`connect-src` ثابت —؛ و`dependencies` قائمةٌ صريحة؛ وحال الترخيص
 *    من `licenseStatus()` في `ipc/license.ts` وحدها. وباب البوّابة (F01) يُضاف إلى قوائمها عمدًا حين يُبنى.
 * ٩. **القنوات القائمة** (A04، D70): كلّ اسمٍ في `ipcMain.handle('…'`/`ipcMain.on('…'` في `channels.allow.json`، والقناة الجديدة بـ`handleChecked`
 *    وحرّاسها (`@shared/bridgeGuards`)؛ و`${}` في `prepare`/`exec` بسطرٍ أو أكثر (D73) في ملفّاته المعروفة وحدها — والقائمتان تتناقصان ولا تزيدان: ما انتقل أو زال يُحذف منهما.
 * ١٠. **المال صامت** (A06، D66، ر161): كلّ سطرٍ في `src/` (ts وtsx وsql) فيه `fee` تعريفُ العمود `fee … INTEGER NOT NULL DEFAULT 0` وحده —
 *    ثلاثة: `schema.sql` مرّتين و`prepareDocuments` —، فالعمودان باقيان في القاعدة بصفرهما ولا يعودان إلى الأنواع ولا الاستعلامات ولا الشاشة.
 *
 * وهو الأصل العامّ: قواعد التصاميم (`designStructure`، DESIGNS.md ٣٫٤) تُبنى عليه لاحقًا.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const ALLOW_FILE = join(__dirname, 'structure.allow.json');
const CHANNELS_FILE = join(__dirname, 'channels.allow.json');
const SIZE_CAP = 400;

const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/');

function walk(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, ext) : ext.test(n) ? [p] : [];
  });
}

type Source = { path: string; abs: string; text: string };
const SOURCES: Source[] = walk(join(ROOT, 'src'), /\.(ts|tsx)$/).map((abs) => ({ abs, path: rel(abs), text: readFileSync(abs, 'utf8') }));
const under = (prefix: string) => SOURCES.filter((s) => s.path.startsWith(prefix));

/** ما يستورده الملفّ: `import … from`، و`export … from`، و`import()`، و`require()`. */
function importsOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?\sfrom\s*['"]([^'"]+)['"]/g)) out.push(m[1]!);
  for (const m of text.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) out.push(m[1]!);
  for (const m of text.matchAll(/\b(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!);
  return out;
}

const NODE = new Set(builtinModules);
const isNode = (spec: string) => spec.startsWith('node:') || NODE.has(spec) || NODE.has(spec.split('/')[0]!);
/** المسار المحلول لاستيرادٍ نسبيّ — أو `null` لحزمةٍ أو اسمٍ مستعار. */
const resolved = (s: Source, spec: string) => (spec.startsWith('.') ? rel(resolve(dirname(s.abs), spec)) : null);

const lineCount = (text: string) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);

describe('اختبار الهيكل (ز١)', () => {
  it('١ — الطبقات: كلٌّ يستورد ممّا تحته وحده', () => {
    const bad: string[] = [];
    for (const s of under('src/shared/')) {
      for (const spec of importsOf(s.text)) {
        const to = resolved(s, spec) ?? '';
        if (spec === 'electron' || isNode(spec)) bad.push(`${s.path}: المشترك يستورد «${spec}» — لا Electron ولا Node فيه (يعمل في العمليّتين وفي الاختبار)`);
        else if (to.startsWith('src/main') || to.startsWith('src/renderer') || to.startsWith('src/preload')) bad.push(`${s.path}: المشترك يستورد «${spec}» من فوقه`);
      }
    }
    for (const s of under('src/renderer/')) {
      for (const spec of importsOf(s.text)) {
        const to = resolved(s, spec) ?? '';
        if (spec === 'electron' || isNode(spec)) bad.push(`${s.path}: الواجهة تستورد «${spec}» — وهي في صندوقٍ بلا Node؛ ما تحتاجه يمرّ بالجسر`);
        else if (to.startsWith('src/main') || to.startsWith('src/preload')) bad.push(`${s.path}: الواجهة تستورد «${spec}» من العملية الرئيسة`);
      }
    }
    for (const s of under('src/main/services/')) {
      for (const spec of importsOf(s.text)) {
        if ((resolved(s, spec) ?? '').startsWith('src/main/ipc')) bad.push(`${s.path}: خدمةٌ تستورد قناةً «${spec}» — القنوات تنادي الخدمات لا العكس`);
      }
    }
    const SPAWNERS = ['src/main/ipc/license.ts', 'src/main/ipc/update.ts', 'src/main/services/inbox.ts', 'src/main/services/scanner.ts', 'src/main/services/printers.ts'];
    for (const s of SOURCES) {
      if (importsOf(s.text).some((spec) => spec === 'child_process' || spec === 'node:child_process') && !SPAWNERS.includes(s.path)) {
        bad.push(`${s.path}: يشغّل برامج (child_process) خارج الملفّات المعروفة — أضفه إلى القائمة عمدًا إن لزم`);
      }
      if (/shell\.openExternal\s*\(/.test(s.text) && s.path !== 'src/main/harden.ts') bad.push(`${s.path}: shell.openExternal خارج harden.ts — الروابط الخارجية تمرّ بـopenExternalSafe`);
      if (/utilityProcess\.fork\s*\(/.test(s.text) && s.path !== 'src/main/services/workerHost.ts') bad.push(`${s.path}: utilityProcess.fork خارج workerHost.ts — العامل المستقلّ يُقلعه مضيفه وحده (A03)`);
      if (s.text.includes('diwan_psd.node') && s.path !== 'src/main/worker/nativePsd.ts') {
        bad.push(`${s.path}: يذكر diwan_psd.node خارج worker/nativePsd.ts — الإضافة الأصلية تُحمَّل من موضعٍ واحد (A20)`);
      }
    }
    // والعامل المستقلّ (A03، D53): لا Electron ولا القاعدة ولا القنوات — القاعدة والمخزن في الرئيسة وحدها.
    for (const s of under('src/main/worker/')) {
      for (const spec of importsOf(s.text)) {
        const to = resolved(s, spec) ?? '';
        if (spec === 'electron' || to.startsWith('src/main/db') || to.startsWith('src/main/ipc')) bad.push(`${s.path}: العامل يستورد «${spec}» — لا Electron ولا db/ ولا ipc/ فيه`);
      }
    }
    // و«أزل الخلفية» في العامل وحده (A18، D145): نماذجها لا تُفتح في الرئيسة، ولا طريق قديم بعد السقوط.
    for (const s of under('src/main/').filter((f) => !f.path.startsWith('src/main/worker/') && !f.path.startsWith('src/main/services/'))) {
      for (const spec of importsOf(s.text)) {
        if (/^src\/main\/services\/(portrait|objectCutout)$/.test(resolved(s, spec) ?? '')) bad.push(`${s.path}: يستورد «${spec}» — أزل الخلفية في العامل وحده (A18)`);
      }
      // D207: قراءة PSD لها بديلٌ، والمنع لإزالة الخلفية وحدها (A18).
      if (s.path === 'src/main/ipc/photos.ts' && /runOr\s*\(\s*['"](?:cutout|cutoutObject)['"]/.test(s.text)) bad.push(`${s.path}: يذكر runOr( — أزل الخلفية في العامل وحده (A18)`);
    }
    expect(bad).toEqual([]);
  });

  it('٢ — متغيّرات البيئة في العملية الرئيسة من قائمةٍ صريحة', () => {
    const ALLOWED = new Set([
      // أبواب الاختبار (المِقْود والسيناريوهات)
      'DIWAN_TEST_CLOSE_ANSWER',
      'DIWAN_TEST_DAMAGED_DB',
      'DIWAN_TEST_FAKE_CAMERA',
      'DIWAN_TEST_INBOX',
      'DIWAN_TEST_LICENSE_PUBKEY',
      'DIWAN_TEST_MACHINE_ID',
      'DIWAN_TEST_NOW_FILE',
      'DIWAN_TEST_OPEN_DIR',
      'DIWAN_TEST_OPEN_FILE',
      'DIWAN_TEST_OPEN_FILES',
      'DIWAN_TEST_PRINT_LOG',
      'DIWAN_TEST_ROLLBACK_ACTION',
      'DIWAN_TEST_SAVE_DIR',
      'DIWAN_TEST_SCAN_FILE',
      'DIWAN_TEST_SLOW_ISSUE',
      'DIWAN_TEST_SLOW_WORKER',
      'DIWAN_TEST_UPDATE_NO_LAUNCH',
      'DIWAN_TEST_WINDOWS_FONTS',
      'DIWAN_TEST_WORKER_TIMEOUT',
      // متغيّرات النظام وأداة البناء (WINDIR: مجلّد خطوط Windows — «خطوط ديوان»)
      'ELECTRON_RENDERER_URL',
      'LOCALAPPDATA',
      'WINDIR'
    ]);
    const bad: string[] = [];
    for (const s of under('src/main/')) {
      const keys = [
        ...[...s.text.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]!),
        ...[...s.text.matchAll(/process\.env\[\s*['"]([^'"]+)['"]\s*\]/g)].map((m) => m[1]!)
      ];
      // `license.ts` يقرأ أبوابه بدالّة `test('…')` محصورةٍ في غير المثبّت.
      if (s.path === 'src/main/ipc/license.ts') keys.push(...[...s.text.matchAll(/\btest\(\s*'([A-Z_0-9]+)'\s*\)/g)].map((m) => m[1]!));
      for (const k of keys) if (!ALLOWED.has(k)) bad.push(`${s.path}: يقرأ متغيّر البيئة «${k}» وليس في القائمة — أضفه إليها عمدًا إن لزم`);
      if (/process\.env\[\s*[^'"\s]/.test(s.text) && s.path !== 'src/main/ipc/license.ts') bad.push(`${s.path}: يقرأ متغيّر بيئةٍ باسمٍ متغيّر — لا يُعرف ما يُقرأ`);
    }
    expect(bad).toEqual([]);
  });

  it('٣ — النوافذ تُنشأ في ملفّاتٍ معروفة وحدها (وكلّها تمرّ بالتحصين)', () => {
    const WINDOWS = ['src/main/fillCard.ts', 'src/main/index.ts', 'src/main/ipc/designs.ts', 'src/main/services/render.ts'];
    const bad = SOURCES.filter((s) => /new BrowserWindow\s*\(/.test(s.text) && !WINDOWS.includes(s.path)).map(
      (s) => `${s.path}: ينشئ نافذةً (new BrowserWindow) خارج الملفّات المعروفة — والنافذة تحتاج hardenWindow`
    );
    expect(bad).toEqual([]);
  });

  it('٤ — القنوات متطابقة بين الجسر والعملية الرئيسة', () => {
    // والجسر أبوابٌ في ملفّاتها (تقسيمه بعد ١٫٧٫٠) — فتُقرأ كلّها.
    const preload = under('src/preload/').map((s) => s.text).join('\n');
    const main = under('src/main/').map((s) => s.text).join('\n');
    const set = (text: string, rx: RegExp) => new Set([...text.matchAll(rx)].map((m) => m[1]!));
    const invoked = set(preload, /\binvoke(?:<[^>]*>)?\(\s*'([^']+)'/g);
    const handled = set(main, /(?:ipcMain\.handle|handleChecked)\(\s*'([^']+)'/g);
    const sent = set(preload, /ipcRenderer\.(?:send|sendSync)\(\s*'([^']+)'/g);
    const heard = set(main, /ipcMain\.(?:on|once)\(\s*'([^']+)'/g);
    const listened = set(preload, /ipcRenderer\.(?:on|once)\(\s*'([^']+)'/g);
    const pushed = set(main, /\.send\(\s*'([^']+)'/g);
    const bad: string[] = [];
    for (const c of invoked) if (!handled.has(c)) bad.push(`القناة «${c}» يناديها الجسر ولا يجيبها ipcMain.handle`);
    for (const c of handled) if (!invoked.has(c)) bad.push(`القناة «${c}» يجيبها ipcMain.handle ولا يناديها الجسر`);
    for (const c of sent) if (!heard.has(c)) bad.push(`الرسالة «${c}» يرسلها الجسر ولا يسمعها ipcMain.on`);
    for (const c of heard) if (!sent.has(c)) bad.push(`ipcMain.on «${c}» لا يرسلها الجسر`);
    for (const c of listened) if (!pushed.has(c)) bad.push(`الجسر يسمع «${c}» ولا ترسلها العملية الرئيسة`);
    expect(bad).toEqual([]);
    expect(invoked.size).toBeGreaterThan(100);
  });

  it('٥ — الحجم: لا ملفٌّ جديدٌ فوق ٤٠٠ سطر، ولا ينمو ملفٌّ مسجَّل', () => {
    const sizes = new Map(SOURCES.map((s) => [s.path, lineCount(s.text)]));
    const allow: Record<string, number> = existsSync(ALLOW_FILE) ? (JSON.parse(readFileSync(ALLOW_FILE, 'utf8')) as Record<string, number>) : {};
    const ratchet = process.env['DIWAN_STRUCTURE_RATCHET'];
    if (ratchet === '1') {
      throw new Error(
        'DIWAN_STRUCTURE_RATCHET=1 كان يخفض السقوف كلّها لا سقف ملفّك (L60) — سمِّ ملفّك: DIWAN_STRUCTURE_RATCHET=src/main/x.ts[,src/…]. ولم يُكتب شيء.'
      );
    }
    if (ratchet) {
      // ينخفض ولا يرتفع، للملفّات المسمّاة وحدها: الأصغر يُكتب، وما نزل تحت الحدّ أو حُذف يسقط، ولا يُضاف جديد.
      const named = ratchet.split(',').map((p) => p.trim().replace(/\\/g, '/')).filter(Boolean);
      const unknown = named.filter((p) => allow[p] === undefined).map((p) => `${p}: ليس في structure.allow.json — الخفض لا يضيف ملفًّا (والمسار من جذر المستودع)`);
      expect(unknown).toEqual([]);
      const next = { ...allow };
      for (const path of named) {
        const n = sizes.get(path);
        if (n === undefined || n <= SIZE_CAP) delete next[path];
        else next[path] = Math.min(allow[path]!, n);
      }
      writeFileSync(ALLOW_FILE, `${JSON.stringify(next, null, 2)}\n`);
      return;
    }
    const bad: string[] = [];
    for (const [path, n] of sizes) {
      const cap = allow[path];
      if (cap === undefined && n > SIZE_CAP) bad.push(`${path}: ${n} سطرًا — فوق ${SIZE_CAP}؛ قسّمه (الملفّ الجديد لا يُسجَّل)`);
      else if (cap !== undefined && n > cap) bad.push(`${path}: نما إلى ${n} سطرًا وسقفه ${cap} — السقف ينخفض ولا يرتفع؛ انقل ما زاد إلى ملفٍّ آخر`);
    }
    expect(bad).toEqual([]);
  });

  it('٦ — المخطط: الجداول تُنشأ وتُعدَّل في أماكنها المعروفة', () => {
    const SCHEMA = new Set([
      'src/main/db/schema.sql',
      'src/main/db/search.sql',
      // الترقيات المرقّمة (D49): مكان كلّ ترقيةٍ جديدة، سطرًا برقمه التالي.
      'src/main/db/migrations.ts',
      // `prepare*`/`ensure*`: أعمدةٌ تُضاف بعد الإصدار الأوّل بحارس PRAGMA table_info
      'src/main/services/citizens.ts',
      'src/main/services/clients.ts',
      'src/main/services/clips.ts',
      'src/main/services/documents.ts',
      'src/main/services/genderMemory.ts',
      'src/main/services/learning.ts',
      'src/main/services/letterheads.ts',
      'src/main/services/orders.ts',
      'src/main/services/revisions.ts',
      'src/main/services/searchIndex.ts',
      'src/main/services/templates.ts'
    ]);
    const files = [...SOURCES.map((s) => ({ path: s.path, text: s.text })), ...walk(join(ROOT, 'src'), /\.sql$/).map((abs) => ({ path: rel(abs), text: readFileSync(abs, 'utf8') }))];
    const bad = files
      .filter((f) => /\b(?:CREATE\s+(?:VIRTUAL\s+)?TABLE|ALTER\s+TABLE)\b/i.test(f.text) && !SCHEMA.has(f.path))
      .map((f) => `${f.path}: ينشئ جدولًا أو يعدّله خارج المخطط وملفّات prepare/ensure المعروفة — والترحيل يُختبر بقواعد الإصدارات المبيعة`);
    expect(bad).toEqual([]);
  });

  it('٧ — المساعدات المشتركة لا تُعرَّف ثانيةً (ز٢)', () => {
    const HOME: Record<string, string> = { toIndic: 'src/shared/arabic.ts', escapeHtml: 'src/shared/html.ts' };
    // نسخ مجلّد التصاميم: تُنقل في خطّة التصاميم — والقائمة تتناقص ولا تزيد.
    const DESIGN_COPIES = new Set([
      'src/renderer/src/designs/BatchPanel.tsx',
      'src/renderer/src/designs/CameraStudio.tsx',
      'src/renderer/src/designs/Gallery.tsx',
      'src/renderer/src/designs/PrintOptions.tsx',
      'src/renderer/src/designs/SheetsPreview.tsx'
    ]);
    const bad: string[] = [];
    for (const s of SOURCES) {
      for (const [name, home] of Object.entries(HOME)) {
        const defined = new RegExp(`(?:\\b(?:const|let|var)\\s+${name}\\s*=|\\bfunction\\s+${name}\\b)`).test(s.text);
        if (!defined || s.path === home) continue;
        if (name === 'toIndic' && DESIGN_COPIES.has(s.path)) continue;
        bad.push(`${s.path}: يعرّف ${name} من جديد — استورده من ${home}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('٨ — الأبواب الواحدة: الشبكة والاعتماديات وحال الترخيص (A04)', () => {
    // اليوم بلا شبكة إلا ملفٌّ محلّيٌّ في بروتوكول diwan://store — وباب البوّابة (F01) يُضاف إلى هذه القوائم عمدًا حين يُبنى.
    const NET_MODULES = new Set(['http', 'https', 'http2', 'net', 'tls', 'dgram', 'dns']);
    const NET_APIS = /\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/g;
    const NET_FETCH = ['src/main/index.ts']; // net.fetch لملفّ المخزن في protocol.handle('diwan')
    const CONNECT_SRC = "'self' diwan:";
    const DEPENDENCIES = ['better-sqlite3', 'docx', 'exceljs', 'fflate', 'onnxruntime-node', 'pdf-lib', 'tesseract.js'];
    const LICENSE_SERVICE = ['src/main/ipc/license.ts']; // التوقيع وevaluate
    const LICENSE_STATUS = ['src/main/ipc/license.ts', 'src/main/ipc/support.ts'];
    const PRODUCTIVE = ['src/main/ipc/license.ts', 'src/main/ipc/gate.ts'];
    const bad: string[] = [];

    // (١) الشبكة في Node: لا وحدة شبكة ولا fetch ولا ما يشبهها، وnet.fetch/net.request في ملفّه وحده.
    for (const s of SOURCES.filter((x) => /^src\/(main|preload|shared)\//.test(x.path))) {
      for (const spec of importsOf(s.text)) {
        if (NET_MODULES.has(spec.replace(/^node:/, '').split('/')[0]!)) bad.push(`${s.path}: يستورد وحدة الشبكة «${spec}» — ديوان بلا إنترنت، وباب البوّابة ملفٌّ واحدٌ يُبنى مع F01`);
      }
      if (/(?<!\bnet\.)\bfetch\s*\(/.test(s.text)) bad.push(`${s.path}: ينادي fetch( — ديوان بلا إنترنت، والملفّ المحلّي يُقرأ من القرص`);
      if (/\bnet\.(?:fetch|request)\s*\(/.test(s.text) && !NET_FETCH.includes(s.path)) bad.push(`${s.path}: ينادي net.fetch/net.request خارج src/main/index.ts — هو لملفّ المخزن في بروتوكول diwan:// وحده`);
      for (const m of s.text.matchAll(NET_APIS)) bad.push(`${s.path}: يستعمل ${m[1]} — ديوان بلا إنترنت`);
    }

    // (٢) الشبكة في الواجهة: fetch لملفّات المخزن (diwan://) وحدها، وconnect-src كما هو.
    for (const s of under('src/renderer/')) {
      for (const m of s.text.matchAll(/\bfetch\s*\(\s*(['"`]diwan:\/\/)?/g)) {
        if (!m[1]) bad.push(`${s.path}: fetch( لغير «diwan://» — الواجهة تقرأ ملفّات المخزن وحدها، وما سواها يمرّ بالجسر`);
      }
      for (const m of s.text.matchAll(NET_APIS)) bad.push(`${s.path}: يستعمل ${m[1]} — الواجهة بلا شبكة`);
    }
    const html = readFileSync(join(ROOT, 'src/renderer/index.html'), 'utf8');
    const connects = [...html.matchAll(/connect-src\s+([^;"]*)/g)].map((m) => m[1]!.trim().replace(/\s+/g, ' '));
    if (connects.length !== 1 || connects[0] !== CONNECT_SRC) {
      bad.push(`src/renderer/index.html: connect-src «${connects.join(' | ') || 'غائب'}» — يبقى «${CONNECT_SRC}» بالضبط؛ والبوّابة تكلّمها الرئيسة لا الواجهة`);
    }

    // (٣) الاعتماديات: السبع نفسها — والجديدة تُضاف هنا عمدًا بموافقة المالك.
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    const deps = Object.keys(pkg.dependencies ?? {});
    for (const d of deps) if (!DEPENDENCIES.includes(d)) bad.push(`package.json: اعتماديةٌ جديدة «${d}» — تُضاف إلى قائمة هذا الاختبار عمدًا بموافقة المالك، بعد التأكّد أنّها لا تكلّم الشبكة`);
    for (const d of DEPENDENCIES) if (!deps.includes(d)) bad.push(`package.json: «${d}» غابت من dependencies — أزِلها من قائمة هذا الاختبار عمدًا`);

    // (٤) حال الترخيص من licenseStatus() وحدها، والتوقيع لا يُقرأ خارج قناته.
    for (const s of SOURCES) {
      const service = importsOf(s.text).some((spec) => /^src\/main\/services\/license(?:\.[jt]s)?$/.test(resolved(s, spec) ?? ''));
      if (service && !LICENSE_SERVICE.includes(s.path)) bad.push(`${s.path}: يستورد services/license (التوقيع وevaluate) — حال الترخيص من licenseStatus() في ipc/license.ts وحدها`);
      if (/\blicenseStatus\s*\(/.test(s.text) && !LICENSE_STATUS.includes(s.path)) {
        bad.push(`${s.path}: ينادي licenseStatus( خارج ipc/license.ts وipc/support.ts — القناة المنتِجة تُضاف إلى بوّابة ipc/gate.ts، والواجهة تسأل window.diwan.license.status()`);
      }
      if (/\brequireProductive\s*\(/.test(s.text) && !PRODUCTIVE.includes(s.path)) bad.push(`${s.path}: ينادي requireProductive( خارج ipc/gate.ts — القناة المنتِجة تُضاف إلى قائمة البوّابة هناك`);
    }
    expect(bad).toEqual([]);
  });

  it('٩ — القنوات القائمة: الجديدة بـhandleChecked وحرّاسها، و${} في SQL في ملفّاته المعروفة (A04)', () => {
    // القائمتان تتناقصان ولا تزيدان: ما انتقل إلى handleChecked أو زال يُحذف منهما عمدًا، ولا يُضاف إليهما شيء.
    const CHANNELS = new Set(JSON.parse(readFileSync(CHANNELS_FILE, 'utf8')) as string[]);
    // `${}` في prepare/exec بسطرٍ أو أكثر (جرد D65، وD73): أسماء جداول وأعمدة وشروطٌ من قوائم ثابتة — والقيم كلّها تُربط بـ`?`.
    const SQL_TEMPLATES = new Set([
      'src/main/ipc/backup.ts',
      'src/main/services/backup.ts',
      'src/main/services/citizens.ts',
      'src/main/services/clients.ts',
      'src/main/services/clips.ts',
      'src/main/services/contentPack.ts',
      'src/main/services/dataVersion.ts',
      // نُقل من documents.ts في D81 بقوالبه الثمانية، ولا قالب جديد (٩ قبل النقل و١ + ٨ بعده) — أُضيف بكلمة المالك «D81 ١»، والقائمة بعده تتناقص ولا تزيد.
      'src/main/services/documentList.ts',
      'src/main/services/documents.ts',
      'src/main/services/letterheads.ts',
      'src/main/services/orders.ts',
      'src/main/services/preUpdateBackup.ts',
      // فاتت جرد D65 (سطرٌ واحد) — فيه منذ 08e9e0d، أُضيف في D73 مرّةً، والقائمة بعده تتناقص ولا تزيد.
      'src/main/services/questionBank.ts',
      'src/main/services/revisions.ts',
      'src/main/services/searchIndex.ts',
      'src/main/services/storeRefs.ts',
      'src/main/services/templates.ts'
    ]);
    const bad: string[] = [];
    const channels = new Set<string>();
    const templates = new Set<string>();
    for (const s of under('src/main/')) {
      for (const m of s.text.matchAll(/ipcMain\.(?:handle|on|once|handleOnce)\(\s*(?:'([^']+)')?/g)) {
        if (m[1] === undefined) {
          if (s.path !== 'src/main/ipc/checked.ts') bad.push(`${s.path}: يسجّل قناةً باسمٍ غير حرفيّ — لا تراه القاعدتان ٤ و٩؛ سجّل القناة الجديدة بـhandleChecked('…' وحرّاسها`);
          continue;
        }
        channels.add(m[1]);
        if (!CHANNELS.has(m[1])) bad.push(`${s.path}: القناة «${m[1]}» ليست في tests/channels.allow.json — سجّل القناة الجديدة بـhandleChecked وحرّاسها (src/main/ipc/checked.ts)`);
      }
      // النصّ كلّه لا سطرًا سطرًا: `prepare(` في سطرٍ وقالبه في التالي (شكل الاستعلام الطويل بعد المنسّق) — و[^`]* يعبر الأسطر حتى أوّل علامة قالب.
      if (/\b(?:prepare|exec)\(\s*`[^`]*\$\{/.test(s.text)) {
        templates.add(s.path);
        if (!SQL_TEMPLATES.has(s.path)) bad.push(`${s.path}: يبني SQL بقالب \${} في prepare/exec — القيم تُربط بـ? واسم الجدول من قائمةٍ ثابتة؛ وهذه القائمة لا تزيد`);
      }
    }
    for (const c of CHANNELS) if (!channels.has(c)) bad.push(`tests/channels.allow.json: «${c}» لا يسجّله ipcMain.handle/on بعد اليوم — احذفه من القائمة (تتناقص ولا تزيد)`);
    for (const p of SQL_TEMPLATES) if (!templates.has(p)) bad.push(`${p}: لم يعد يبني SQL بقالب \${} — احذفه من قائمة هذا الاختبار (تتناقص ولا تزيد)`);
    expect(bad).toEqual([]);
    // وسقفها يوم كُتبت (D70، بعد انتقال قناتي revisions:*) — ينخفض ولا يرتفع.
    expect(CHANNELS.size).toBeLessThanOrEqual(203);
  });

  it('١٠ — المال صامت: عمود fee باقٍ في القاعدة ولا يعود إلى الكود (A06، ر161)', () => {
    // تعريف العمود وحده: `schema.sql` (documents وtransactions)، و`prepareDocuments` لقواعد ما قبل المخطط.
    const COLUMN = /^\s*fee\s+INTEGER NOT NULL DEFAULT 0,?\s*$/;
    const HOMES = new Set(['src/main/db/schema.sql', 'src/main/services/documents.ts']);
    const files = [...SOURCES.map((s) => ({ path: s.path, text: s.text })), ...walk(join(ROOT, 'src'), /\.sql$/).map((abs) => ({ path: rel(abs), text: readFileSync(abs, 'utf8') }))];
    const bad: string[] = [];
    let columns = 0;
    for (const f of files) {
      f.text.split(/\r?\n/).forEach((line, i) => {
        if (!/\bfee\b/.test(line)) return;
        if (COLUMN.test(line) && HOMES.has(f.path)) columns++;
        else bad.push(`${f.path}:${i + 1}: المال صامت (ر161): العمود باقٍ في القاعدة ولا يعود إلى الكود — «${line.trim()}»`);
      });
    }
    expect(bad).toEqual([]);
    // ثلاثة تعريفات (schema.sql مرّتين وprepareDocuments) — والرابع عمودُ مالٍ جديد.
    expect(columns, 'المال صامت (ر161): تعريف العمود ثلاثة — schema.sql مرّتين وprepareDocuments').toBe(3);
  });
});
