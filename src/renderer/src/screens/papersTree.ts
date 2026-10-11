/** شجرة الأسئلة في ورقة الامتحان: تحويلاتٌ خالصة — نُقلت من `PapersScreen.tsx` (سقف حجمه). */
import { run, type Inline, type ListItem } from '@shared/doc';

export function mapTree(items: ListItem[], id: string, fn: (it: ListItem) => ListItem | null): ListItem[] {
  return items.flatMap((it) => {
    if (it.id === id) {
      const next = fn(it);
      return next ? [next] : [];
    }
    if (!it.items?.length) return [it];
    return [{ ...it, items: mapTree(it.items, id, fn) }];
  });
}

/** يزيح عنصرًا بين إخوته — ولا يقفز بين المستويات. */
export function moveIn(items: ListItem[], id: string, step: -1 | 1): ListItem[] {
  const at = items.findIndex((it) => it.id === id);
  if (at >= 0) {
    const to = at + step;
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(at, 1);
    next.splice(to, 0, moved!);
    return next;
  }
  return items.map((it) => (it.items?.length ? { ...it, items: moveIn(it.items, id, step) } : it));
}

export const textOf = (inlines: Inline[]): string =>
  inlines.map((n) => (n.kind === 'run' ? n.text : n.kind === 'break' ? '\n' : '')).join('');

export const inlinesOf = (text: string): Inline[] =>
  text
    .split('\n')
    .flatMap((line, i): Inline[] => (i ? [{ kind: 'break' }, run(line)] : [run(line)]))
    .filter((n) => n.kind !== 'run' || n.text.length > 0);

/** كل عنصرٍ في الشجرة — لعدّ الأسئلة والتحقّق من نصوصها. */
export function flatten(items: ListItem[]): ListItem[] {
  return items.flatMap((it) => [it, ...(it.items?.length ? flatten(it.items) : [])]);
}
