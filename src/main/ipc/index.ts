import { ipcMain, BrowserWindow } from 'electron';
import { getDb } from '../db';
import { registerLetterheadIpc } from './letterheads';
import { registerFileIpc } from './files';
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
  serialYear: new Date().getFullYear()
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
    serialYear: Number(map.get('serialYear') ?? DEFAULTS.serialYear)
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
    return { templates: templates.n, issuedToday: issuedToday.n };
  });

  ipcMain.handle('archive:stats', (): ArchiveStats => {
    const db = getDb();
    const count = (expr: string) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM documents WHERE ${expr}`).get() as { n: number }).n;

    const issuedToday = count("date(issued_at) = date('now','localtime')");
    const issuedYesterday = count("date(issued_at) = date('now','localtime','-1 day')");
    const revenue = db
      .prepare(
        `SELECT COALESCE(SUM(fee), 0) AS total FROM documents
         WHERE date(issued_at) = date('now','localtime')`
      )
      .get() as { total: number };

    const top = db
      .prepare(
        `SELECT t.title AS title, COUNT(*) AS n
         FROM documents d JOIN templates t ON t.id = d.template_id
         WHERE date(d.issued_at) = date('now','localtime')
         GROUP BY d.template_id ORDER BY n DESC LIMIT 1`
      )
      .get() as { title: string; n: number } | undefined;

    return {
      issuedToday,
      issuedYesterday,
      revenueToday: revenue.total,
      topTemplate: top
        ? { title: top.title, count: top.n, share: issuedToday ? top.n / issuedToday : 0 }
        : null
    };
  });

  ipcMain.handle('archive:today', (): DocumentRow[] => {
    const db = getDb();
    return db
      .prepare(
        `SELECT d.id, d.serial,
                COALESCE(c.full_name, '') AS citizenName,
                c.national_id AS nationalId,
                d.doc_type AS docType,
                d.destination,
                strftime('%H:%M', d.issued_at, 'localtime') AS issuedTime,
                d.copies, d.fee
         FROM documents d LEFT JOIN citizens c ON c.id = d.citizen_id
         WHERE date(d.issued_at) = date('now','localtime')
         ORDER BY d.issued_at DESC`
      )
      .all() as DocumentRow[];
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
