import { ipcMain, BrowserWindow } from 'electron';
import { getDb } from '../db';
import { registerLetterheadIpc } from './letterheads';
import { registerFileIpc } from './files';
import { registerDesignIpc } from './designs';
import { registerTemplateIpc } from './templates';
import { registerCitizenIpc } from './citizens';
import { registerDocumentIpc } from './documents';
import { registerOrderIpc } from './orders';
import { orderCounts } from '../services/orders';
import { archiveStats, listDocuments } from '../services/documents';
import type {
  OfficeSettings,
  SidebarCounts,
  PrinterInfo,
  ArchiveStats,
  DocumentRow
} from '@shared/api';

/** الافتراضات الوحيدة المسموح بها: تسميات محايدة يغيّرها صاحب المكتب.
 *  لا محتوى إداري مبرمَج — ولا نموذج ولا جهة ولا مواطن. */
const DEFAULTS: OfficeSettings = {
  officeName: '',
  operatorName: '',
  defaultPrinter: null,
  serialPrefix: 'م',
  serialYear: new Date().getFullYear(),
  uiScale: 1,
  onboarded: false
};

function readSettings(): OfficeSettings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    officeName: map.get('officeName') ?? DEFAULTS.officeName,
    operatorName: map.get('operatorName') ?? DEFAULTS.operatorName,
    defaultPrinter: map.get('defaultPrinter') ?? DEFAULTS.defaultPrinter,
    serialPrefix: map.get('serialPrefix') ?? DEFAULTS.serialPrefix,
    serialYear: Number(map.get('serialYear') ?? DEFAULTS.serialYear),
    uiScale: Math.min(1.5, Math.max(0.8, Number(map.get('uiScale') ?? DEFAULTS.uiScale) || 1)),
    onboarded: map.get('onboarded') === 'true'
  };
}

function writeSettings(patch: Partial<OfficeSettings>): OfficeSettings {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  const tx = db.transaction((entries: [string, string][]) => {
    for (const [k, v] of entries) stmt.run(k, v);
  });
  tx(
    Object.entries(patch)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)] as [string, string])
  );
  return readSettings();
}

export function registerIpc(): void {
  registerLetterheadIpc();
  registerFileIpc();
  registerDesignIpc();
  registerTemplateIpc();
  registerCitizenIpc();
  registerDocumentIpc();
  registerOrderIpc();

  ipcMain.handle('settings:get', (): OfficeSettings => readSettings());

  ipcMain.handle(
    'settings:set',
    (_e, patch: Partial<OfficeSettings>): OfficeSettings => writeSettings(patch)
  );

  ipcMain.handle('counts:sidebar', (): SidebarCounts => {
    const db = getDb();
    const templates = db
      .prepare('SELECT COUNT(*) AS n FROM templates WHERE is_active = 1')
      .get() as { n: number };
    const issuedToday = db
      .prepare("SELECT COUNT(*) AS n FROM documents WHERE date(issued_at) = date('now','localtime')")
      .get() as { n: number };
    return { templates: templates.n, issuedToday: issuedToday.n, orders: orderCounts(db) };
  });

  ipcMain.handle('archive:stats', (): ArchiveStats => archiveStats(getDb()));

  ipcMain.handle('archive:today', (): DocumentRow[] => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    return listDocuments(getDb(), { from: day, to: day });
  });

  ipcMain.handle('printers:list', async (e): Promise<PrinterInfo[]> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return [];
    const printers = await win.webContents.getPrintersAsync();
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
  });
}
