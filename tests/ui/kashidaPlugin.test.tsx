/**
 * زخرفة الكشيدة في المحرّر (S13، D184): ما تغيّر من الفقرات تُمحى زخرفته في المعاملة نفسها فلا يُرى تطويلٌ قديم، والباقي يتبع النصّ بالتعيين.
 * حالُ الإضافة وحدها (بلا عرض) — وقياسها على DOM الحقيقيّ في سيناريو `editor` (عدد التطويل في المحرّر كما في PDF). وهنا لا في
 * `tests/kashida.test.ts` لأنّ الإضافة من الواجهة (أنواع DOM في إعداد اختبارات الواجهة وحده).
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { Decoration } from 'prosemirror-view';
import { docSchema } from '@shared/docPm';
import { kashidaKey, kashidaPlugin } from '../../src/renderer/src/components/pageEditor/kashidaPlugin';

describe('زخرفة التطويل في المحرّر (D184)', () => {
  it('ما تغيّر من الفقرات تُمحى زخرفته في المعاملة نفسها، والباقي يتبع النصّ', () => {
    const para = (text: string) => docSchema.node('paragraph', { align: 'justify', kashida: 'medium' }, [docSchema.text(text)]);
    let state = EditorState.create({ schema: docSchema, doc: docSchema.node('doc', null, [para('مدرسة النور'), para('سلام على الطالب')]), plugins: [kashidaPlugin()] });
    const at = () => kashidaKey.getState(state)!.find().map((d) => d.from);
    const w = (pos: number) => Decoration.widget(pos, () => ({}) as never);
    // الأولى من ٠ (نصّها من ١، و«مدرس» ٤ أحرف)، والثانية من ١٣ (نصّها من ١٤، و«س» حرف).
    state = state.apply(state.tr.setMeta(kashidaKey, { add: [w(5), w(15)] }));
    expect(at()).toEqual([5, 15]);
    state = state.apply(state.tr.insertText('و', 1));
    expect(at()).toEqual([16]);
    state = state.apply(state.tr.setNodeMarkup(14, undefined, { ...state.doc.child(1).attrs, align: 'right', kashida: null }));
    expect(at()).toEqual([]);
    state = state.apply(state.tr.setMeta(kashidaKey, { add: [w(5)] }));
    expect(at()).toEqual([5]);
    state = state.apply(state.tr.setMeta(kashidaKey, { reset: true }));
    expect(at()).toEqual([]);
  });
});
