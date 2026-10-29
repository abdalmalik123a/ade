// @vitest-environment jsdom
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { textElement } from '../../src/shared/canvas';
import InlineTextEditor from '../../src/renderer/src/designs/editor/InlineTextEditor';
import type { DesignEditor } from '../../src/renderer/src/designs/editor/useDesignEditor';
import { mount } from './mount';
function setup() {
  const el = textElement({ box: { x: .1, y: .2, w: .5, h: .1 }, inlines: [{ kind: 'run', text: 'نص', marks: { bold: true } }, { kind: 'break' }, { kind: 'field', id: 'field-test', ref: 'الاسم' }] });
  const patchElement = vi.fn(); const close = vi.fn();
  const ed = { geometry: { pxW: 500, pxH: 300, offset: 12 }, patchElement } as unknown as DesignEditor;
  const host = mount(<InlineTextEditor el={el} ed={ed} close={close} />);
  const input = host.querySelector('textarea')!;
  const type = (s: string) => act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, s); input.dispatchEvent(new Event('input', { bubbles: true })); });
  const click = (s: string) => act(() => (host.querySelector(s) as HTMLButtonElement).click());
  return { input, type, click, patchElement, close };
}
describe('مسودة النص على اللوحة', () => {
  it('فتح ثم اعتماد بلا تعديل لا يفقد علامات النص ولا عقد الحقل والسطر', () => {
    const t = setup(); expect(t.input.value).toBe('نص\n{الاسم}'); t.click('[data-inline-accept]'); expect(t.patchElement).not.toHaveBeenCalled(); expect(t.close).toHaveBeenCalledOnce();
  });
  it('الكتابة محلية والاعتماد يغير الوثيقة مرة واحدة', () => {
    const t = setup(); t.type('زينب'); t.type('زينب {الاسم}'); expect(t.patchElement).not.toHaveBeenCalled(); t.click('[data-inline-accept]'); t.click('[data-inline-accept]');
    expect(t.patchElement).toHaveBeenCalledOnce(); expect(t.patchElement.mock.calls[0]![1].inlines).toEqual([{ kind: 'run', text: 'زينب ' }, expect.objectContaining({ kind: 'field', ref: 'الاسم' })]);
  });
  it('الإلغاء لا يغير الأصل', () => { const t = setup(); t.type('تعديل ملغى'); t.click('[data-inline-cancel]'); expect(t.patchElement).not.toHaveBeenCalled(); expect(t.close).toHaveBeenCalledOnce(); });
  it('Escape أثناء تركيب IME لا يغلق ولا يكتب', () => {
    const t = setup(); act(() => { t.input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); t.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(t.close).not.toHaveBeenCalled(); expect(t.patchElement).not.toHaveBeenCalled();
    act(() => { t.input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); t.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); expect(t.close).toHaveBeenCalledOnce();
  });
});
