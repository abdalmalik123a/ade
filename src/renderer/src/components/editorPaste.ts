/**
 * اللصق في المحرّر: ما يلصقه Word من وسوم مكتبه يُنظَّف (ويبقى ترقيمه نصًّا)، والمؤشّر بعد ما لُصق، والصور — لقطة
 * شاشةٍ من الحافظة، أو صور Word المؤقّتة والمضمّنة — تُحفظ في المخزن ويُشار إليها منه.
 *
 * كانت في `PageEditor.tsx` حتى بلغ سقفه، فنُقلت كما هي (محادثة «محرّر الكتاب»).
 */
import { NodeSelection, Plugin, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { NodeType } from 'prosemirror-model';
import { docSchema } from '@shared/docPm';
import { newUuid } from '@shared/doc';

const N = docSchema.nodes as Record<string, NodeType>;

/**
 * ما يلصقه Word من تعليقاتٍ شرطية ووسوم مكتبه لا معنى له هنا.
 *
 * إلا ترقيمه: Word يكتب رقم البند ونقطته بين `<![if !supportLists]>` و`<![endif]>` في
 * `mso-list:Ignore` — فيبقى الرقم نصًّا كما رآه الكاتب، ونقطة خطّ Symbol («·» أو «§») تصير «•».
 */
export function cleanPastedHtml(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<!\[if[^\]]*\]>|<!\[endif\]>/gi, '')
    .replace(/(<span[^>]*mso-list:\s*Ignore[^>]*>)\s*[·§o\uF0B7\uF0A7]\s*/gi, '$1• ')
    .replace(/<\/?o:p>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

/**
 * بعد اللصق يقف المؤشّر بعد ما لُصق كما في Word — لا على صورةٍ لُصقت آخره فيحلّ محلّها
 * ما يُلصق بعدها. وصورةٌ في آخر الورقة يُفتح بعدها سطر.
 */
export const caretAfterPaste = new Plugin({
  appendTransaction(trs, _old, state) {
    if (!trs.some((t) => t.getMeta('paste')) || !(state.selection instanceof NodeSelection)) return null;
    const end = state.selection.to;
    const $end = state.doc.resolve(end);
    const tr = state.tr;
    if (!$end.nodeAfter || !$end.nodeAfter.isTextblock) tr.insert(end, N.paragraph.create({ id: newUuid() }));
    return tr.setSelection(TextSelection.create(tr.doc, end + 1));
  }
});

/** صورٌ من الحافظة تُحفظ في المخزن وتُدرج حيث المؤشّر — بمقاسها، وأعرضها عرض المتن. */
export async function pasteImages(view: EditorView, files: File[], maxWidth: number) {
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const src = await window.diwan.files.storeImage(bytes);
    if (!src || view.isDestroyed) continue;
    let width = 140;
    try {
      const bmp = await createImageBitmap(file);
      width = Math.round(Math.min(bmp.width, maxWidth));
      bmp.close();
    } catch {
      /* مقاسها لا يُقرأ — يبقى الافتراض */
    }
    const node = N.image.create({ id: newUuid(), src, width, align: 'center' });
    view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
  }
  view.focus();
}

/** بايتات صورةٍ مضمّنة (`data:image/png;base64,…`) — بلا `fetch` تمنعه سياسة المحتوى. */
function dataUriBytes(uri: string): Uint8Array {
  const comma = uri.indexOf(',');
  const body = uri.slice(comma + 1);
  if (!/;base64$/i.test(uri.slice(0, comma))) return new TextEncoder().encode(decodeURIComponent(body));
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * ما لُصق من Word بصوره: الصورة ملفٌّ مؤقّت (`file:`) أو مضمّنة (`data:`) — تُنسخ إلى المخزن
 * ويُشار إليها منه. وما لم يُحفظ يُرفع من الورقة بدل صورةٍ مكسورة.
 */
export async function adoptPastedImages(view: EditorView) {
  const pending: { id: string; src: string }[] = [];
  view.state.doc.descendants((node) => {
    if (node.type === N.image && /^(file:|data:)/i.test(String(node.attrs.src))) pending.push({ id: node.attrs.id as string, src: node.attrs.src as string });
  });
  for (const p of pending) {
    let stored: string | null = null;
    try {
      stored = /^data:/i.test(p.src)
        ? await window.diwan.files.storeImage(dataUriBytes(p.src))
        : await window.diwan.files.storeImageUrl(p.src);
    } catch {
      stored = null;
    }
    if (view.isDestroyed) return;
    let at = -1;
    view.state.doc.descendants((node, pos) => {
      if (at < 0 && node.type === N.image && node.attrs.id === p.id && node.attrs.src === p.src) at = pos;
    });
    if (at < 0) continue;
    const node = view.state.doc.nodeAt(at)!;
    const tr = stored ? view.state.tr.setNodeMarkup(at, null, { ...node.attrs, src: stored }) : view.state.tr.delete(at, at + node.nodeSize);
    view.dispatch(tr.setMeta('addToHistory', false));
  }
}
