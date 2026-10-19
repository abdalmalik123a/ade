/**
 * المعاملات المعلّقة (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولةٌ من `ServiceScreen` كما هي: تُعلَّق المعاملة وتُستأنف من حيث تُركت (ولو
 * بعد إغلاق البرنامج: تُحفظ في القاعدة)، و«ألغِ المعاملة» و× المعلّقة بـ«تراجع»، و«استأنف» من قيد العمل، وما يُترك عند الإغلاق.
 * والحال كلّها في الشاشة: الخطّاف يقرؤها ويضبطها بأسمائها.
 */
import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { onBeforeClose } from '../../lib/beforeClose';
import type { useToast } from '../../kit/useToast';
import type { Loaded, Parked, Step } from './types';

export function useParked(
  ctx: {
    say: ReturnType<typeof useToast>['say'];
    dismiss: ReturnType<typeof useToast>['dismiss'];
    citizenName: string;
    loaded: Loaded[];
    step: Step;
    values: Record<string, string>;
    letterNo: string;
    citizenId: number | null;
    merge: boolean;
    names: string;
    valuesOnly: boolean;
    genderByHand: boolean;
    reset: () => void;
    goFill: (ids?: number[]) => Promise<void>;
    setStep: Dispatch<SetStateAction<Step>>;
    setPicked: Dispatch<SetStateAction<number[]>>;
    setValues: Dispatch<SetStateAction<Record<string, string>>>;
    setLetterNo: Dispatch<SetStateAction<string>>;
    setCitizenId: Dispatch<SetStateAction<number | null>>;
    setMerge: Dispatch<SetStateAction<boolean>>;
    setNames: Dispatch<SetStateAction<string>>;
    setValuesOnly: Dispatch<SetStateAction<boolean>>;
    setGenderByHand: Dispatch<SetStateAction<boolean>>;
    setAt: Dispatch<SetStateAction<number>>;
    resumeRequest: { key: number; parkedKey: number } | null;
  }
) {
  const { say, dismiss, citizenName, loaded, step, values, letterNo, citizenId, merge, names, valuesOnly, genderByHand, reset, goFill, setStep, setPicked, setValues, setLetterNo, setCitizenId, setMerge, setNames, setValuesOnly, setGenderByHand, setAt, resumeRequest } = ctx;

  const [parked, setParkedState] = useState<Parked[]>([]);
  useEffect(() => {
    void window.diwan.service
      .parked()
      .then((list) => {
        const all = list as (Parked & { autosave?: boolean })[];
        setParkedState(all.filter((p) => !p.autosave));
        const draft = all.find((p) => p.autosave);
        if (draft && !resumeRequest) {
          void resumeDraft(draft);
        }
      })
      .catch(() => undefined);
  }, []);

  /** كلّ تغييرٍ يُحفظ في القاعدة — فالمعلّقة لا تضيع بإغلاق البرنامج ولا بانقطاع الكهرباء. */
  const setParked = (update: (list: Parked[]) => Parked[]) =>
    setParkedState((list) => {
      const next = update(list);
      void window.diwan.service.setParked(next).catch(() => say('تعذّر حفظ المعاملات المعلّقة', 'warn'));
      return next;
    });

  const snapshot = (): Parked => ({
    key: Date.now(),
    label: citizenName || loaded.map((l) => l.summary.title).join('، ') || 'معاملة',
    step,
    picked: loaded.map((l) => l.detail.id),
    values,
    letterNo,
    citizenId,
    merge,
    names,
    valuesOnly,
    genderByHand
  });

  const autosaveTimer = useRef<number | null>(null);

  const clearAutosave = () => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    setParked((list) => list.filter((x: any) => !x.autosave));
  };

  const prevStep = useRef<Step>(step);
  useEffect(() => {
    if (prevStep.current !== 'pick' && step === 'pick') {
      clearAutosave();
    }
    prevStep.current = step;
  }, [step]);

  // حفظ تلقائي دوري مؤجّل (debounce ~1.8 ث) عند وجود بيانات في fill أو review
  useEffect(() => {
    if (loaded.length === 0 || step === 'pick') {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      return;
    }
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      const snap = { ...snapshot(), autosave: true };
      setParked((list) => [...list.filter((x: any) => !x.autosave), snap as Parked]);
    }, 1800);

    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [step, loaded, values, letterNo, citizenId, merge, names, valuesOnly, genderByHand, citizenName]);

  const closeFlush = useRef<() => unknown>(() => undefined);
  closeFlush.current = () => {
    if (loaded.length > 0 && step !== 'pick') {
      const snap = { ...snapshot(), autosave: true };
      const others = parked.filter((x: any) => !x.autosave);
      return window.diwan.service.setParked([...others, snap]);
    }
    return undefined;
  };
  useEffect(() => onBeforeClose(() => closeFlush.current()), []);

  async function resumeDraft(p: Parked) {
    const found = (await Promise.all((p.picked ?? []).map((id) => window.diwan.templates.get(id).catch(() => null)))).filter(Boolean).length;
    if (!found) {
      clearAutosave();
      return;
    }
    const owner = p.citizenId === null || p.citizenId === undefined ? null : await window.diwan.citizens.get(p.citizenId).catch(() => null);
    const ownerGone = p.citizenId !== null && p.citizenId !== undefined && !owner;
    await goFill(p.picked ?? []);
    setStep(p.step ?? 'fill');
    setPicked(p.picked ?? []);
    setValues(p.values ?? {});
    setLetterNo(p.letterNo ?? '');
    setCitizenId(ownerGone ? null : (p.citizenId ?? null));
    setMerge(Boolean(p.merge));
    setNames(p.names ?? '');
    setValuesOnly(Boolean(p.valuesOnly));
    setGenderByHand(Boolean(p.genderByHand));
    setAt(0);
  }

  /** تُعلَّق المعاملة كما هي، ويُفتح الشبّاك لزبونٍ آخر. */
  function park() {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    setParked((list) => [...list.filter((x: any) => !x.autosave), snapshot()]);
    reset();
    say('عُلّقت المعاملة — تُستأنف من «معاملات معلّقة» حين يعود صاحبها');
  }

  /**
   * تُستأنف معلّقةٌ من حيث تُركت — والجارية إن كان فيها شيء تُعلَّق مكانها. والنماذج تُحمَّل
   * من جديد: ما حُذف منها منذ التعليق يُقال.
   */
  async function resume(key: number, from: Parked[] = parked) {
    const p = from.find((x) => x.key === key);
    if (!p) return;
    const current = loaded.length > 0 ? snapshot() : null;
    const found = (await Promise.all(p.picked.map((id) => window.diwan.templates.get(id).catch(() => null)))).filter(Boolean).length;
    if (!found) {
      say(`نماذج معاملة ${p.label} حُذفت منذ عُلّقت — لا تُستأنف`, 'warn');
      return;
    }
    const owner = p.citizenId === null ? null : await window.diwan.citizens.get(p.citizenId).catch(() => null);
    const ownerGone = p.citizenId !== null && !owner;
    setParked((list) => [...list.filter((x) => x.key !== key && !(x as any).autosave), ...(current ? [current] : [])]);
    await goFill(p.picked);
    setStep(p.step);
    setPicked(p.picked);
    setValues(p.values);
    setLetterNo(p.letterNo);
    setCitizenId(ownerGone ? null : p.citizenId);
    setMerge(p.merge);
    setNames(p.names);
    setValuesOnly(p.valuesOnly);
    setGenderByHand(p.genderByHand);
    setAt(0);
    const notes = [
      found < p.picked.length ? 'وحُذف من نماذجها ما لم يعد في المكتبة' : '',
      ownerGone ? 'والزبون الذي عُلّقت له لم يعد في السجلّ فلا تُربط به' : ''
    ].filter(Boolean);
    say(`استُؤنفت معاملة ${p.label}${notes.length ? ` — ${notes.join('، ')}` : ''}`, ownerGone ? 'warn' : 'ok');
  }

  /** آخر `resume` — فـ«تراجع» يُنادى بعد ثوانٍ، ولا يقرأ حالةً قديمة. */
  const resumeNow = useRef(resume);
  resumeNow.current = resume;

  /**
   * «ألغِ المعاملة»: تُمحى فورًا — وتبقى ثوانيَ يُتراجع عنها: زرّها ملاصقٌ لـ«علّق» وقد يُنقر بالخطأ (ج٢).
   * و«تراجع» يستأنفها بما استأنفت به المعلّقة: ما في الشبّاك الآن إن كان فيه عملٌ يُعلَّق مكانها فلا يضيع.
   */
  function discardTransaction() {
    clearAutosave();
    const gone = snapshot();
    reset();
    say('أُلغيت المعاملة — لم يُقيَّد شيء', 'ok', {
      label: 'تراجع',
      run: () => {
        dismiss();
        void resumeNow.current(gone.key, [gone]);
      }
    });
  }

  /** × على معاملةٍ معلّقة: تُحذف فورًا وتعود بـ«تراجع» إلى مكانها في الصفّ. */
  function dropParked(p: Parked) {
    const index = parked.findIndex((x) => x.key === p.key);
    setParked((list) => list.filter((x) => x.key !== p.key));
    say(`أُلغيت المعاملة المعلّقة «${p.label}»`, 'ok', {
      label: 'تراجع',
      run: () => {
        dismiss();
        setParked((list) => {
          if (list.some((x) => x.key === p.key)) return list;
          const at = index < 0 ? list.length : Math.min(index, list.length);
          return [...list.slice(0, at), p, ...list.slice(at)];
        });
      }
    });
  }

  // «استأنف» من قيد العمل: القائمة من القاعدة (قد عُلّقت عند الإغلاق بعد أن قُرئت هنا) ثم الاستئناف.
  useEffect(() => {
    if (!resumeRequest) return;
    void window.diwan.service.parked().then((list) => {
      const fresh = (list as Parked[]).filter((x: any) => !x.autosave);
      setParkedState(fresh);
      void resume(resumeRequest.parkedKey, fresh);
    });
    // مرّةً لكلّ «استأنف» بمفتاحه
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeRequest?.key]);

  return { parked: parked.filter((p: any) => !p.autosave), park, resume, discardTransaction, dropParked };
}
