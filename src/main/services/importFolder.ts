/**
 * «استورد مجلدي»: من مئات ملفات Word إلى مكتبة حيّة، مرّةً واحدة في العمر.
 *
 * المكتب لا يملك ٣٠٠ استمارة — يملك ثلاثين نُسخت عشر مرّات، لأن Word لا يفرّق
 * بين الأصل والنسخة. وأكثر ملفاته ترويستها واحدة، فتُستخرج مرّة وتُربط بالجميع.
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
  ImportOutcome,
  ImportPlan
} from '@shared/api';
import { buildBody, groupDuplicates, splitForms, stripTatweel } from './blanks';
import { importTemplateFile, type ImageSaver } from './import';
import { saveLetterhead } from './letterheads';
import { saveTemplate } from './templates';
import { learned, recordCorrections, type Correction } from './learning';

export type { ImportCandidate, ImportChoices, ImportOutcome, ImportPlan };

/** سقفٌ يمنع مجلدًا ضخمًا من تعليق التطبيق — والباقي يُستورد على دفعات. */
export const FOLDER_LIMIT = 500;

/** نصّ الترويسة مجرّدًا — بصمتها التي تُعرف بها بين الملفات. */
export function letterheadKey(layout: LetterheadLayout | null): string | null {
  if (!layout || isLayoutEmpty(layout)) return null;
  const lines = layout.sections.flatMap((s) =>
    s.blocks.filter((b) => b.kind === 'text').map((b) => stripTatweel(b.value).trim())
  );
  const text = lines.filter(Boolean).join('|');
  return text || null;
}

function docOf(blocks: ReturnType<typeof buildBody>): Doc {
  const doc = emptyDoc();
  doc.blocks = blocks.blocks as Doc['blocks'];
  doc.fields = blocks.fields;
  return doc;
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
  const limit = opts.limit ?? FOLDER_LIMIT;
  const names = (await readdir(dir))
    .filter((n) => extname(n).toLowerCase() === '.docx')
    // `~$` ملفات Word المؤقّتة — ليست مستندات.
    .filter((n) => !n.startsWith('~$'))
    .sort()
    .slice(0, limit);

  const candidates: ImportCandidate[] = [];
  const failed: ImportPlan['failed'] = [];

  for (const name of names) {
    try {
      const res = await importTemplateFile(join(dir, name), opts.saveImage);
      const key = letterheadKey(res.letterhead);

      // الملف الواحد قد يكون مكتبة: حدُّ الاستمارة تكرارُ ترويستها.
      const lines = res.body.split('\n');
      const marker = key ? key.split('|')[0]! : '';
      const ranges = splitForms(lines, marker);

      ranges.forEach(([from, to], i) => {
        const built = buildBody(lines.slice(from, to));
        const doc = docOf(built);
        if (!docText(doc).trim()) return;

        candidates.push({
          id: newUuid(),
          file: name,
          formIndex: i + 1,
          formCount: ranges.length,
          title:
            ranges.length > 1 ? `${res.title} (${i + 1})` : res.title || basename(name, '.docx'),
          subjectLine: res.subjectLine,
          doc,
          letterheadKey: key,
          letterhead: res.letterhead,
          notes: built.notes,
          // هذا المسار يبني وثيقته من النصّ بعدُ — فلا يُقال له «استُورد بتنسيقه».
          warnings: res.warnings.filter((w) => !w.includes('ورقةً واحدة بتنسيقه')),
          suggestions: built.suggestions
        });
      });
    } catch (e) {
      failed.push({ file: name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    candidates,
    sharedLetterhead: findShared(candidates),
    duplicates: groupDuplicates(
      candidates.map((c) => ({ id: c.id, text: docText(c.doc) }))
    ),
    failed
  };
}

/** الترويسة الأكثر تكرارًا إن تكرّرت — وإلا فلكلّ ملف ترويسته. */
function findShared(candidates: ImportCandidate[]): ImportPlan['sharedLetterhead'] {
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
  return {
    ...plan,
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
      saveTemplate(db, {
        id: null,
        code: null,
        title: c.title,
        subtitle: null,
        category: choices.category ?? null,
        subjectLine: c.subjectLine,
        // الظلّ النصّي للبحث والمحرّر القديم؛ والحقيقة في `doc`.
        bodyHtml: docText(c.doc),
        letterheadId: shared && c.letterheadKey === shared.key ? letterheadId : null,
        variables: [],
        doc: c.doc
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
