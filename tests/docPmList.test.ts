/**
 * القوائم في المحرّر كما تُطبع (محادثة «محرّر الكتاب»، البند ٣): علامة كلّ عنصرٍ من `marker` نفسها التي تطبع الورقة —
 * «أ)» و«١-» و«أولًا:» لا «1.» المتصفّح — وشكل الترقيم يُختار لمستوى المؤشّر ويُحفظ في القائمة العليا.
 */
import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { blocksToPm, pmBlocks } from '../src/shared/docPm';
import { listMarkers, listStyleAt, setListStyle, toggleList, withLevelStyle } from '../src/shared/docPmList';
import { paragraph, run, type Block, type ListBlock, type ListStyle } from '../src/shared/doc';

/** قائمةٌ بعنصرين، وللأوّل فرعان. */
const list = (styles: ListStyle[]): ListBlock => ({
  id: 'l',
  kind: 'list',
  styles,
  items: [
    { id: 'a', inlines: [run('أوّل')], items: [{ id: 'a1', inlines: [run('فرع')] }, { id: 'a2', inlines: [run('فرع ثانٍ')] }] },
    { id: 'b', inlines: [run('ثانٍ')] }
  ]
});

const editor = (blocks: Block[]) => EditorState.create({ doc: blocksToPm(blocks) });

/** المؤشّر في أوّل نصٍّ يساوي هذا. */
function caretIn(state: EditorState, text: string): EditorState {
  let at = -1;
  state.doc.descendants((n, pos) => {
    if (at < 0 && n.isText && n.text === text) at = pos;
    return at < 0;
  });
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, at + 1)));
}

function apply(state: EditorState, cmd: Command): EditorState | null {
  let next: EditorState | null = null;
  return cmd(state, (tr) => (next = state.apply(tr))) ? next : null;
}

const saved = (state: EditorState) => pmBlocks(state.doc);

describe('علامة كلّ عنصرٍ كما تُطبع', () => {
  it('الحروف «أ) ب)» لكلّ مستوى، والأعمق يأخذ آخر شكل', () => {
    const s = editor([list(['arabicLetter'])]);
    expect(listMarkers(s.doc, 'arabic').map((m) => m.text)).toEqual(['أ)', 'أ)', 'ب)', 'ب)']);
  });

  it('والأرقام الهندية كما تُطبع، ولكلّ مستوى شكله', () => {
    const s = editor([list(['number', 'arabicLetter'])]);
    expect(listMarkers(s.doc, 'indic').map((m) => m.text)).toEqual(['١-', 'أ)', 'ب)', '٢-']);
    expect(listMarkers(s.doc, 'arabic').map((m) => m.text)).toEqual(['1-', 'أ)', 'ب)', '2-']);
  });

  it('والعلامة على الفقرة الأولى لعنصرها بحدودها', () => {
    const s = editor([paragraph([run('قبل')]), list(['ordinal'])]);
    const ms = listMarkers(s.doc, 'arabic');
    expect(ms.map((m) => [s.doc.nodeAt(m.from)?.type.name, s.doc.nodeAt(m.from)?.textContent, m.to - m.from === s.doc.nodeAt(m.from)?.nodeSize])).toEqual([
      ['paragraph', 'أوّل', true],
      ['paragraph', 'فرع', true],
      ['paragraph', 'فرع ثانٍ', true],
      ['paragraph', 'ثانٍ', true]
    ]);
    expect(ms[0]!.text).toBe('أولًا:');
  });
});

describe('شكل الترقيم', () => {
  it('أشكال المستويات: ما فوقه كما كان، وما تحته يتبعه', () => {
    expect(withLevelStyle(['number'], 1, 'arabicLetter')).toEqual(['number', 'arabicLetter']);
    expect(withLevelStyle(['question', 'arabicLetter'], 0, 'number')).toEqual(['number', 'arabicLetter']);
    expect(withLevelStyle(['bullet'], 2, 'ordinal')).toEqual(['bullet', 'bullet', 'ordinal']);
  });

  it('يُختار لمستوى المؤشّر ويُحفظ في القائمة العليا', () => {
    let s = caretIn(editor([list(['number'])]), 'فرع');
    expect(listStyleAt(s)).toBe('number');
    s = apply(s, setListStyle('arabicLetter'))!;
    expect((saved(s)[0] as ListBlock).styles).toEqual(['number', 'arabicLetter']);
    expect(listStyleAt(s)).toBe('arabicLetter');
    s = caretIn(s, 'ثانٍ');
    s = apply(s, setListStyle('ordinal'))!;
    expect((saved(s)[0] as ListBlock).styles).toEqual(['ordinal', 'arabicLetter']);
  });

  it('وفقرةٌ خارج القائمة تدخل قائمةً بالشكل المختار', () => {
    const s = apply(caretIn(editor([paragraph([run('بند')])]), 'بند'), setListStyle('arabicLetter'))!;
    expect(saved(s)[0]).toMatchObject({ kind: 'list', styles: ['arabicLetter'], items: [{ inlines: [run('بند')] }] });
  });

  it('وفقراتٌ محدَّدة تصير عناصر — كلّ فقرةٍ عنصر كما في Word — والتحديد على نصّه', () => {
    const s0 = editor([paragraph([run('قبل')]), paragraph([run('بند أوّل')]), paragraph([run('بند ثانٍ')])]);
    const from = s0.doc.child(0).nodeSize + 1;
    const to = s0.doc.content.size - 1;
    const sel = s0.apply(s0.tr.setSelection(TextSelection.create(s0.doc, from + 2, to)));
    const s = apply(sel, toggleList('number'))!;
    expect(saved(s).map((b) => b.kind)).toEqual(['paragraph', 'list']);
    expect((saved(s)[1] as ListBlock).items.map((it) => it.inlines)).toEqual([[run('بند أوّل')], [run('بند ثانٍ')]]);
    expect(s.doc.textBetween(s.selection.from, s.selection.to, '|')).toBe('د أوّل|بند ثانٍ');
    expect(listStyleAt(s)).toBe('number');
  });

  it('«ترقيم» على عنصرٍ مرقَّمٍ يُخرجه من القائمة، و«تعداد نقطي» يقلبها نقطية', () => {
    const lifted = apply(caretIn(editor([list(['number'])]), 'ثانٍ'), toggleList('number'))!;
    expect(saved(lifted).map((b) => b.kind)).toEqual(['list', 'paragraph']);
    const bullets = apply(caretIn(editor([list(['number'])]), 'ثانٍ'), toggleList('bullet'))!;
    expect((saved(bullets)[0] as ListBlock).styles).toEqual(['bullet']);
  });
});
