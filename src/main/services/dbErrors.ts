/**
 * أخطاء قاعدة البيانات بالعربية (مراجعة ٧ ت١).
 *
 * كانت تصل الواجهةَ إنكليزيةً خامًا — «SqliteError: FOREIGN KEY constraint failed» أو «database or disk is full» —
 * لموظفٍ لا يعرف ما يفعل بها (معاملةٌ معلّقة لزبونٍ حُذف، وقرصٌ ممتلئ، وفلاشةٌ نُزعت). فتُترجَم عند حدّ القنوات
 * (`ipc/errors.ts`) ويبقى الأصل في سجلّ الأخطاء ومعه رمزه بين قوسين للمطوّر.
 *
 * ولا يمسّ هذا الأخطاء التي رماها البرنامج نفسه بالعربية.
 */

const RULES: [code: RegExp, message: string][] = [
  [
    /^SQLITE_CONSTRAINT_FOREIGNKEY$/,
    'تعذّر الحفظ: سجلٌّ مرتبطٌ بهذا العمل (زبون أو قالب أو جهة) لم يعد موجودًا، فلا يصحّ الربط به — أعد فتح الشاشة وحاول من جديد.'
  ],
  [/^SQLITE_CONSTRAINT_(UNIQUE|PRIMARYKEY)$/, 'هذا السجلّ موجودٌ من قبل (قيمةٌ مكرّرة) — لم يُحفظ مرّتين.'],
  [/^SQLITE_CONSTRAINT/, 'قيمةٌ غير صالحة لم تُقبل (حقلٌ ناقص أو خارج المدى المسموح).'],
  [/^SQLITE_FULL$/, 'القرص ممتلئ — فرّغ مساحةً عليه ثم أعد المحاولة.'],
  [/^SQLITE_(BUSY|LOCKED)/, 'قاعدة البيانات مشغولةٌ بعمليةٍ أخرى — أعد المحاولة بعد لحظات.'],
  [/^SQLITE_READONLY/, 'قاعدة البيانات للقراءة فقط — تحقّق من مجلّد بيانات ديوان (صلاحياته، أو قرصٌ منزوع).'],
  [
    /^SQLITE_(CORRUPT|NOTADB)/,
    'قاعدة البيانات تالفة — توقّف عن العمل، واسترجع نسخةً احتياطية أو راسل المطوّر قبل أن يتفاقم.'
  ],
  [/^SQLITE_(IOERR|CANTOPEN)/, 'تعذّرت القراءة من القرص أو الكتابة عليه — تحقّق منه (فلاشةٌ منزوعة؟ قرصٌ معطوب؟) وأعد المحاولة.']
];

/** الرسالة العربية لخطأ SQLite، أو `null` إن لم يكن الخطأ منها. */
export function arabicDbMessage(e: unknown): string | null {
  if (!(e instanceof Error)) return null;
  const code = String((e as { code?: unknown }).code ?? '');
  if (e.name !== 'SqliteError' && !code.startsWith('SQLITE_')) return null;
  for (const [pattern, message] of RULES) if (pattern.test(code)) return `${message} [${code}]`;
  // خطأ SQLite لم نعرفه: يُقال بالعربية وأصله بين قوسين ليُرسل إلى المطوّر.
  return `خطأ في قاعدة البيانات (${e.message}) — أعد المحاولة، فإن تكرّر فأرسل هذه الرسالة إلى المطوّر.`;
}

/** الخطأ كما يُرمى إلى الواجهة: عربيًّا إن كان من SQLite، وكما هو إن لم يكن. */
export function translateDbError(e: unknown): unknown {
  const message = arabicDbMessage(e);
  return message === null ? e : new Error(message, { cause: e });
}
