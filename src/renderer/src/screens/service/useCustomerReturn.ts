/**
 * الزبون عائدًا من أداة (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو: يبقى زبون الشبّاك، وحقول ما يختاره بعدُ تُملأ من ملفّه.
 */
import { useRef, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Step } from './types';
import type { DocField } from '@shared/doc';
import type { Toast, ToastAction } from '../../kit/useToast';

export function useCustomerReturn(
  ctx: {
    customerRequest: { key: number; citizenId: number; } | null;
    setCitizenId: Dispatch<SetStateAction<number | null>>;
    step: Step;
    fields: DocField[];
    applyCitizen: (id: number) => Promise<void>;
    say: (text: string, tone?: Toast['tone'], action?: ToastAction, opts?: { sticky?: boolean; }) => void;
  }
) {
  const { customerRequest, setCitizenId, step, fields, applyCitizen, say } = ctx;

  // الزبون عائدًا من أداة: يبقى زبون الشبّاك، وحقول ما يختاره بعدُ تُملأ من ملفّه.
  const fillFrom = useRef<number | null>(null);
  useEffect(() => {
    if (!customerRequest) return;
    setCitizenId(customerRequest.citizenId);
    fillFrom.current = customerRequest.citizenId;
    if (step === 'fill' && fields.length) {
      fillFrom.current = null;
      void applyCitizen(customerRequest.citizenId);
    } else say('الزبون نفسه — اختر ما يريده بعدُ، وحقوله تُملأ من ملفّه');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerRequest?.key]);
  useEffect(() => {
    if (step !== 'fill' || !fields.length || fillFrom.current === null) return;
    const id = fillFrom.current;
    fillFrom.current = null;
    void applyCitizen(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, fields]);
}
