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
      # بلا AsArray: ليس في PowerShell 5.1 الذي في ويندوز — فكانت القائمة فارغةً دائمًا.
      ConvertTo-Json -Compress -InputObject @($out)
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
  /** المطلوب — والماسح قد يقرّبه، فيعود في `ScanResult` ما طُبِّق. */
  dpi?: number;
  color?: boolean;
};

export type ScanResult = { relativePath: string; dpi: number; format: string };

/**
 * يمسح ورقة واحدة ويحفظها في مخزن التطبيق.
 * يعيد المسار النسبي ليُعرض عبر مخطط diwan:// لا عبر file://.
 *
 * وما تعلّمناه من ماسحٍ حقيقي (كانون MF3010، أيلول ٢٠٢٦):
 * - **نوع المسح (ملوّن/رمادي) يُضبط قبل الدقّة**: ضبطه يعيدها إلى افتراضيّها — فكان كلّ مسحٍ
 *   بـ١٥٠ نقطة ولو طُلبت ٦٠٠. والدقّة تُقرأ بعد ضبطها ويُعاد ما طُبِّق فعلًا، فإن قرّبها ماسحٌ
 *   إلى ما يدعمه لم يُحسب مقاس الورقة خطأً.
 * - **المساحة لا تتبع الدقّة**: تبقى ٨٥٠×١١٦٩ نقطة فيُمسح ثلث الزجاج بدقّة ٣٠٠. فتُضبط على
 *   الزجاج كلّه (مقاسه من الجهاز بأجزاء الألف من الإنش).
 * - **لا PNG فيه**: BMP وحده. فيُطلب ما يدعمه ويُحوَّل PNG.
 */
export async function scanPage(options: ScanOptions = {}): Promise<ScanResult> {
  const dpi = options.dpi ?? 300;
  const intent = options.color === false ? 2 : 1; // 1 = ملوّن، 2 = تدرّج رمادي
  const name = `scan-${Date.now()}.png`;
  const target = join(storeDir('attachments'), name);
  const transfer = `${target}.part`;
  // مسارٌ في نصٍّ بين علامتين مفردتين في PowerShell: لا يُهرَّب فيه إلا العلامة نفسها.
  const lit = (p: string) => p.replace(/'/g, "''");

  // للسيناريوهات وحدها: صورةٌ جاهزة بدل الماسح، أو «none» ماسحٌ غائب — فالسيناريو لا يتبع
  // ما وُصل بجهاز الاختبار (ماسحٌ موصول مسح بطاقةً حقيقية في سيناريو «بلا ماسح»).
  if (process.env.DIWAN_TEST_SCAN_FILE === 'none') throw new Error('لا يوجد ماسح ضوئي موصول بهذا الجهاز');
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
    $bedW = 0; $bedH = 0
    foreach ($p in $device.Properties) {
      if ($p.PropertyID -eq 3074) { $bedW = $p.Value }   # عرض الزجاج بأجزاء الألف من الإنش
      if ($p.PropertyID -eq 3075) { $bedH = $p.Value }   # طوله
    }
    $item = $device.Items.Item(1)
    function Get-WiaProp($item, $id) {
      foreach ($p in $item.Properties) { if ($p.PropertyID -eq $id) { return $p } }
    }
    function Set-WiaProp($item, $id, $value) {
      $p = Get-WiaProp $item $id
      if (-not $p) { return }
      if ($p.SubType -eq 1 -and $value -gt $p.SubTypeMax) { $value = $p.SubTypeMax }
      $p.Value = $value
    }
    # النوع أوّلًا: ضبطه يعيد الدقّة إلى افتراضيّها (١٥٠) — فكان كلّ مسحٍ بـ١٥٠ أيًّا كان المطلوب.
    Set-WiaProp $item 6146 ${intent}
    Set-WiaProp $item 6147 ${dpi}   # أفقي
    Set-WiaProp $item 6148 ${dpi}   # عمودي
    $real = (Get-WiaProp $item 6147).Value
    Set-WiaProp $item 6149 0
    Set-WiaProp $item 6150 0
    if ($bedW -gt 0) { Set-WiaProp $item 6151 ([int]($bedW / 1000 * $real)) }
    if ($bedH -gt 0) { Set-WiaProp $item 6152 ([int]($bedH / 1000 * $real)) }
    $png = '{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}'
    $format = $png
    if (-not (@($item.Formats) -contains $png)) { $format = @($item.Formats)[0] }
    $image = $item.Transfer($format)
    $image.SaveFile('${lit(transfer)}')
    if ($image.FormatID -eq $png) {
      Move-Item -LiteralPath '${lit(transfer)}' -Destination '${lit(target)}' -Force
    } else {
      Add-Type -AssemblyName System.Drawing
      $bitmap = [System.Drawing.Image]::FromFile('${lit(transfer)}')
      try { $bitmap.Save('${lit(target)}', [System.Drawing.Imaging.ImageFormat]::Png) } finally { $bitmap.Dispose() }
      Remove-Item -LiteralPath '${lit(transfer)}' -Force
    }
    Write-Output "OK $real"
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
  const done = /OK\s+(\d+)/.exec(output);
  if (!done) {
    throw new Error('لم يكتمل المسح الضوئي');
  }

  return { relativePath: `attachments/${name}`, dpi: Number(done[1]) || dpi, format: 'PNG' };
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
