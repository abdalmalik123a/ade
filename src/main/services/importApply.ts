/**
 * تنفيذ خطّة استيراد المجلّد أو Excel وحفظ الترويسة المشتركة والنماذج في القاعدة — نُقل من `importFolder.ts` (D92).
 */
import type { Database } from 'better-sqlite3';
import type { ImportPlan, ImportChoices, ImportOutcome } from '@shared/api';
import { type Correction, recordCorrections } from './learning';
import { saveLetterhead } from './letterheads';
import { HEAD_MAX, splitSheetHead } from '@shared/sheetHead';
import { saveTemplate } from './templates';
import { docText } from '@shared/doc';

/**
 * ينفّذ ما قبِله الموظف.
 *
 * والترويسة المشتركة تُحفظ **مرّة واحدة** ويُربط بها الجميع — فمكتبٌ بجانب
 * مديرية التربية رأسُه واحد، ولا معنى لمئتين وثمانين نسخةً منه.
 */
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
