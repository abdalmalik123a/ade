/**
 * عرض العقد في المحرّر: الحقل صندوقٌ بقيمته أو اسمه، والصورة بحجمها ومحاذاتها، والمسافة ومساحة الإجابة، وفاصل الصفحة،
 * والجدول بأوزان أعمدته، والعمودان، والمجموعة الشرطية — كلٌّ كما يُطبع.
 *
 * كانت في `PageEditor.tsx` حتى بلغ سقفه، فنُقلت كما هي (محادثة «محرّر الكتاب»).
 */
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

// ── عرض العقد ───────────────────────────────────────────────────────────

const FIELD_CHIP =
  'px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-500/15 text-amber-950 border border-amber-500/40 font-semibold font-label-sm text-label-sm shadow-xs';
const FIELD_FILLED = 'px-0.5 rounded bg-secondary-fixed/60 text-on-surface font-semibold';

export class FieldView implements NodeView {
  dom: HTMLElement;
  constructor(
    private node: PMNode,
    private labelOf: (key: string) => string
  ) {
    this.dom = document.createElement('span');
    this.dom.contentEditable = 'false';
    this.render();
  }
  private render() {
    const ref = this.node.attrs.ref as string;
    const shown = this.labelOf(ref);
    this.dom.dataset.field = ref;
    if (shown.startsWith('=')) {
      this.dom.className = FIELD_FILLED;
      this.dom.textContent = shown.slice(1);
      this.dom.dataset.filled = '';
    } else {
      this.dom.className = FIELD_CHIP;
      this.dom.textContent = `[ ${shown} ]`;
      delete this.dom.dataset.filled;
    }
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  selectNode() {
    this.dom.classList.add('ring-2', 'ring-secondary');
  }
  deselectNode() {
    this.dom.classList.remove('ring-2', 'ring-secondary');
  }
  ignoreMutation() {
    return true;
  }
}

function button(icon: string, title: string, onClick: () => void, danger = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = title;
  b.className = `w-7 h-7 rounded flex items-center justify-center ${danger ? 'text-error hover:bg-error-container' : 'text-on-surface-variant hover:bg-surface-container-high'}`;
  b.innerHTML = `<span class="material-symbols-outlined text-[16px]">${icon}</span>`;
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** الصورة والشعار: حجمٌ ومحاذاة وحذف — كما في المحرّر الأوّل. */
export class ImageView implements NodeView {
  dom: HTMLElement;
  private img: HTMLImageElement;
  private frame: HTMLElement | null = null;
  constructor(
    private node: PMNode,
    private view: EditorView,
    private getPos: () => number | undefined
  ) {
    this.dom = document.createElement('div');
    this.dom.className = 'group/img relative';
    this.img = document.createElement('img');
    this.img.alt = '';
    this.img.style.display = 'inline-block';
    this.img.style.maxWidth = '100%';
    const bar = document.createElement('div');
    bar.className =
      'absolute top-1 right-1 hidden group-hover/img:flex items-center gap-0.5 p-0.5 rounded-btn bg-surface-container-lowest shadow-low border border-outline-variant/50';
    bar.contentEditable = 'false';
    const set = (patch: Record<string, unknown>) => {
      const pos = this.getPos();
      if (pos == null) return;
      this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, ...patch }));
    };
    const width = (w: number) => {
      const next = Math.min(800, Math.max(20, w));
      const a = this.node.attrs;
      set({ width: next, ...(a.height ? { height: Math.max(1, Math.round(((a.height as number) * next) / (a.width as number))) } : {}) });
    };
    bar.append(
      button('remove', 'أصغر', () => width((this.node.attrs.width as number) - 20)),
      button('add', 'أكبر', () => width((this.node.attrs.width as number) + 20)),
      button('format_align_right', 'يمين', () => set({ align: 'right' })),
      button('format_align_center', 'وسط', () => set({ align: 'center' })),
      button('format_align_left', 'يسار', () => set({ align: 'left' })),
      button(
        'delete',
        'حذف',
        () => {
          const pos = this.getPos();
          if (pos != null) this.view.dispatch(this.view.state.tr.delete(pos, pos + this.node.nodeSize));
        },
        true
      )
    );
    this.dom.append(this.img, bar);
    this.render();
  }
  private render() {
    const a = this.node.attrs;
    this.dom.style.textAlign = a.align === 'justify' ? 'center' : (a.align as string);
    this.img.src = a.src ? `diwan://store/${a.src as string}` : '';
    this.img.style.width = `${a.width as number}px`;
    this.img.style.height = a.height ? `${a.height as number}px` : '';
    // حقل الصورة (S38): إطارٌ بمقاسه وفيه اسم الحقل — يُملأ عند كلّ ورقة.
    this.img.style.display = a.field && !a.src ? 'none' : 'inline-block';
    this.frame?.remove();
    this.frame = null;
    if (a.field && !a.src) {
      const f = document.createElement('span');
      f.dataset.imageField = a.field as string;
      f.className = 'inline-flex items-center justify-center border border-dashed border-outline text-on-surface-variant font-label-md text-label-md align-top';
      f.style.width = `${a.width as number}px`;
      f.style.height = `${(a.height as number | null) ?? (a.width as number)}px`;
      f.style.maxWidth = '100%';
      f.textContent = a.field as string;
      this.dom.prepend(f);
      this.frame = f;
    }
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  stopEvent(e: Event) {
    return (e.target as HTMLElement).closest('button') !== null;
  }
  ignoreMutation() {
    return true;
  }
}

/** المسافة ومساحة الإجابة — ارتفاعها كما يُطبع، وزرّ السطور. */
export class SpacerView implements NodeView {
  dom: HTMLElement;
  private label: HTMLElement;
  constructor(
    private node: PMNode,
    private view: EditorView,
    private getPos: () => number | undefined
  ) {
    this.dom = document.createElement('div');
    this.dom.className =
      'rounded border border-dashed border-outline-variant flex items-center justify-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant';
    this.label = document.createElement('span');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'h-6 px-2 rounded bg-surface-container-low hover:bg-surface-container-high';
    toggle.addEventListener('mousedown', (e) => e.preventDefault());
    toggle.addEventListener('click', () => {
      const pos = this.getPos();
      if (pos != null) this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, lines: !this.node.attrs.lines }));
    });
    this.dom.append(this.label, toggle);
    this.render();
  }
  private render() {
    const a = this.node.attrs;
    this.dom.style.height = `${Math.max(28, a.height as number)}px`;
    this.label.textContent = `${a.lines ? 'مساحة إجابة' : 'مسافة'} ${a.height as number}px`;
    (this.dom.lastChild as HTMLElement).textContent = a.lines ? 'بلا سطور' : 'بسطور';
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  stopEvent(e: Event) {
    return (e.target as HTMLElement).closest('button') !== null;
  }
  ignoreMutation() {
    return true;
  }
}

export function pageBreakView(): NodeView {
  const dom = document.createElement('div');
  dom.className = 'my-space-xs border-t-2 border-dashed border-secondary text-center';
  dom.dataset.pageBreak = '';
  dom.innerHTML = '<span class="px-2 -mt-2 inline-block bg-surface-container-lowest font-label-sm text-label-sm text-secondary">فاصل صفحة</span>';
  return { dom, ignoreMutation: () => true };
}

/** الجدول بأوزان أعمدته كما يُطبع، وبلا حدودٍ إن كان رأسًا مخفيّ الخطوط. */
export class TableView implements NodeView {
  dom: HTMLTableElement;
  contentDOM: HTMLElement;
  private colgroup: HTMLElement;
  constructor(private node: PMNode) {
    this.dom = document.createElement('table');
    this.colgroup = document.createElement('colgroup');
    this.contentDOM = document.createElement('tbody');
    this.dom.append(this.colgroup, this.contentDOM);
    this.render();
  }
  private render() {
    const cols = (this.node.attrs.columns as number[] | null) ?? [];
    const total = cols.reduce((a, b) => a + b, 0) || 1;
    this.colgroup.innerHTML = cols.map((w) => `<col style="width:${((w / total) * 100).toFixed(2)}%">`).join('');
    if (this.node.attrs.headerShading) this.dom.setAttribute('data-header-shading', 'true');
    else this.dom.removeAttribute('data-header-shading');
    // صفّ العناوين عريضٌ ومظلَّلٌ كما يطبعه `docHtml` (رأسٌ `th`).
    this.dom.className = [
      'pm-table',
      this.node.attrs.borders === false && 'pm-noborder',
      this.node.attrs.header && 'pm-header',
      this.node.attrs.headerShading && 'pm-header-shading'
    ]
      .filter(Boolean)
      .join(' ');
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  ignoreMutation(m: { type: string; target: Node }) {
    return m.type === 'attributes' || this.colgroup.contains(m.target);
  }
}

/** عمودان جنبًا إلى جنب بأوزانهما — يُكتب في كلٍّ منهما. */
export class ColumnsView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  constructor(private node: PMNode) {
    this.dom = document.createElement('div');
    this.dom.className = 'pm-columns grid';
    this.contentDOM = this.dom;
    this.render();
  }
  /** الأوزان شبكةٌ على عنصر الصفّ نفسه — لا أنماطٌ على أعمدةٍ يملك المحرّرُ عناصرها فيقرؤها تغييرًا. */
  private render() {
    this.dom.style.gap = `${(this.node.attrs.gap as number | null) ?? 16}px`;
    const widths = (this.node.attrs.widths as number[] | null) ?? [];
    const n = this.node.childCount || 1;
    this.dom.style.gridTemplateColumns = Array.from({ length: n }, (_, i) => `minmax(0, ${widths[i] ?? 1}fr)`).join(' ');
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  // سمات العمودين (الفجوة والأوزان) يضعها العرض نفسه: لو قُرئت تغييرًا من الكاتب لأعاد المحرّر
  // قراءة الصفّ كلّه — فتدخل خطوةٌ وهمية التراجعَ، وتلتصق بالخانة علامةُ حجمٍ لم يضعها أحد.
  ignoreMutation(m: { type: string; target: Node }) {
    return m.type === 'attributes';
  }
}

/** المجموعة الشرطية أو المتكرّرة: إطارٌ يقول شرطها، ويُكتب فيها. */
export class GroupView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private tag: HTMLElement;
  constructor(private node: PMNode) {
    this.dom = document.createElement('div');
    this.dom.className = 'relative rounded border border-dashed border-secondary/50 px-1 pt-3 my-1';
    this.tag = document.createElement('span');
    this.tag.contentEditable = 'false';
    this.tag.className = 'absolute -top-2 right-2 px-1.5 rounded bg-surface-container-lowest font-label-sm text-label-sm text-secondary';
    this.contentDOM = document.createElement('div');
    this.dom.append(this.tag, this.contentDOM);
    this.render();
  }
  private render() {
    const on = this.node.attrs.on as string;
    this.tag.textContent = this.node.attrs.mode === 'repeat' ? `يتكرّر لكلّ: ${on}` : `يظهر إن وُجد: ${on}`;
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
  ignoreMutation(m: { type: string; target: Node }) {
    return m.type === 'attributes' || this.tag.contains(m.target);
  }
}
