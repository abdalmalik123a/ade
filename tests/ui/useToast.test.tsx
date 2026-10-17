// @vitest-environment jsdom
/**
 * `useToast` (L28): مؤقّت الرسالة السابقة يُلغى أوّلًا — وإلا محا رسالةً جديدة بعد لحظةٍ من ظهورها فظنّ الموظف أنّ العملية
 * لم تقل شيئًا. و`sticky` تبقى حتى تُغلق، و`dismiss` وفكّ الشاشة يلغيان المؤقّت فلا يكتب في شاشةٍ فُكّت.
 */
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '../../src/renderer/src/kit/useToast';
import { mount, unmountAll } from './mount';

let hook: ReturnType<typeof useToast>;
function Probe() {
  hook = useToast(3000);
  return <span data-toast="">{hook.toast?.text ?? ''}</span>;
}
const shown = (host: HTMLElement) => host.querySelector('[data-toast]')?.textContent ?? '';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useToast (L28)', () => {
  it('رسالتان متتاليتان: مؤقّت الأولى لا يمحو الثانية', () => {
    const host = mount(<Probe />);
    act(() => hook.say('حُفظت المسودة'));
    act(() => vi.advanceTimersByTime(2000));
    act(() => hook.say('صدر الكتاب'));
    // ٣٫٥ ث من الأولى: مؤقّتها لو بقي لمحا الثانية هنا.
    act(() => vi.advanceTimersByTime(1500));
    expect(shown(host)).toBe('صدر الكتاب');
    act(() => vi.advanceTimersByTime(1600));
    expect(shown(host)).toBe('');
  });

  it('`sticky` تبقى حتى تُغلق', () => {
    const host = mount(<Probe />);
    act(() => hook.say('تعذّر حفظ PDF', 'warn', undefined, { sticky: true }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(shown(host)).toBe('تعذّر حفظ PDF');
    act(() => hook.dismiss());
    expect(shown(host)).toBe('');
  });

  it('`dismiss` يلغي المؤقّت، وفكّ المكوّن يلغيه', () => {
    const host = mount(<Probe />);
    act(() => hook.say('رسالة'));
    expect(vi.getTimerCount()).toBe(1);
    act(() => hook.dismiss());
    expect(shown(host)).toBe('');
    expect(vi.getTimerCount()).toBe(0);
    act(() => hook.say('رسالة أخرى'));
    expect(vi.getTimerCount()).toBe(1);
    unmountAll();
    expect(vi.getTimerCount()).toBe(0);
  });
});
