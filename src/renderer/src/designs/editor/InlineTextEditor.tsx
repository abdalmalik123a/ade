/** مسودة محلية للنص: الكتابة لا تغير الوثيقة، والاعتماد قيد واحد؛ عدم التغيير يحفظ العقد الغنية. */
import { useEffect, useRef, useState } from 'react';
import { SCREEN_DPI, ptToPx, type TextElement } from '@shared/canvas';
import { inlinesOf } from './kit';
import type { DesignEditor } from './useDesignEditor';
export default function InlineTextEditor({ el, ed, close }: { el: TextElement; ed: DesignEditor; close: () => void }) {
  const original = el.inlines.map((n) => n.kind === 'run' ? n.text : n.kind === 'field' ? `{${n.ref}}` : '\n').join('');
  const [draft, setDraft] = useState(original);
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const ended = useRef(false);
  const { pxW, pxH, offset } = ed.geometry;
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const finish = (accept: boolean) => {
    if (ended.current || composing.current) return;
    ended.current = true;
    // لا كتابة فوق عنصر قُفل أو أُخفي أثناء التحرير.
    if (accept && draft !== original && !el.locked && !el.hidden) ed.patchElement(el.id, { inlines: draft.split('\n').flatMap((line, i) => [...(i ? [{ kind: 'break' as const }] : []), ...inlinesOf(line)]) });
    close();
  };
  return <div data-inline-editor={el.id} className="absolute bg-surface-container-lowest outline outline-2 outline-primary flex flex-col"
    style={{ right: offset + el.box.x * pxW, top: offset + el.box.y * pxH, width: el.box.w * pxW, height: el.box.h * pxH, zIndex: 12000, transform: `rotate(${- (el.rotate ?? 0)}deg)` }}
    onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) finish(true); }}>
    <textarea ref={input} aria-label="تحرير النص على اللوحة" data-inline-text dir={el.dir ?? 'rtl'} value={draft}
      className="w-full h-full min-h-0 resize-none border-0 outline-none bg-transparent p-0"
      style={{ fontFamily: el.font, fontSize: ptToPx(el.size, SCREEN_DPI), fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? 'italic' : 'normal', lineHeight: el.lineHeight ?? 1.4, color: el.color, textAlign: el.align, letterSpacing: `${el.letterSpacing ?? 0}em`, wordSpacing: `${el.wordSpacing ?? 0}em` }}
      onChange={(e) => setDraft(e.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
      onKeyDown={(e) => {
        // IME يدير Enter وEscape بنفسه، وبقية المفاتيح تبقى في خانة النص.
        e.stopPropagation();
        if (e.nativeEvent.isComposing || composing.current) return;
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); finish(true); }
      }} />
    <div className="absolute top-full right-0 flex gap-1 bg-surface-container-lowest border border-outline-variant p-1 text-on-surface" style={{ fontSize: 12 }}>
      <button type="button" data-inline-accept onMouseDown={(e) => e.preventDefault()} onClick={() => finish(true)}>اعتمد</button>
      <button type="button" data-inline-cancel onMouseDown={(e) => e.preventDefault()} onClick={() => finish(false)}>ألغِ</button>
    </div>
  </div>;
}
