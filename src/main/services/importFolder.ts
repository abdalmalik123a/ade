/**
 * «استورد مجلدي»: من مئات ملفات Word إلى مكتبة حيّة، مرّةً واحدة في العمر.
 *
 * المكتب لا يملك ٣٠٠ استمارة — يملك ثلاثين نُسخت عشر مرّات، لأن Word لا يفرّق
 * بين الأصل والنسخة. وأكثر ملفاته ترويستها واحدة، فتُستخرج مرّة وتُربط بالجميع.
 *
 * **وكلّ ملفٍّ بتنسيقه** (الموجة ٢): الورقة كما يرسمها قارئ Word للملفّ الواحد (`docxDoc.ts`) —
 * جداولها وصورها وعريضها وأحجامها ومحاذاتها — وفراغاتها خاناتٌ بأسمائها كما يقترحها المحرّر
 * (`applyBlankFields`). وكانت تُبنى من نصّ الملفّ وحده فتسقط الجداول والصور والتنسيق، ويسقط معها رأس
 * كلّ ملفٍّ لم تشاركه الملفّات الأخرى. والرأس الآن يُكشف قبل الخانات (`findSheetHead`): يتكرّر بين
 * الملفّات فيصير ترويسةً واحدة بتنسيقه، وفراغاته (العدد والتاريخ) نقاطٌ يملؤها القلم كما كانت في
 * الترويسة؛ ولا يُفصل عن ورقته إلا حين تُربط بتلك الترويسة — وإلا بقيت الورقة برأسها كما كانت.
 *
 * **ولا يُحفظ شيء هنا.** تُبنى «خطّة» تُعرض على الموظف في شاشة المراجعة، ثم
 * يُنفَّذ ما قبله — فالبرنامج يقترح وهو يحكم.
 */
import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import {
  APPLY_THRESHOLD,
  docText,
  emptyDoc,
  newUuid,
  renameField,
  type Doc,
  type Suggestion
} from '@shared/doc';
import { isLayoutEmpty, type LetterheadLayout } from '@shared/letterhead';
import type {
  ImportCandidate,
  ImportChoices,
  ImportedTemplate,
  ImportOutcome,
  ImportPlan,
  ImportSkipped
} from '@shared/api';
import { FOLDER_DEPTH } from '@shared/importSkipped';
import { groupDuplicates, stripTatweel } from './blanks';
import { applyBlankFields } from '@shared/fieldHints';
import { HEAD_MAX, findSheetHead, splitSheetHead } from '@shared/sheetHead';
import { OTHER_WORD, importTemplateFile, type ImageSaver } from './import';
import { adoptDataFields, excelToDocs } from './excelDoc';
import { saveLetterhead } from './letterheads';
import { saveTemplate } from './templates';
import { learned, recordCorrections, type Correction } from './learning';
import { similarityBucket } from '@shared/learningKeys';
import { censusOf, type WordScan } from '@shared/wordLosses';

export type { ImportCandidate, ImportChoices, ImportOutcome, ImportPlan };

/** سقفٌ يمنع مجلدًا ضخمًا من تعليق التطبيق — وما بعده يُعدّ ويُقال (هـ١)، ويُستورد من مجلّدٍ آخر. */
export const FOLDER_LIMIT = 500;

const EXCEL = new Set(['.xls', '.xlsx', '.xlsm', '.xlsb', '.ods']);
/** ما ليس من عمل المكتب: مؤقّتات Word (`~$`) وملفّات ويندوز المخفيّة — لا تُقرأ ولا تُعدّ. */
const noise = (name: string) => name.startsWith('~$') || name.startsWith('.') || /^(desktop\.ini|thumbs\.db)$/i.test(name);
const systemDir = (name: string) => /^[.$~]/.test(name) || name === 'System Volume Information';

/**
 * ملفّات Word في المجلّد ومجلّداته الفرعية (هـ١) بمساراتها النسبية («الإنذارات/انذار.docx»)، وما تُرك بأعداده.
 *
 * ملفّات كلّ مجلّدٍ قبل مجلّداته الفرعية وبترتيب أسمائها — فالترتيب ثابت، والسقف يأخذ الأقرب إلى ما اختير.
 * ومجلّدٌ فرعيّ لا يُفتح يُعدّ ولا يُسقط المجلّد؛ والمجلّد المختار نفسه إن لم يُفتح فخطؤه يُقال كما كان.
 */
export async function walkFolder(dir: string, limit = FOLDER_LIMIT): Promise<{ files: string[]; skipped: ImportSkipped }> {
  const skipped: ImportSkipped = { doc: 0, xls: 0, unsupported: 0, overCap: 0, folders: 0, limit };
  const files: string[] = [];
  async function walk(rel: string, depth: number): Promise<void> {
    const at = rel ? join(dir, rel) : dir;
    const entries = rel ? await readdir(at, { withFileTypes: true }).catch(() => null) : await readdir(at, { withFileTypes: true });
    if (!entries) {
      skipped.folders++;
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const subs: string[] = [];
    for (const e of entries) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!systemDir(e.name)) subs.push(path);
        continue;
      }
      if (!e.isFile() || noise(e.name)) continue;
      const ext = extname(e.name).toLowerCase();
      if (ext === '.docx') {
        if (files.length < limit) files.push(path);
        else skipped.overCap++;
      } else if (OTHER_WORD.has(ext)) skipped.doc++;
      else if (EXCEL.has(ext)) skipped.xls++;
      else skipped.unsupported++;
    }
    for (const sub of subs) {
      if (depth >= FOLDER_DEPTH) skipped.folders++;
      else await walk(sub, depth + 1);
    }
  }
  await walk('', 0);
  return { files, skipped };
}

/** أسطر نصٍّ مجرّدة: بلا تمديدٍ ولا مسافاتٍ زائدة — فالفرق في المنطوق. */
const plainLines = (text: string) =>
  text
    .split('\n')
    .map((l) => stripTatweel(l).replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** نصّ الترويسة مجرّدًا — بصمتها التي تُعرف بها بين الملفات: أقسامها، أو كتل رأس الورقة إن كانت منه. */
export function letterheadKey(layout: LetterheadLayout | null): string | null {
  if (!layout) return null;
  if (layout.sheet?.length) {
    const text = plainLines(docText({ ...emptyDoc(), blocks: layout.sheet })).join('|');
    return text ? `ورقة:${text}` : null;
  }
  if (isLayoutEmpty(layout)) return null;
  const lines = layout.sections.flatMap((s) =>
    s.blocks.filter((b) => b.kind === 'text').map((b) => stripTatweel(b.value).trim())
  );
  const text = lines.filter(Boolean).join('|');
  return text || null;
}

/**
 * الملف الواحد قد يكون مكتبة: ٣١ استمارةً مدرسية في ملفٍّ واحد، وحدُّ الاستمارة تكرارُ أوّل سطرٍ من رأسها.
 *
 * فالكتلة التي نصّها نصّ أوّل كتلةٍ في الورقة بدايةُ استمارةٍ أخرى — وما قبلها من كتلٍ بلا نصّ (الشعار) يتبعها
 * كما تبع الأولى. وفاصل الصفحة والأسطر الفارغة في آخر كلّ استمارةٍ تُترك.
 */
export function formsOf(doc: Doc): Doc[] {
  const blocks = doc.blocks;
  const text = (i: number) => plainLines(docText({ ...emptyDoc(), blocks: [blocks[i]!] })).join('|');
  const first = blocks.findIndex((_, i) => text(i));
  if (first < 0) return [doc];
  const marker = text(first);
  const starts = [0];
  for (let i = first + 1; i < blocks.length; i++) {
    const start = i - first;
    if (text(i) === marker && start > starts[starts.length - 1]!) starts.push(start);
  }
  if (starts.length < 2) return [doc];
  const blank = (b: Doc['blocks'][number]) => b.kind === 'pageBreak' || (b.kind === 'paragraph' && !plainLines(docText({ ...emptyDoc(), blocks: [b] })).length);
  return starts.map((from, k) => {
    const part = blocks.slice(from, starts[k + 1] ?? blocks.length);
    while (part.length > 1 && blank(part[part.length - 1]!)) part.pop();
    return { ...doc, blocks: part };
  });
}

/**
 * يقرأ مجلدًا ويبني خطّة استيراد.
 *
 * ولا يمسّ القاعدة: القراءة وحدها، فالموظف يرى ما سيصير قبل أن يصير.
 */
export async function planFolderImport(
  dir: string,
  opts: { saveImage?: ImageSaver; limit?: number } = {}
): Promise<ImportPlan> {
  // والمجلّدات الفرعية تُفتح، وما لا يُقرأ يُعدّ (هـ١) — وكان المجلّد الأوّل وحده و`.docx` وحده، والسقف يقصّ صامتًا.
  const { files: names, skipped } = await walkFolder(dir, opts.limit ?? FOLDER_LIMIT);

  const failed: ImportPlan['failed'] = [];
  /** ما في كلّ ملفٍّ ولا يُنقل — للإحصاء: ملفٌّ واحد ولو كان فيه عدّة استمارات. */
  const scans: WordScan[] = [];

  // ── الأولى: كلّ ملفٍّ أوراقُه ورأسُ كلٍّ منها كما يُكشف ──
  type Form = { file: string; res: ImportedTemplate; index: number; count: number; doc: Doc; headCount: number; letterheadKey: string | null; letterhead: LetterheadLayout | null };
  const forms: Form[] = [];
  for (const name of names) {
    try {
      const res = await importTemplateFile(join(dir, name), opts.saveImage);
      if (res.scan) scans.push(res.scan);
      if (!res.doc) throw new Error('لم تُقرأ ورقة الملف');
      // ترويسةٌ في رأس صفحة Word: الورقة لا تحملها، فتُشارك كما كانت ولا يُبحث عن رأسٍ في المتن.
      const fromHeader = res.letterheadFromHeader ? res.letterhead : null;
      const parts = formsOf(res.doc);
      parts.forEach((doc, index) => {
        const headCount = fromHeader ? 0 : findSheetHead(doc);
        const letterhead = (headCount ? splitSheetHead(doc, headCount)?.layout : null) ?? fromHeader;
        forms.push({ file: name, res, index, count: parts.length, doc, headCount, letterheadKey: letterheadKey(letterhead), letterhead });
      });
    } catch (e) {
      failed.push({ file: name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── الثانية: الرأس رأسٌ إن تكرّر بين الملفّات وحده ──
  // رأسٌ لا يتكرّر قد يكون ابتلع الكتاب نفسه: كتابٌ لا سطر فارغًا بين رأسه ومتنه يُعدّ متنُه رأسًا — فتبقى
  // فراغاته نقاطًا، ويصير كلّ كتابٍ من الدائرة «نسخةً» من غيره. فيبقى في ورقته، وتُبحث فيه الفراغات كلّها.
  const shared = findShared(forms);
  const candidates: ImportCandidate[] = [];
  for (const f of forms) {
    const headCount = shared && f.letterheadKey === shared.key ? f.headCount : 0;
    // الفراغات خاناتٌ تُملأ بالقلم بعد الطباعة ما لم يقل المكتب غير ذلك — وفراغات الرأس المشترك لا تُمسّ.
    const built = applyBlankFields(f.doc, { from: headCount, fillMode: 'hand' });
    if (!docText(built.doc).trim()) continue;
    candidates.push({
      id: newUuid(),
      file: f.file,
      formIndex: f.index + 1,
      formCount: f.count,
      title: titleOf(f.res.title, f.file, f.index, f.count),
      // سطر «م /» في الورقة نفسها — وسطرُ موضوعٍ فوقها يكرّره (كالملفّ الواحد).
      subjectLine: null,
      doc: built.doc,
      headCount,
      letterheadKey: f.letterheadKey,
      letterhead: f.letterhead,
      notes: f.res.docNotes ?? [],
      warnings: [],
      suggestions: built.suggestions,
      scan: f.res.scan
    });
  }

  return {
    candidates,
    sharedLetterhead: shared,
    // المكرّر بمتنه لا برأسه: رأسٌ واحد لكلّ كتب المدرسة لا يجعل الإنذار والتأييد نسختين.
    duplicates: groupDuplicates(
      candidates.map((c) => ({ id: c.id, text: docText({ ...c.doc, blocks: c.doc.blocks.slice(c.headCount ?? 0) }) }))
    ),
    failed,
    census: censusOf(scans, failed.length),
    skipped
  };
}

/**
 * «كتب من ملف Excel» (الموجة ٢): كلّ ورقةٍ بطاقة، بالمراجعة نفسها والحفظ نفسه (`applyImportPlan`).
 *
 * وخانات ورقة البيانات اقتراحٌ واثق باسم بيانها («اسم المدرسة»، «المحافظة») — فيخدم النموذج كلّ مدرسة —
 * وفراغات المسافات خاناتٌ بأسمائها تُملأ بالقلم كفراغات Word. وما لم يُستورد من الأوراق يُقال بسببه.
 */
export async function planExcelImport(path: string, opts: { saveImage?: ImageSaver } = {}): Promise<ImportPlan> {
  const book = await excelToDocs(path, opts.saveImage);
  const file = basename(path);
  const reason = book.dataSheet ? `من ورقة البيانات «${book.dataSheet}»` : 'من ورقة البيانات';
  const candidates: ImportCandidate[] = book.sheets.map((sheet) => {
    const built = applyBlankFields(sheet.doc, { fillMode: 'hand' });
    // وفراغٌ باسم خانةٍ من البيانات يصير هي — فلا تبقى له خانةٌ تُملأ بالقلم.
    const { doc, adopted } = adoptDataFields(built.doc, book.dataFields);
    const kept = new Set(doc.fields.map((f) => f.key));
    const fromData = [...sheet.doc.fields, ...adopted].map((f) => ({ value: `${f.key} — ${f.label}`, confidence: 0.95, reason }));
    return {
      id: newUuid(),
      file,
      formIndex: 1,
      formCount: 1,
      title: sheet.name,
      subjectLine: null,
      doc,
      headCount: 0,
      letterheadKey: null,
      letterhead: null,
      notes: sheet.notes,
      warnings: [],
      suggestions: [...fromData, ...built.suggestions.filter((s) => kept.has(s.value.split(' — ')[0]!))]
    };
  });
  return {
    source: 'excel',
    candidates,
    sharedLetterhead: null,
    duplicates: groupDuplicates(candidates.map((c) => ({ id: c.id, text: docText(c.doc) }))),
    failed: book.skipped.map((s) => ({ file: s.name, error: s.reason }))
  };
}

/**
 * عنوان البطاقة: ما استُنتج من نصّها — إلا أن يكون أرقامًا أو أقلّ من كلمة («1 9» من خليّةٍ في أعلاها)،
 * فاسمُ الملفّ. وبلا ترقيم المكتب في أوّله: «06 - طلب تنسيب» عنوانه «طلب تنسيب».
 */
export function titleOf(found: string, file: string, index: number, count: number): string {
  const unnumbered = (s: string) => s.replace(/^\s*\d+\s*[-–_.]\s*/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  const fromText = unnumbered(found ?? '');
  const title = (fromText.match(/[ء-ي]/g) ?? []).length >= 3 ? fromText : unnumbered(basename(file, extname(file))) || fromText;
  return count > 1 ? `${title} (${index + 1})` : title;
}

/** الترويسة الأكثر تكرارًا إن تكرّرت — وإلا فلكلّ ملف ترويسته. */
function findShared(candidates: { letterheadKey: string | null; letterhead: LetterheadLayout | null }[]): ImportPlan['sharedLetterhead'] {
  const counts = new Map<string, { layout: LetterheadLayout; count: number }>();
  for (const c of candidates) {
    if (!c.letterheadKey || !c.letterhead) continue;
    const seen = counts.get(c.letterheadKey);
    if (seen) seen.count += 1;
    else counts.set(c.letterheadKey, { layout: c.letterhead, count: 1 });
  }

  let best: ImportPlan['sharedLetterhead'] = null;
  for (const [key, v] of counts) {
    if (v.count < 2) continue;
    if (!best || v.count > best.count) best = { key, layout: v.layout, count: v.count };
  }
  return best;
}

/**
 * ينفّذ ما قبِله الموظف.
 *
 * والترويسة المشتركة تُحفظ **مرّة واحدة** ويُربط بها الجميع — فمكتبٌ بجانب
 * مديرية التربية رأسُه واحد، ولا معنى لمئتين وثمانين نسخةً منه.
 */
/**
 * يطبّق ما **اعتاده** المكتب على خطّةٍ بُنيت بالقواعد.
 *
 * فالتخطيط يبقى خالصًا (لا قاعدةَ بياناتٍ فيه)، والعادةُ تُطبَّق على حافّته.
 *
 * **ولا تُطبَّق إلا إن رسخت**: تصحيحٌ واحد قد يكون زلّة، فلا يُعاد به تسمية
 * حقلٍ في كل ملفٍ يأتي بعده — وإلا لم يتعلّم البرنامج شيئًا بعدها، إذ لن يرى
 * الموظفُ الاسمَ الأول ليصحّحه ثانيةً. فالعتبة هي `APPLY_THRESHOLD` نفسها التي
 * في النواة، وما دونها يُقال ولا يُطبَّق.
 *
 * وكل تسميةٍ تُغيَّر يُقال سببُها في `suggestions` — فالتعلّم لا يكون صامتًا:
 * «اعتاده مكتبك: اختاره ٤ مرّات».
 */
export function applyHabits(db: Database, plan: ImportPlan): ImportPlan {
  // المتشابه الذي اعتاد المكتب إبقاءه بهذه الدرجة (ج١٣): لا يُنزع اختياره — ويُقال لماذا.
  const kept: { ids: string[]; reason: string }[] = [];
  const duplicates = plan.duplicates.filter((g) => {
    const habit = learned(db, 'duplicate', similarityBucket(g.confidence));
    if (!habit || habit.value !== 'keep' || habit.confidence < APPLY_THRESHOLD) return true;
    kept.push({ ids: g.ids, reason: `متشابهان ${Math.round(g.confidence * 100)}٪ ويُبقيهما مكتبك — ${habit.reason}` });
    return false;
  });
  const keptReason = new Map(kept.flatMap((k) => k.ids.map((id) => [id, k.reason] as const)));

  return {
    ...plan,
    duplicates,
    candidates: plan.candidates.map((c) => {
      let doc = c.doc;
      const reasons: Suggestion<string>[] = [];
      for (const field of c.doc.fields) {
        const habit = learned(db, 'fieldName', field.label);
        if (!habit || habit.value === field.label) continue;
        if (habit.confidence < APPLY_THRESHOLD) continue;
        // `value` مفتاحُ الحقل لا الاسمَ الجديد: الشاشة تربط السببَ بالمفتاح،
        // فلو وُضع الاسمُ هنا لم يُعرض السببُ قطّ ولصار التعلّم صامتًا.
        reasons.push({
          value: field.key,
          confidence: habit.confidence,
          reason: `«${field.label}» ← «${habit.value}» — ${habit.reason}`
        });
        doc = renameField(doc, field.key, habit.value);
      }
      const keep = keptReason.get(c.id);
      if (keep) reasons.push({ value: c.id, confidence: 0.9, reason: keep });
      return reasons.length ? { ...c, doc, suggestions: [...c.suggestions, ...reasons] } : c;
    })
  };
}

export function applyImportPlan(
  db: Database,
  plan: ImportPlan,
  choices: ImportChoices
): ImportOutcome {
  const accepted = new Set(choices.accept);
  const taken = plan.candidates.filter((c) => accepted.has(c.id));

  /**
   * ما غيّره الموظف يُقيَّد — ولا يُقيَّد ما قبِله.
   *
   * فالذي قبِل الاقتراح لم يعلّمنا جديدًا؛ والذي أعاد تسمية حقلٍ علّمنا اسم
   * مكتبه له. والفرقُ يُحسب في الشاشة لأنها وحدها تملك الاثنين: ما اقترحه
   * البرنامج وما صار إليه بيد الموظف.
   */
  const corrections: Correction[] = (choices.corrections ?? []).map((c) => ({
    kind: 'fieldName' as const,
    input: c.input,
    suggested: c.suggested,
    chosen: c.chosen
  }));

  return db.transaction((): ImportOutcome => {
    let letterheadId: number | null = null;
    const shared = plan.sharedLetterhead;
    if (choices.useSharedLetterhead && shared) {
      letterheadId = saveLetterhead(db, {
        id: null,
        name: choices.sharedName?.trim() || 'ترويسة المكتب',
        authorityId: null,
        layout: shared.layout,
        category: choices.category ?? null
      }).id;
    }

    for (const c of taken) {
      const linked = letterheadId !== null && shared !== null && c.letterheadKey === shared.key;
      // الرأس يُفصل حين تُربط الورقة بالترويسة التي صارها وحده — وإلا بقيت برأسها كما كانت في Word.
      const head = linked ? Math.min(Math.max(0, Math.floor(c.headCount ?? 0)), HEAD_MAX) : 0;
      const doc = head ? (splitSheetHead(c.doc, head)?.doc ?? c.doc) : c.doc;
      saveTemplate(db, {
        id: null,
        code: null,
        title: c.title,
        subtitle: null,
        category: choices.category ?? null,
        subjectLine: c.subjectLine,
        // الظلّ النصّي للبحث ولمعاينة البطاقة في المكتبة؛ والحقيقة في `doc`.
        bodyHtml: docText(doc),
        letterheadId: linked ? letterheadId : null,
        variables: [],
        doc
      });
    }

    if (corrections.length) recordCorrections(db, corrections);

    return {
      templates: taken.length,
      letterheadId,
      skipped: plan.candidates.length - taken.length
    };
  })();
}
