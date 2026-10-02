import { app, clipboard, ipcMain, BrowserWindow } from 'electron';
import { dataDir, getDb } from '../db';
import { registerLetterheadIpc } from './letterheads';
import { lastAnyBackup, registerBackupIpc } from './backup';
import { registerContentIpc } from './content';
import { registerLicenseIpc } from './license';
import { assertGateComplete, installProductiveGate } from './gate';
import { registerFileIpc } from './files';
import { registerDesignIpc } from './designs';
import { registerPdfIpc } from './pdf';
import { registerTemplateIpc } from './templates';
import { registerCitizenIpc } from './citizens';
import { registerDocumentIpc } from './documents';
import { registerOrderIpc } from './orders';
import { registerCameraIpc } from './camera';
import { registerQuestionIpc } from './questions';
import { registerPhotoIpc } from './photos';
import { orderCounts } from '../services/orders';
import { learnGenders, learnedGenders } from '../services/genderMemory';
import { openFillCard } from '../fillCard';
import { archiveStats } from '../services/documents';
import { normalizePrintRoles } from '@shared/printRoles';
import { normalizeHidden } from '@shared/sections';
import type {
  OfficeSettings,
  SidebarCounts,
  PrinterInfo,
  ArchiveStats
} from '@shared/api';

/** الافتراضات الوحيدة المسموح بها: تسميات محايدة يغيّرها صاحب المكتب.
 *  لا محتوى إداري مبرمَج — ولا نموذج ولا جهة ولا مواطن. */
const DEFAULTS: OfficeSettings = {
  officeName: '',
  operatorName: '',
  defaultPrinter: null,
  printRoles: normalizePrintRoles(undefined, null),
  serialPrefix: 'م',
  serialYear: 0,
  uiScale: 1,
  onboarded: false,
  printOffsets: {},
  basmala: null,
  lastBackupAt: null,
  sidebarPinned: true,
  hiddenSections: []
};

function readSettings(): OfficeSettings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const defaultPrinter = map.get('defaultPrinter') ?? DEFAULTS.defaultPrinter;
  return {
    officeName: map.get('officeName') ?? DEFAULTS.officeName,
    operatorName: map.get('operatorName') ?? DEFAULTS.operatorName,
    defaultPrinter,
    printRoles: normalizePrintRoles(parseJson(map.get('printRoles')), defaultPrinter),
    serialPrefix: map.get('serialPrefix') ?? DEFAULTS.serialPrefix,
    // سنة القيد سنة اليوم دائمًا — لا تُحفظ فتثبت (ipc/documents.ts).
    serialYear: new Date().getFullYear(),
    uiScale: Math.min(1.5, Math.max(0.8, Number(map.get('uiScale') ?? DEFAULTS.uiScale) || 1)),
    onboarded: map.get('onboarded') === 'true',
    printOffsets: parseOffsets(map.get('printOffsets')),
    basmala: map.has('basmala') ? map.get('basmala') === 'true' : DEFAULTS.basmala,
    // اليدويّة في القاعدة، والتلقائيّة بجانبها — والتذكير بآخرهما.
    lastBackupAt: lastAnyBackup(map.get('lastBackupAt') ?? null),
    sidebarPinned: map.get('sidebarPinned') !== 'false',
    hiddenSections: normalizeHidden(parseJson(map.get('hiddenSections')))
  };
}

/** قيمةٌ محفوظةٌ JSON — وما فسد منها `undefined` لا يُسقط الإعدادات. */
function parseJson(raw: string | undefined): unknown {
  try {
    return raw === undefined ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

/** الإزاحات محفوظةً JSON — وما فسد منها يُترك لا يُسقط الإعدادات. */
function parseOffsets(raw: string | undefined): OfficeSettings['printOffsets'] {
  try {
    const v = JSON.parse(raw ?? '{}') as Record<string, { x?: unknown; y?: unknown }>;
    const out: OfficeSettings['printOffsets'] = {};
    for (const [k, o] of Object.entries(v)) {
      const x = Number(o?.x);
      const y = Number(o?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) out[k] = { x: clampMm(x), y: clampMm(y) };
    }
    return out;
  } catch {
    return {};
  }
}

const clampMm = (v: number) => Math.max(-15, Math.min(15, Math.round(v * 10) / 10));

function writeSettings(patch: Partial<OfficeSettings>): OfficeSettings {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  // `null` «لم يُحدَّد» (طابعةٌ يسأل عنها النظام، بسملةٌ لم يخترها المكتب): يُمحى
  // مفتاحه فيعود إلى أصله. وكان يُحفظ نصًّا "null" فيُقرأ اسم طابعةٍ أو اختيارًا.
  const unset = db.prepare('DELETE FROM settings WHERE key = ?');
  const tx = db.transaction((entries: [string, string | null][]) => {
    for (const [k, v] of entries) {
      if (v === null) unset.run(k);
      else stmt.run(k, v);
    }
  });
  tx(
    Object.entries(patch)
      // سنة القيد ليست إعدادًا: تُحسب يوم الإصدار. وما قد حُفظ منها قديمًا يُهمل.
      .filter(([k, v]) => v !== undefined && k !== 'serialYear')
      .map(
        ([k, v]) =>
          [k, v === null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v)] as [string, string | null]
      )
  );
  return readSettings();
}

export function registerIpc(): void {
  // قبل أيّ قناة: ما يُنتج ورقةً أو ملفًّا يمرّ بالمدّة التجريبية (ipc/gate.ts).
  installProductiveGate();
  registerLetterheadIpc();
  registerFileIpc();
  registerDesignIpc();
  registerPdfIpc();
  registerTemplateIpc();
  registerCitizenIpc();
  registerDocumentIpc();
  registerOrderIpc();
  registerCameraIpc();
  registerPhotoIpc();
  registerQuestionIpc();
  registerBackupIpc();
  registerContentIpc();
  registerLicenseIpc();

  /** بطاقة التعبئة للمواقع الحكومية (هـ٦): نافذةٌ فوق المتصفّح لمواطنٍ من السجل. */
  ipcMain.handle('fillcard:open', (_e, citizenId: number) => openFillCard(Number(citizenId)));

  /** ما تعلّمه المكتب من التذكير والتأنيث (ج٤): يُحمَّل مرّة، ويُضاف إليه ما يُجاب. */
  ipcMain.handle('gender:learned', () => learnedGenders(getDb()));
  ipcMain.handle('gender:learn', (_e, answers: { name: string; gender: 'ذكر' | 'أنثى' }[]) =>
    learnGenders(getDb(), Array.isArray(answers) ? answers : [])
  );

  // رقم الإصدار من package.json — لا نصًّا مكتوبًا في الشريط يتخلّف عن الحزمة.
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataDir: dataDir() }));

  // الحافظة من النظام لا من واجهة المتصفّح: تلك ترفض الكتابة إن لم تكن النافذة في الأمام
  // («Document is not focused») — فبطاقة التعبئة فوق المتصفّح، والنسخ بعد حوار، يفشلان.
  ipcMain.handle('app:copyText', (_e, text: unknown) => clipboard.writeText(String(text ?? '')));
  ipcMain.handle('app:pasteText', () => clipboard.readText());

  // المعاملات المعلّقة في الشبّاك (تعميق الموجود ٥): في القاعدة، فتبقى بعد الإغلاق.
  ipcMain.handle('service:parked', (): unknown[] => {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'parkedTransactions'").get() as { value: string } | undefined;
    try {
      const list = JSON.parse(row?.value ?? '[]') as unknown;
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  });
  ipcMain.handle('service:setParked', (_e, list: unknown) => {
    getDb()
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES ('parkedTransactions', ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(JSON.stringify(Array.isArray(list) ? list.slice(0, 50) : []));
  });

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
      .prepare("SELECT COUNT(*) AS n FROM documents WHERE date(issued_at,'localtime') = date('now','localtime')")
      .get() as { n: number };
    return { templates: templates.n, issuedToday: issuedToday.n, orders: orderCounts(db) };
  });

  ipcMain.handle('archive:stats', (): ArchiveStats => archiveStats(getDb()));

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

  // وكلّ قناةٍ في قائمة البوّابة سُجّلت فعلًا — اسمٌ خاطئٌ فيها يُقال عند الإقلاع.
  assertGateComplete();
}
