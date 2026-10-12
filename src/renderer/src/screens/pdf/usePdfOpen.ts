/**
 * الفتح والدمج والمسح في محرّر PDF (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو: ملفّاتٌ تُضاف (وما جاء من «الملفّات»
 * في الشبّاك مرّةً بمفتاحه)، وصفحةٌ من الماسح، و«ابدأ من جديد».
 */
import type { PdfOpened } from '@shared/api';
import type { PageRef, Rotation, Overlay, FracBox } from '@shared/pdfEdit';
import { type PdfIncoming, loadSource, newId, pagesWord, type Snap, type Src } from './pdfPages';
import { useEffect } from 'react';
import { errorText } from '../../lib/errors';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';

let pdfIncomingSeen = 0;

export function usePdfOpen(
  ctx: {
    latest: MutableRefObject<Snap>;
    baselinePending: MutableRefObject<boolean>;
    setSources: Dispatch<SetStateAction<Record<string, Src>>>;
    setPages: Dispatch<SetStateAction<PageRef[]>>;
    setCurrent: Dispatch<SetStateAction<string | null>>;
    name: string;
    setName: Dispatch<SetStateAction<string>>;
    incoming: PdfIncoming | null;
    say: (text: string, tone?: 'ok' | 'warn') => void;
    setBusy: Dispatch<SetStateAction<string | null>>;
    sources: Record<string, Src>;
    past: MutableRefObject<Snap[]>;
    future: MutableRefObject<Snap[]>;
    restoring: MutableRefObject<boolean>;
    committed: MutableRefObject<Snap>;
    setOverlays: Dispatch<SetStateAction<Overlay[]>>;
    setSelected: Dispatch<SetStateAction<string[]>>;
    setActive: Dispatch<SetStateAction<string | null>>;
    setCrop: Dispatch<SetStateAction<FracBox | null>>;
    setThumbs: Dispatch<SetStateAction<Record<string, string>>>;
    setView: Dispatch<SetStateAction<{ url: string; w: number; h: number; } | null>>;
  }
) {
  const {
    latest, baselinePending, setSources, setPages, setCurrent, name, setName, incoming, say, setBusy, sources, past, future, restoring,
    committed, setOverlays, setSelected, setActive, setCrop, setThumbs, setView
  } = ctx;

  async function add(opened: PdfOpened[], fromFile = true): Promise<PageRef[]> {
    const loaded = await Promise.all(opened.map(loadSource));
    // أوّل ما يُفتح من ملفٍّ على القرص هو الأصل (لا يضيع)؛ والصفحة الممسوحة لا أصل لها.
    if (fromFile && latest.current.pages.length === 0) baselinePending.current = true;
    setSources((s) => ({ ...s, ...Object.fromEntries(loaded.map((l) => [l.id, l])) }));
    const added: PageRef[] = loaded.flatMap((src) => src.pages.map((_, index) => ({ id: newId('p'), source: src.id, index, rotate: 0 as Rotation })));
    setPages((p) => [...p, ...added]);
    setCurrent((c) => c ?? added[0]?.id ?? null);
    if (!name && loaded[0]) setName(loaded[0].image?.dpi ? 'ملف ممسوح' : `${loaded[0].name.replace(/\.[^.]+$/, '')} — معدّل`);
    return added;
  }

  // ما جاء من «الملفّات» في الشبّاك يُضاف حين تُفتح الأداة — مرّةً واحدة.
  useEffect(() => {
    if (!incoming || incoming.key === pdfIncomingSeen) return;
    pdfIncomingSeen = incoming.key;
    void add(incoming.opened).then((added) => {
      if (incoming.failed.length) say(incoming.failed.map((f) => `«${f.name}»: ${f.error}`).join(' · '), 'warn');
      else if (added.length) say(`فُتح «${incoming.opened[0]?.name ?? ''}» — ${pagesWord(added.length)}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.key]);

  async function open() {
    setBusy('يُفتح…');
    try {
      const out = await window.diwan.pdf.open();
      if (!out) return;
      const n = (await add(out.opened)).length;
      if (out.failed.length) say(out.failed.map((f) => `«${f.name}»: ${f.error}`).join(' · '), 'warn');
      else if (n) say(`أُضيفت ${pagesWord(n)}`);
    } catch (e) {
      say(errorText(e, 'تعذّر فتح الملف'), 'warn');
    } finally {
      setBusy(null);
    }
  }

  /** صفحةٌ من الماسح تُضاف في آخر الملف وتُعرض — والتالية بضغطةٍ أخرى. */
  async function scan() {
    setBusy('يُمسح… ضع الورقة في الماسح');
    try {
      const [page] = await add([await window.diwan.pdf.scan()], false);
      if (page) setCurrent(page.id);
      say('أُضيفت الصفحة الممسوحة — ضع التالية واضغط «امسح» مرّةً أخرى');
    } catch (e) {
      say(errorText(e, 'تعذّر المسح'), 'warn');
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    void window.diwan.pdf.close(Object.keys(sources));
    const empty: Snap = { pages: [], overlays: [] };
    past.current = [];
    future.current = [];
    restoring.current = true;
    committed.current = empty;
    setSources({});
    setPages(empty.pages);
    setOverlays(empty.overlays);
    setCurrent(null);
    setSelected([]);
    setActive(null);
    setCrop(null);
    setThumbs({});
    setView(null);
    setName('');
  }

  return { reset, open, scan };
}
