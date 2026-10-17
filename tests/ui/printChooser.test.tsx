// @vitest-environment jsdom
/**
 * «على أيّ طابعة؟» (`PrintChooser` و`choosePrinter`): دورٌ بلا طابعة يسأل مرّةً في نافذة البرنامج بطابعات ويندوز والافتراضية مختارة ·
 * Enter تطبع عليها · Esc تلغي (`null`) · «بإعدادات ويندوز…» تفتح نافذته (`system: true`) · ودورٌ بطابعةٍ مسمّاة يطبع مباشرةً بلا سؤال.
 */
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import PrintChooser from '../../src/renderer/src/components/PrintChooser';
import { choosePrinter, type PrintPick } from '../../src/renderer/src/lib/printChoice';
import { fakeDiwan, mount, settle } from './mount';

const printer = (name: string, isDefault = false) => ({ name, displayName: name, description: '', isDefault, ready: true });

beforeEach(() =>
  fakeDiwan({
    settings: {
      get: async () => ({
        printRoles: {
          designs: { normal: null, color: null, dialog: false },
          documents: { normal: 'طابعة الكتب', color: null, dialog: false }
        }
      })
    },
    printers: { list: async () => [printer('HP LaserJet'), printer('Canon G3010', true), printer('Microsoft Print to PDF')] }
  })
);

/** يسأل عن دور التصاميم ويعيد الوعد والنافذة حين تُرسم بطابعاتها. */
async function ask(): Promise<{ answer: Promise<PrintPick | null>; host: HTMLElement }> {
  const host = mount(<PrintChooser />);
  let answer!: Promise<PrintPick | null>;
  await act(async () => {
    answer = choosePrinter('designs', { allowSystem: true });
  });
  await settle();
  await settle();
  return { answer, host };
}
const key = (k: string) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));

describe('PrintChooser — سؤالٌ واحد للمهمّة', () => {
  it('دورٌ بلا طابعة: النافذة بطابعات ويندوز والافتراضية مختارة، وEnter تطبع عليها', async () => {
    const { answer, host } = await ask();
    expect(host.querySelector('[data-print-chooser="designs"]')).not.toBeNull();
    expect([...host.querySelectorAll('[data-print-printer]')].map((b) => b.getAttribute('data-print-printer'))).toEqual([
      'HP LaserJet',
      'Canon G3010',
      'Microsoft Print to PDF'
    ]);
    expect(host.querySelector('[data-print-printer="Canon G3010"]')?.textContent).toContain('radio_button_checked');
    await key('Enter');
    expect(await answer).toEqual({ printer: 'Canon G3010', system: false });
    expect(host.querySelector('[data-print-chooser]')).toBeNull();
  });

  it('Esc تلغي الطباعة', async () => {
    const { answer } = await ask();
    await key('Escape');
    expect(await answer).toBeNull();
  });

  it('«بإعدادات ويندوز…» تفتح نافذته بالطابعة المختارة', async () => {
    const { answer, host } = await ask();
    act(() => (host.querySelector('[data-print-printer="HP LaserJet"]') as HTMLButtonElement).click());
    act(() => (host.querySelector('[data-act="print-system"]') as HTMLButtonElement).click());
    expect(await answer).toEqual({ printer: 'HP LaserJet', system: true });
  });

  it('ودورٌ بطابعةٍ مسمّاة يطبع مباشرةً — لا نافذة', async () => {
    const host = mount(<PrintChooser />);
    let pick: PrintPick | null = null;
    await act(async () => {
      pick = await choosePrinter('documents', { allowSystem: true });
    });
    expect(pick).toEqual({ printer: 'طابعة الكتب', system: false });
    expect(host.querySelector('[data-print-chooser]')).toBeNull();
  });
});
