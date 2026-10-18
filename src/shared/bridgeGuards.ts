/**
 * حرّاس الجسر (A04، D70) — ما يصل العملية الرئيسة من الواجهة يُفحص شكله عند الباب قبل أن يمسّ القاعدة أو القرص.
 *
 * دوالّ خالصة بلا Node ولا مكتبة (ر159): كلٌّ يعيد القيمة كما جاءت أو يرمي رسالةً عربية تسمّي المعامل. والقناة الجديدة تُسجَّل
 * بـ`handleChecked` (`src/main/ipc/checked.ts`) بحارسٍ لكلّ معامل؛ والقائمة (`ipcMain.handle`) لا تُنمَّط كلّها — مرفوضٌ بأسبابه في DECISIONS.
 * وما يحتاج القرص (المسار) في الرئيسة: `storeFile` و`ipc/handedPaths.ts`.
 */

/** حارسٌ: القيمة كما جاءت إن صحّ شكلها، وإلا رسالةٌ باسم المعامل. */
export type Guard<T> = (value: unknown, name: string) => T;

/** ما يعيده الحارس. */
export type Guarded<G> = G extends Guard<infer T> ? T : never;

const fail = (name: string, want: string): Error => new Error(`المعامل «${name}» ${want}`);

/** معرّفٌ في القاعدة: رقمٌ صحيحٌ موجب — لا نصّ (`'1'`) ولا سالب ولا كسر ولا `NaN`. */
export const id: Guard<number> = (value, name) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  throw fail(name, 'رقمٌ صحيحٌ موجب');
};

/** نصٌّ لا يزيد على `max` حرفًا (والفارغ نصّ). */
export const text =
  (max: number): Guard<string> =>
  (value, name) => {
    if (typeof value === 'string' && value.length <= max) return value;
    throw fail(name, `نصٌّ لا يزيد على ${max} حرفًا`);
  };

/** واحدٌ من قائمةٍ معروفة — كنوع القطعة الذي يُبنى منه اسم جدول. */
export const oneOf =
  <T extends string | number>(list: readonly T[]): Guard<T> =>
  (value, name) => {
    if (list.includes(value as T)) return value as T;
    throw fail(name, `واحدٌ من: ${list.join('، ')}`);
  };

/** الحارس نفسه، أو `null` لما لم يُعطَ (`null` أو غائب). */
export const optional =
  <T>(guard: Guard<T>): Guard<T | null> =>
  (value, name) =>
    value === null || value === undefined ? null : guard(value, name);

/** قائمةٌ لا تزيد على `max`، وكلّ عنصرٍ بحارسه (ويُسمّى برقمه: «ids[2]»). */
export const listOf =
  <T>(guard: Guard<T>, max: number): Guard<T[]> =>
  (value, name) => {
    if (!Array.isArray(value) || value.length > max) throw fail(name, `قائمةٌ لا تزيد على ${max}`);
    return value.map((item, i) => guard(item, `${name}[${i + 1}]`));
  };
