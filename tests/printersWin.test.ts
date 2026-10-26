/**
 * طابعات ويندوز (D192): الافتراضية والمنقطعة من سجلّ ويندوز نفسه (`reg export`) — فـElectron 44 يعطي هناك `options` فارغة،
 * وكانت `listPrinters` تقرأ منها مفاتيح CUPS فلا افتراضية أبدًا ولا «غير جاهزة» أبدًا.
 */
import { describe, expect, it } from 'vitest';
import { defaultFromReg, listPrinters, offlineFromReg } from '../src/main/services/printers';

/** كما يكتبه `reg export` (يُقرأ UTF-16 إلى نصّ). */
const DEVICE = [
  '\uFEFFWindows Registry Editor Version 5.00',
  '',
  '[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows]',
  '"DeviceNotSelectedTimeout"="15"',
  '"Device"="طابعة الكتب, الطابق الأوّل,winspool,Ne00:"',
  '"LegacyDefaultPrinterMode"=dword:00000000',
  ''
].join('\r\n');

const PRINTERS = [
  '\uFEFFWindows Registry Editor Version 5.00',
  '',
  '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers]',
  '"DefaultSpoolDirectory"="C:\\\\Windows\\\\system32\\\\spool\\\\PRINTERS"',
  '',
  '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\Canon MF3010]',
  '"Name"="Canon MF3010"',
  '"Attributes"=dword:00000e00',
  '"Default DevMode"=hex:43,00,61,00,6e,00,\\',
  '  6f,00,6e,00',
  '',
  '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\Canon MF3010\\PrinterDriverData]',
  '"Attributes"=dword:00000400',
  '',
  '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\EPSON L3250 Series]',
  '"Attributes"=dword:00000200',
  '',
  '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\طابعة الكتب, الطابق الأوّل]',
  '"Attributes"=dword:00000600',
  ''
].join('\r\n');

const contents = (names: string[]) => ({
  getPrintersAsync: async () => names.map((name) => ({ name, displayName: name, description: '', options: {} }))
});

describe('طابعات ويندوز من سجلّه', () => {
  it('الافتراضية ما قبل «,winspool,» — ولو حمل اسمها فاصلةً أو كان عربيًّا', () => {
    expect(defaultFromReg(DEVICE)).toBe('طابعة الكتب, الطابق الأوّل');
    expect(defaultFromReg('"Device"="\\\\\\\\server\\\\HP LaserJet,winspool,Ne01:"')).toBe('\\\\server\\HP LaserJet');
    expect(defaultFromReg('')).toBeNull();
    expect(defaultFromReg('"Device"=""')).toBeNull();
  });

  it('والمنقطعة بالبتّ 0x400 في مفتاح الطابعة نفسه لا فيما تحته', () => {
    expect([...offlineFromReg(PRINTERS)].sort()).toEqual(['canon mf3010', 'طابعة الكتب, الطابق الأوّل']);
    expect(offlineFromReg('').size).toBe(0);
    expect(offlineFromReg('[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\X]\r\n"Attributes"=كسر').size).toBe(0);
  });

  it('listPrinters: الافتراضية والجاهزية من ويندوز و`options` فارغة', async () => {
    const list = await listPrinters(contents(['Microsoft Print to PDF', 'EPSON L3250 Series', 'Canon MF3010']), async () => ({
      defaultName: 'microsoft print to pdf',
      offline: offlineFromReg(PRINTERS)
    }));
    expect(list.map((p) => [p.name, p.isDefault, p.ready])).toEqual([
      ['Microsoft Print to PDF', true, true],
      ['EPSON L3250 Series', false, true],
      ['Canon MF3010', false, false]
    ]);
  });

  it('وإن تعذّر السجلّ يبقى ما يعطيه Electron — وغير ويندوز بمفاتيح CUPS', async () => {
    const failed = await listPrinters(contents(['HP']), async () => ({ defaultName: null, offline: new Set() }));
    expect(failed.map((p) => [p.isDefault, p.ready])).toEqual([[false, true]]);
    const cups = {
      getPrintersAsync: async () => [
        { name: 'A', displayName: 'A', description: '', options: { 'printer-is-default': 'true', 'printer-state': '3' } },
        { name: 'B', displayName: 'B', description: '', options: { 'printer-state': '5' } }
      ]
    };
    expect((await listPrinters(cups, null)).map((p) => [p.isDefault, p.ready])).toEqual([
      [true, true],
      [false, false]
    ]);
  });
});
