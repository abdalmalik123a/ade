/**
 * استيراد الزبائن من Excel (الموجة ٢، «كلفة الانتقال») — الخطّة ثم الاستيراد، على القاعدة.
 *
 * كلّ صفٍّ واحدٌ من أربعة:
 * - **جديد** يُضاف ملفًّا.
 * - **موجود** — بالرقم الوطني، أو بالاسم والهاتف معًا — فيُكمل الفارغ من خاناته وحده، ولا يُكتب فوق ما
 *   كتبه المكتب في ملفّه.
 * - **بلا اسم** يُترك.
 * - **بالاسم نفسه** لزبونٍ في السجلّ ولا رقمَ ولا هاتفَ يفرّق بينهما — فيُترك ما لم يختر المكتب إضافته:
 *   الملفّ المكرّر لشخصٍ واحد يفسد الأرشيف (`isNationalIdTaken`)، وملفّان لشخصين باسمٍ واحد يُضافان بيده.
 *
 * والمكرّر داخل الملفّ نفسه (بالرقم الوطني، أو بالاسم والهاتف) يُدمج في أوّله. والخطّة تُعرض قبل
 * الاستيراد، والاستيراد كلّه قيدٌ واحد: يتمّ كلّه أو لا شيء.
 */
import type { Database } from 'better-sqlite3';
import { normalizeFold } from '@shared/arabic';
import { CITIZEN_FIELDS } from '@shared/citizenSchema';
import { canonicalNationalId, nationalIdHint, normalizePhone } from '@shared/idChecks';
import { IMPORT_MAX_ROWS, cleanMap, type ImportMap, type ImportRow } from '@shared/citizenImport';
import type { CitizenImportOptions, CitizenImportReport, CitizenInput } from '@shared/api';
import { isNationalIdTaken, saveCitizen } from './citizens';

type Plan = {
  report: CitizenImportReport;
  adds: ImportRow[];
  fills: { id: number; patch: ImportRow }[];
};

/** الهاتف للمقارنة: المحمول بصيغته المحلية، وغيره أرقامه — أو عدم. */
function phoneKey(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const local = normalizePhone(value);
  if (local) return local;
  const d = normalizeFold(value).replace(/\D/g, '');
  return d.length >= 6 ? d : null;
}

/** يملأ في الصفّ الأوّل ما فرغ منه من الثاني — المكرّر في الملفّ نفسه. */
function fillMissing(into: ImportRow, from: ImportRow): void {
  for (const [k, v] of Object.entries(from) as [keyof ImportRow, string][]) if (v && !into[k]) into[k] = v;
}

const TEXT = CITIZEN_FIELDS.filter((f) => f.key !== 'fullName');

/** الخطّة بلا كتابة: ما سيُضاف وما سيُكمل وما سيُترك — تُعرض قبل الاستيراد. */
export function planCitizenImport(db: Database, rows: ImportRow[], opts: CitizenImportOptions = {}): Plan {
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new Error(`في الملف أكثر من ${IMPORT_MAX_ROWS.toLocaleString('ar-IQ')} صفّ — قسّمه ملفّين`);
  }
  const report: CitizenImportReport = { added: 0, completed: 0, unchanged: 0, similar: 0, noName: 0, repeated: 0, unusualIds: 0, similarNames: [] };
  const category = opts.category?.trim() || null;

  // ── داخل الملف: المكرّر يُدمج في أوّله ──
  const seen = new Map<string, ImportRow>();
  const order: ImportRow[] = [];
  for (const raw of rows) {
    const row: ImportRow = { ...raw };
    if (category && !row.category) row.category = category;
    const name = row.fullName?.trim();
    if (!name) {
      report.noName++;
      continue;
    }
    const nid = canonicalNationalId(row.nationalId) ?? row.nationalId?.trim() ?? null;
    const phone = phoneKey(row.phone);
    // بلا رقمٍ وطنيٍّ ولا هاتف لا يُعرف أنّهما واحد: اسمان متطابقان في قائمة صفٍّ قد يكونان طالبين.
    const key = nid ? `n:${nid}` : phone ? `p:${normalizeFold(name)}|${phone}` : null;
    const prior = key ? seen.get(key) : undefined;
    if (prior) {
      fillMissing(prior, row);
      report.repeated++;
      continue;
    }
    if (row.nationalId && nationalIdHint(row.nationalId)) report.unusualIds++;
    if (key) seen.set(key, row);
    order.push(row);
  }

  // ── على السجلّ: موجودٌ يُكمل، ومتشابهٌ يُترك، وجديدٌ يُضاف ──
  const byNid = db.prepare('SELECT id FROM citizens WHERE national_id = ?');
  const byName = db.prepare('SELECT id, national_id AS nid, phone FROM citizens WHERE name_fold = ?');
  const current = db.prepare('SELECT * FROM citizens WHERE id = ?');
  const adds: ImportRow[] = [];
  const fills: Plan['fills'] = [];

  for (const row of order) {
    const name = row.fullName!.trim();
    const nid = canonicalNationalId(row.nationalId) ?? row.nationalId?.trim() ?? null;
    const phone = phoneKey(row.phone);
    let id = nid ? ((byNid.get(nid) as { id: number } | undefined)?.id ?? null) : null;
    let ambiguous = false;
    if (id === null) {
      for (const c of byName.all(normalizeFold(name)) as { id: number; nid: string | null; phone: string | null }[]) {
        // رقمان وطنيّان مختلفان: شخصان. وهاتفان: متطابقان شخصٌ واحد، ومختلفان شخصان.
        if (nid && c.nid && c.nid !== nid) continue;
        const theirs = phoneKey(c.phone);
        if (phone && theirs) {
          if (phone === theirs) {
            id = c.id;
            break;
          }
          continue;
        }
        ambiguous = true;
      }
    }

    if (id !== null) {
      const cur = current.get(id) as Record<string, string | null>;
      const patch: ImportRow = {};
      for (const f of TEXT) {
        const v = row[f.key]?.trim();
        if (v && !cur[f.column]?.trim()) patch[f.key] = v;
      }
      if (row.category && !cur.category?.trim()) patch.category = row.category;
      if (row.notes && !cur.notes?.trim()) patch.notes = row.notes;
      // رقمٌ وطنيٌّ يُكمل ملفًّا بلا رقم — إلا إن كان لزبونٍ آخر.
      if (patch.nationalId) {
        const canon = canonicalNationalId(patch.nationalId) ?? patch.nationalId;
        if (isNationalIdTaken(db, canon, id)) delete patch.nationalId;
      }
      if (Object.keys(patch).length) {
        fills.push({ id, patch });
        report.completed++;
      } else report.unchanged++;
      continue;
    }

    if (ambiguous && !opts.addSimilar) {
      report.similar++;
      if (report.similarNames.length < 20) report.similarNames.push(name);
      continue;
    }
    adds.push(row);
    report.added++;
  }
  return { report, adds, fills };
}

/** ملفٌّ جديدٌ من الصفّ — كلّ خاناته، والفارغ فارغ. */
function inputOf(row: ImportRow): CitizenInput {
  const text = Object.fromEntries(TEXT.map((f) => [f.key, row[f.key]?.trim() || null]));
  return {
    ...(text as Omit<CitizenInput, 'id' | 'fullName' | 'photoPath' | 'category' | 'notes' | 'verified'>),
    id: null,
    fullName: row.fullName!.trim(),
    photoPath: null,
    category: row.category?.trim() || null,
    notes: row.notes?.trim() || null,
    verified: false
  };
}

/** الاستيراد: الخطّة نفسها تُنفَّذ قيدًا واحدًا، ويُقيَّد في سجلّ الأحداث. */
export function importCitizens(db: Database, rows: ImportRow[], opts: CitizenImportOptions = {}): CitizenImportReport {
  return db.transaction(() => {
    const { report, adds, fills } = planCitizenImport(db, rows, opts);
    for (const row of adds) saveCitizen(db, inputOf(row));
    for (const { id, patch } of fills) {
      const cur = db.prepare('SELECT * FROM citizens WHERE id = ?').get(id) as Record<string, unknown>;
      // الخانة الغائبة تبقى كما هي (`saveCitizen`)؛ فلا يُمرَّر إلا ما يُكمل — وما سواه من الملف كما كان.
      // إلا الاسم والرقم الوطني: يُكتبان دائمًا، فيُمرّران بما في الملف (وكان الرقم يُمحى إن غاب).
      saveCitizen(db, {
        ...(patch as Partial<CitizenInput>),
        id,
        fullName: String(cur.full_name),
        nationalId: patch.nationalId ?? (cur.national_id as string | null) ?? null,
        photoPath: (cur.photo_path as string | null) ?? null,
        category: patch.category ?? (cur.category as string | null) ?? null,
        notes: patch.notes ?? (cur.notes as string | null) ?? null,
        verified: cur.verified === 1
      } as CitizenInput);
    }
    if (report.added || report.completed) {
      const file = opts.fileName?.trim() || 'ملف Excel';
      db.prepare(`INSERT INTO audit_log (entity, action, detail) VALUES ('citizen', 'import', ?)`).run(
        `${file}: أُضيف ${report.added}، وأُكمل ${report.completed}`
      );
    }
    return report;
  })();
}

/** ربط الأعمدة الذي تذكّره المكتب من ملفّاته السابقة. */
export function readImportMap(db: Database): ImportMap {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'citizenImportMap'").get() as { value: string } | undefined;
  try {
    return cleanMap(JSON.parse(row?.value ?? '{}'));
  } catch {
    return {};
  }
}

/** يُضاف الربط الجديد إلى المحفوظ — والأحدث يغلب، ولا يزيد على ثلاثمئة عنوان. */
export function saveImportMap(db: Database, map: unknown): ImportMap {
  const merged = { ...readImportMap(db), ...cleanMap(map) };
  const keys = Object.keys(merged);
  const kept: ImportMap = Object.fromEntries(keys.slice(Math.max(0, keys.length - 300)).map((k) => [k, merged[k] ?? null]));
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('citizenImportMap', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(JSON.stringify(kept));
  return kept;
}
