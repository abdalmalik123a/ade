/**
 * استيراد الزبائن من Excel (الموجة ٢، «كلفة الانتقال») — ربط الأعمدة وبناء الصفوف، خالصًا.
 *
 * مكتبٌ عنده قائمة زبائنه في Excel لا يعيد كتابتها واحدًا واحدًا. الملف يُقرأ بقارئ الدفعة نفسه
 * (`sheetRead.ts` ← أعمدةٌ بالجدولة)، وكلّ عمودٍ يُعرف معناه من عنوانه بمعجم ملف المواطن نفسه
 * (`citizenFields.ts`): «اسم الموظف» و«الموبايل» و«التولد». وما لا يُعرف يُترك ويُقال، والموظف يربطه
 * بيده فيُتذكّر للملف القادم. والاسم المفرّق في أعمدة (الاسم، اسم الأب، اسم الجد، اللقب) يُجمع اسمًا
 * واحدًا، والعنوان المفرّق (المحلة، الزقاق، الدار) عنوانًا واحدًا بأسماء أجزائه كما في خانة الملف.
 *
 * وما يُفعل بالصفوف على القاعدة — الجديد يُضاف والموجود يُكمل فارغه — في `main/services/citizenImport.ts`.
 */
import { normalizeFold } from './arabic';
import { citizenSourceOf } from './citizenFields';
import { CITIZEN_FIELDS, type CitizenTextKey } from './citizenSchema';

/** ما يُربط به العمود: خانةٌ من ملف المواطن، أو تصنيفه، أو ملاحظاته. */
export type ImportTarget = CitizenTextKey | 'category' | 'notes';

/**
 * ربط المكتب: معرّف العمود (عنوانه مطويًّا) ← ما يُربط به، و`null` «اتركه». يُحفظ ويُطبَّق على الملف
 * القادم بالعناوين نفسها — فقائمةٌ عنوانها «اسم التلميذ» تُربط مرّةً وإلى الأبد.
 */
export type ImportMap = Record<string, ImportTarget | null>;

export type ImportColumn = {
  /** عنوانه مطويًّا — أو «#رقمه» إن لم يكن للملف سطر عناوين. */
  id: string;
  header: string;
  target: ImportTarget | null;
  /** ربطٌ من المكتب (بيده الآن أو محفوظٌ من قبل) — لا من المعجم. */
  manual: boolean;
  /** أوّل ما فيه — ليُعرف العمود من قيمه. */
  samples: string[];
};

export type ImportTable = { headed: boolean; columns: ImportColumn[]; rows: string[][] };

/** صفٌّ جاهزٌ للاستيراد: قيمه بخاناتها. */
export type ImportRow = Partial<Record<ImportTarget, string>>;

/** أكبر ملفٍّ يُستورد مرّةً — وما زاد يُقسَّم. */
export const IMPORT_MAX_ROWS = 10000;

/** ما يُختار للعمود في نافذة الاستيراد: خانات الملف بأبوابها، ثم التصنيف والملاحظات. */
export const IMPORT_TARGETS: { key: ImportTarget; label: string; group: string }[] = [
  ...CITIZEN_FIELDS.map((f) => ({ key: f.key, label: f.label, group: f.group as string })),
  { key: 'category', label: 'التصنيف', group: 'أخرى' },
  { key: 'notes', label: 'ملاحظات', group: 'أخرى' }
];

const TARGETS = new Set<string>(IMPORT_TARGETS.map((t) => t.key));
export const isImportTarget = (v: unknown): v is ImportTarget => typeof v === 'string' && TARGETS.has(v);

const fold = (s: string) => normalizeFold(s).replace(/[_\s]+/g, ' ').trim();
const digitsOf = (s: string) => normalizeFold(s).replace(/\D/g, '');

/** عمود التسلسل — «ت» و«م» و«التسلسل»: لا يُستورد. */
const SERIAL = /^(ت|م|ن|#|تسلسل|التسلسل|الرقم التسلسلي|seq|no|n)$/;
/** «الرقم» وحده: رمز الموظف في المعجم — إلا إن كانت قيمه ١، ٢، ٣… فهو تسلسل. */
const BARE_NUMBER = /^(الرقم|رقم|id)$/;
const CATEGORY = /^(التصنيف|تصنيف|الفئه|الصنف|المجموعه|category|group)$/;
const NOTES = /ملاحظ|^notes?$|^remarks?$/;
/** «التولد» عراقيًّا: الولادة سنةً أو تاريخًا. */
const BORN = /التولد|^تولد|سنه الولاده/;
/** أسماء الجهات لا أسماء الناس: «اسم المدرسة» مكان العمل لا الاسم. */
const PLACE = /المدرسه|الشركه|المؤسسه|الجامعه|الكليه|المعهد|الروضه|المكتب/;
/** أجزاء العنوان العراقي — تُجمع «محلة ٦١٢ زقاق ١٤ دار ٧». */
const ADDRESS_PART = /^(?:رقم )?(?:ال)?(محله|زقاق|دار|شارع|حي)$/;
const PART_WORD: Record<string, string> = { محله: 'محلة', زقاق: 'زقاق', دار: 'دار', شارع: 'شارع', حي: 'حي' };
/** «رقم الهوية»: الموحّدة (١٢ رقمًا) أو هوية الأحوال القديمة — تُعرف من قيمها. */
const ID_CARD = /هويه|رقم البطاقه|^البطاقه$/;

/** قيمٌ ١، ٢، ٣… متتالية — عمود تسلسل مهما كان عنوانه. */
function sequential(samples: string[]): boolean {
  if (samples.length < 2) return false;
  const n = samples.map((s) => Number(digitsOf(s)));
  return n.every((v, i) => Number.isInteger(v) && String(v) === digitsOf(samples[i]!) && v === n[0]! + i) && n[0]! <= 2;
}

/** ما يُربط به العمود من عنوانه (وقيمه حين يلتبس العنوان) — أو عدمٌ لا يُخمَّن له. */
export function autoTarget(header: string, samples: string[] = []): ImportTarget | null {
  const h = fold(header);
  if (!h || SERIAL.test(h)) return null;
  if (BARE_NUMBER.test(h) && sequential(samples)) return null;
  if (CATEGORY.test(h)) return 'category';
  if (NOTES.test(h)) return 'notes';
  if (BORN.test(h)) return 'birthDate';
  if (ADDRESS_PART.test(h)) return 'address';
  if (ID_CARD.test(h) && !/السكن|التموينيه|الجواز/.test(h)) {
    if (/الاحوال|القديمه/.test(h)) return 'civilIdNo';
    const twelve = samples.filter((s) => digitsOf(s).length === 12 && digitsOf(s) === fold(s).replace(/[\s-]/g, '')).length;
    return twelve * 2 >= samples.length ? 'nationalId' : 'civilIdNo';
  }
  if (PLACE.test(h) && /اسم/.test(h)) return 'workplace';
  const source = citizenSourceOf(header);
  return isImportTarget(source) ? source : null;
}

/**
 * الجدول من نصّ الملف (أعمدةٌ بالجدولة، سطرٌ لكلّ صفّ): السطر الأوّل عناوين إن عُرف منه عمود — أو إن
 * ربط المكتب عنوانًا منه من قبل. وإلا فكلّ الأسطر صفوف، والأعمدة «العمود ١، ٢…» يربطها الموظف.
 */
export function readTable(text: string, saved: ImportMap = {}): ImportTable {
  const grid = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split('\t').map((c) => c.replace(/\s+/g, ' ').trim()));
  if (!grid.length) return { headed: false, columns: [], rows: [] };

  const first = grid[0]!;
  const width = Math.max(...grid.map((r) => r.length));
  const samplesOf = (body: string[][], i: number) => body.map((r) => r[i] ?? '').filter(Boolean).slice(0, 5);
  const auto = first.map((h, i) => autoTarget(h, samplesOf(grid.slice(1), i)));
  const headed = auto.some(Boolean) || first.some((h) => Boolean(fold(h)) && fold(h) in saved);
  const body = headed ? grid.slice(1) : grid;

  const columns = Array.from({ length: width }, (_, i): ImportColumn => {
    const header = headed ? (first[i] ?? '') : '';
    const id = headed && fold(header) ? fold(header) : `#${i + 1}`;
    const remembered = id in saved;
    const target = remembered ? (isImportTarget(saved[id]) ? saved[id]! : null) : headed ? (auto[i] ?? null) : null;
    return { id, header: header || `العمود ${i + 1}`, target, manual: remembered, samples: samplesOf(body, i).slice(0, 3) };
  });
  return { headed, columns, rows: body };
}

/** العمود بربطٍ جديدٍ من الموظف. */
export function withTarget(table: ImportTable, index: number, target: ImportTarget | null): ImportTable {
  return { ...table, columns: table.columns.map((c, i) => (i === index ? { ...c, target, manual: true } : c)) };
}

/** الربط الذي يُحفظ: عناوين الملف كلّها بما رُبطت به (و«اتركه» معها) — والملف بلا عناوين لا يُتذكّر. */
export function mapOf(table: ImportTable): ImportMap {
  if (!table.headed) return {};
  return Object.fromEntries(table.columns.filter((c) => !c.id.startsWith('#')).map((c) => [c.id, c.target]));
}

const fullNameOf = (names: string[], surname: string | undefined) => {
  const name = names.join(' ').replace(/\s+/g, ' ').trim();
  // اللقب في عمودٍ وحده يُلحق بالاسم إن لم يكن آخره — والملف يحفظه منفصلًا أيضًا.
  return surname && !fold(name).endsWith(fold(surname)) ? `${name} ${surname.trim()}` : name;
};

/** «٦١٢» تحت عنوان «المحلة» تصير «محلة ٦١٢»؛ وما فيه كلمةٌ يبقى كما كُتب. */
function addressPart(header: string, value: string): string {
  const m = ADDRESS_PART.exec(fold(header));
  return m && /^[\d/\s-]+$/.test(normalizeFold(value)) ? `${PART_WORD[m[1]!]} ${value}` : value;
}

/** الجنس بصيغة الملف — وما لا يُعرف يبقى كما كُتب. */
function genderOf(value: string): string {
  const v = fold(value);
  if (['ذكر', 'مذكر', 'male', 'm'].includes(v)) return 'ذكر';
  if (['انثي', 'مونث', 'female', 'f'].includes(v)) return 'أنثى';
  return value;
}

/** صفّ الملف بخاناته — والعمودان على خانةٍ واحدة: الاسم والعنوان يُجمعان، والملاحظات تُوصل، وغيرهما أوّلهما. */
export function rowOf(cells: string[], columns: ImportColumn[]): ImportRow {
  const row: ImportRow = {};
  const names: string[] = [];
  const address: string[] = [];
  columns.forEach((col, i) => {
    const v = (cells[i] ?? '').replace(/\s+/g, ' ').trim();
    if (!v || !col.target) return;
    if (col.target === 'fullName') names.push(v);
    else if (col.target === 'address') address.push(addressPart(col.header, v));
    else if (col.target === 'notes') row.notes = row.notes ? `${row.notes} — ${v}` : v;
    else if (!row[col.target]) row[col.target] = col.target === 'gender' ? genderOf(v) : v;
  });
  if (names.length) row.fullName = fullNameOf(names, row.surname);
  if (address.length) row.address = address.join(' ');
  return row;
}

/** صفوف الجدول جاهزةً — والصفّ الذي لم يبقَ فيه شيءٌ بعد الربط يُترك. */
export function importRows(table: ImportTable): ImportRow[] {
  return table.rows.map((cells) => rowOf(cells, table.columns)).filter((r) => Object.keys(r).length > 0);
}

/** ما وصل عبر الجسر صفوفًا كما يجب: خاناتٌ معروفة بقيمٍ نصّية — وما سواها يُترك. */
export function cleanRows(raw: unknown): ImportRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, IMPORT_MAX_ROWS + 1).map((r) => {
    const row: ImportRow = {};
    if (r && typeof r === 'object') {
      for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
        if (isImportTarget(k) && typeof v === 'string' && v.trim()) row[k] = v.trim().slice(0, 500);
      }
    }
    return row;
  });
}

/** الربط المحفوظ كما يجب — وما فسد منه يُترك. */
export function cleanMap(raw: unknown): ImportMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ImportMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === 'string' && k.length <= 120 && (v === null || isImportTarget(v))) out[k] = v;
  }
  return out;
}
