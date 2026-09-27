/**
 * التحليل الذكي لنصوص رسائل الواتساب وشبكات التواصل (WhatsApp Smart Parse).
 *
 * في مكاتب الاستنساخ، يرسل المواطن بياناته أو بيانات معاملته عبر رسالة نصية
 * غير مهيكلة على واتساب أو تيليجرام. يقوم هذا المحرك بتحليل الرسالة واستخراج:
 * - الاسم الكامل والرباعي واللقب
 * - الرقم الوطني الموحد (١٢ رقمًا)
 * - رقم الهاتف (العراقي ٠٧xxx أو الدولي +964)
 * - تاريخ الولادة ومحل الولادة
 * - بطاقة السكن والعنوان (المحلة والزقاق والدار) والنقطة الدالة
 * - الوظيفة ودائرة الانتساب ورمز الموظف
 * - اسم الأم وملاحظات المعاملة
 *
 * كل ذلك محليًا ١٠٠٪ وبلا إنترنت عبر تعبيرات نمطية وقواعد لغوية عراقية ذكية.
 */

export type ExtractedCitizen = {
  fullName: string | null;
  nationalId: string | null;
  phone: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  housingCardNo: string | null;
  address: string | null;
  landmark: string | null;
  jobTitle: string | null;
  workplace: string | null;
  employeeCode: string | null;
  motherName: string | null;
  notes: string | null;
  detectedFieldsCount: number;
};

/** تحويل الأرقام الهندية/المشرقية (٠١٢٣٤٥٦٧٨٩) إلى أرقام عربية قياسية (0-9) */
export function normalizeIndicDigits(text: string): string {
  const indic = '٠١٢٣٤٥٦٧٨٩';
  return text.replace(/[٠-٩]/g, (ch) => String(indic.indexOf(ch)));
}

/** تنظيف الأقواس والنقاط الزائدة من بداية ونهاية القيمة */
function cleanValue(v: string | undefined): string | null {
  if (!v) return null;
  const cleaned = v
    .replace(/^[:=\-–—ـ،؛*#•.\s]+/, '')
    .replace(/[:=\-–—ـ،؛*#•.\s]+$/, '')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** العناوين التي تبدأ بها قطع الرسالة — وعند الفاصلة التي تسبقها وحدها يُقطَّع السطر. */
const LABELS = [
  'الاسم', 'اسم', 'التولد', 'تاريخ', 'الميلاد', 'سنة', 'محل', 'مكان', 'مسقط', 'الرقم', 'رقم',
  'البطاقة', 'بطاقة', 'الهوية', 'الهاتف', 'هاتف', 'الموبايل', 'موبايل', 'جوال', 'تلفون', 'تليفون',
  'واتساب', 'العنوان', 'السكن', 'المنطقة', 'أقرب', 'نقطة', 'قرب', 'الوظيفة', 'المهنة', 'المنصب',
  'الدرجة', 'الدائرة', 'جهة', 'الوزارة', 'المديرية', 'رمز', 'كود', 'الأم', 'الام', 'أم', 'ام',
  'الوالدة', 'والدته'
].join('|');
const SEGMENT_BREAK = new RegExp(`[،,؛;|]\\s*(?=(?:${LABELS})[^:=\\n]{0,20}[:=])`);

/** المدن والمحافظات العراقية الشائعة */
export const IRAQI_PROVINCES = [
  'بغداد',
  'البصرة',
  'نينوى',
  'الموصل',
  'أربيل',
  'اربيل',
  'النجف',
  'كربلاء',
  'كركوك',
  'الأنبار',
  'الانبار',
  'ديالى',
  'بابل',
  'الحلة',
  'واسط',
  'الكوت',
  'ميسان',
  'العمارة',
  'ذي قار',
  'الناصرية',
  'القادسية',
  'الديوانية',
  'صلاح الدين',
  'تكريت',
  'السليمانية',
  'دهوك'
];

/**
 * يحلل نص رسالة واتساب ويعيد كائن بيانات المواطن المهيكل
 */
export function parseWhatsAppMessage(rawText: string): ExtractedCitizen {
  const normalized = normalizeIndicDigits(rawText);
  // سطرٌ واحد فيه بياناتٌ كثيرة («الاسم: …، التولد: …، العنوان: …») يُقطَّع عند
  // الفاصلة **التي تسبق عنوانًا معروفًا** وحدها — فالعنوان «بغداد، الكرادة» يبقى
  // قطعةً واحدة.
  const lines = normalized
    .split(/\r?\n/)
    .flatMap((l) => l.split(SEGMENT_BREAK))
    .map((l) => l.trim())
    .filter(Boolean);

  let fullName: string | null = null;
  let nationalId: string | null = null;
  let phone: string | null = null;
  let birthDate: string | null = null;
  let birthPlace: string | null = null;
  let housingCardNo: string | null = null;
  let address: string | null = null;
  let landmark: string | null = null;
  let jobTitle: string | null = null;
  let workplace: string | null = null;
  let employeeCode: string | null = null;
  let motherName: string | null = null;
  const extraNotes: string[] = [];

  for (const line of lines) {
    // 1. الاسم
    if (!fullName) {
      const nameMatch = line.match(
        /^(?:الاسم(?:\s+الكامل|\s+الرباعي|\s+الثلاثي|\s+واللقب)?|اسم\s+المواطن|اسم\s+الزبون|الاسم)\s*[:=؛\-–]\s*(.+)$/i
      );
      if (nameMatch) {
        fullName = cleanValue(nameMatch[1]);
        continue;
      }
    }

    // 2. الرقم الوطني الموحد (12 رقماً)
    if (!nationalId) {
      const nidMatch = line.match(
        /(?:الرقم\s+الوطني(?:\s+الموحد)?|البطاقة\s+الوطنية|الرقم\s+الموحد|رقم\s+البطاقة|الهوية|الرقم\s+المدني)\s*[:=؛\-–]?\s*([0-9]{10,14})/i
      );
      if (nidMatch) {
        nationalId = cleanValue(nidMatch[1]);
        continue;
      }
    }

    // 3. الهاتف
    if (!phone) {
      const phoneMatch = line.match(
        /(?:رقم\s+)?(?:ال)?(?:هاتف|موبايل|جوال|تلفون|تليفون|اتصال|واتساب)\s*[:=؛\-–]?\s*(\+?964\s?7\d{8,9}|07[3-9]\d{8}|\b07\d{9}\b)/i
      );
      if (phoneMatch) {
        phone = cleanValue(phoneMatch[1]?.replace(/\s+/g, ''));
        continue;
      }
    }

    // 4. تاريخ التولد
    if (!birthDate) {
      const birthMatch = line.match(
        /(?:التولد|تاريخ\s+الولادة|تاريخ\s+الميلاد|الميلاد|سنة\s+الولادة)\s*[:=؛\-–]?\s*([0-9]{4}[/\-.][0-9]{1,2}[/\-.][0-9]{1,2}|[0-9]{1,2}[/\-.][0-9]{1,2}[/\-.][0-9]{4}|[0-9]{4})/i
      );
      if (birthMatch) {
        birthDate = cleanValue(birthMatch[1]);
        continue;
      }
    }

    // 5. محل الولادة
    if (!birthPlace) {
      const bpMatch = line.match(
        /(?:محل\s+الولادة|مكان\s+الولادة|مسقط\s+الرأس)\s*[:=؛\-–]\s*(.+)$/i
      );
      if (bpMatch) {
        birthPlace = cleanValue(bpMatch[1]);
        continue;
      }
    }

    // 6. بطاقة السكن
    if (!housingCardNo) {
      const hcMatch = line.match(
        /(?:بطاقة\s+السكن|رقم\s+بطاقة\s+السكن|معلومات\s+السكن)\s*[:=؛\-–]?\s*([A-Za-z0-9/\-_]+)/i
      );
      if (hcMatch) {
        housingCardNo = cleanValue(hcMatch[1]);
        continue;
      }
    }

    // 7. العنوان والسكن
    if (!address) {
      const addrMatch = line.match(
        /(?:العنوان|السكن|منطقة\s+السكن|محل\s+الإقامة|المنطقة)\s*[:=؛\-–]\s*(.+)$/i
      );
      if (addrMatch) {
        address = cleanValue(addrMatch[1]);
        continue;
      } else if (/محلة\s*\d+|زقاق\s*\d+|دار\s*\d+|حي\s+[\u0600-\u06FF]+/i.test(line)) {
        address = cleanValue(line);
        continue;
      }
    }

    // 8. أقرب نقطة دالة
    if (!landmark) {
      const lmMatch = line.match(
        /(?:أقرب\s+نقطة\s+دالة|نقطة\s+دالة|علامة\s+دالة|مجاور|قرب)\s*[:=؛\-–]\s*(.+)$/i
      );
      if (lmMatch) {
        landmark = cleanValue(lmMatch[1]);
        continue;
      }
    }

    // 9. العنوان الوظيفي والوظيفة
    if (!jobTitle) {
      const jobMatch = line.match(
        /(?:الوظيفة|العنوان\s+الوظيفي|المهنة|الدرجة\s+الوظيفية|المنصب)\s*[:=؛\-–]\s*(.+)$/i
      );
      if (jobMatch) {
        jobTitle = cleanValue(jobMatch[1]);
        continue;
      }
    }

    // 10. مكان العمل ودائرة الانتساب
    if (!workplace) {
      const wpMatch = line.match(
        /(?:مكان\s+العمل|الدائرة|جهة\s+العمل|الوزارة|المديرية|دائرة\s+الانتساب)\s*[:=؛\-–]\s*(.+)$/i
      );
      if (wpMatch) {
        workplace = cleanValue(wpMatch[1]);
        continue;
      }
    }

    // 11. رمز الموظف
    if (!employeeCode) {
      const codeMatch = line.match(
        /(?:رمز\s+الموظف|الرقم\s+الوظيفي|الرقم\s+الاحصائي|كود\s+الموظف)\s*[:=؛\-–]?\s*([A-Za-z0-9/\-_]+)/i
      );
      if (codeMatch) {
        employeeCode = cleanValue(codeMatch[1]);
        continue;
      }
    }

    // 12. اسم الأم
    if (!motherName) {
      const motherMatch = line.match(
        /^(?:اسم\s+(?:ال)?[أا]م|(?:ال)?[أا]م|الوالدة|والدته)\s*[:=؛\-–]\s*(.+)$/i
      );
      if (motherMatch) {
        motherName = cleanValue(motherMatch[1]);
        continue;
      }
    }

    // ملاحظات عامة — وقطعةٌ لا تحمل إلا رقمًا يُستخرج بعد قليل لا تُكرَّر فيها.
    if (
      line.length > 5 &&
      !line.startsWith('السلام') &&
      !line.startsWith('مرحبا') &&
      !/^[^\d]{0,14}\d{10,14}\s*$/.test(line)
    ) {
      extraNotes.push(line);
    }
  }

  // فحص شامل بالنص الحر إذا لم يُكتشف الرقم الوطني أو الهاتف بعد
  if (!nationalId) {
    const freeNid = normalized.match(/\b(19\d{10}|20\d{10})\b/);
    if (freeNid) nationalId = freeNid[1];
  }

  if (!phone) {
    const freePhone = normalized.match(/\b(07[3-9]\d{8})\b/);
    if (freePhone) phone = freePhone[1];
  }

  // ولا يُخمَّن محلّ الولادة من محافظةٍ ذُكرت في الرسالة: «العنوان: بغداد» كان
  // يصير «محل الولادة: بغداد». ما لم يُكتب بعنوانه يبقى فارغًا (المبدأ ٥).

  // إذا لم نجد سطراً بعنوان "الاسم"، نأخذ أول سطر عربي من 3 أو 4 كلمات لا يحوي أرقاماً ولا تحايا
  if (!fullName && lines.length > 0) {
    for (const l of lines) {
      if (
        !l.includes('السلام') &&
        !l.includes('مرحبا') &&
        !l.includes('معاملة') &&
        !l.includes('أخي') &&
        !l.includes('اريد') &&
        !/\d/.test(l)
      ) {
        const words = l.split(/\s+/).filter(Boolean);
        if (words.length >= 2 && words.length <= 6) {
          fullName = cleanValue(l);
          break;
        }
      }
    }
  }

  const detectedFieldsCount = [
    fullName,
    nationalId,
    phone,
    birthDate,
    birthPlace,
    housingCardNo,
    address,
    landmark,
    jobTitle,
    workplace,
    employeeCode,
    motherName
  ].filter(Boolean).length;

  return {
    fullName,
    nationalId,
    phone,
    birthDate,
    birthPlace,
    housingCardNo,
    address,
    landmark,
    jobTitle,
    workplace,
    employeeCode,
    motherName,
    notes: extraNotes.length > 0 ? extraNotes.join(' | ') : null,
    detectedFieldsCount
  };
}

type FillableField = { key: string; label: string; source: string | null; role: string | null };

/**
 * يوزّع ما استُخرج من الرسالة على حقول الأوراق المختارة في الشبّاك.
 *
 * الحقل يُعرف بمصدره في ملف المواطن (`source`) أو بدوره (`role`)، واسمُ الأم
 * بعنوانه. ولا يُكتب فوق ما كتبه الموظف بيده — يُعاد ما يملأ الفارغ وحده.
 */
export function valuesFromMessage(
  fields: FillableField[],
  extracted: ExtractedCitizen,
  current: Record<string, string> = {}
): Record<string, string> {
  const out: Record<string, string> = {};
  const bySource = extracted as unknown as Record<string, string | null>;
  for (const f of fields) {
    if (current[f.key]?.trim()) continue;
    let value: string | null = null;
    if (f.role === 'name') value = extracted.fullName;
    else if (f.role === 'nationalId') value = extracted.nationalId;
    else if (f.source && typeof bySource[f.source] === 'string') value = bySource[f.source] ?? null;
    else if (/(^|\s|_)(اسم_?)?(ال)?[أا]م($|\s|_)|الوالدة/.test(`${f.label} ${f.key}`)) value = extracted.motherName;
    if (value?.trim()) out[f.key] = value.trim();
  }
  return out;
}
