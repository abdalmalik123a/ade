/**
 * ما لا يُنقل من ملف Word — وإحصاؤه في مجلّد المكتب كلّه (الموجة ٢، «كلفة الانتقال»).
 *
 * قارئ Word (`main/services/docxDoc.ts`) يعيد رسم الورقة بما تعرفه الوثيقة: النصّ بعريضه ومائله وتسطيره
 * وحجمه، والمحاذاة، والجداول، والصور في المتن، والهوامش. وما سواه كان يسقط صامتًا: مربّع نصٍّ يختفي نصّه، وصورةٌ
 * في خليّة جدول، ولونٌ، وشطب، وخطّ Word نفسه. فيُقال الآن لكلّ ملفّ ما لم يُنقل منه وكم مرّة — ويُجمع في مجلّدٍ
 * كامل إحصاءً بلا أسماءٍ ولا نصوص، فيُعرف ما يُضاف إلى المحرّر أوّلًا من عمل المكاتب لا من التخمين.
 *
 * والكشف في `main/services/wordScan.ts`؛ وهنا الأسماء بلغة المكتب والجمع.
 */
import { toIndic } from './arabic';

export type WordLossKey =
  | 'textbox'
  | 'shape'
  | 'cellImage'
  | 'nestedTable'
  | 'header'
  | 'footer'
  | 'watermark'
  | 'footnote'
  | 'color'
  | 'highlight'
  | 'strike'
  | 'vertAlign'
  | 'font'
  | 'tabLeader'
  | 'cellShading'
  | 'paraShading'
  | 'columns'
  | 'sections'
  | 'pageSize'
  | 'pageBorder'
  | 'symbol'
  | 'equation'
  | 'chart'
  | 'smartArt'
  | 'embedded'
  | 'comments'
  | 'trackChanges';

/** لكلّ ما لا يُنقل: اسمه، وما صار إليه (أو ما يفعله الموظف). بترتيب الخطر: ما يختفي نصُّه أوّلًا. */
export const WORD_LOSSES: { key: WordLossKey; label: string; hint: string }[] = [
  { key: 'textbox', label: 'مربّعات نصّ', hint: 'نصّها لم يُنقل — انسخه إلى الورقة بيدك' },
  { key: 'header', label: 'رأس الصفحة في Word (Header)', hint: 'لم يُنقل — اكتبه أسطرًا في أعلى الورقة أو اختر ترويسة' },
  { key: 'footer', label: 'تذييل الصفحة في Word (Footer)', hint: 'لم يُنقل' },
  { key: 'footnote', label: 'حواشٍ سفلية', hint: 'لم تُنقل' },
  { key: 'cellImage', label: 'صورٌ داخل الجداول', hint: 'لم تُنقل — أدرجها في خليّتها' },
  { key: 'shape', label: 'أشكالٌ وخطوطٌ مرسومة', hint: 'لم تُنقل' },
  { key: 'chart', label: 'رسومٌ بيانية', hint: 'لم تُنقل' },
  { key: 'smartArt', label: 'رسوم SmartArt', hint: 'لم تُنقل' },
  { key: 'equation', label: 'معادلات', hint: 'لم تُنقل' },
  { key: 'embedded', label: 'كائناتٌ مضمّنة (جدول Excel أو غيره)', hint: 'نُقلت صورتها الثابتة إن كانت لها صورة — لا تُحرَّر' },
  { key: 'symbol', label: 'رموزٌ من خطوطٍ خاصّة (Wingdings)', hint: 'لم تُنقل' },
  { key: 'nestedTable', label: 'جدولٌ داخل جدول', hint: 'صار أسطرًا في خليّته' },
  { key: 'watermark', label: 'علامة مائية', hint: 'لم تُنقل — أضفها من شريط الورقة' },
  { key: 'columns', label: 'أعمدة نصٍّ كالجرائد', hint: 'صارت عمودًا واحدًا' },
  { key: 'sections', label: 'أقسامٌ بإعداداتٍ مختلفة', hint: 'أُخذ مقاس آخرها واتجاهه وهوامشه' },
  { key: 'pageSize', label: 'مقاس ورقٍ غير A4 وA5 والفولسكاب', hint: 'صار A4' },
  { key: 'pageBorder', label: 'إطار الصفحة أو لون خلفيتها', hint: 'لم يُنقل' },
  { key: 'color', label: 'لون الخطّ', hint: 'كُتب بالأسود' },
  { key: 'highlight', label: 'تظليل النصّ', hint: 'لم يُنقل' },
  { key: 'strike', label: 'الشطب', hint: 'لم يُنقل' },
  { key: 'vertAlign', label: 'أعلى السطر وأسفله', hint: 'كُتب على السطر' },
  { key: 'cellShading', label: 'تظليل خلايا الجدول', hint: 'لم يُنقل' },
  { key: 'paraShading', label: 'تظليل الفقرات أو إطارٌ حولها', hint: 'لم يُنقل' },
  { key: 'tabLeader', label: 'نقاط الجدولة (……)', hint: 'صارت فراغًا' },
  { key: 'font', label: 'خطوط Word', hint: 'كُتب بخطّ البرنامج' },
  { key: 'comments', label: 'تعليقات المراجعة', hint: 'لم تُنقل' },
  { key: 'trackChanges', label: 'تعقّب التغييرات', hint: 'أُخذ النصّ بعد قبولها' }
];

/** ما قُرئ من ملفٍّ واحد: ما لا يُنقل وكم مرّة، وما يُعرف به عمل المكاتب. */
export type WordScan = {
  losses: Partial<Record<WordLossKey, number>>;
  /** أسماء الخطوط في الملف (بخطّ المتن الافتراضي). */
  fonts: string[];
  tables: number;
  images: number;
  /** فقراتٌ مرقّمة أو منقّطة. */
  lists: number;
  /** مقاس الورقة باسمه — أو «أخرى». */
  page: string | null;
  landscape: boolean;
};

/** ما لا يُنقل من الملف بترتيب الخطر — لما يُعرض بجانب الورقة. */
export function lossesOf(scan: WordScan): { key: WordLossKey; label: string; hint: string; count: number }[] {
  return WORD_LOSSES.filter((l) => (scan.losses[l.key] ?? 0) > 0).map((l) => ({ ...l, count: scan.losses[l.key]! }));
}

/** إحصاء مجلّدٍ كامل: لكلّ ما لا يُنقل كم ملفًّا فيه وكم مرّة — بلا أسماء ملفّاتٍ ولا نصوص. */
export type WordCensus = {
  files: number;
  failed: number;
  losses: { key: WordLossKey; files: number; count: number }[];
  fonts: { name: string; files: number }[];
  /** ملفّاتٌ فيها جداول، وصور، وقوائم مرقّمة، وورقٌ أفقي. */
  withTables: number;
  withImages: number;
  withLists: number;
  landscape: number;
  pages: { name: string; files: number }[];
};

export function censusOf(scans: WordScan[], failed = 0): WordCensus {
  const count = <K extends string>(keys: K[]) => {
    const m = new Map<K, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  };
  const losses = WORD_LOSSES.map((l) => ({
    key: l.key,
    files: scans.filter((s) => (s.losses[l.key] ?? 0) > 0).length,
    count: scans.reduce((n, s) => n + (s.losses[l.key] ?? 0), 0)
  }))
    .filter((l) => l.files > 0)
    .sort((a, b) => b.files - a.files || b.count - a.count);
  return {
    files: scans.length,
    failed,
    losses,
    fonts: count(scans.flatMap((s) => s.fonts)).map(([name, files]) => ({ name, files })),
    withTables: scans.filter((s) => s.tables > 0).length,
    withImages: scans.filter((s) => s.images > 0).length,
    withLists: scans.filter((s) => s.lists > 0).length,
    landscape: scans.filter((s) => s.landscape).length,
    pages: count(scans.map((s) => s.page ?? 'غير محدّد')).map(([name, files]) => ({ name, files }))
  };
}

/**
 * الإحصاء نصًّا يُقرأ ويُرسل — أعدادٌ وأسماء خطوطٍ وحدها: لا اسم ملفٍّ ولا كلمةٌ من متنه، فبيانات الناس لا تخرج.
 */
export function censusText(c: WordCensus, when: Date = new Date()): string {
  const label = new Map(WORD_LOSSES.map((l) => [l.key, l.label]));
  const pct = (n: number) => (c.files ? `${toIndic(Math.round((n / c.files) * 100))}٪` : '—');
  const lines = [
    'إحصاء ملفات Word — ديوان',
    `التاريخ: ${when.toISOString().slice(0, 10)}`,
    `الملفات: ${toIndic(c.files)}${c.failed ? ` (وتعذّرت قراءة ${toIndic(c.failed)})` : ''}`,
    '',
    'ما لا يُنقل إلى الورقة — بعدد الملفات التي فيها (وكم مرّة):'
  ];
  if (!c.losses.length) lines.push('  لا شيء.');
  for (const l of c.losses) lines.push(`  ${label.get(l.key)}: ${toIndic(l.files)} ملفّ (${pct(l.files)}) — ${toIndic(l.count)} مرّة`);
  lines.push('', 'ما في الملفات:');
  lines.push(`  جداول: ${toIndic(c.withTables)} ملفّ (${pct(c.withTables)})`);
  lines.push(`  صور: ${toIndic(c.withImages)} ملفّ (${pct(c.withImages)})`);
  lines.push(`  قوائم مرقّمة أو منقّطة: ${toIndic(c.withLists)} ملفّ (${pct(c.withLists)})`);
  lines.push(`  ورق أفقي: ${toIndic(c.landscape)} ملفّ`);
  lines.push('', 'مقاس الورق:');
  for (const p of c.pages) lines.push(`  ${p.name}: ${toIndic(p.files)}`);
  lines.push('', 'الخطوط (بعدد الملفات):');
  for (const f of c.fonts.slice(0, 30)) lines.push(`  ${f.name}: ${toIndic(f.files)}`);
  lines.push('', 'لا أسماء ملفاتٍ في هذا الإحصاء ولا شيء من نصوصها.');
  return lines.join('\n');
}
