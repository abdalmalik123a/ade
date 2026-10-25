/**
 * الكشيدة في المحرّر (S13، D184) — تُرى كما تُطبع: تطويل الفقرة المضبوطة بكشيدةٍ يُحسب بالدالّة نفسها التي تُحقن في نافذة الطباعة
 * (`applyKashida`، D183) على **نسخةٍ** منها خارج المحرّر بعرضها وخطّها، ثم يوضع زخرفةً (`Decoration.widget`) في مواضعه —
 * فلا يدخل الوثيقة ولا التراجع ولا النسخ، ولا يُمسّ DOM الذي يراقبه ProseMirror (تغييرُ محاذاة فقرته للقياس كان يُقرأ تعديلًا).
 *
 * ويُحسب **بعد ٣٠٠ م.ث من آخر تغيير**، لما ظهر من الفقرات (والشاشة التي تليها) ولم يُحسب بعد — فالحرف لا ينتظره (S43).
 * وما تغيّر تُمحى زخرفته في المعاملة نفسها فلا يُرى تطويلٌ قديم، والباقي يتبع النصّ بالتعيين؛ وتغيّرُ عرض الورقة أو تحميلُ خطٍّ يعيده كلّه.
 * وفقرة عنصر القائمة لا كشيدة لها (لا تُحفظ لها، `pmItems`)، والتطويل داخل الخانة لا يُعرض (الخانة صندوقٌ في المحرّر وقيمةٌ في الطباعة).
 */
import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { applyKashida, kashidaPoint, planLine, KASHIDA_MAX_PER_WORD, KASHIDA_SHARE } from '@shared/kashida';

export const kashidaKey = new PluginKey<DecorationSet>('kashida');
const IDLE_MS = 300;

type Meta = { add?: Decoration[]; reset?: boolean };
type Target = { node: PMNode; dom: HTMLElement };

/** مدى ما غيّرته المعاملة في الوثيقة الأخيرة. */
function changedRanges(tr: Transaction): [number, number][] {
  const out: [number, number][] = [];
  tr.mapping.maps.forEach((map, i) => {
    const rest = tr.mapping.slice(i + 1);
    map.forEach((_a, _b, from, to) => out.push([rest.map(from, -1), rest.map(to, 1)]));
  });
  return out;
}

/** نصوص الفقرة بترتيبها — بلا ما في فواصل الصفحات والتطويل. */
function textsOf(p: HTMLElement): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (!n.parentElement?.closest('[data-page-gap], .kashida')) out.push(n as Text);
  return out;
}

/** ما أدخلته `applyKashida` في النسخة: رقم النصّ الأصليّ، وموضعه فيه، وعدده — و`splitText` يُبقي الرأس في النصّ ويجعل الذيل بعده. */
function insertsOf(clone: HTMLElement, texts: Map<Text, number>): { index: number; offset: number; count: number }[] {
  const out: { index: number; offset: number; count: number }[] = [];
  let index = -1;
  let at = 0;
  const walk = (n: Node) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c instanceof HTMLElement && c.classList.contains('kashida')) {
        if (index >= 0 && !c.parentElement?.closest('[contenteditable="false"]')) out.push({ index, offset: at, count: c.textContent?.length ?? 0 });
      } else if (c instanceof Text) {
        const i = texts.get(c);
        if (i !== undefined) [index, at] = [i, c.length];
        else at += c.length;
      } else walk(c);
    }
  };
  walk(clone);
  return out;
}

function widget(count: number): HTMLElement {
  const s = document.createElement('span');
  s.className = 'kashida';
  s.contentEditable = 'false';
  s.style.userSelect = 'none';
  s.textContent = 'ـ'.repeat(count);
  return s;
}

/** يقيس نسخ الفقرات في صندوقٍ خفيّ بجوار المحرّر (يرث خطّه)، ويعيد زخرفة التطويل في مواضعه من الوثيقة. */
function measure(view: EditorView, targets: Target[]): Decoration[] {
  const host = view.dom.parentElement;
  if (!host || !targets.length) return [];
  const box = document.createElement('div');
  box.className = view.dom.className;
  box.dir = 'rtl';
  box.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none';
  const pairs = targets.map((t) => {
    const wrap = document.createElement('div');
    wrap.style.width = `${t.dom.clientWidth}px`;
    const clone = t.dom.cloneNode(true) as HTMLElement;
    for (const el of clone.querySelectorAll('[data-page-gap], .kashida')) el.remove();
    wrap.appendChild(clone);
    box.appendChild(wrap);
    const mine = textsOf(t.dom);
    const theirs = textsOf(clone);
    return { mine, clone, map: mine.length === theirs.length ? new Map(theirs.map((n, i) => [n, i])) : null };
  });
  host.appendChild(box);
  const out: Decoration[] = [];
  try {
    applyKashida(box as never, kashidaPoint, planLine, KASHIDA_SHARE, KASHIDA_MAX_PER_WORD);
    for (const { mine, clone, map } of pairs) {
      if (!map) continue;
      for (const ins of insertsOf(clone, map)) {
        const pos = view.posAtDOM(mine[ins.index]!, ins.offset);
        out.push(Decoration.widget(pos, () => widget(ins.count), { side: -1, marks: view.state.doc.resolve(pos).marks(), ignoreSelection: true, key: `k${ins.count}` }));
      }
    }
  } finally {
    box.remove();
  }
  return out;
}

export function kashidaPlugin(): Plugin<DecorationSet> {
  let done = new WeakSet<PMNode>();
  return new Plugin<DecorationSet>({
    key: kashidaKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, prev) {
        const meta = tr.getMeta(kashidaKey) as Meta | undefined;
        let deco = meta?.reset ? DecorationSet.empty : prev;
        if (tr.docChanged) {
          deco = deco.map(tr.mapping, tr.doc);
          for (const [a, b] of changedRanges(tr))
            tr.doc.nodesBetween(Math.max(0, a), Math.min(b, tr.doc.content.size), (node, pos) => {
              if (node.type.name !== 'paragraph') return true;
              done.delete(node);
              const stale = deco.find(pos, pos + node.nodeSize);
              if (stale.length) deco = deco.remove(stale);
              return false;
            });
        }
        return meta?.add?.length ? deco.add(tr.doc, meta.add) : deco;
      }
    },
    props: { decorations: (state) => kashidaKey.getState(state) },
    view(view) {
      let timer = 0;
      let reset = false;
      let width = view.dom.clientWidth;
      /** الفقرات المضبوطة بكشيدةٍ لم تُحسب، فيما يُرى والشاشة التي تليه. */
      const pending = (): Target[] => {
        const out: Target[] = [];
        const h = window.innerHeight;
        view.state.doc.descendants((node, pos) => {
          if (node.type.name === 'list') return false;
          if (node.type.name !== 'paragraph') return true;
          if (node.attrs.align === 'justify' && node.attrs.kashida && !done.has(node)) {
            const dom = view.nodeDOM(pos);
            const r = dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
            if (r && r.bottom > -h && r.top < 2 * h) out.push({ node, dom: dom as HTMLElement });
          }
          return false;
        });
        return out;
      };
      const run = () => {
        timer = 0;
        if (reset) {
          reset = false;
          done = new WeakSet();
          view.dispatch(view.state.tr.setMeta(kashidaKey, { reset: true } satisfies Meta));
        }
        const targets = pending();
        const add = measure(view, targets);
        for (const t of targets) done.add(t.node);
        if (add.length) view.dispatch(view.state.tr.setMeta(kashidaKey, { add } satisfies Meta));
      };
      const schedule = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(run, IDLE_MS);
      };
      const redo = () => {
        reset = true;
        schedule();
      };
      const resized = new ResizeObserver(() => {
        if (view.dom.clientWidth === width) return;
        width = view.dom.clientWidth;
        redo();
      });
      resized.observe(view.dom);
      document.fonts?.addEventListener('loadingdone', redo);
      window.addEventListener('scroll', schedule, true);
      schedule();
      return {
        update(v, prevState) {
          if (v.state.doc !== prevState.doc) schedule();
        },
        destroy() {
          window.clearTimeout(timer);
          resized.disconnect();
          document.fonts?.removeEventListener('loadingdone', redo);
          window.removeEventListener('scroll', schedule, true);
        }
      };
    }
  });
}
