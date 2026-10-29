/**
 * تنقية عرض نص المستمسك فقط (S33). لا تُحفظ النتيجة مكان OCR الأصلي.
 * لا تُحذف كلمة إلا في جانب عنوان عربي معروف قبل النقطتين، ومع ترجمتها المعروفة.
 * تشوّه غير معروف أو ترتيب مقلوب يبقى للمراجعة؛ لا تخمين لقيم الأشخاص أو تواريخهم.
 */
const BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** مقارنة عناوين فقط؛ لا تغيير في نص القيمة ولا في طيّ البحث. */
function labelKey(s: string): string {
  return s.replace(BIDI, '').replace(/[\u064b-\u065f\u0670ـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/[یىێ]/g, 'ي').replace(/ک/g, 'ك')
    .replace(/ڕ/g, 'ر').replace(/ۆ/g, 'و').replace(/ە/g, 'ه').replace(/\s+/g, ' ').trim();
}

const PAIRS: [string[], string[]][] = [
  [['الاسم', 'الاسم الثلاثي', 'الاسم الكامل'], ['ناو', 'ناوي سياني']],
  [['الأب', 'اسم الأب'], ['باوک']],
  [['الجد'], ['باپیر', 'بايير', 'بابير', 'بيهر']],
  [['اللقب'], ['نازناو']],
  [['الأم', 'اسم الأم'], ['دایک', 'ديك', 'ناوي دايك']],
  [['الجنس'], ['ڕەگەز', 'رهگهز', 'رگەز']],
  [['فصيلة الدم'], ['گروپی خوێن', 'كروبي خوين', 'كروى خون']],
  [['محل الولادة', 'محل الميلاد'], ['شوێنی لەدایک بوون', 'شوينى لعدايك بوون']],
  [['تاريخ الولادة', 'تاريخ الميلاد'], ['ڕۆژی لەدایک بوون', 'روزى له دايك بوون']],
  [['تاريخ الإصدار'], ['ڕۆژی دەرچوون', 'روزى ده رچوون']],
  [['تاريخ النفاذ', 'تاريخ الانتهاء'], ['ڕۆژی بەسەرچوون', 'روزى به سه رچوون', 'روزى بمسبرجوون']],
  [['جهة الإصدار'], ['لایەنی دەرچوون', 'لايه نى ده رچوون']],
  [['الرقم العائلي'], ['ژمارەی خێزانی', 'زمارهى خيزانى']],
  [['رقم الجواز'], ['ژمارەی پاسپۆرت', 'زمارهى باسپورت']],
  [['الجنسية'], ['ڕەگەزنامە']]
];
const labels = new Map<string, Set<string>>();
for (const [arabic, kurdish] of PAIRS) {
  for (const name of arabic) labels.set(labelKey(name), new Set(kurdish.map(labelKey)));
}
const isPair = (arabic: string, kurdish: string) => labels.get(labelKey(arabic))?.has(labelKey(kurdish)) ?? false;

function cleanLine(line: string): string {
  const colon = line.search(/[:：]/);
  if (colon < 0 || colon > 180) return line;
  const heading = line.slice(0, colon);
  let arabic: string | null = null;
  const slash = heading.search(/[/|]/);
  if (slash >= 0) {
    const before = heading.slice(0, slash), after = heading.slice(slash + 1);
    if (isPair(before, after)) arabic = before;
  } else {
    // بعض القراءات تفقد الشرطة: «الجد بيهر : حسن»؛ يُقبل تطابق العنوانين كاملًا فقط.
    for (const gap of heading.matchAll(/[ \t]+/g)) {
      const before = heading.slice(0, gap.index), after = heading.slice(gap.index + gap[0].length);
      if (isPair(before, after)) { arabic = before; break; }
    }
  }
  if (arabic === null) return line;
  const spacing = heading.match(/[ \t]*$/)?.[0] ?? '';
  return arabic.trimEnd() + spacing + line.slice(colon);
}

export function cleanIdOcrText(text: string): string {
  return text.replace(/[^\r\n]+/g, cleanLine);
}
