/**
 * «تشخيص الجهاز» (S34، D186): خمسة أسطرٍ بعلامة — مكتبات مايكروسوفت (VC++) والخطوط والطابعات والمساحة والساعة — بجملةٍ عربية لكلٍّ،
 * في «الإعدادات ← مشكلة في البرنامج؟» وفي تقرير المشكلة: فيعرف المطوّر من رسالةٍ واحدة لماذا لا يطبع مكتبٌ أو لا تُزال خلفية.
 *
 * حكمٌ خالص على ما جُمع (`ipc/support.ts` يجمعه)، والحدود ثوابت مسمّاة. ومكتبات VC++ تُعرف بملفّاتها لا بتحميل «أزل الخلفية»:
 * تلك في العامل وحده (A18)، والملفّات الثلاثة هي ما يحمله المثبّت بجوارها (L51، `afterPack.test`).
 */
import type { DiagnoseRow } from '@shared/api';
import { count, toIndic, type Noun } from '@shared/arabic';

/** ما يحتاجه محرّك «أزل الخلفية» من مكتبات مايكروسوفت — بجوار مكتبته في المثبّت، أو في System32. */
export const VC_DLLS = ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll'] as const;
/** دون هذا الفارغ على قرص البيانات: انتبه — ودون الثاني: لا يكفي لنسخةٍ احتياطية ولا لمستمسكاتٍ ممسوحة. */
export const DISK_WARN_BYTES = 2 * 1024 ** 3;
export const DISK_BAD_BYTES = 500 * 1024 ** 2;
/** ساعة الجهاز قبل آخر يومٍ رآه البرنامج بأكثر من هذا: متأخّرة. */
export const CLOCK_SLACK_MS = 24 * 3600 * 1000;

export type DiagnoseInput = {
  /** ملفّات VC++ التي لم توجد بجوار مكتبة «أزل الخلفية» ولا في System32. */
  vcMissing: readonly string[];
  /** خطوط المكتب المستوردة: عددها، وعائلات ما تعذّر ملفّه. */
  fonts: { count: number; broken: readonly string[] };
  printers: readonly { name: string; isDefault: boolean; ready: boolean }[];
  /** الفارغ على قرص البيانات بالبايت — أو `null` إن تعذّرت قراءته. */
  freeBytes: number | null;
  now: Date;
  /** آخر يومٍ رآه البرنامج (التفعيل، `lastSeen`). */
  lastSeen: string | null;
};

const PRINTER: Noun = { one: 'طابعة واحدة', two: 'طابعتان', few: 'طابعات', many: 'طابعة', single: 'طابعة' };
const FONT: Noun = { one: 'خطّ مستورد واحد', two: 'خطّان مستوردان', few: 'خطوط مستوردة', many: 'خطًّا مستوردًا', single: 'خطّ مستورد' };

const gb = (bytes: number) => toIndic((Math.round((bytes / 1024 ** 3) * 10) / 10).toString()).replace('.', '٫');
/** اليوم بتوقيت الجهاز (لا UTC: بعد منتصف الليل في بغداد يومٌ جديد). */
const day = (d: Date) => toIndic(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);

export function diagnose(i: DiagnoseInput): DiagnoseRow[] {
  const rows: DiagnoseRow[] = [];

  rows.push(
    i.vcMissing.length
      ? {
          key: 'vc',
          level: 'bad',
          title: 'مكتبات مايكروسوفت',
          text: `«أزل الخلفية» لن تعمل: ينقص ${i.vcMissing.join('، ')} — ثبّت «Microsoft Visual C++ Redistributable» (x64) من موقع مايكروسوفت`
        }
      : { key: 'vc', level: 'ok', title: 'مكتبات مايكروسوفت', text: 'موجودة — «أزل الخلفية» تعمل' }
  );

  rows.push(
    i.fonts.broken.length
      ? { key: 'fonts', level: 'warn', title: 'الخطوط', text: `تعذّر ملفّ ${i.fonts.broken.join('، ')} — أعد استيراده من «خطوط ديوان»` }
      : { key: 'fonts', level: 'ok', title: 'الخطوط', text: i.fonts.count ? `خطوط ديوان و${count(i.fonts.count, FONT)} سليمة` : 'خطوط ديوان المحزومة — لا خطوط مستوردة' }
  );

  const fallback = i.printers.find((p) => p.isDefault);
  const notReady = i.printers.filter((p) => !p.ready).map((p) => `«${p.name}»`);
  rows.push(
    !i.printers.length
      ? { key: 'printers', level: 'bad', title: 'الطابعات', text: 'لا طابعة على الجهاز — أضفها من إعدادات ويندوز' }
      : notReady.length
        ? { key: 'printers', level: 'warn', title: 'الطابعات', text: `غير مستعدّة: ${notReady.join('، ')} — شغّلها أو افحص وصلها` }
        : !fallback
          ? { key: 'printers', level: 'warn', title: 'الطابعات', text: `${count(i.printers.length, PRINTER)} ولا افتراضية في ويندوز` }
          : { key: 'printers', level: 'ok', title: 'الطابعات', text: `${count(i.printers.length, PRINTER)}، والافتراضية «${fallback.name}»` }
  );

  rows.push(
    i.freeBytes === null
      ? { key: 'disk', level: 'warn', title: 'المساحة', text: 'تعذّرت قراءة الفارغ على قرص البيانات' }
      : {
          key: 'disk',
          level: i.freeBytes < DISK_BAD_BYTES ? 'bad' : i.freeBytes < DISK_WARN_BYTES ? 'warn' : 'ok',
          title: 'المساحة',
          text:
            i.freeBytes < DISK_WARN_BYTES
              ? `الفارغ ${gb(i.freeBytes)} غ.ب على قرص البيانات — لا يكفي لنسخةٍ احتياطية ومستمسكاتٍ ممسوحة؛ أفرغ بعضه`
              : `الفارغ ${gb(i.freeBytes)} غ.ب على قرص البيانات`
        }
  );

  const last = i.lastSeen ? new Date(i.lastSeen) : null;
  rows.push(
    last && !Number.isNaN(last.getTime()) && i.now.getTime() < last.getTime() - CLOCK_SLACK_MS
      ? { key: 'clock', level: 'bad', title: 'الساعة', text: `تاريخ الجهاز ${day(i.now)} قبل آخر يومٍ عمل فيه البرنامج ${day(last)} — صحّح التاريخ والساعة` }
      : { key: 'clock', level: 'ok', title: 'الساعة', text: `التاريخ ${day(i.now)}` }
  );

  return rows;
}

const MARK: Record<DiagnoseRow['level'], string> = { ok: '✓', warn: '⚠', bad: '✗' };

/** الأسطر نفسها نصًّا — لتقرير المشكلة. */
export function diagnoseLines(rows: readonly DiagnoseRow[]): string[] {
  return rows.map((r) => `${MARK[r.level]} ${r.title}: ${r.text}`);
}
