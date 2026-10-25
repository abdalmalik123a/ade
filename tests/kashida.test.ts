/**
 * الكشيدة في الضبط (S13، D183): موضع التطويل في الكلمة بأولويّته، وتوزيع عدده على كلمات السطر — حسابٌ خالص.
 * والمرور على DOM (`applyKashida`) يُختبر في الطباعة الحقيقية (سيناريو `editor`)، وزخرفة المحرّر: محوها وتعيينها (D184).
 */
import { describe, expect, it } from 'vitest';
import { KASHIDA_SHARE, kashidaPoint, planLine } from '../src/shared/kashida';
import { EditorState } from 'prosemirror-state';
import { Decoration } from 'prosemirror-view';
import { docSchema } from '../src/shared/docPm';
import { kashidaKey, kashidaPlugin } from '../src/renderer/src/components/pageEditor/kashidaPlugin';

describe('موضع التطويل في الكلمة', () => {
  it('بعد السين وأخواتها أوّلًا، ثم قبل ا ط ل ك، ولا موضع في كلمةٍ حروفها لا تتّصل بما بعدها', () => {
    expect(kashidaPoint('مدرسة')).toEqual({ at: 4, p: 5 }); // مدرسـة
    expect(kashidaPoint('سلام')).toEqual({ at: 1, p: 5 }); // سـلام
    expect(kashidaPoint('على')).toEqual({ at: 1, p: 3 }); // عـلى
    expect(kashidaPoint('الطالب')).toEqual({ at: 3, p: 3 }); // الطـالب (والتعادل للأخير)
    expect(kashidaPoint('إدارة')).toBeNull(); // كلّها لا تتّصل بما بعدها
  });

  it('لا بين اللام والألف، ولا في كلمةٍ فيها تطويل الموظف، ولا في اللاتينية أو الحرف الواحد', () => {
    expect(kashidaPoint('لا')).toBeNull();
    expect(kashidaPoint('سـلام')).toBeNull();
    expect(kashidaPoint('Ali')).toBeNull();
    expect(kashidaPoint('و')).toBeNull();
    expect(kashidaPoint('123')).toBeNull();
  });

  it('والحركات تُتخطّى: التطويل بعد الحرف وحركاته', () => {
    // م ُ د َ ر ِ ّ س َ ة — قبل التاء المربوطة (الموضع ٩)، بعد فتحة السين.
    expect(kashidaPoint('مُدَرِّسَة')).toEqual({ at: 9, p: 5 });
  });
});

describe('توزيع التطويل على السطر', () => {
  it('بالدور، الأعلى أولويّةً أوّلًا، وما لا موضع فيه صفر', () => {
    expect(planLine([1, null, 5, 3], 5, 5)).toEqual([1, 0, 2, 2]);
  });

  it('وسقفٌ للكلمة الواحدة — والزائد يبقى للمسافات', () => {
    expect(planLine([5, null], 10, 5)).toEqual([5, 0]);
  });

  it('وبلا مواضع أو بلا فراغ: لا شيء', () => {
    expect(planLine([null, null], 3, 5)).toEqual([0, 0]);
    expect(planLine([2, 3], 0, 5)).toEqual([0, 0]);
    expect(planLine([2, 3], -4, 5)).toEqual([0, 0]);
  });

  it('ونصيب المستوى من الفراغ: منخفضة أقلّ من متوسّطة أقلّ من مرتفعة (الكلّ)', () => {
    expect(KASHIDA_SHARE.low).toBeLessThan(KASHIDA_SHARE.medium);
    expect(KASHIDA_SHARE.medium).toBeLessThan(KASHIDA_SHARE.high);
    expect(KASHIDA_SHARE.high).toBe(1);
  });
});

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
