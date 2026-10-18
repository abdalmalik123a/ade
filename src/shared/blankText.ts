/**
 * تنظيف السطر من آثار الكتابة اليدوية في Word، واستنتاج اسم الخانة مما قبلها
 * وربطه بسجلّ المواطنين — نُقل من `blanks.ts` (D84).
 */
import { type Suggestion, APPLY_THRESHOLD, type DocField } from './doc';

// ── التنظيف ──────────────────────────────────────────────────────────

const TATWEEL = /ـ+/g;

/**
 * التمديد زخرفةُ Word: `انـــــــــذار` كلمتها «انذار».
 *
 * ومن بحث عن «إنذار» لا يجدها ما بقيت ممدودة — وورقتنا تعيد الصفّ فيظهر
 * المدّ مهلهلًا.
 */
export function stripTatweel(text: string): string {
  return text.replace(TATWEEL, '');
}

/** هل انتهى النصّ بحرف عربي؟ — شرط قاعدة الصفر. */
const ARABIC_LETTER = /[ء-ي]/;

/**
 * «0» بدل النقطة: لوحة المفاتيح العربية تضع الصفر حيث تُراد نقطة.
 *
 * مؤكَّدٌ في ملفين مستقلّين: `وانذاره0` و`الدوام 0`. والشرط ألّا يجاور رقمًا —
 * وإلا أفسدنا عددًا حقيقيًا.
 */
export function fixZeroPeriods(text: string): Suggestion<string>[] {
  const out: Suggestion<string>[] = [];
  const re = /0/g;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    const before = text.slice(0, at);
    const after = text.slice(at + 1);
    if (/[\d٠-٩]$/.test(before) || /^[\d٠-٩]/.test(after)) continue;

    const prev = before.replace(/\s+$/, '');
    if (!ARABIC_LETTER.test(prev.slice(-1))) continue;

    const attached = !/\s$/.test(before);
    out.push({
      value: `${before}.${after}`,
      confidence: attached ? 0.9 : /^\s*$/.test(after) ? 0.85 : 0.6,
      reason: attached ? 'صفرٌ ملتصق بآخر كلمة عربية' : 'صفرٌ منفرد بعد كلمة عربية'
    });
  }
  return out;
}

/**
 * ينظّف سطرًا: التمديد، والصفر الواثق، والمسافات المكرّرة.
 *
 * والمسافات الطويلة داخل السطر ليست زخرفًا — بها يفصل الموظف عمودًا عن عمود،
 * فتُترك للترويسة وتُضغط في المتن.
 */
export function cleanLine(text: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  let out = text;

  const stripped = stripTatweel(out);
  if (stripped !== out) {
    notes.push('حُذف التمديد');
    out = stripped;
  }

  for (;;) {
    const fix = fixZeroPeriods(out).find((s) => s.confidence >= APPLY_THRESHOLD);
    if (!fix) break;
    out = fix.value;
    notes.push(`«0» ← «.» (${fix.reason})`);
  }

  const squeezed = out.replace(/[ \t]{2,}/g, ' ').trim();
  if (squeezed !== out.trim()) notes.push('ضُغطت المسافات المكرّرة');
  return { text: squeezed, notes };
}

// ── اسم الحقل يُستنتج مما قبله ───────────────────────────────────────

// بلا «ال»: تُقارن بالكلمة بعد نزع أداتها (`bare`) — وكانت «المدعو» و«السيد» بأداتهما فلا تُطابَقان أبدًا.
const PERSON_NOUNS = ['تلميذ', 'طالب', 'موظف', 'مواطن', 'مدرس', 'معلم', 'مدعو', 'سيد', 'استاذ', 'أستاذ', 'منتسب'];

const DROP_WORDS = ['في', 'من', 'على', 'الى', 'إلى', 'عن', 'لدى', 'مع', 'الرقم', 'رقم'];

/** كلماتٌ لا تُسمّي شيئًا: «علمًا أن ......» فراغٌ بلا اسم، لا خانةٌ اسمها «ان». */
const STOP_WORDS = new Set(['ان', 'أن', 'إن', 'بان', 'بأن', 'علما', 'علمًا', 'علماً', 'انه', 'أنه', 'التي', 'الذي', 'كما', 'حيث', 'قد', 'او', 'أو', 'ثم']);

/** ما يُعدّ ويُرقّم ويؤرَّخ في الكتب: «كتابكم ذو العدد ( )» عدد كتابكم. */
const NUMBERED = /^(?:و|ب|ل|ف)?((?:ال)?(?:كتاب|امر|أمر|قرار|وثيقة)[ء-ي]*)$/;

const bare = (w: string) => w.replace(/^(?:لل|بال|كال|وال|فال|ال|ل|ب|ك|و|ف)/, '');

/**
 * اسم شخصٍ بمؤنّثه («الطالبة»، «للسيدة») — لا كلّ ما بدأ به: «مدير المدرسة ......» اسم المدرسة لا اسم مدرّس، وكانت
 * «المدرسة» تُعدّ «مدرّسًا» فتُربط بسجلّ الزبائن ويملؤها F2 باسم شخص.
 */
const PERSON = new RegExp(`^(?:(?:${PERSON_NOUNS.filter((n) => n !== 'مدرس').join('|')})(?:ة|ه)?|مدرس)$`);

const person = (w: string) => PERSON.test(bare(w));

/** الكلمة بأداة التعريف وحدها: «والاطلاع» ← «الاطلاع»، «للعام» ← «العام» — و«بغداد» تبقى. */
const definite = (w: string) => w.replace(/^(?:و|ف|ب|ك)?(?:ال|لل)(?=[ء-ي]{2})/, 'ال');

const words = (s: string) =>
  s
    .replace(/[:؛،.…()_\-/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** صاحب العدد أو الرقم: أقرب «كتاب» أو «أمر» أو «وثيقة» قبله — «كتاب» وحدها «الكتاب». */
function numberedOwner(ws: string[], before: number): string | null {
  for (let i = before; i >= Math.max(0, before - 8); i--) {
    const m = NUMBERED.exec(ws[i] ?? '');
    if (m) return /^(?:كتاب|امر|أمر|قرار|وثيقة)$/.test(m[1]!) ? `ال${m[1]}` : m[1]!;
  }
  return null;
}

/** حدود الكلام قبل الفراغ: فراغٌ قبله، وكسر السطر. */
const EDGES = /[.…_]{3,}|\([ \t ]*(?:\/[ \t ]*)?\)|\/[ \t]+\/|\n/;

/** «مواليد / /» و«المولود في / /»: تاريخ الميلاد. */
const BIRTH = /^(?:و?(?:ال)?مواليد(?:ه|ها)?|(?:ال)?تولد|(?:ال)?ميلاد|ولادت(?:ه|ها)|(?:ال)?مولود(?:ة)?)$/;

const DATED = /^(?:في|بتاريخ|وبتاريخ|(?:و?ال)?مؤرخ(?:ة)?)$/;

export function keyFromLabel(label: string): string {
  return stripTatweel(label).trim().replace(/\s+/g, '_').replace(/[{}]/g, '') || 'حقل';
}

/**
 * آخر كلامٍ قبل الفراغ: الفراغات قبله وكسر السطر حدودٌ — «المحافظة ...... قضاء ......» اسم الثاني «قضاء»
 * لا «المحافظة قضاء».
 */
export function nearText(before: string): string {
  return before.split(EDGES).filter((l) => /[ء-ي]/.test(l)).pop() ?? '';
}

/** كلامٌ في آخر السطر بعد فراغه الأخير — يكمله السطر بعده، وسطرٌ انتهى بفراغٍ لا يُكمَل. */
export function trailingText(text: string): string {
  const tail = text.split(EDGES).pop() ?? '';
  return /[ء-ي]/.test(tail) ? tail : '';
}

/**
 * اسم فراغ التاريخ من الكلام قبله — وكان «التاريخ» لكلّ فراغ، فيلتقي تاريخ الكتاب وتاريخ الميلاد وتاريخ
 * كتابهم في خانةٍ واحدة يملؤها رقمٌ واحد. و`prevLabel` اسم الفراغ قبله في سطره: «كتابكم ذو العدد ( ) في / /»
 * تاريخُ ما عُدّ قبله.
 */
export function suggestDateName(before: string, prevLabel = ''): Suggestion<string> {
  const ws = words(stripTatweel(nearText(before))).filter((w) => (w.match(/[ء-ي]/g) ?? []).length >= 2);
  const last = ws[ws.length - 1] ?? '';
  const prev = ws[ws.length - 2] ?? '';
  if (BIRTH.test(last) || (DATED.test(last) && BIRTH.test(prev))) {
    return { value: 'تاريخ الميلاد', confidence: 0.9, reason: 'تاريخٌ بعد «مواليد»' };
  }
  if (bare(prev) === 'تاريخ' && last) return { value: `تاريخ ${definite(last)}`, confidence: 0.85, reason: '«تاريخ» وما أُضيف إليه' };
  const owner = /^(?:رقم|عدد) (.+)$/.exec(prevLabel);
  if (owner && (DATED.test(last) || !last)) return { value: `تاريخ ${owner[1]}`, confidence: 0.8, reason: `تاريخُ ما رُقّم قبله («${prevLabel}»)` };
  return { value: 'التاريخ', confidence: 0.95, reason: 'صيغة «/ / 20»' };
}

/**
 * اسم الحقل من الكلام الذي قبله: «للتلميذ ( )» ← اسم التلميذ.
 *
 * والقواعد مرتّبة بثقتها، وأوثقها النقطتان: «الاسم: ......» لا تحتمل غير
 * «الاسم». وما دونها اجتهادٌ يراجعه الموظف.
 */
export function suggestFieldName(before: string): Suggestion<string> {
  let text = stripTatweel(nearText(before)).replace(/\s+/g, ' ').trimEnd();
  // ملاحظةٌ بين قوسين بعد العنوان ليست منه: «اسم المركز الصحي المحال اليه ( يجب ان يكون ضمن الرقعة ) ......».
  for (let m = /\s*\([^()]*[ء-ي][^()]*\)$/.exec(text); m && /[ء-ي]/.test(text.slice(0, m.index)); m = /\s*\([^()]*[ء-ي][^()]*\)$/.exec(text)) {
    text = text.slice(0, m.index).trimEnd();
  }

  // ١) «الاسم: .......» — العنوان معلنٌ بنقطتيه.
  const colon = text.match(/([^\s:؛،][^:؛،]{0,30}?)\s*[:：]\s*$/);
  if (colon) {
    let value = colon[1]!.trim();
    // الثلاثون حرفًا قد تبدأ في وسط كلمة: «…رقم البطاقة التموينية الإلكترونية:» لا «م البطاقة…».
    const at = text.length - colon[0].length;
    if (at > 0 && /[ء-ي]/.test(text[at - 1]!)) value = value.replace(/^\S+\s*/, '');
    // وجملةٌ قبل النقطتين («نود إعلامكم بأن المواطن:») ليست عنوانًا: يُسمّى الفراغ من آخرها.
    if (value && words(value).length <= 3) return { value, confidence: 0.95, reason: 'عنوانٌ منتهٍ بنقطتين' };
    if (value) return suggestFieldName(value);
  }

  // كلمةٌ بأقلّ من حرفين («/ة»، «20»، «ل») ليست اسمًا: يُسمّى الفراغ بما قبلها.
  const ws = words(text).filter((w) => (w.match(/[ء-ي]/g) ?? []).length >= 2);
  const last = ws[ws.length - 1] ?? '';
  const prev = ws[ws.length - 2] ?? '';

  // ٢) «الوثيقة المرقمة ( )» ← رقم الوثيقة.
  if (/^و?المرقم(?:ة)?$/.test(last)) {
    // وتبقى الكلمة بأداتها: «رقم الوثيقة» عنوانٌ مفهوم، و«رقم وثيقة» مبتور. وصفةٌ بينهما تُتجاوز:
    // «كتابكم السري المرقم» رقم كتابكم لا «رقم السري».
    const noun = /^ال[ء-ي]{2,}(?:ي|ية)$/.test(prev) && ws.length >= 3 ? ws[ws.length - 3]! : prev;
    if (noun) return { value: `رقم ${definite(noun)}`, confidence: 0.9, reason: '«المرقم» تسبقها الوثيقة' };
    return { value: 'الرقم', confidence: 0.6, reason: '«المرقمة» بلا ما رُقّم قبلها' };
  }

  // ٣) «للتلميذ ( )» ← اسم التلميذ.
  const noun = bare(last);
  // وشخصان في كتابٍ واحد باسمين: «المدير السابق الاستاذ ( ) والمدير الحالي الاستاذ ( )»، و«المسلم الاستاذ / ( )» —
  // وكانا «اسم الاستاذ» خانةً واحدة يملؤها اسمٌ واحد.
  if (person(last) && /^(?:و?ال)?(?:مسلم|مستلم)(?:ة)?$/.test(prev)) {
    return { value: `اسم ${definite(prev.replace(/^و/, ''))}`, confidence: 0.8, reason: 'اسمُ شخص' };
  }
  if (person(last) && /^(?:و?ال)?(?:سابق|حالي|جديد|قديم|بديل)(?:ة)?$/.test(prev)) {
    const role = ws[ws.length - 3];
    const of = role && /^(?:و|ب|ل|ف)?ال[ء-ي]{2,}$/.test(role) && !person(role) ? definite(role.replace(/^و(?=ال)/, '')) : `ال${noun}`;
    return { value: `اسم ${of} ${definite(prev.replace(/^و/, ''))}`, confidence: 0.8, reason: 'اسمُ شخص' };
  }
  if (person(last)) {
    return { value: `اسم ${noun.startsWith('ال') ? noun : `ال${noun}`}`, confidence: 0.85, reason: 'اسمُ شخص' };
  }

  // «اسم الطالب الثلاثي ......» و«اسم المركز الصحي المحال اليه ......»: العنوان من «اسم» بثلاث كلماتٍ أقصاها
  // — وكان آخر كلمةٍ وحدها: «الثلاثي».
  const tail = ws.slice(-5);
  let named = -1;
  tail.forEach((w, i) => {
    if (/^و?(?:ال)?اسم$/.test(w)) named = i;
  });
  if (named >= 0 && named < tail.length - 1) {
    // «اسم وتوقيع مدير المدرسة» يُؤخذ كلّه؛ وما زاد على أربعٍ وصفٌ بعد العنوان («المحال اليه»).
    const from = tail.slice(named);
    const picked = (from.length > 4 ? from.slice(0, 3) : from).map((w, i) => (i ? definite(w) : w.replace(/^و/, '')));
    const ofPerson = picked.slice(1).some(person);
    return { value: picked.join(' '), confidence: 0.75, reason: ofPerson ? 'اسمُ شخص' : 'عنوانٌ يبدأ بـ«اسم»' };
  }

  // «بعنوان ......» في الكتب الرسمية العنوانُ الوظيفي لا عنوان السكن.
  if (/^و?بعنوان$/.test(last)) {
    return { value: 'العنوان الوظيفي', confidence: 0.8, reason: '«بعنوان» في الكتب الرسمية العنوانُ الوظيفي' };
  }

  // «وتاريخ المراجعة ......»: التاريخ وما أُضيف إليه.
  if (bare(prev) === 'تاريخ' && !DROP_WORDS.includes(last)) {
    return { value: `تاريخ ${definite(last)}`, confidence: 0.75, reason: '«تاريخ» وما أُضيف إليه' };
  }

  // «كتابكم ذو العدد ( )» عددُ كتابكم — لا «العدد» الذي في رأس الكتاب. وصاحب العدد أقرب «كتاب» قبله:
  // «كتاب المديرية … قسم الملاك ذي العدد ( )» عدد الكتاب لا «عدد الملاك».
  if (bare(last) === 'عدد' && /^(?:ذو|ذي|ذات)$/.test(prev)) {
    const owner = numberedOwner(ws, ws.length - 3);
    if (owner) return { value: `عدد ${owner}`, confidence: 0.8, reason: '«ذو العدد» وما قبلها صاحبه' };
    return { value: 'العدد', confidence: 0.6, reason: '«ذو العدد» بلا كتابٍ قبلها' };
  }
  // «والبالغ عددها ( )» و«بتاريخ ......»: العدد والتاريخ لا ضميرهما.
  if (/^عدد(?:ه|ها|هم)$/.test(bare(last))) return { value: 'العدد', confidence: 0.6, reason: '«عددها» عددٌ يُكتب' };
  if (bare(last) === 'تاريخ') return { value: 'التاريخ', confidence: 0.6, reason: '«بتاريخ» تاريخٌ يُكتب' };

  // «الوثيقة الصادرة من ( )»: الجهة التي أصدرتها. ولا «جهة» في اسم الخانة: معجم ملف الزبون يقرؤها مكان عمله
  // (`citizenSourceOf`) — فاسمها «مصدر الوثيقة»، كما تُسمّى خانات الحزم (CATALOG، القاعدة ٧).
  if (/^(?:من|عن)$/.test(last) && /^(?:و?ال)?صادر(?:ة)?$/.test(prev)) {
    return { value: 'مصدر الوثيقة', confidence: 0.7, reason: '«الصادرة من» جهةٌ أصدرتها' };
  }

  // «الى ( )» وحدها، و«بوثيقةٍ معنونة الى ( )»: جهةٌ يُكتب إليها — «المرسل إليه» لا «الجهة» للسبب نفسه.
  if (/^(?:الى|إلى|الي)$/.test(last) && (!prev || /^(?:ال)?(?:معنون|مرسل|موجه|مقدم)(?:ة|ه)?$/.test(prev))) {
    return { value: 'المرسل إليه', confidence: 0.45, reason: '«الى» تليها جهة' };
  }
  // «المديرية العامة لتربية ......»: المحافظة — في كتب المدارس كلّها.
  if (/^(?:ل|لل)تربية$/.test(last)) return { value: 'المحافظة', confidence: 0.6, reason: '«لتربية» تليها المحافظة' };
  // «وذلك لـ ......» و«بسبب ......»: السبب.
  if (/^و?ذلك$/.test(last) || /^(?:ب|ل)?سبب$/.test(last)) return { value: 'السبب', confidence: 0.5, reason: '«وذلك لـ» يليها سبب' };

  // ٤) «في الصف ......» ← الصف: تُسقط أداة الجرّ ويبقى المضاف إليه.
  if (DROP_WORDS.includes(last) && prev && !STOP_WORDS.has(prev)) {
    return { value: definite(prev), confidence: 0.6, reason: 'كلمةٌ قبل أداة الجرّ' };
  }
  // وأداةٌ وحدها، أو كلمةٌ لا تُسمّي («علمًا أن ......»)، لا اسم لفراغها: يُسمّى بما قبلها إن سمّى.
  if (DROP_WORDS.includes(last) || STOP_WORDS.has(last)) {
    if (prev && !STOP_WORDS.has(prev) && !DROP_WORDS.includes(prev)) return { value: definite(prev), confidence: 0.45, reason: 'كلمةٌ قبل ما لا يُسمّي' };
    return { value: 'حقل', confidence: 0.2, reason: 'لا كلام قبله يُسمّيه' };
  }

  // «المرحلة الدراسية ......»: الصفة وموصوفها عنوانٌ واحد — و«الدراسية» وحدها لا تُفهم.
  if (/^ال[ء-ي]{2,}(?:ي|ية)$/.test(last) && /^(?:و|ف|ب|ك)?(?:ال|لل)[ء-ي]{2,}$/.test(prev)) {
    return { value: `${definite(prev)} ${last}`, confidence: 0.6, reason: 'صفةٌ وموصوفها' };
  }

  // وتُترك الكلمة كما كُتبت: «الصف» عنوانٌ مفهوم، و«صف» مبتورة — وأداة العطف والجرّ قبل «ال» ليست منها،
  // و«تزويدنا باسم ......» الاسم.
  if (last) {
    return { value: bare(last) === 'اسم' ? 'الاسم' : definite(last), confidence: 0.55, reason: 'آخر كلمة قبل الفراغ' };
  }

  return { value: 'حقل', confidence: 0.2, reason: 'لا كلام قبله' };
}

/**
 * يربط الحقل المستنتَج بسجل المواطنين حين يعرفه.
 *
 * المحرّك عرف أنّ «للتلميذ ( )» اسمُ شخص — فلا يُهدر ما عرفه: يُوسم الحقل
 * بدوره ومصدره، فيملؤه F2 ويُقيَّد في الأرشيف باسم صاحبه. وبغيره تبقى الورقة
 * مجهولة الصاحب مهما مُلئت.
 */
export function citizenLink(guess: Suggestion<string>): Partial<DocField> {
  if (guess.reason === 'اسمُ شخص') return { source: 'fullName', role: 'name' };
  if (/^(?:الرقم الوطني|رقم البطاقة|البطاقة الموحدة)/.test(guess.value)) {
    return { source: 'nationalId', role: 'nationalId' };
  }
  return {};
}
