/**
 * الصفحات كما تُطبع (خطّة الترقية، المرحلة ١ — قرار ٣ تشرين الأول: «تبقى الورقة عنصرًا واحدًا
 * في التخزين، والمحرّر يعرض صفحاتها كما تُطبع»).
 *
 * الطابعة تقسم الورقة سطرًا سطرًا: ما لا يسعه ارتفاع الصفحة بعد هامشيها ينزل إلى التالية،
 * ولا تُترك فقرةٌ بسطرٍ واحد في أسفل صفحةٍ ولا في أعلاها (orphans/widows = 2 في Chromium
 * كما في Word). وهنا يُعاد الحساب نفسه على الشاشة: يُقاس كلّ سطرٍ في DOM ويُحاكى التقسيم.
 *
 * - **في المحرّر** (`measurePages`): يُدرج عند أوّل سطرٍ من كلّ صفحةٍ فاصلٌ شفّاف بارتفاع ما
 *   بقي من الصفحة وهامشيها والفجوة بين الورقتين — فيقع السطر في أعلى الورقة التالية كما يقع في
 *   الطباعة، والأوراق تُرسم خلفه. والفاصل زخرفةٌ لا عقدة: لا يدخل الوثيقة ولا التراجع ولا النسخ.
 * - **في ورقة الإصدار** (`printedPages`): المحاكاة نفسها تعدّ صفحات الورقة التي تُطبع، فتقول
 *   قائمة «قبل الإصدار» ما يقوله المحرّر.
 *
 * **ما لا يُقسم**: الجدول والصورة والأعمدة والفراغ تنزل كاملةً إن لم تسعها الصفحة (والطباعة
 * تُعلَّم `break-inside: avoid` لها في `docHtml.ts` فتفعل مثلها). وما كان منها أطول من صفحةٍ
 * كاملة يمتدّ عبر الحدّ على الشاشة — والطابعة تقسمه.
 */
import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

/** ملّيمترٌ بالبكسل — كما يحسبه CSS. */
export const MM_PX = 96 / 25.4;

/** هندسة الورقة بالبكسل (قبل تكبير الواجهة). */
export type PageGeometry = {
  pageW: number;
  pageH: number;
  /** الفجوة بين ورقتين على الشاشة — وصفرٌ في ورقة الإصدار المتّصلة. */
  gap: number;
  top: number;
  /** الهامش السفلي الفعلي — يتّسع لترقيم الصفحات (`pageCss`). */
  bottom: number;
  /** ارتفاع الترويسة المكرّرة في أعلى كلّ صفحةٍ بعد الأولى، أو صفر. */
  repeatHead: number;
};

export type PageBreakAt = { pos: number; height: number };

type FlowState = { breaks: PageBreakAt[]; deco: DecorationSet };

export const pageFlowKey = new PluginKey<FlowState>('pageFlow');

function gapWidget(b: PageBreakAt): Decoration {
  return Decoration.widget(
    b.pos,
    () => {
      const el = document.createElement('div');
      el.dataset.pageGap = '';
      el.contentEditable = 'false';
      el.setAttribute('aria-hidden', 'true');
      el.style.height = `${b.height}px`;
      el.style.userSelect = 'none';
      el.style.pointerEvents = 'none';
      return el;
    },
    { side: -1, key: `gap:${b.pos}:${b.height.toFixed(1)}`, height: b.height, ignoreSelection: true }
  );
}

export function pageFlowPlugin(): Plugin<FlowState> {
  return new Plugin<FlowState>({
    key: pageFlowKey,
    state: {
      init: () => ({ breaks: [], deco: DecorationSet.empty }),
      apply(tr, prev, _old, state) {
        const meta = tr.getMeta(pageFlowKey) as PageBreakAt[] | undefined;
        if (meta) return { breaks: meta, deco: DecorationSet.create(state.doc, meta.map(gapWidget)) };
        if (!tr.docChanged) return prev;
        // إلى أن يُعاد القياس: الفواصل تتبع النصّ الذي تحرّك.
        const deco = prev.deco.map(tr.mapping, tr.doc);
        return { breaks: deco.find().map((d) => ({ pos: d.from, height: (d.spec as { height: number }).height })), deco };
      }
    },
    props: {
      decorations: (state) => pageFlowKey.getState(state)?.deco
    }
  });
}

// ── المحاكاة ─────────────────────────────────────────────────────────────

/** ما يُوزَّع على الصفحات بترتيبه: أسطرٌ تُقسم، أو كتلةٌ تنزل كاملة. و`forced` بعد فاصلٍ صريح. */
type FlowUnit<R> = { kind: 'lines' | 'atom'; el: HTMLElement; forced: boolean; ref: R };

/** فاصلٌ محسوب: قبل الوحدة كلّها (`line` صفر) أو قبل سطرٍ منها. */
type FlowBreak<R> = { unit: FlowUnit<R>; line: number; glyphTop: number; height: number };

/**
 * أسطر العنصر بإحداثيات الشاشة: مستطيلات النصّ والخانات تُجمع سطرًا سطرًا بتداخلها
 * العمودي. والفواصل المدرجة لا تُعدّ.
 */
function glyphLines(p: HTMLElement): { top: number; bottom: number }[] {
  const rects: { top: number; bottom: number }[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n instanceof HTMLElement) {
        if (n.dataset.pageGap !== undefined) return NodeFilter.FILTER_REJECT;
        if (n.dataset.field !== undefined) {
          const r = n.getBoundingClientRect();
          if (r.height > 0) rects.push({ top: r.top, bottom: r.bottom });
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.height > 0) rects.push({ top: r.top, bottom: r.bottom });
  }
  rects.sort((a, b) => a.top - b.top);
  const lines: { top: number; bottom: number }[] = [];
  for (const r of rects) {
    const last = lines[lines.length - 1];
    if (last && r.top < last.bottom - 2) {
      last.top = Math.min(last.top, r.top);
      last.bottom = Math.max(last.bottom, r.bottom);
    } else lines.push({ ...r });
  }
  return lines;
}

/**
 * يحاكي الطابعة على وحداتٍ مقيسة.
 *
 * `Y` يحوّل إحداثيّ الشاشة إلى إحداثيّ المتن (من أعلاه، بلا تكبير)، و`flat` يطرح ما فوق
 * الموضع من فواصل قائمة — فالحساب على الورقة «بلا فواصل» لا يتبع القياس السابق، ويستقرّ
 * من أوّل مرّة. و`bodyOff` موضع أوّل المتن من أعلى الورقة الأولى.
 */
function simulate<R>(
  units: FlowUnit<R>[],
  geo: PageGeometry,
  Y: (clientY: number) => number,
  flat: (y: number) => number,
  bodyOff: number
): { breaks: FlowBreak<R>[]; pages: number } {
  const stride = geo.pageH + geo.gap;
  /** أوّل المتن في الصفحة `p` — والأولى تبدأ تحت ترويستها. */
  const startR = (p: number) => (p === 0 ? 0 : p * stride + geo.top + geo.repeatHead - bodyOff);
  /** آخر ما يُكتب في الصفحة `p` قبل هامشها السفلي. */
  const endR = (p: number) => p * stride + geo.pageH - geo.bottom - bodyOff;

  const breaks: FlowBreak<R>[] = [];
  let page = 0;
  let shift = 0;
  const breakAt = (unit: FlowUnit<R>, line: number, flatTop: number, glyphTop: number) => {
    page += 1;
    const height = Math.max(0, startR(page) - (flatTop + shift));
    shift += height;
    breaks.push({ unit, line, glyphTop, height: Math.round(height * 10) / 10 });
  };
  const firstOnPage = (flatTop: number) => flatTop + shift <= startR(page) + 1;

  for (const u of units) {
    const r = u.el.getBoundingClientRect();
    if (!r.height && u.kind === 'atom') continue;
    const top = flat(Y(r.top));
    const bottom = flat(Y(r.bottom));
    if (u.forced && !firstOnPage(top)) breakAt(u, 0, top, top);
    if (bottom + shift <= endR(page) + 0.5) continue;

    if (u.kind === 'atom') {
      if (!firstOnPage(top)) breakAt(u, 0, top, top);
      // أطول من صفحة: يمتدّ عبر الحدّ، وما بعده يُحسب من حيث انتهى.
      while (bottom + shift > endR(page) + 0.5 && page < 500) page += 1;
      continue;
    }

    // أسطرٌ: بلا الفواصل، وحدودها في منتصف ما بين السطرين.
    const glyphs = glyphLines(u.el).map((l) => ({ top: flat(Y(l.top)), bottom: flat(Y(l.bottom)) }));
    if (glyphs.length < 2) {
      if (!firstOnPage(top)) breakAt(u, 0, top, top);
      continue;
    }
    const lines = glyphs.map((g, i) => ({
      top: i === 0 ? top : (glyphs[i - 1].bottom + g.top) / 2,
      bottom: i === glyphs.length - 1 ? bottom : (g.bottom + glyphs[i + 1].top) / 2,
      glyphTop: g.top
    }));
    const n = lines.length;
    let start = 0;
    for (let guard = 0; guard < 500; guard++) {
      let k = start;
      while (k < n && lines[k].bottom + shift <= endR(page) + 0.5) k++;
      if (k >= n) break;
      let b = k;
      if (n - b < 2) b = Math.max(start, n - 2); // لا سطرٌ وحيد في أعلى التالية
      if (b - start < 2) b = start; // ولا سطرٌ وحيد في أسفل هذه
      if (b === start && (start > 0 || firstOnPage(lines[0].top))) b = Math.max(k, start + 1);
      if (b >= n) break;
      breakAt(u, b, lines[b].top, lines[b].glyphTop);
      start = b;
    }
  }
  return { breaks, pages: page + 1 };
}

// ── المحرّر ─────────────────────────────────────────────────────────────

type PmRef = { pos: number; node: PMNode };

/** وحدات المحرّر من الوثيقة: فقرةٌ تُقسم أسطرًا، وكتلةٌ تنزل كاملة، وما بعد الفاصل الصريح. */
function pmUnits(view: EditorView): FlowUnit<PmRef>[] {
  const out: FlowUnit<PmRef>[] = [];
  let forced = false;
  view.state.doc.descendants((node, pos) => {
    const name = node.type.name;
    if (name === 'list' || name === 'list_item' || name === 'group') return true;
    if (name === 'page_break') {
      forced = true;
      return false;
    }
    const el = view.nodeDOM(pos);
    if (el instanceof HTMLElement) {
      out.push({ kind: name === 'paragraph' ? 'lines' : 'atom', el, forced, ref: { pos, node } });
      forced = false;
    }
    return false;
  });
  return out;
}

/**
 * يقيس المحرّر ويعيد مواضع الصفحات: أين تبدأ كلّ صفحةٍ بعد الأولى، وبكم يُدفع ما بعدها.
 */
export function measurePages(
  view: EditorView,
  paper: HTMLElement,
  mount: HTMLElement,
  geo: PageGeometry
): { breaks: PageBreakAt[]; pages: number } {
  const paperRect = paper.getBoundingClientRect();
  const scale = paperRect.width / geo.pageW || 1;
  const mountTop = mount.getBoundingClientRect().top;
  const Y = (clientY: number) => (clientY - mountTop) / scale;

  const gaps = [...mount.querySelectorAll<HTMLElement>('[data-page-gap]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { top: Y(r.top), h: r.height / scale };
  });
  const flat = (y: number) => {
    let s = 0;
    for (const g of gaps) if (g.top + g.h <= y + 0.5) s += g.h;
    return y - s;
  };

  const { breaks, pages } = simulate(pmUnits(view), geo, Y, flat, (mountTop - paperRect.top) / scale);
  return {
    pages,
    breaks: breaks.map((b) => ({
      pos: b.line === 0 ? b.unit.ref.pos : lineStart(view, b.unit.ref, b.glyphTop, Y, flat),
      height: b.height
    }))
  };
}

/** أوّل موضعٍ في الفقرة يقع حرفه على السطر الذي أعلاه `glyphTop` — بحثٌ ثنائي. */
function lineStart(view: EditorView, { pos, node }: PmRef, glyphTop: number, Y: (y: number) => number, flat: (y: number) => number): number {
  let lo = pos + 1;
  let hi = pos + node.content.size;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const top = flat(Y(view.coordsAtPos(mid, 1).top));
    if (top >= glyphTop - 2) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function sameBreaks(a: PageBreakAt[], b: PageBreakAt[]): boolean {
  return a.length === b.length && a.every((x, i) => x.pos === b[i].pos && Math.abs(x.height - b[i].height) < 1);
}

// ── ورقة الإصدار ────────────────────────────────────────────────────────

/** وحدات الورقة المرسومة (`renderDocHtml`): الفقرة والقائمة أسطر، وما سواهما كتلة، وفاصل الصفحة يُعلَّم. */
function htmlUnits(body: HTMLElement): FlowUnit<null>[] {
  const out: FlowUnit<null>[] = [];
  let forced = false;
  for (const el of body.children) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.style.breakAfter === 'page') {
      forced = true;
      continue;
    }
    const lines = el.tagName === 'P' || el.dataset.flow === 'lines';
    out.push({ kind: lines ? 'lines' : 'atom', el, forced, ref: null });
    forced = false;
  }
  return out;
}

/**
 * كم صفحةً تُطبع الورقة: المحاكاة نفسها على ورقة الإصدار المتّصلة (`LetterSheet`).
 * `sheet` الورقة بحشوها الأعلى هامشًا، و`body` متنها، و`head` الترويسة إن تكرّرت.
 */
export function printedPages(sheet: HTMLElement, body: HTMLElement, geo: Omit<PageGeometry, 'gap' | 'pageW' | 'repeatHead'> & { pageW: number; head: HTMLElement | null }): number {
  const sheetRect = sheet.getBoundingClientRect();
  const scale = sheetRect.width / geo.pageW || 1;
  const bodyTop = body.getBoundingClientRect().top;
  const Y = (clientY: number) => (clientY - bodyTop) / scale;
  const repeatHead = geo.head ? geo.head.getBoundingClientRect().height / scale : 0;
  return simulate(htmlUnits(body), { ...geo, gap: 0, repeatHead }, Y, (y) => y, (bodyTop - sheetRect.top) / scale).pages;
}
