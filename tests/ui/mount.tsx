/**
 * تركيب مكوّنٍ من الواجهة وحده في jsdom (G03، D39) — بـ`createRoot` و`act` من React ١٨ نفسها، بلا مكتبة اختبارٍ أخرى.
 * يُفكّ كلّ ما رُكّب بعد كلّ اختبار، و`window.diwan` مزيَّفٌ بما يحتاجه المكوّن وحده.
 */
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach } from 'vitest';

// React ١٨ خارج Jest: بهذا العلم يعرف أنّ `act` يحيط التحديثات، فلا يحذّر في كلّ تحديث.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: { root: Root; host: HTMLElement }[] = [];

export function mount(element: ReactElement): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  mounted.push({ root, host });
  return host;
}

export function unmountAll(): void {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
}

afterEach(() => unmountAll());

/** `window.diwan` بما يناديه المكوّن في الاختبار وحده — وما سواه غائبٌ فيسقط إن نودي. */
export function fakeDiwan(api: Record<string, unknown>): void {
  (window as unknown as { diwan: unknown }).diwan = api;
}

/** تفرغ الوعود المعلّقة داخل `act` — جوابٌ من الجسر المزيَّف ثم ما يرسمه. */
export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
