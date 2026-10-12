/**
 * العدد والتاريخ في المحرّر (تقسيمه بعد ١٫٧٫٠) — منقولٌ من `EditorScreen` كما هو: ضبطهما وتاريخ اليوم، وحقول الترويسة في المعاينة
 * وفي الورقة التي تُطبع.
 */
import type { Registry } from '@shared/letterDraft';
import { formatGregorian, formatHijri } from '@shared/dates';
import { isLayoutEmpty, type LetterheadLayout } from '@shared/letterhead';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';

export function useEditorRegistry(
  ctx: {
    dirty: MutableRefObject<boolean>;
    setRegistry: Dispatch<SetStateAction<Registry>>;
    registry: Registry;
    shown: Record<string, string>;
    effective: Record<string, string>;
    layout: LetterheadLayout;
  }
) {
  const { dirty, setRegistry, registry, shown, effective, layout } = ctx;

  const setReg = (patch: Partial<Registry>) => {
    dirty.current = true;
    setRegistry((r) => ({ ...r, ...patch }));
  };
  const stampToday = () => {
    const now = new Date();
    setReg({ dateGreg: formatGregorian(now), dateHijri: formatHijri(now) });
  };
  /** حقول الترويسة التلقائية — والعدد ما أعطاه الزبون لا رقم المكتب (§١). */
  const resolveHead = (text: string): string =>
    text.replace(/\{([^{}]+)\}/g, (_m, raw: string) => {
      const key = raw.trim();
      if (key === 'رقم_الصادر') return registry.number;
      if (key === 'التاريخ_الميلادي') return registry.dateGreg;
      if (key === 'التاريخ_الهجري') return registry.dateHijri;
      return shown[key] ?? shown[key.replace(/_/g, ' ')] ?? '';
    });
  /** وحقولها في الورقة التي تُطبع وتُصدَّر — بالقيم الحقيقية لا بما تعرضه المعاينة. */
  const resolvePrinted = (text: string): string =>
    text.replace(/\{([^{}]+)\}/g, (_m, raw: string) => {
      const key = raw.trim();
      if (key === 'رقم_الصادر') return registry.number;
      if (key === 'التاريخ_الميلادي') return registry.dateGreg;
      if (key === 'التاريخ_الهجري') return registry.dateHijri;
      return effective[key] ?? effective[key.replace(/_/g, ' ')] ?? '';
    });
  const headLayout = isLayoutEmpty(layout) ? null : layout;
  const regValues = { number: registry.number, date: registry.dateGreg };

  return { headLayout, resolvePrinted, regValues, resolveHead, setReg, stampToday };
}
