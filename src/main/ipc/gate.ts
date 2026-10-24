/**
 * بوّابة الإنتاج (خطة Production، ٦٫٢): القنوات التي تُخرج ورقةً أو ملفًّا يُسلَّم تمرّ بـ`requireProductive`
 * — فبعد المدّة التجريبية بلا تفعيلٍ تُرفض بسببها، وما سواها يعمل كما هو.
 *
 * والقائمة هنا في مكانٍ واحد يُقرأ: الإصدار والطباعة وPDF وWord والصورة، وما يحفظه محرّر PDF. ولا فيها
 * العرض ولا البحث ولا النسخ الاحتياطي ولا تصدير البيانات (Excel، ورفع المستمسكات، وحزمة المحتوى) —
 * فلا تُقفل بيانات أحد. وورقة معايرة الطابعة إعدادٌ لا إنتاج.
 */
import { ipcMain } from 'electron';
import { now } from '../clock';
import { getDb } from '../db';
import { recordWork, workOf } from '../services/workLog';
import { isoDate } from '@shared/dates';
import { produced } from '@shared/overview';
import { requireProductive } from './license';

/**
 * أوّل عملٍ خرج من المكتب — كتابٌ أو طباعةٌ أو ملفّ: يُقيَّد مرّةً فيهدأ «؟» الصفحات إلى «مساعدة» ولا يختفي (ر117 يعدّل
 * قرار الموجة ٢: «بعد التنصيب وعمل معاملةٍ أو شيءٍ ما تختفي الأزرار»). وتقييده لا يُفشل العمل نفسه.
 */
let worked = false;
function markFirstWork(out: unknown): void {
  if (worked || !produced(out)) return;
  worked = true;
  try {
    getDb().prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('firstWorkAt', ?, datetime('now'))").run(new Date().toISOString());
  } catch {
    worked = false;
  }
}

/** ما خرج — أوراقٌ طُبعت وملفّاتٌ حُفظت — يُعدّ لليوم (الملخّص الأسبوعي). والعدّ لا يُفشل العمل نفسه. */
function countWork(channel: string, args: unknown[], out: unknown): void {
  try {
    recordWork(getDb(), isoDate(now()), workOf(channel, args, out));
  } catch {
    // عدٌّ فاته عمل خيرٌ من عملٍ يُرفض بسببه.
  }
}

export const PRODUCTIVE_CHANNELS = [
  'documents:issue',
  'documents:issueTransaction',
  'documents:issueBatch',
  'documents:printIssued',
  'documents:reprint',
  'documents:exportPdf',
  'output:print',
  'output:printJob',
  'output:resumeJob',
  'output:savePdf',
  'output:savePng300',
  'output:saveImage',
  'output:saveDocx',
  'templates:export',
  'attachments:print',
  'pdf:save',
  'pdf:saveMany',
  'pdf:saveImages',
  'photos:cutout',
  'photos:clipboardImage',
  'photos:pickPhoto',
  'photos:storePasted',
  'photos:addSuit',
  'photos:storeReview',
  'photos:saveImage',
  'photos:saveUpload',
  'photos:saveToCitizen'
] as const;

const gated = new Set<string>(PRODUCTIVE_CHANNELS);
const registered = new Set<string>();
let installed = false;

/** يُستدعى قبل تسجيل القنوات: ما في القائمة يُلفّ بالبوّابة حين يُسجَّل. */
export function installProductiveGate(): void {
  if (installed) return;
  installed = true;
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = ((channel: string, listener: Parameters<typeof ipcMain.handle>[1]) => {
    registered.add(channel);
    if (!gated.has(channel)) return handle(channel, listener);
    return handle(channel, async (event, ...args) => {
      requireProductive();
      const out: unknown = await listener(event, ...args);
      markFirstWork(out);
      countWork(channel, args, out);
      return out;
    });
  }) as typeof ipcMain.handle;
}

/** بعد التسجيل: قناةٌ في القائمة لم تُسجَّل خطأٌ في الاسم — يُقال لا يُبلع، فلا تفلت قناةٌ من البوّابة. */
export function assertGateComplete(): void {
  const missing = PRODUCTIVE_CHANNELS.filter((c) => !registered.has(c));
  if (missing.length) throw new Error(`بوّابة الإنتاج: قنواتٌ في القائمة لم تُسجَّل — ${missing.join('، ')}`);
}
