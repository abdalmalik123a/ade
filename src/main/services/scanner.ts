import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { copyFile, unlink } from 'node:fs/promises';
import { storeDir } from '../db';

/**
 * المسح الضوئي عبر WIA — من داخل التطبيق، بلا واجهة الشركة المصنّعة.
 *
 * WIA واجهة ويندوز القياسية للماسحات. نستدعيها عبر PowerShell لأن الوصول
 * إلى COM من Node يحتاج وحدة أصلية، وPowerShell موجود على كل ويندوز.
 * المستخدم لا يرى نافذة: التشغيل مخفيّ والناتج ملف في مخزن التطبيق.
 */

const run = promisify(execFile);

const PS = [
  'powershell',
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-WindowStyle',
  'Hidden',
  '-Command'
] as const;

export type ScannerDevice = { id: string; name: string };

async function ps(script: string): Promise<string> {
  const { stdout } = await run(PS[0], [...PS.slice(1), script], {
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000
  });
  return stdout.trim();
}

/** قائمة الماسحات الموصولة. الفراغ ليس خطأً — قد لا يكون ثمّة ماسح. */
export async function listScanners(): Promise<ScannerDevice[]> {
  const script = `
    $ErrorActionPreference = 'Stop'
    try {
      $dm = New-Object -ComObject WIA.DeviceManager
      $out = @()
      foreach ($d in $dm.DeviceInfos) {
        if ($d.Type -eq 1) {
          $name = ''
          foreach ($p in $d.Properties) { if ($p.Name -eq 'Name') { $name = $p.Value } }
          $out += [pscustomobject]@{ id = $d.DeviceID; name = $name }
        }
      }
      if ($out.Count -eq 0) { '[]' } else { $out | ConvertTo-Json -Compress -AsArray }
    } catch { '[]' }
  `;
  try {
    const raw = await ps(script);
    const parsed: unknown = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? (parsed as ScannerDevice[]) : [];
  } catch {
    return [];
  }
}

export type ScanOptions = {
  deviceId?: string;
  /** التصميم يعلن 600 نقطة/إنش للمستمسكات. */
  dpi?: number;
  color?: boolean;
};

export type ScanResult = { relativePath: string; dpi: number; format: string };

/**
 * يمسح ورقة واحدة ويحفظها في مخزن التطبيق.
 * يعيد المسار النسبي ليُعرض عبر مخطط diwan:// لا عبر file://.
 */
export async function scanPage(options: ScanOptions = {}): Promise<ScanResult> {
  const dpi = options.dpi ?? 600;
  const intent = options.color === false ? 4 : 1; // 1 = ملوّن، 4 = تدرّج رمادي
  const name = `scan-${Date.now()}.png`;
  const target = join(storeDir('attachments'), name);

  // للسيناريوهات وحدها: صورةٌ جاهزة بدل ماسحٍ لا يوجد على جهاز الاختبار.
  if (process.env.DIWAN_TEST_SCAN_FILE) {
    await copyFile(process.env.DIWAN_TEST_SCAN_FILE, target);
    return { relativePath: `attachments/${name}`, dpi, format: 'PNG' };
  }

  const script = `
    $ErrorActionPreference = 'Stop'
    $dm = New-Object -ComObject WIA.DeviceManager
    $devices = @($dm.DeviceInfos | Where-Object { $_.Type -eq 1 })
    if ($devices.Count -eq 0) { Write-Output 'NO_DEVICE'; exit 0 }
    ${
      options.deviceId
        ? `$info = $devices | Where-Object { $_.DeviceID -eq '${options.deviceId.replace(/'/g, "''")}' } | Select-Object -First 1
           if (-not $info) { $info = $devices[0] }`
        : '$info = $devices[0]'
    }
    $device = $info.Connect()
    $item = $device.Items.Item(1)
    function Set-WiaProp($item, $id, $value) {
      foreach ($p in $item.Properties) { if ($p.PropertyID -eq $id) { $p.Value = $value } }
    }
    Set-WiaProp $item 6147 ${dpi}   # أفقي
    Set-WiaProp $item 6148 ${dpi}   # عمودي
    Set-WiaProp $item 6146 ${intent}
    $image = $item.Transfer('{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}')  # PNG
    if (Test-Path '${target.replace(/\\/g, '\\\\').replace(/'/g, "''")}') {
      Remove-Item -LiteralPath '${target.replace(/\\/g, '\\\\').replace(/'/g, "''")}' -Force
    }
    $image.SaveFile('${target.replace(/\\/g, '\\\\').replace(/'/g, "''")}')
    Write-Output 'OK'
  `;

  let output: string;
  try {
    output = await ps(script);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/0x80210015|WIA_ERROR_DEVICE_NOT_AVAILABLE/i.test(message)) {
      throw new Error('الماسح الضوئي غير متاح — تأكّد أنه موصول ومشغّل');
    }
    if (/0x80210003|paper/i.test(message)) {
      throw new Error('لا توجد ورقة في الماسح');
    }
    throw new Error('تعذّر المسح الضوئي — راجع اتصال الماسح');
  }

  if (output.includes('NO_DEVICE')) {
    throw new Error('لا يوجد ماسح ضوئي موصول بهذا الجهاز');
  }
  if (!output.includes('OK')) {
    throw new Error('لم يكتمل المسح الضوئي');
  }

  return { relativePath: `attachments/${name}`, dpi, format: 'PNG' };
}

/** يحذف ملفًا من المخزن — يُستدعى عند حذف مستمسك. */
export async function removeStoreFile(relativePath: string): Promise<void> {
  if (!relativePath || relativePath.includes('..')) return;
  try {
    await unlink(join(storeDir(), relativePath));
  } catch {
    // الملف مفقود أصلًا — لا يعنينا
  }
}
