/**
 * بوّابة الإنتاج (خطة Production، ٦٫٢): القنوات التي تُخرج ورقةً أو ملفًّا يُسلَّم تمرّ بـ`requireProductive`
 * — فبعد المدّة التجريبية بلا تفعيلٍ تُرفض بسببها، وما سواها يعمل كما هو.
 *
 * والقائمة هنا في مكانٍ واحد يُقرأ: الإصدار والطباعة وPDF وWord والصورة، وما يحفظه محرّر PDF. ولا فيها
 * العرض ولا البحث ولا النسخ الاحتياطي ولا تصدير البيانات (Excel، ورفع المستمسكات، وحزمة المحتوى) —
 * فلا تُقفل بيانات أحد. وورقة معايرة الطابعة إعدادٌ لا إنتاج.
 */
import { ipcMain } from 'electron';
import { requireProductive } from './license';

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
  'output:saveDocx',
  'attachments:print',
  'pdf:save',
  'pdf:saveMany',
  'pdf:saveImages'
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
    return handle(channel, (event, ...args) => {
      requireProductive();
      return listener(event, ...args);
    });
  }) as typeof ipcMain.handle;
}

/** بعد التسجيل: قناةٌ في القائمة لم تُسجَّل خطأٌ في الاسم — يُقال لا يُبلع، فلا تفلت قناةٌ من البوّابة. */
export function assertGateComplete(): void {
  const missing = PRODUCTIVE_CHANNELS.filter((c) => !registered.has(c));
  if (missing.length) throw new Error(`بوّابة الإنتاج: قنواتٌ في القائمة لم تُسجَّل — ${missing.join('، ')}`);
}
