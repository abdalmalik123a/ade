/**
 * بعد تحزيم ويندوز: ملفّات VC++ بجوار «إزالة الخلفية» (مراجعة ٧ ت١).
 *
 * ملحق ONNX الأصلي و`onnxruntime.dll` يستوردان `VCRUNTIME140` و`VCRUNTIME140_1` و`MSVCP140` و`MSVCP140_1`
 * و`MSVCP140_ATOMIC_WAIT`، وليست في Electron ولا في المثبّت. وجهازٌ نظيف بلا «Microsoft Visual C++ Redistributable»
 * لا يشغّل الميزة (وكان يُسقط البرنامج كلّه عند الإقلاع؛ والتحميل صار كسولًا، `services/portrait.ts`).
 *
 * فتُنسخ الملفّات الخمسة (نحو ٠٫٨ م.ب) من النظام الذي يبني المثبّت إلى مجلّدين:
 * 1) مجلّد البرنامج (بجوار `Diwan.exe`) — أوّل ما يبحث فيه ويندوز؛ 2) مجلّد الملحق نفسه.
 * ولا تحتاج صلاحيات مدير، فتوافق «بلا حساب مدير» (`docs/INSTALL.md`).
 *
 * الترخيص: ملفّات VC++ هذه من ملفّات Visual Studio القابلة لإعادة التوزيع مع التطبيق («app-local
 * deployment»)، وتُراجَع شروط مايكروسوفت قبل بيع النسخة الأولى (`DEVELOPMENT.md`).
 *
 * ويفشل البناء — لا يصدر مثبّتٌ ناقص — إن غاب ملفّ أو لم يكن x64.
 */
const { copyFileSync, existsSync, openSync, readSync, closeSync } = require('node:fs');
const { join } = require('node:path');

const RUNTIME = ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll', 'msvcp140_1.dll', 'msvcp140_atomic_wait.dll'];
const X64 = 0x8664;

/** نوع الآلة في ترويسة PE — x64 = 0x8664. */
function machineOf(file) {
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(64);
    readSync(fd, head, 0, 64, 0);
    const at = head.readUInt32LE(0x3c);
    const pe = Buffer.alloc(6);
    readSync(fd, pe, 0, 6, at);
    return pe.toString('latin1', 0, 4) === 'PE\0\0' ? pe.readUInt16LE(4) : 0;
  } finally {
    closeSync(fd);
  }
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  if (process.arch !== 'x64') {
    throw new Error('المثبّت يُبنى من Node بنمط x64: ملفّات VC++ في نظام 32 بت ليست التي يحتاجها الملحق.');
  }
  const system = join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const missing = RUNTIME.filter((name) => !existsSync(join(system, name)));
  if (missing.length) {
    throw new Error(
      `ينقص هذا الجهاز ${missing.join('، ')} — ثبّت «Microsoft Visual C++ Redistributable 2015-2022 (x64)» ثم أعد البناء، ` +
        'وإلا خرج المثبّت لا يشغّل «إزالة الخلفية» على جهازٍ نظيف.'
    );
  }
  const notX64 = RUNTIME.filter((name) => machineOf(join(system, name)) !== X64);
  if (notX64.length) throw new Error(`ليست x64: ${notX64.join('، ')}`);

  const targets = [
    context.appOutDir,
    join(context.appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6', 'win32', 'x64')
  ];
  for (const dir of targets) {
    if (!existsSync(dir)) throw new Error(`مجلّدٌ غاب عن التحزيم: ${dir}`);
    for (const name of RUNTIME) copyFileSync(join(system, name), join(dir, name));
  }
  console.log(`  • VC++: ${RUNTIME.length} ملفّات إلى ${targets.length} مجلّدين (مراجعة ٧ ت١)`);
};
