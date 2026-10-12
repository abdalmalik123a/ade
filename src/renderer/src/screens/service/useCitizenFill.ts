/**
 * F2 في الشبّاك (تقسيم الشبّاك بعد ١٫٧٫٠) — منقولٌ من `ServiceScreen` كما هو: ما يعرفه البرنامج عن المواطن يملأ ما يطابقه من الحقول، وما كتبه الموظف لا يُطمس.
 */
import type { DocField } from '@shared/doc';
import type { Dispatch, SetStateAction } from 'react';
import type { Toast, ToastAction } from '../../kit/useToast';

export function useCitizenFill(
  ctx: {
    setCitizenId: Dispatch<SetStateAction<number | null>>;
    setValues: Dispatch<SetStateAction<Record<string, string>>>;
    fields: DocField[];
    setPicker: Dispatch<SetStateAction<boolean>>;
    say: (text: string, tone?: Toast['tone'], action?: ToastAction, opts?: { sticky?: boolean; }) => void;
  }
) {
  const { setCitizenId, setValues, fields, setPicker, say } = ctx;

  /** F2: ما يعرفه البرنامج عن المواطن يملأ ما يطابقه من الحقول. */
  async function useCitizen(id: number) {
    const citizen = (await window.diwan.citizens.get(id)) as Record<string, unknown> | null;
    if (!citizen) return;
    setCitizenId(id);
    setValues((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (!f.source) continue;
        const raw = citizen[f.source];
        // ما كتبه الموظف بيده لا يُطمس.
        if (typeof raw === 'string' && raw.trim() && !next[f.key]?.trim()) next[f.key] = raw;
      }
      const name = citizen.fullName;
      const byRole = fields.find((f) => f.role === 'name');
      if (byRole && typeof name === 'string' && !next[byRole.key]?.trim()) next[byRole.key] = name;
      return next;
    });
    setPicker(false);
    say('استُوردت بيانات المواطن');
  }

  return { useCitizen };
}
