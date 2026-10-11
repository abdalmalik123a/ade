/**
 * إضافتان للمحرّر ترسمان على الورقة نفسها (محادثة «محرّر الكتاب»):
 *
 * - **سحب حدّ العمود بالفأرة كما في Word** (البند ١): كان عرض العمود يتغيّر بزرّي «وسّع» و«ضيّق» نصف درجةٍ في كلّ ضغطة.
 *   فالفأرة على الحدّ بين خليّتين تصير سهمَي سحب، والسحب يُرى حيًّا ويُحفظ أوزانًا في آخره خطوةً واحدة (Ctrl+Z يردّها).
 *   والحساب في `shared/docPmTable.ts` (`dragColumnBorder`) — يُختبر بلا DOM.
 * - **علامة كلّ عنصرٍ في القائمة كما تُطبع** (البند ٣): «أ)» و«١-» و«أولًا:» زخرفةٌ على فقرته الأولى (`data-marker`)، لا ترقيم
 *   المتصفّح «1.». والحساب في `shared/docPmList.ts`.
 */
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { TableMap } from 'prosemirror-tables';
import type { Numerals } from '@shared/doc';
import { listMarkers } from '@shared/docPmList';
import { dragColumnBorder, setTableColumns, weightsOf } from '@shared/docPmTable';

/** كم بكسلًا من حدّ الخليّة يُمسك منه الحدّ. */
const EDGE_PX = 5;

type Border = { pos: number; border: number; el: HTMLTableElement; rtl: boolean };

/** الحدّ تحت الفأرة بين عمودين — وحدّا الجدول الخارجيّان لا يُسحبان: عرضه عرض المتن. */
function borderAt(view: EditorView, e: MouseEvent): Border | null {
  const cell = (e.target as HTMLElement | null)?.closest?.('td, th');
  if (!cell || !view.dom.contains(cell)) return null;
  const r = cell.getBoundingClientRect();
  const nearLeft = e.clientX - r.left <= EDGE_PX;
  const nearRight = r.right - e.clientX <= EDGE_PX;
  const el = cell.closest('table');
  if ((!nearLeft && !nearRight) || !el) return null;
  let $p;
  try {
    $p = view.state.doc.resolve(view.posAtDOM(cell, 0));
  } catch {
    return null;
  }
  let d = $p.depth;
  while (d > 0 && $p.node(d).type.spec.tableRole !== 'cell') d--;
  if (d < 2) return null;
  const map = TableMap.get($p.node(d - 2));
  const rect = map.findCell($p.before(d) - $p.start(d - 2));
  const rtl = getComputedStyle(el).direction === 'rtl';
  // في الورقة العربية العمود الأوّل يمينًا: حدّ الخليّة الأيمن بدايتها، والأيسر نهايتها.
  const border = nearRight === rtl ? rect.left : rect.right;
  if (border <= 0 || border >= map.width) return null;
  return { pos: $p.before(d - 2), border, el, rtl };
}

export function tableResizing(): Plugin {
  let dragging = false;
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousemove(view, e) {
          if (!dragging) view.dom.classList.toggle('pm-col-resize', Boolean(borderAt(view, e)));
          return false;
        },
        mouseleave(view) {
          if (!dragging) view.dom.classList.remove('pm-col-resize');
          return false;
        },
        mousedown(view, e) {
          if (e.button !== 0) return false;
          const hit = borderAt(view, e);
          const table = hit ? view.state.doc.nodeAt(hit.pos) : null;
          if (!hit || !table) return false;
          // قبل تحديد الخلايا بالسحب (`tableEditing`): الإمساك بالحدّ لا يحدّد شيئًا.
          e.preventDefault();
          const start = weightsOf(table, TableMap.get(table).width);
          const px = hit.el.getBoundingClientRect().width || 1;
          const cols = [...hit.el.querySelectorAll<HTMLElement>(':scope > colgroup > col')];
          const x0 = e.clientX;
          let next = start;
          dragging = true;
          view.dom.classList.add('pm-col-resize');
          // حيًّا على أعمدة الجدول نفسه (`TableView` لا يقرؤها تغييرًا)، والوثيقة مرّةً في آخره.
          const move = (ev: MouseEvent) => {
            next = dragColumnBorder(start, hit.border, ((hit.rtl ? -1 : 1) * (ev.clientX - x0)) / px);
            const total = next.reduce((a, b) => a + b, 0) || 1;
            cols.forEach((c, i) => (c.style.width = `${(((next[i] ?? 0) / total) * 100).toFixed(2)}%`));
          };
          const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            dragging = false;
            view.dom.classList.remove('pm-col-resize');
            if (next.some((w, i) => w !== start[i])) setTableColumns(hit.pos, next)(view.state, view.dispatch);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
          return true;
        }
      }
    }
  });
}

export const listMarkersKey = new PluginKey<DecorationSet>('listMarkers');

/** `numerals` أرقام الورقة: تُقرأ حين تتغيّر الوثيقة، أو حين يُطلب بعد تغييرها (`setMeta(listMarkersKey, true)`). */
export function listMarkersPlugin(numerals: () => Numerals): Plugin<DecorationSet> {
  const build = (state: EditorState) =>
    DecorationSet.create(
      state.doc,
      listMarkers(state.doc, numerals()).map((m) => Decoration.node(m.from, m.to, { 'data-marker': m.text }))
    );
  return new Plugin<DecorationSet>({
    key: listMarkersKey,
    state: {
      init: (_config, state) => build(state),
      apply: (tr, old, _before, state) => (tr.docChanged || tr.getMeta(listMarkersKey) ? build(state) : old)
    },
    props: { decorations: (state) => listMarkersKey.getState(state) }
  });
}
