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
 *
 * وحارس التحزيم (D142): كلّ ملحقٍ أصليّ (`*.node`) تحت `app.asar.unpacked` يُقرأ جدول استيراده، وما يستورده من `vcruntime*` و`msvcp*`
 * يجب أن يكون بجانبه — فويندوز يبحث عن مستورَدات الملحق بجانبه لا بجانب Diwan.exe، وجهاز التطوير فيه VC++ فلا يرى العيب
 * (محرّك Rust سقط هكذا في صندوق D141). ومحرّك Rust نفسه بـCRT ساكن (`buildNative.mjs`) فلا يستورد منه شيئًا.
 */
const { copyFileSync, existsSync, openSync, readSync, closeSync, readFileSync, readdirSync } = require('node:fs');
const { join, relative } = require('node:path');

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

/** أسماء ما يستورده ملفّ PE (‏DLL أو ‏`.node`) من جدول الاستيراد، بحروفها كما في الملفّ. */
function importsOf(file) {
  const b = readFileSync(file);
  const pe = b.readUInt32LE(0x3c);
  if (b.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error(`ليس ملفًّا تنفيذيًّا لويندوز: ${file}`);
  const sections = b.readUInt16LE(pe + 6);
  const opt = pe + 24;
  const magic = b.readUInt16LE(opt);
  if (magic !== 0x10b && magic !== 0x20b) throw new Error(`ترويسةٌ غير معروفة (${magic.toString(16)}): ${file}`);
  const wide = magic === 0x20b; // PE32+ (‏x64)
  if (b.readUInt32LE(opt + (wide ? 108 : 92)) < 2) return [];
  const importRva = b.readUInt32LE(opt + (wide ? 112 : 96) + 8); // الدليل الثاني: جدول الاستيراد
  if (!importRva) return [];
  const table = opt + b.readUInt16LE(pe + 20);
  const offsetOf = (rva) => {
    for (let i = 0; i < sections; i++) {
      const s = table + i * 40;
      const va = b.readUInt32LE(s + 12);
      if (rva >= va && rva < va + Math.max(b.readUInt32LE(s + 8), b.readUInt32LE(s + 16))) return rva - va + b.readUInt32LE(s + 20);
    }
    throw new Error(`جدول الاستيراد خارج أقسام الملفّ: ${file}`);
  };
  const names = [];
  for (let d = offsetOf(importRva); ; d += 20) {
    const nameRva = b.readUInt32LE(d + 12);
    if (!nameRva) break; // الواصف الأخير أصفار
    const at = offsetOf(nameRva);
    names.push(b.toString('latin1', at, b.indexOf(0, at)));
  }
  return names;
}

/** كلّ `*.node` تحت `dir` وما يستورده من VC++ (`vcruntime*` و`msvcp*`) وليس بجانبه. */
function runtimeNotBeside(dir) {
  const missing = [];
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.node')) continue;
    const addon = join(entry.parentPath, entry.name);
    for (const dll of importsOf(addon)) {
      if (/^(vcruntime|msvcp)/i.test(dll) && !existsSync(join(entry.parentPath, dll))) missing.push({ addon, dll });
    }
  }
  return missing;
}

exports.importsOf = importsOf;
exports.runtimeNotBeside = runtimeNotBeside;

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

  const unpacked = join(context.appOutDir, 'resources', 'app.asar.unpacked');
  const stranded = runtimeNotBeside(unpacked);
  if (stranded.length) {
    throw new Error(
      'ملحقٌ أصليّ يستورد من VC++ ما ليس بجانبه، فلا يُحمَّل على جهازٍ بلا VC++ (ويندوز يبحث بجانب الملحق لا بجانب Diwan.exe — D142):\n' +
        stranded.map((m) => `  ${relative(unpacked, m.addon)} ← ${m.dll}`).join('\n')
    );
  }
  console.log('  • الملحقات الأصلية: ما تستورده من VC++ بجانب كلٍّ منها (D142)');
};
