/**
 * ما تشترك فيه شاشة الأسئلة وأجزاؤها (تقسيمها بعد ١٫٧٫٠) — منقولٌ منها كما هو.
 */
import type { OmrSpec } from '@shared/omr';
import { type ListItem, newUuid } from '@shared/doc';

export const newOmr = (): OmrSpec => ({ questions: 20, choices: 4, idDigits: 3, key: [] });

/** رموزُ المواد: رياضياتٌ وفيزياءُ وكيمياء — تُدرج عند المؤشّر. */

export const SHEET_WIDTH = 794;

export type Toast = { text: string; tone: 'ok' | 'warn' } | null;

export const NUM_INPUT =
  'w-16 h-8 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular font-label-md text-label-md text-on-surface';

export const ICON_BTN =
  'w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors flex items-center justify-center';

/**
 * «الدور الثاني» من البنك (د٩): الأسئلة نفسها عددًا ودرجاتٍ، من البنك في مادّتها وصفّها،
 * لا من الدور الأول. وتُفتح ورقةً جديدة غير محفوظة — فلا تُكتب فوق ورقة الدور الأول.
 */
export function roundTwoHead(head: Record<string, string>): Record<string, string> {
  return { ...head, الدور: 'الثاني' };
}

/** نسخةٌ من سؤال البنك بمعرّفاتٍ جديدة — فلا تشترك ورقتان في عقدةٍ واحدة. */
export function freshCopy(item: ListItem): ListItem {
  return {
    ...item,
    id: newUuid(),
    inlines: item.inlines.map((n) => (n.kind === 'field' ? { ...n, id: newUuid() } : n)),
    items: item.items?.map(freshCopy)
  };
}
