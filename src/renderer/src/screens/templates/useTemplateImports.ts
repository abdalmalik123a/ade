/**
 * الاستيراد إلى مكتبة النماذج والتصدير منها (تقسيمها بعد ١٫٧٫٠) — منقولٌ من `TemplatesScreen` كما هو: ملفّ Word، ومجلّدٌ كامل،
 * وملفّ Excel، وحزم المحتوى، والحذف والتكرار والتصدير.
 */
import { isLayoutEmpty, type Letterhead } from '@shared/letterhead';
import { errorText } from '../../lib/errors';
import { skippedLines } from '@shared/importSkipped';
import type { ImportPlan, ImportChoices, ImportedTemplate, BundledPackInfo } from '@shared/api';
import { SECTION_LABEL, type ContentSection } from '@shared/sealedPack';
import { count } from '@shared/arabic';
import { nf } from './shared';
import type { Dispatch, SetStateAction } from 'react';

export function useTemplateImports(
  ctx: {
    setBusy: Dispatch<SetStateAction<boolean>>;
    setPendingImport: Dispatch<SetStateAction<ImportedTemplate | null>>;
    openImported: (imported: ImportedTemplate, letterheadId: number | null) => void;
    say: (text: string, tone?: 'ok' | 'warn', sticky?: boolean) => void;
    setPlan: Dispatch<SetStateAction<ImportPlan | null>>;
    reload: (category: string | null) => Promise<void>;
    active: string | null;
    onChanged: (() => void) | undefined;
    setLetterheads: Dispatch<SetStateAction<Letterhead[]>>;
    setImporting: Dispatch<SetStateAction<boolean>>;
    setPacksModal: Dispatch<SetStateAction<boolean>>;
    setLoadingPacks: Dispatch<SetStateAction<boolean>>;
    setBundledPacks: Dispatch<SetStateAction<BundledPackInfo[]>>;
  }
) {
  const {
    setBusy, setPendingImport, openImported, say, setPlan, reload, active, onChanged, setLetterheads, setImporting, setPacksModal,
    setLoadingPacks, setBundledPacks
  } = ctx;

  async function importTemplate() {
    setBusy(true);
    try {
      const imported = await window.diwan.templates.importFile();
      if (!imported) return;
      // ملف Word يُفتح ورقةً واحدة كما صنعه صاحبه — رأسه جزءٌ منها لا ترويسةٌ
      // تُفصل. وما ليس ورقةً منسّقة يبقى طريقه القديم: الترويسة يقرّرها المكتب.
      if (!imported.doc && imported.letterhead && !isLayoutEmpty(imported.letterhead)) {
        setPendingImport(imported);
        return;
      }
      openImported(imported, null);
    } catch (e) {
      say(errorText(e, 'تعذّر الاستيراد'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  /**
   * «استورد مجلدي»: يقرأ المجلد ويعرض ما وجده — ولا يحفظ شيئًا بعد.
   *
   * مرّةٌ واحدة في العمر يخرج بها المكتب من مئات ملفات Word إلى مكتبة حيّة.
   */
  async function importFolder() {
    setBusy(true);
    try {
      const found = await window.diwan.templates.planFolder();
      if (!found) return;
      if (found.candidates.length === 0) {
        // ومجلّدٌ ملفّاته `.doc` يُقال له ما فيه وما يُفعل (هـ١) — لا «لا ملفات Word» وهو ممتلئٌ بها.
        const left = skippedLines(found.skipped);
        say(
          (found.failed.length
            ? `لم يُقرأ أيّ ملف من ${found.failed.length}`
            : 'لا ملفات .docx في هذا المجلد') + (left.length ? ` — ${left.join(' · ')}` : ''),
          'warn',
          left.length > 0
        );
        return;
      }
      setPlan(found);
    } catch (e) {
      say(errorText(e, 'تعذّرت قراءة المجلد'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  /**
   * «كتب من ملف Excel» (الموجة ٢): برنامج مخاطباتٍ في Excel — ورقةٌ لكلّ كتاب — يُراجَع كالمجلّد ثم يُحفظ.
   */
  async function importExcel() {
    setBusy(true);
    try {
      const found = await window.diwan.templates.planExcel();
      if (!found) return;
      if (found.candidates.length === 0) {
        say(found.failed.length ? `لا ورقة فيها كتابٌ يُطبع من ${found.failed.length}` : 'لا أوراق فيها كتب', 'warn');
        return;
      }
      setPlan(found);
    } catch (e) {
      say(errorText(e, 'تعذّرت قراءة ملف Excel'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function applyPlan(edited: ImportPlan, choices: ImportChoices) {
    setBusy(true);
    try {
      const out = await window.diwan.templates.applyImport(edited, choices);
      setPlan(null);
      await reload(active);
      onChanged?.();
      // وما في المجلّد ولم يُنقل يُقال في النتيجة أيضًا (هـ١)، ويبقى حتى يُغلق — فلا يظنّ المكتب أنّ أرشيفه كلّه دخل.
      const left = skippedLines(edited.skipped);
      say(
        `حُفظت ${count(out.templates, 'بطاقة')}` +
          (out.letterheadId ? ' وترويسة واحدة للجميع' : '') +
          (out.skipped ? ` — وتُركت ${count(out.skipped, 'بطاقة')}` : '') +
          (left.length ? ` · ولم يُنقل من المجلّد: ${left.join(' · ')}` : ''),
        'ok',
        left.length > 0
      );
    } catch (e) {
      say(errorText(e, 'تعذّر الحفظ'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  /** حفظ الترويسة المستخرجة في المكتبة ثم ربط النموذج بها. */
  async function keepImportedLetterhead(imported: ImportedTemplate) {
    try {
      const saved = await window.diwan.letterheads.save({
        id: null,
        name: (imported.title || 'ترويسة مستوردة').slice(0, 60),
        authorityId: null,
        layout: imported.letterhead!
      });
      // القائمة تُحدَّث قبل فتح المصمّم، وإلا لم يجد الترويسةَ التي لتوّها حُفظت.
      setLetterheads(await window.diwan.letterheads.list());
      setPendingImport(null);
      openImported(imported, saved.id);
      say(`حُفظت الترويسة «${saved.name}» ورُبط بها النموذج`);
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ الترويسة'), 'warn');
    }
  }

  async function removeTemplate(id: number, title: string) {
    await window.diwan.templates.delete(id);
    await reload(active);
    onChanged?.();
    say('حُذف النموذج: ' + title);
  }

  /** «نسخ نموذج»: نسخة مستقلّة تُعدَّل دون المساس بالأصل — الأصل لا يُفتح أبدًا. */
  async function duplicateTemplate(id: number, title: string) {
    setBusy(true);
    try {
      const copy = await window.diwan.templates.duplicate(id);
      if (!copy) {
        say('تعذّر النسخ', 'warn');
        return;
      }
      await reload(active);
      onChanged?.();
      say(`نُسخ «${title}» — عدّل النسخة دون المساس بالأصل`);
    } catch (e) {
      say(errorText(e, 'تعذّر النسخ'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function exportOne(id: number) {
    setBusy(true);
    try {
      const path = await window.diwan.templates.export(id);
      if (path) say('صُدّر مستند Word');
    } catch (e) {
      say(errorText(e, 'تعذّر التصدير'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  /**
   * حزمة المحتوى (خطة Production، ٤٫٣): النماذج والترويسات والكليشات وصورها — بلا بيانات الناس —
   * لمكتبٍ آخر أو لجهازٍ جديد. والمكرّر يُعرف بمعرّفه فلا يُضاف ثانيةً.
   */
  async function exportContent(section?: ContentSection) {
    setBusy(true);
    try {
      const r = section ? await window.diwan.content.exportSection(section) : await window.diwan.content.export();
      if (r) say(`${section ? `صُدّر قسم «${SECTION_LABEL[section]}»` : 'صُدّرت حزمة المحتوى'}: ${count(r.templates, 'نموذج')}، ${count(r.letterheads, 'ترويسة')}، ${count(r.clips, 'كليشة')} — ${r.path}`);
    } catch (e) {
      say(errorText(e, 'تعذّر التصدير'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function importContent() {
    setBusy(true);
    try {
      const r = await window.diwan.content.import();
      if (!r) return;
      await reload(active);
      onChanged?.();
      const a = r.added;
      const had = r.existing.templates + r.existing.letterheads + r.existing.clips;
      say(
        (r.sealed ? `«${r.sealed.title}» — ` : '') + `أُضيف: ${count(a.templates, 'نموذج')}، ${count(a.letterheads, 'ترويسة')}، ${count(a.clips, 'كليشة')}` +
          (had ? ` — و${nf.format(had)} موجودٌ في المكتب فتُرك كما هو` : '')
      );
    } catch (e) {
      say(errorText(e, 'تعذّر الاستيراد'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function openPacksModal() {
    setImporting(false);
    setPacksModal(true);
    setLoadingPacks(true);
    try {
      const list = await window.diwan.content.bundled();
      setBundledPacks(list);
    } catch (e) {
      say(errorText(e, 'تعذّر تحميل الحزم المشحونة'), 'warn');
    } finally {
      setLoadingPacks(false);
    }
  }

  async function importBundledPack(id: string) {
    setBusy(true);
    try {
      const r = await window.diwan.content.importBundled(id);
      if (!r) return;
      await reload(active);
      onChanged?.();
      try {
        const list = await window.diwan.content.bundled();
        setBundledPacks(list);
      } catch {
        setBundledPacks((prev) =>
          prev.map((p) => (p.id === id ? { ...p, imported: true } : p))
        );
      }
      const a = r.added;
      const had = r.existing.templates + r.existing.letterheads + r.existing.clips;
      say(
        `أُضيف: ${count(a.templates, 'نموذج')}، ${count(a.letterheads, 'ترويسة')}، ${count(a.clips, 'كليشة')}` +
          (had ? ` — و${nf.format(had)} موجودٌ في المكتب فتُرك كما هو` : '')
      );
    } catch (e) {
      say(errorText(e, 'تعذّر استيراد الحزمة'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFileFromModal() {
    await importContent();
    try {
      const list = await window.diwan.content.bundled();
      setBundledPacks(list);
    } catch {
      // ignore
    }
  }

  return {
    importFolder, openPacksModal, importTemplate, importExcel, duplicateTemplate, exportOne, removeTemplate, exportContent, applyPlan,
    keepImportedLetterhead, importBundledPack, handleImportFileFromModal
  };
}
