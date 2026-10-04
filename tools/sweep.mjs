/**
 * مشغّل الفحص الشامل لسيناريوهات «ديوان» (البرومت الثاني).
 *
 * يشغّل السيناريوهات كلّها بالتتابع بواسطة drive.mjs، بمهلةٍ محدّدة لكل سيناريو،
 * وإعادةٍ واحدة لما يفشل لتمييز الفشل المتقلّب من الثابت،
 * ويكتب تقريرًا مفصّلًا بصيغتي markdown وjson في مجلّد reports/sweep-<التاريخ>/.
 *
 * الاستعمال:
 *   node tools/sweep.mjs                   (على نسخة التطوير)
 *   DIWAN_EXE=... node tools/sweep.mjs     (على البرنامج المحزوم)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const SCENARIOS_DIR = resolve('tools/scenarios');
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 دقائق
const RESILIENCE_TIMEOUT_MS = 20 * 60 * 1000; // 20 دقيقة لسيناريو الصمود

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  }
}

function ensurePortFree(port = 9223) {
  if (process.platform === 'win32') {
    try {
      const res = spawnSync('powershell', ['-Command', `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`], {
        encoding: 'utf8',
        timeout: 5000
      });
      const pids = (res.stdout || '').trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      for (const p of pids) {
        const pidNum = parseInt(p, 10);
        if (pidNum && pidNum !== process.pid) {
          killTree(pidNum);
        }
      }
    } catch {}
  }
}

async function runScenarioOnce(scenarioPath, customEnv = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  ensurePortFree(9223);
  await sleep(400);

  const start = Date.now();
  const env = {
    ...process.env,
    ...customEnv
  };

  return new Promise((res) => {
    const child = spawn(process.execPath, ['tools/drive.mjs', scenarioPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      const allOutput = (stdout + '\n' + stderr).trim();
      const lines = allOutput.split(/\r?\n/);
      const passedLines = lines.filter((l) => l.startsWith('✓'));
      const failedLines = lines.filter((l) => l.startsWith('✗'));

      let status = 'passed';
      if (timedOut) {
        status = 'timeout';
      } else if (code !== 0 || failedLines.length > 0) {
        status = 'failed';
      }

      res({
        code,
        status,
        durationMs,
        passedCount: passedLines.length,
        failedCount: failedLines.length,
        passedLines,
        failedLines,
        lastLines: lines.slice(-40),
        rawOutput: allOutput
      });
    });
  });
}

async function runScenarioWithRetry(scenarioConfig) {
  const { name, path, env, timeoutMs, label } = scenarioConfig;
  const first = await runScenarioOnce(path, env, timeoutMs);

  if (first.status === 'passed') {
    return {
      name,
      label,
      env,
      status: 'passed',
      flaky: false,
      durationMs: first.durationMs,
      passedCount: first.passedCount,
      failedCount: first.failedCount,
      failedLines: [],
      lastLines: []
    };
  }

  // إعادة المحاولة مرة واحدة لتمييز الفشل المتقلب
  console.log(`    ↳ إعادة فحص «${label}» للتحقق من الاستقرار...`);
  await sleep(1500);
  const second = await runScenarioOnce(path, env, timeoutMs);

  if (second.status === 'passed') {
    return {
      name,
      label,
      env,
      status: 'passed',
      flaky: true,
      durationMs: first.durationMs + second.durationMs,
      passedCount: second.passedCount,
      failedCount: 0,
      failedLines: first.failedLines,
      lastLines: []
    };
  }

  return {
    name,
    label,
    env,
    status: 'failed',
    flaky: false,
    durationMs: first.durationMs + second.durationMs,
    passedCount: second.passedCount,
    failedCount: second.failedCount || 1,
    failedLines: second.failedLines.length > 0 ? second.failedLines : first.failedLines,
    lastLines: second.lastLines
  };
}

async function main() {
  const files = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.mjs'))
    .sort();

  const configs = [];

  for (const file of files) {
    const fullPath = join(SCENARIOS_DIR, file);
    const base = basename(file, '.mjs');

    if (base === 'imageForm') {
      // ثلاث استمارات للمالك
      for (const form of ['graduation', 'info', 'ids']) {
        configs.push({
          name: base,
          label: `imageForm (${form})`,
          path: fullPath,
          env: { FORM_IMAGE: form },
          timeoutMs: DEFAULT_TIMEOUT_MS
        });
      }
    } else if (base === 'resilience') {
      configs.push({
        name: base,
        label: base,
        path: fullPath,
        env: { SOAK_ROUNDS: '15' },
        timeoutMs: RESILIENCE_TIMEOUT_MS
      });
    } else {
      configs.push({
        name: base,
        label: base,
        path: fullPath,
        env: {},
        timeoutMs: DEFAULT_TIMEOUT_MS
      });
    }
  }

  const isPackaged = Boolean(process.env.DIWAN_EXE);
  const roundName = isPackaged ? 'الجولة ب (البرنامج المحزوم Diwan.exe)' : 'الجولة أ (نسخة التطوير)';
  console.log(`\n======================================================`);
  console.log(`  بدء الفحص الشامل لسيناريوهات ديوان — ${roundName}`);
  console.log(`  عدد التشغيلات المجدولة: ${configs.length} تشغيل`);
  console.log(`======================================================\n`);

  const results = [];
  const startAll = Date.now();

  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const idxStr = `[${String(i + 1).padStart(2, '0')}/${configs.length}]`;
    process.stdout.write(`${idxStr} تشغيل «${cfg.label}»... `);

    const res = await runScenarioWithRetry(cfg);
    results.push(res);

    const durSec = (res.durationMs / 1000).toFixed(1);
    if (res.status === 'passed') {
      if (res.flaky) {
        console.log(`✓ نجح في الإعادة (متقلّب) — ✓${res.passedCount} (${durSec}ث)`);
      } else {
        console.log(`✓ نجح — ✓${res.passedCount} (${durSec}ث)`);
      }
    } else {
      console.log(`✗ فشل — ✗${res.failedCount} (${durSec}ث)`);
      if (res.failedLines.length > 0) {
        for (const fl of res.failedLines) {
          console.log(`      ${fl}`);
        }
      }
    }
  }

  const totalTimeSec = ((Date.now() - startAll) / 1000).toFixed(1);
  const passedTotal = results.filter((r) => r.status === 'passed').length;
  const failedTotal = results.filter((r) => r.status === 'failed').length;
  const flakyTotal = results.filter((r) => r.flaky).length;
  const sumChecksPassed = results.reduce((acc, r) => acc + r.passedCount, 0);
  const sumChecksFailed = results.reduce((acc, r) => acc + r.failedCount, 0);

  console.log(`\n======================================================`);
  console.log(`  ملخص الفحص — ${roundName}`);
  console.log(`  التشغيلات: ${results.length} | ناجح: ${passedTotal} | فاشل: ${failedTotal} | متقلب: ${flakyTotal}`);
  console.log(`  إجمالي الفحوص الفردية: ✓${sumChecksPassed} | ✗${sumChecksFailed}`);
  console.log(`  المدة الإجمالية: ${totalTimeSec} ثانية`);
  console.log(`======================================================\n`);

  // حفظ التقرير
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  const reportDir = resolve('reports', `sweep-${dateStr}`);
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });

  const reportJsonPath = join(reportDir, 'sweep-report.json');
  writeFileSync(
    reportJsonPath,
    JSON.stringify(
      {
        round: roundName,
        isPackaged,
        exe: process.env.DIWAN_EXE || null,
        timestamp: now.toISOString(),
        totalDurationSeconds: parseFloat(totalTimeSec),
        totalScenarios: results.length,
        passedScenarios: passedTotal,
        failedScenarios: failedTotal,
        flakyScenarios: flakyTotal,
        totalChecksPassed: sumChecksPassed,
        totalChecksFailed: sumChecksFailed,
        results
      },
      null,
      2
    ),
    'utf8'
  );

  const mdRows = results
    .map(
      (r, i) =>
        `| ${i + 1} | \`${r.label}\` | ${r.status === 'passed' ? '✓ ناجح' : '✗ فاشل'} | ${r.passedCount} | ${r.failedCount} | ${(r.durationMs / 1000).toFixed(1)}ث | ${r.flaky ? 'متقلب (نجح بعد إعادة)' : ''} |`
    )
    .join('\n');

  const reportMd = `# تقرير الفحص الشامل — ${roundName}

- **التاريخ**: ${now.toLocaleString('ar-IQ')}
- **نوع الجولة**: ${roundName}
- **الملف التنفيذي**: \`${process.env.DIWAN_EXE || 'نسخة التطوير (Electron Dev)'}\`
- **عدد السيناريوهات**: ${results.length}
- **السيناريوهات الناجحة**: ${passedTotal}
- **السيناريوهات الفاشلة**: ${failedTotal}
- **السيناريوهات المتقلبة**: ${flakyTotal}
- **إجمالي الفحوص الفردية الناجحة**: ✓ ${sumChecksPassed}
- **إجمالي الفحوص الفردية الفاشلة**: ✗ ${sumChecksFailed}
- **المدة الإجمالية**: ${totalTimeSec} ثانية

---

## جدول النتائج التفصيلي

| # | السيناريو | الحالة | ✓ | ✗ | المدة | ملاحظات |
|---|---|:---:|:---:|:---:|:---:|---|
${mdRows}

${failedTotal > 0 ? `\n## تفاصيل الفحوصات الفاشلة\n\n` + results.filter((r) => r.status === 'failed').map((r) => `### ${r.label}\n\`\`\`text\n${r.failedLines.join('\n')}\n\`\`\``).join('\n\n') : ''}
`;

  const reportMdPath = join(reportDir, 'sweep-report.md');
  writeFileSync(reportMdPath, reportMd, 'utf8');

  console.log(`تم حفظ التقرير في:\n  - ${reportMdPath}\n  - ${reportJsonPath}\n`);

  process.exit(failedTotal > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('خطأ غير متوقع أثناء تشغيل sweep.mjs:', err);
  process.exit(1);
});
