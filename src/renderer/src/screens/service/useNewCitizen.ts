/**
 * الزبون الجديد إلى السجلّ (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو: معاملةٌ صدرت لاسمٍ لا ملفّ له يُعرض
 * حفظه بما كُتب له، وتُربط به كتبه.
 */
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DocField } from '@shared/doc';
import type { CitizenInput } from '@shared/api';
import type { useToast } from '../../kit/useToast';
import type { AfterIssue, NewCitizen } from './types';

export function useNewCitizen(
  ctx: {
    fields: DocField[];
    values: Record<string, string>;
    byRole: (role: DocField['role']) => string;
    citizenName: string;
    say: ReturnType<typeof useToast>['say'];
    sayError: (e: unknown, fallback: string) => void;
    setAfter: Dispatch<SetStateAction<AfterIssue | null>>;
  }
) {
  const { fields, values, byRole, citizenName, say, sayError, setAfter } = ctx;

  /**
   * صدرت المعاملة لاسمٍ كُتب باليد لا في السجل؟ يُعرض حفظه — بما كُتب في حقوله
   * (كل حقلٍ يعرف خانته في ملف المواطن: `source`) — وتُربط كتبه به. عرضٌ لا
   * حفظٌ صامت: قد يكون زبونًا عابرًا لا يريد المكتب ملفًّا له.
   */
  const [newCitizen, setNewCitizen] = useState<NewCitizen | null>(null);

  function offerToRegistry(transactionId: number) {
    const input: CitizenInput = {
      id: null, fullName: citizenName, nationalId: null, jobTitle: null, workplace: null, employeeCode: null,
      serviceStatus: null, birthDate: null, birthPlace: null, enrollmentDept: null, address: null,
      housingCardNo: null, landmark: null, phone: null, photoPath: null, category: null, notes: null, verified: false
    };
    for (const f of fields) {
      const v = values[f.key]?.trim();
      if (!v || !f.source || !(f.source in input) || f.source === 'id' || f.source === 'verified') continue;
      (input as unknown as Record<string, string>)[f.source] = v;
    }
    input.nationalId ||= byRole('nationalId') || null;
    input.fullName = citizenName;
    setNewCitizen({ transactionId, input });
  }

  async function saveNewCitizen() {
    if (!newCitizen) return;
    try {
      const saved = await window.diwan.citizens.save(newCitizen.input);
      await window.diwan.documents.linkCitizen(newCitizen.transactionId, saved.id);
      say(`حُفظ «${saved.fullName}» في الزبائن، ورُبطت به كتبه`);
      setNewCitizen(null);
      // «شيءٌ آخر لنفس الزبون» بعدها يحمل ملفّه الجديد — فتعرفه الأداة التي يُفتح لها (المرحلة ٥).
      setAfter((a) => (a?.customer ? { ...a, customer: { ...a.customer, citizenId: saved.id } } : a));
    } catch (e) {
      sayError(e, 'تعذّر الحفظ في السجل');
    }
  }

  return { newCitizen, setNewCitizen, offerToRegistry, saveNewCitizen };
}
