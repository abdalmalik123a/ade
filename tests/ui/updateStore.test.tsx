// @vitest-environment jsdom
/**
 * نسخة متجر مايكروسوفت تتحدّث من المتجر وحده (D242): بطاقة «التحديث» في الإعدادات تقول ذلك بلا زرّ «ثبّت تحديثًا»،
 * ونسخة exe كما كانت — الزرّ يفتح ملفّ التحديث. وقناتا التحديث في `tests/updateStore.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import UpdateCard from '../../src/renderer/src/components/UpdateCard';
import { fakeDiwan, mount, settle, unmountAll } from './mount';

describe('بطاقة التحديث في نسخة المتجر (D242)', () => {
  afterEach(() => unmountAll());

  it('نسخة المتجر: جملة المتجر بلا زرّ «ثبّت تحديثًا»', async () => {
    const pick = vi.fn(async () => null);
    fakeDiwan({ update: { pick } });
    const host = mount(<UpdateCard card="" title="التحديث" version="2.0.0" store />);
    await settle();
    expect(host.querySelector('[data-update-card="store"]')?.textContent).toContain('التحديث يصل من المتجر وحده');
    expect(host.querySelector('[data-act="update-pick"]')).toBeNull();
    expect(pick).not.toHaveBeenCalled();
  });

  it('نسخة exe: الزرّ كما كان ويفتح ملفّ التحديث', async () => {
    const pick = vi.fn(async () => null);
    fakeDiwan({ update: { pick } });
    const host = mount(<UpdateCard card="" title="التحديث" version="2.0.0" />);
    await settle();
    const button = host.querySelector<HTMLButtonElement>('[data-act="update-pick"]');
    expect(button?.textContent).toContain('ثبّت تحديثًا');
    button!.click();
    await settle();
    expect(pick).toHaveBeenCalledTimes(1);
  });
});
