/** ما تشترك فيه شاشة الزبائن وأجزاؤها (تقسيمها بعد ١٫٧٫٠) — منقولٌ منها كما هو. */
import type { CitizenTextKey } from '@shared/citizenSchema';

export const nf = new Intl.NumberFormat('en-US');
export const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : undefined);

/** خانات الملف التي تُعرض ولو فارغة — وما سواها يُعرض إن مُلئ. */
export const ALWAYS_SHOWN = new Set<CitizenTextKey>(['nationalId', 'jobTitle', 'enrollmentDept', 'birthDate', 'birthPlace', 'housingCardNo', 'address', 'landmark', 'phone']);

export type Toast = { text: string; tone: 'ok' | 'warn' } | null;
