/**
 * عمليات الصفحات في محرّر PDF (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `PdfScreen` كما هي: التدوير والحذف والترتيب بالسهمين وبالسحب،
 * وتكرار الصفحة بعدها.
 */
import { totalRotation, type PageRef, type Overlay } from '@shared/pdfEdit';
import { pagesWord, newId } from './pdfPages';
import { useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export function usePdfPageOps(
  ctx: {
    setPages: Dispatch<SetStateAction<PageRef[]>>;
    targets: string[];
    pages: PageRef[];
    setOverlays: Dispatch<SetStateAction<Overlay[]>>;
    setSelected: Dispatch<SetStateAction<string[]>>;
    setCurrent: Dispatch<SetStateAction<string | null>>;
    say: (text: string, tone?: 'ok' | 'warn') => void;
  }
) {
  const { setPages, targets, pages, setOverlays, setSelected, setCurrent, say } = ctx;

  function rotate(by: 90 | 270) {
    setPages((ps) => ps.map((p) => (targets.includes(p.id) ? { ...p, rotate: totalRotation(p.rotate, by) } : p)));
  }

  function remove() {
    if (!targets.length) return;
    const left = pages.filter((p) => !targets.includes(p.id));
    setPages(left);
    setOverlays((os) => os.map((o) => (o.pages === 'all' ? o : { ...o, pages: o.pages.filter((id) => !targets.includes(id)) })).filter((o) => o.pages === 'all' || o.pages.length));
    setSelected([]);
    setCurrent(left[0]?.id ?? null);
    say(`حُذفت ${pagesWord(targets.length)} من الملف الجديد — والأصل كما هو`);
  }

  function move(delta: -1 | 1) {
    if (!targets.length) return;
    const list = [...pages];
    const order = delta < 0 ? list.map((_, i) => i) : list.map((_, i) => list.length - 1 - i);
    for (const i of order) {
      const j = i + delta;
      if (targets.includes(list[i]!.id) && j >= 0 && j < list.length && !targets.includes(list[j]!.id)) {
        [list[i], list[j]] = [list[j]!, list[i]!];
      }
    }
    setPages(list);
  }

  const dragPage = useRef<string | null>(null);
  function dropPage(onto: string) {
    const from = dragPage.current;
    dragPage.current = null;
    if (!from || from === onto) return;
    const list = pages.filter((p) => p.id !== from);
    const at = list.findIndex((p) => p.id === onto);
    list.splice(at, 0, pages.find((p) => p.id === from)!);
    setPages(list);
  }

  /** نسخةٌ من كلّ صفحةٍ محدَّدة بعدها مباشرة — بدورانها وقصّها وما عليها من إضافات. */
  function duplicate() {
    if (!targets.length) return;
    const copies = new Map<string, string>();
    const list: PageRef[] = [];
    for (const p of pages) {
      list.push(p);
      if (targets.includes(p.id)) {
        const id = newId('p');
        copies.set(p.id, id);
        list.push({ ...p, id });
      }
    }
    setPages(list);
    setOverlays((os) => os.map((o) => (o.pages === 'all' ? o : { ...o, pages: o.pages.flatMap((id) => (copies.has(id) ? [id, copies.get(id)!] : [id])) })));
    say(`كُرّرت ${pagesWord(copies.size)}`);
  }

  return { rotate, move, duplicate, remove, dragPage, dropPage };
}
