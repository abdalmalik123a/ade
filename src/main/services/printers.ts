/**
 * طابعات ويندوز كما تراها نافذة البرنامج — لقائمة «الطابعة» ولـ«تشخيص الجهاز» (D186، نُقلت من `ipc/index.ts` كما هي).
 */
import type { WebContents } from 'electron';
import type { PrinterInfo } from '@shared/api';

/** Electron 44 لم يعد يعطي isDefault/status مباشرة — يُستخرجان من options الخاصة بالنظام. */
export async function listPrinters(contents: WebContents): Promise<PrinterInfo[]> {
  const printers = await contents.getPrintersAsync();
  return printers.map((p) => {
    const options = (p.options ?? {}) as Record<string, unknown>;
    const flag = (key: string) => String(options[key] ?? '').toLowerCase();
    // ويندوز يعرض الحالة في printer-state: 3 = مستعدة.
    const state = flag('printer-state');
    return {
      name: p.name,
      displayName: p.displayName,
      description: p.description ?? '',
      isDefault: flag('printer-is-default') === 'true' || flag('is-default') === 'true',
      ready: state === '' || state === '3'
    };
  });
}
