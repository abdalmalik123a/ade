/**
 * «ملفّ المدارس» في الشبّاك (الموجة ٢؛ تقسيمه بعد ١٫٧٫٠): «هات المدرسة» يملأ خاناتها من «الجهات»، والعام الدراسي يُكتب وحده
 * في خانته الفارغة — منقولٌ من `ServiceScreen` كما هو. و`fillFromSchool` دالّةٌ تملأ الخانات لا خطّاف.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DocField } from '@shared/doc';
import type { OfficeSettings } from '@shared/api';
import type { Client } from '@shared/orders';
import { applySchool, hasSchoolFields, schoolSlotOf, schoolValues } from '@shared/schoolFile';
import type { useToast } from '../../kit/useToast';
import type { Step } from './types';

export function useSchoolFile(
  ctx: {
    settings: OfficeSettings | null;
    fields: DocField[];
    step: Step;
    values: Record<string, string>;
    setValues: Dispatch<SetStateAction<Record<string, string>>>;
    say: ReturnType<typeof useToast>['say'];
  }
) {
  const { settings, fields, step, values, setValues, say } = ctx;

  /** «هات المدرسة» (ملفّ المدارس، الموجة ٢): المدارس من «الجهات»، وما ملأه آخر اختيار — فتبديلها يبدّل قيمها. */
  const [schoolPicker, setSchoolPicker] = useState(false);
  const [schools, setSchools] = useState<Client[]>([]);
  const schoolFilled = useRef<Record<string, string>>({});

  /** «ملفّ المدارس» مفعّلٌ، وفي الأوراق خانةٌ من ملفّ المدرسة — فيُعرض «هات المدرسة». */
  const schoolOn = Boolean(settings?.schoolFiles) && hasSchoolFields(fields);
  const schoolNameKey = useMemo(() => fields.find((f) => schoolSlotOf(f.key, f.source) === 'name')?.key ?? null, [fields]);
  useEffect(() => {
    if (schoolOn) void window.diwan.clients.list().then(setSchools);
  }, [schoolOn]);

  // والعام الدراسي يُكتب وحده من التاريخ (والخيار مفعّل) — في خانته الفارغة، فما كتبه الموظف لا يُمسّ.
  useEffect(() => {
    if (!settings?.schoolFiles || step !== 'fill') return;
    const year = schoolValues(fields, null, new Date());
    if (!Object.keys(year).length) return;
    setValues((prev) => {
      const missing = Object.entries(year).filter(([key]) => !prev[key]?.trim());
      return missing.length ? { ...prev, ...Object.fromEntries(missing) } : prev;
    });
  }, [fields, settings?.schoolFiles, step]);

  /** ملفّ المدرسة يملأ خاناتها — وما كتبه الموظف بيده لا يُطمس، وما ملأته مدرسةٌ سابقة يُستبدل. */
  function fillFromSchool(school: Client, base: Record<string, string> = values, filled: Record<string, string> = schoolFilled.current) {
    const out = applySchool(base, schoolValues(fields, school, new Date()), filled);
    schoolFilled.current = out.filled;
    setValues(out.values);
    setSchoolPicker(false);
    say(`مُلئت بيانات ${school.name}`);
  }

  return { schoolPicker, setSchoolPicker, schools, schoolFilled, schoolOn, schoolNameKey, fillFromSchool };
}
