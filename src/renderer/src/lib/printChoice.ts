/**
 * أيّ طابعةٍ تطبع؟ (خطة Production، ٢٫١–٢٫٢) — سؤالٌ واحد لكلّ شاشة تطبع.
 *
 * الدور يقرّر (`planPrint`): طابعةٌ واحدة تطبع مباشرة، وإلا سُئل الموظف مرّةً للمهمّة كلّها في
 * نافذة البرنامج (`PrintChooser`) — لا نافذة ويندوز لكلّ ورقة. و`null`: أُلغيت الطباعة.
 *
 * و`system`: اختار الموظف «بإعدادات ويندوز» ليضبط الورق والجودة — تُعرض لما يُرسل مهمّةً واحدة
 * فقط (`allowSystem`)؛ أمّا ما يُرسل ورقةً ورقة فنافذة ويندوز فيه تُفتح لكلّ ورقة.
 */
import { planPrint, type PrintPlan, type PrintRoleKey } from '@shared/printRoles';

export type PrintPick = { printer: string; system: boolean };
export type PrintAsk = {
  role: PrintRoleKey;
  plan: Exclude<PrintPlan, { kind: 'direct' }>;
  allowSystem: boolean;
};
type Ask = (req: PrintAsk) => Promise<PrintPick | null>;

let ask: Ask | null = null;

/** نافذة السؤال تسجّل نفسها حين تُركَّب (`App`)، وتعيد ما يلغي تسجيلها. */
export function registerPrintChooser(fn: Ask): () => void {
  ask = fn;
  return () => {
    if (ask === fn) ask = null;
  };
}

export async function choosePrinter(
  role: PrintRoleKey,
  opts: { allowSystem?: boolean } = {}
): Promise<PrintPick | null> {
  const settings = await window.diwan.settings.get();
  const plan = planPrint(settings.printRoles[role]);
  if (plan.kind === 'direct') return { printer: plan.printer, system: false };
  if (!ask) return null;
  return ask({ role, plan, allowSystem: Boolean(opts.allowSystem) });
}
