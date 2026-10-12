/**
 * تحميل تفاصيل النماذج المختارة مرّةً عند الانتقال إلى «املأ» (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو.
 */
import type { Loaded, Step } from './types';
import { normalizeLayout, type Letterhead } from '@shared/letterhead';
import type { Dispatch, SetStateAction } from 'react';
import type { TemplateSummary } from '@shared/apiTemplates';
import type { Toast, ToastAction } from '../../kit/useToast';

export function useFillLoader(
  ctx: {
    picked: number[];
    setBusy: Dispatch<SetStateAction<boolean>>;
    items: TemplateSummary[];
    letterheads: Letterhead[];
    setLoaded: Dispatch<SetStateAction<Loaded[]>>;
    setStep: Dispatch<SetStateAction<Step>>;
    say: (text: string, tone?: Toast['tone'], action?: ToastAction, opts?: { sticky?: boolean; }) => void;
  }
) {
  const { picked, setBusy, items, letterheads, setLoaded, setStep, say } = ctx;

  /** تحميل تفاصيل المختارات مرّة عند الانتقال — لا مع كل ضغطة. */
  async function goFill(ids: number[] = picked) {
    setBusy(true);
    try {
      const details = await Promise.all(ids.map((id) => window.diwan.templates.get(id)));
      const next: Loaded[] = [];
      for (const detail of details) {
        if (!detail) continue;
        // الملخّص من القائمة، وإلا من التفاصيل نفسها — نموذجٌ مُكرَّر قد لا يكون فيها.
        const summary =
          items.find((t) => t.id === detail.id) ?? { ...detail, variables: detail.variables.map((v) => v.token) };
        const lh = letterheads.find((x) => x.id === detail.letterheadId) ?? null;
        next.push({
          summary,
          detail,
          doc: await window.diwan.templates.doc(detail.id),
          layout: lh ? normalizeLayout(lh.layout) : null
        });
      }
      setLoaded(next);
      setStep('fill');
    } catch {
      say('تعذّر تحميل النماذج', 'warn');
    } finally {
      setBusy(false);
    }
  }

  return { goFill };
}
