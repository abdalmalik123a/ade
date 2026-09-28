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

export type NameParts = { first: string; father: string; grandfather: string; surname: string; fourth?: string };

const words = (s: string) => joinCompounds(s.replace(/[،,]/g, ' ').trim().split(/\s+/).filter(Boolean));

/**
 * الاسم الرباعي واللقب مفرَّقًا — والرابع وما بعده لقبٌ (أو جدٌّ ثانٍ ولقب).
 *
 * فإن حُفظ اللقب في خانته عُرف موضعه: يُحذف من آخر الاسم إن كُتب فيه، والرابع اسمُ أب
 * الجد (الخانة الرابعة في استمارات أور) — لا جزءٌ من اللقب.
 */
export function splitArabicName(full: string, surname?: string | null): NameParts {
  const w = words(full);
  const known = words(surname ?? '');
  if (!known.length) {
    return { first: w[0] ?? '', father: w[1] ?? '', grandfather: w[2] ?? '', surname: w.slice(3).join(' ') };
  }
  const fold = (s: string) => normalizeFold(s);
  const tail = w.slice(-known.length);
  const own = tail.length === known.length && tail.every((x, i) => fold(x) === fold(known[i]!)) ? w.slice(0, -known.length) : w;
  return { first: own[0] ?? '', father: own[1] ?? '', grandfather: own[2] ?? '', fourth: own.slice(3).join(' '), surname: known.join(' ') };
}

/**
 * «محلة ٦١٢ زقاق ١٤ دار ٧» ← أجزاؤها، كما تسأل الاستمارات كلًّا في خانة. والأرقام الهندية
 * تُكتب لاتينية (خانات المواقع أرقام). وما لا يُعرف يبقى فارغًا — والعنوان كاملًا سطرٌ معه.
 */
export function addressParts(address: string): { mahalla: string; alley: string; house: string } {
  const t = normalizeFold(address).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
  const part = (re: RegExp) => re.exec(t)?.[1] ?? '';
  return {
    mahalla: part(/(?:^|\s)(?:م|محله|محلة)\s*[:/]?\s*(\d+[\w/-]*)/),
    alley: part(/(?:^|\s)(?:ز|زقاق|زقاق رقم)\s*[:/]?\s*(\d+[\w/-]*)/),
    house: part(/(?:^|\s)(?:د|دار|دار رقم)\s*[:/]?\s*(\d+[\w/-]*)/)
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
  surname?: string | null;
  motherName?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  education?: string | null;
  email?: string | null;
  governorate?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  nidIssueDate?: string | null;
  nidIssuer?: string | null;
  familyNumber?: string | null;
  civilIdNo?: string | null;
  civilRecord?: string | null;
  civilPage?: string | null;
  passportNo?: string | null;
  rationCardNo?: string | null;
  housingIssuer?: string | null;
};

/** تاريخٌ بالصيغتين اللتين تسأل بهما المواقع — وما لم يُفهم يبقى كما كُتب. */
function dateLines(label: string, text: string | null | undefined): [string, string | null | undefined][] {
  const d = text ? parseLooseDate(text) : null;
  return [
    [label, d ? `${pad(d.d)}/${pad(d.m)}/${d.y}` : text],
    [`${label} (السنة أولًا)`, d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null]
  ];
}

/** الأرقام في خانات المواقع لاتينية: «١٢٣» و«۱۲۳» ← «123» — والحروف كما هي (الرقم العائلي فيه حروف). */
const latinDigits = (v: string | null | undefined) =>
  v ? v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)) : v;

/**
 * البطاقة بأبوابها — بترتيب استمارات أور: الاسم واسم الأم، ثم الولادة والجنس، ثم السكن،
 * ثم الاتصال، ثم البطاقات والأرقام. وما لا قيمة له لا يُعرض.
 */
export function fillGroups(c: FillSource): FillGroup[] {
  const lines = (list: [string, string | null | undefined][]): FillLine[] =>
    list.filter(([, v]) => v && v.trim()).map(([label, value]) => ({ label, value: value!.trim() }));
  const name = splitArabicName(c.fullName, c.surname);
  const mother = splitArabicName(c.motherName ?? '');
  const groups: FillGroup[] = [
    {
      title: 'الاسم',
      lines: lines([
        ['الاسم الكامل', c.fullName],
        ['الاسم', name.first],
        ['اسم الأب', name.father],
        ['اسم الجد', name.grandfather],
        ['الاسم الرابع', name.fourth],
        ['اللقب', name.surname],
        ['الاسم الثلاثي', [name.first, name.father, name.grandfather].filter(Boolean).join(' ')],
        ['الاسم الرباعي', name.fourth ? [name.first, name.father, name.grandfather, name.fourth].join(' ') : null],
        ['اسم الأم الثلاثي', c.motherName],
        ['اسم الأم', c.motherName ? mother.first : null],
        ['اسم أب الأم', c.motherName ? mother.father : null],
        ['اسم جد الأم', c.motherName ? mother.grandfather : null]
      ])
    }
  ];

  groups.push({
    title: 'الولادة والحالة',
    lines: lines([
      ...dateLines('تاريخ الولادة', c.birthDate),
      ['سنة الولادة', c.birthDate ? String(parseLooseDate(c.birthDate)?.y ?? '') : null],
      ['محل الولادة', c.birthPlace],
      ['الجنس', c.gender],
      ['الحالة الاجتماعية', c.maritalStatus],
      ['التحصيل الدراسي', c.education]
    ])
  });

  const parts = addressParts(c.address ?? '');
  groups.push({
    title: 'السكن',
    lines: lines([
      ['المحافظة', c.governorate],
      ['القضاء', c.district],
      ['الناحية', c.subdistrict],
      ['المحلة', parts.mahalla],
      ['الزقاق', parts.alley],
      ['الدار', parts.house],
      ['العنوان', c.address],
      ['أقرب نقطة دالة', c.landmark]
    ])
  });

  const phone = (c.phone ?? '').trim();
  const local = phone ? normalizePhone(phone) : null;
  groups.push({
    title: 'الاتصال',
    lines: lines([
      ['الهاتف', local ?? phone],
      ['الهاتف بلا صفر', local ? local.slice(1) : null],
      ['الهاتف الدولي', local ? internationalPhone(local) : null],
      ['البريد الإلكتروني', c.email]
    ])
  });

  const id = (c.nationalId ?? '').trim();
  groups.push({
    title: 'البطاقات والأرقام',
    lines: lines([
      ['الرقم الوطني', id ? normalizeFold(id).replace(/\D/g, '') || id : null],
      ...dateLines('تاريخ إصدار البطاقة', c.nidIssueDate),
      ['جهة إصدار البطاقة', c.nidIssuer],
      ['الرقم العائلي', latinDigits(c.familyNumber)],
      ['رقم هوية الأحوال', latinDigits(c.civilIdNo)],
      ['رقم السجل', latinDigits(c.civilRecord)],
      ['رقم الصحيفة', latinDigits(c.civilPage)],
      ['رقم الجواز', latinDigits(c.passportNo)],
      ['رقم البطاقة التموينية', latinDigits(c.rationCardNo)],
      ['رقم بطاقة السكن', latinDigits(c.housingCardNo)],
      ['جهة إصدار بطاقة السكن', c.housingIssuer],
      ['رمز الموظف', c.employeeCode]
    ])
  });

  groups.push({
    title: 'العمل',
    lines: lines([
      ['العنوان الوظيفي', c.jobTitle],
      ['مكان العمل', c.workplace]
    ])
  });
  return groups.filter((g) => g.lines.length > 0);
}
