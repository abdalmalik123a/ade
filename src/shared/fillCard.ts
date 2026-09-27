/**
 * بطاقة التعبئة للمواقع الحكومية (هـ٦) — صيغٌ جاهزة تُنسخ بنقرة.
 *
 * المواقع الحكومية (البطاقة الوطنية، الجوازات، المنصّات) تسأل عن الاسم مفرَّقًا:
 * «الاسم / اسم الأب / اسم الجد / اللقب»، وعن التاريخ بصيغتها، وعن الهاتف بلا صفرٍ
 * أو بمفتاح الدولة. فالموظف كان ينسخ الاسم كاملًا ثم يقصّه بيده في كل خانة.
 * وهنا يُقصّ مرّةً، وكلّ صيغةٍ سطرٌ يُنسخ.
 */
import { normalizeFold } from './arabic';
import { internationalPhone, normalizePhone } from './idChecks';

/** أسماءٌ من كلمتين: «عبد الله»، «أبو بكر»، «نور الدين» — كلمةٌ واحدة في الخانة. */
function joinCompounds(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const next = words[i + 1];
    if (next && /^(عبد|ابو|أبو|ام|أم)$/.test(w)) {
      out.push(`${w} ${next}`);
      i++;
    } else if (out.length && /^(الدين|الله)$/.test(w)) {
      out[out.length - 1] = `${out[out.length - 1]} ${w}`;
    } else out.push(w);
  }
  return out;
}

export type NameParts = { first: string; father: string; grandfather: string; surname: string };

/** الاسم الرباعي واللقب مفرَّقًا — والرابع وما بعده لقبٌ (أو جدٌّ ثانٍ ولقب). */
export function splitArabicName(full: string): NameParts {
  const words = joinCompounds(full.replace(/[،,]/g, ' ').trim().split(/\s+/).filter(Boolean));
  return {
    first: words[0] ?? '',
    father: words[1] ?? '',
    grandfather: words[2] ?? '',
    surname: words.slice(3).join(' ')
  };
}

/** تاريخٌ مكتوبٌ بأيّ صيغةٍ شائعة ← يومٌ وشهرٌ وسنة — أو عدم. */
export function parseLooseDate(text: string): { d: number; m: number; y: number } | null {
  const t = normalizeFold(text).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) return valid(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

function valid(d: number, m: number, y: number) {
  return d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100 ? { d, m, y } : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export type FillLine = { label: string; value: string };
export type FillGroup = { title: string; lines: FillLine[] };

export type FillSource = {
  fullName: string;
  nationalId?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  address?: string | null;
  housingCardNo?: string | null;
  landmark?: string | null;
  jobTitle?: string | null;
  workplace?: string | null;
  employeeCode?: string | null;
};

/** البطاقة بأبوابها — وما لا قيمة له لا يُعرض. */
export function fillGroups(c: FillSource): FillGroup[] {
  const lines = (list: [string, string | null | undefined][]): FillLine[] =>
    list.filter(([, v]) => v && v.trim()).map(([label, value]) => ({ label, value: value!.trim() }));
  const name = splitArabicName(c.fullName);
  const groups: FillGroup[] = [
    {
      title: 'الاسم',
      lines: lines([
        ['الاسم الكامل', c.fullName],
        ['الاسم', name.first],
        ['اسم الأب', name.father],
        ['اسم الجد', name.grandfather],
        ['اللقب', name.surname],
        ['الاسم الثلاثي', [name.first, name.father, name.grandfather].filter(Boolean).join(' ')]
      ])
    }
  ];

  const id = (c.nationalId ?? '').trim();
  const phone = (c.phone ?? '').trim();
  const local = phone ? normalizePhone(phone) : null;
  groups.push({
    title: 'الأرقام',
    lines: lines([
      ['الرقم الوطني', id ? normalizeFold(id).replace(/\D/g, '') || id : null],
      ['الهاتف', local ?? phone],
      ['الهاتف بلا صفر', local ? local.slice(1) : null],
      ['الهاتف الدولي', local ? internationalPhone(local) : null],
      ['رقم بطاقة السكن', c.housingCardNo],
      ['رمز الموظف', c.employeeCode]
    ])
  });

  const birth = c.birthDate ? parseLooseDate(c.birthDate) : null;
  groups.push({
    title: 'الولادة',
    lines: lines([
      ['تاريخ الولادة', birth ? `${pad(birth.d)}/${pad(birth.m)}/${birth.y}` : c.birthDate],
      ['بصيغة السنة أولًا', birth ? `${birth.y}-${pad(birth.m)}-${pad(birth.d)}` : null],
      ['سنة الولادة', birth ? String(birth.y) : null],
      ['محل الولادة', c.birthPlace]
    ])
  });

  groups.push({
    title: 'السكن والعمل',
    lines: lines([
      ['العنوان', c.address],
      ['أقرب نقطة دالة', c.landmark],
      ['العنوان الوظيفي', c.jobTitle],
      ['مكان العمل', c.workplace]
    ])
  });
  return groups.filter((g) => g.lines.length > 0);
}
