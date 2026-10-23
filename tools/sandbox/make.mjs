/**
 * الجهاز النظيف في Windows Sandbox (A22، D141 — ر171): يجهّز `release/sandbox/` لتثبيت ديوان في صندوقٍ بلا شبكة وفحصه، والنتيجة في مجلّدٍ مشترك.
 *
 *   node tools/sandbox/make.mjs <المثبّت diwan-…-setup.exe> [--keep]
 *   ثم: Start-Process release\sandbox\diwan-clean.wsb   (أو النقر عليه مرّتين)
 *
 * - `kit` (للقراءة، `C:\kit` في الصندوق): المثبّت، وnode.exe هذا الجهاز (لا تنزيل في الصندوق)، و`drive.mjs` و`inside.mjs` و`cleanCheck.mjs`،
 *   و`inside.cmd` أمر الدخول. و`--keep` يُبقي الصندوق مفتوحًا بعد الفحص للتحقيق.
 * - `out` (للكتابة، `C:\out`): `result.txt` و`log.txt` و`done.txt` (`inside.mjs`) — يُفرَّغ هنا قبل كلّ تشغيل.
 * - الشبكة معطّلة، والصندوق يُمحى كلّه حين يُغلق؛ فلا يبقى من التجربة على الجهاز إلا `out`.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const setup = args.find((a) => !a.startsWith('--'));
if (!setup || !/-setup\.exe$/i.test(setup) || !existsSync(setup)) {
  console.error('✗ أعطِ مسار المثبّت — مثل: node tools/sandbox/make.mjs release/check/diwan-1.8.1-a22-setup.exe');
  process.exit(1);
}

const base = join(ROOT, 'release', 'sandbox');
const kit = join(base, 'kit');
const out = join(base, 'out');
for (const dir of [kit, out]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
copyFileSync(setup, join(kit, basename(setup)));
copyFileSync(process.execPath, join(kit, 'node.exe'));
copyFileSync(join(ROOT, 'tools', 'drive.mjs'), join(kit, 'drive.mjs'));
for (const f of ['inside.mjs', 'cleanCheck.mjs']) copyFileSync(join(HERE, f), join(kit, f));
if (args.includes('--keep')) writeFileSync(join(kit, 'keep-open'), '');
writeFileSync(join(kit, 'inside.cmd'), '@echo off\r\nC:\\kit\\node.exe C:\\kit\\inside.mjs > C:\\out\\log.txt 2>&1\r\n', 'utf8');

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wsb = join(base, 'diwan-clean.wsb');
writeFileSync(
  wsb,
  `<Configuration>
  <Networking>Disable</Networking>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <PrinterRedirection>Disable</PrinterRedirection>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <MemoryInMB>4096</MemoryInMB>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>${xml(kit)}</HostFolder>
      <SandboxFolder>C:\\kit</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
    <MappedFolder>
      <HostFolder>${xml(out)}</HostFolder>
      <SandboxFolder>C:\\out</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>C:\\kit\\inside.cmd</Command>
  </LogonCommand>
</Configuration>
`,
  'utf8'
);
console.log(`✓ الصندوق جاهز: ${wsb}
  المثبّت ${basename(setup)} · node ${process.version} · الشبكة معطّلة${args.includes('--keep') ? ' · يبقى مفتوحًا بعد الفحص' : ' · يُطفأ بعد الفحص'}
  شغّله: Start-Process "${wsb}" — ثم انتظر ${join(out, 'done.txt')}، والنتيجة في ${join(out, 'result.txt')}`);
