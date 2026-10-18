/**
 * `handleChecked` (A04، D70): القناة الجديدة تُسجَّل بحارسٍ لكلّ معامل (`@shared/bridgeGuards`) — فلا يصل معالجها إلا ما صحّ شكله.
 *
 * ينادي `ipcMain.handle` نفسه، فتلفّه ترجمة الأخطاء (`errors.ts`) والبوّابة (`gate.ts`) كما تلفّ القائمة. والمعاملات بترتيب مفاتيح
 * الحرّاس، وكلٌّ يمرّ بحارسه قبل المعالج، والزائد يُرفض. وأسماء القنوات القائمة في `tests/channels.allow.json` تتناقص ولا تزيد (القاعدة ٩).
 */
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { Guard, Guarded } from '@shared/bridgeGuards';

type Guards = Record<string, Guard<unknown>>;

/** المعاملات بعد حرّاسها، بأسماء مفاتيحها. */
export type Checked<G extends Guards> = { [K in keyof G]: Guarded<G[K]> };

export function handleChecked<G extends Guards>(
  channel: string,
  guards: G,
  fn: (args: Checked<G>, event: IpcMainInvokeEvent) => unknown
): void {
  const names = Object.keys(guards);
  // مفتاحٌ رقميّ («0») يتقدّم في ترتيب المفاتيح فيختلط ترتيب المعاملات — فيُرفض عند التسجيل.
  if (names.some((n) => /^\d+$/.test(n))) throw new Error(`${channel}: أسماء المعاملات حروفٌ لا أرقام`);
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (args.length > names.length) throw new Error(`${channel}: معاملاتٌ زائدة — ينتظر ${names.length} وجاءه ${args.length}`);
    const checked: Record<string, unknown> = {};
    names.forEach((name, i) => {
      try {
        checked[name] = guards[name]!(args[i], name);
      } catch (e) {
        throw new Error(`${channel}: ${(e as Error).message}`);
      }
    });
    return fn(checked as Checked<G>, event);
  });
}
