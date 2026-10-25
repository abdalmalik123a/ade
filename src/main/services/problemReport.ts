/**
 * «أرسل تقرير المشكلة» (البند ٣٢): ملفٌّ نصّيٌّ واحد يحفظه المكتب ويرسله إلى المطوّر بواتساب — ما كتبه الموظف عمّا كان
 * يفعل، والإصدار وWindows والتفعيل، وآخر ما في سجلّ الأخطاء. **ولا شيء من سجلّ المكتب** (لا أسماء ولا كتب ولا مستمسكات)،
 * واسم مستخدم Windows في المسارات يُخفى. كان السجلّ موجودًا وإيصاله يدويًّا: يُطلب من المكتب أن يجده في مجلّد بياناته.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { LicenseStatus } from '@shared/api';
import { count } from '@shared/arabic';

/** ما يُكتب في رأس التقرير عن الجهاز والبرنامج. */
export type ReportInfo = {
  version: string;
  os: string;
  arch: string;
  memoryGb: number;
  freeMemoryGb: number;
  license: LicenseStatus | null;
  /** أسطر «تشخيص الجهاز» (D186) — وتقريرٌ بلا تشخيصٍ يقول ذلك. */
  diagnostics?: readonly string[];
};

/** آخر ما في سجلّ الأخطاء: الأقدم (`.1`) ثم الحاليّ، ومن آخره بقدر `maxChars`. */
export function readLogTail(files: readonly string[], maxChars = 300_000): string {
  const text = files
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('');
  return text.length > maxChars ? `…\n${text.slice(text.length - maxChars)}` : text;
}

/** اسم مستخدم Windows في المسارات (`C:\Users\الاسم\…`) يُخفى — فالتقرير لا يحمل اسم أحد. */
export function hideUserName(text: string, userName: string): string {
  const name = userName.trim();
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`([\\\\/]Users[\\\\/])${escaped}(?=[\\\\/]|$)`, 'gi'), '$1…');
}

/** حال التفعيل بلغة المكتب — بلا المفتاح نفسه. */
export function licenseLine(l: LicenseStatus | null): string {
  if (!l) return 'غير معروف';
  const device = `رمز الجهاز ${l.device}`;
  switch (l.status) {
    case 'activated':
      return `مفعّل مدى الحياة — ${device}`;
    case 'subscribed':
      return `اشتراك ${l.plan === 'yearly' ? 'سنوي' : 'شهري'} حتى ${l.lastDay} — ${device}`;
    case 'trial':
      return `تجربة: بقي ${count(l.daysLeft, 'يوم')} (حتى ${l.lastDay}) — ${device}`;
    case 'expired':
      return `${l.ended === 'trial' ? 'انتهت التجربة' : 'انتهى الاشتراك'} في ${l.lastDay} — ${device}`;
    case 'unverified':
      return `تعذّر قراءة معرّف الجهاز — ${device}`;
  }
}

/** نصّ التقرير — بأسطر Windows (يُفتح في المفكّرة كما هو). */
export function buildReport(input: { note: string; info: ReportInfo; log: string; userName: string; now: Date }): string {
  const { note, info, log, userName, now } = input;
  const stamp = now.toLocaleString('en-GB', { hour12: false });
  const body = [
    'تقرير مشكلة — ديوان',
    '====================',
    `التاريخ: ${stamp}`,
    `الإصدار: ${info.version}`,
    `Windows: ${info.os} (${info.arch}) — الذاكرة ${info.memoryGb} غ.ب، الفارغ منها ${info.freeMemoryGb} غ.ب`,
    `التفعيل: ${licenseLine(info.license)}`,
    '',
    'تشخيص الجهاز:',
    ...(info.diagnostics?.length ? info.diagnostics : ['(تعذّر)']),
    '',
    'ما كتبه الموظف:',
    note.trim() || '(لم يُكتب شيء)',
    '',
    'سجلّ الأخطاء (آخره في الأسفل):',
    '------------------------------',
    log.trim() || '(لا أخطاء مسجّلة)',
    ''
  ].join('\n');
  return hideUserName(body, userName).replace(/\r?\n/g, '\r\n');
}

/** اسم الملفّ المقترح: بالتاريخ، فتقريران في يومين لا يتداخلان. */
export function reportFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `تقرير مشكلة ديوان ${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}${p(now.getMinutes())}.txt`;
}
