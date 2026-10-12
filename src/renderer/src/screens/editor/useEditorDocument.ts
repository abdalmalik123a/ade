/**
 * وثيقة المحرّر وترويسته ومصدرها (تقسيمه بعد ١٫٧٫٠) — منقولٌ من `EditorScreen` كما هو: تبديل الوثيقة، وقراءة الإعدادات والمكتبة،
 * والترويسة وحفظها، وفتح النموذج والمسودّة (وقراءتها القديمة) والكتاب الصادر نسخةً جديدة.
 */
import { useCallback, useEffect } from 'react';
import { type Doc, docText } from '@shared/doc';
import { type Letterhead, normalizeLayout, emptyLayout, type LetterheadLayout } from '@shared/letterhead';
import { blankLetter } from './shared';
import { readSavedLetter, type Registry } from '@shared/letterDraft';
import type { DocumentDetail, OfficeSettings, TemplateSummary } from '@shared/api';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';

export function useEditorDocument(
  ctx: {
    dirty: MutableRefObject<boolean>;
    setDocState: Dispatch<SetStateAction<Doc>>;
    setSettings: Dispatch<SetStateAction<OfficeSettings | null>>;
    setLetterheads: Dispatch<SetStateAction<Letterhead[]>>;
    setTemplates: Dispatch<SetStateAction<TemplateSummary[]>>;
    setClips: Dispatch<SetStateAction<{ id: number; title: string; body: string; }[]>>;
    templateId: number | null;
    draftId: number | null;
    documentId: number | null;
    toast: string | null;
    setToast: Dispatch<SetStateAction<string | null>>;
    letterheads: Letterhead[];
    letterheadId: number | null;
    setLetterheadId: Dispatch<SetStateAction<number | null>>;
    setLayoutDirty: Dispatch<SetStateAction<boolean>>;
    setLayout: Dispatch<SetStateAction<LetterheadLayout>>;
    doc: Doc;
    layout: LetterheadLayout;
    setSaveLayoutOpen: Dispatch<SetStateAction<boolean>>;
    setActiveTemplate: Dispatch<SetStateAction<number | null>>;
    baseDoc: MutableRefObject<Doc | null>;
    setDocType: Dispatch<SetStateAction<string>>;
    setError: Dispatch<SetStateAction<string | null>>;
    setValues: Dispatch<SetStateAction<Record<string, string>>>;
    setRegistry: Dispatch<SetStateAction<Registry>>;
    setOwner: Dispatch<SetStateAction<string>>;
    setDraft: Dispatch<SetStateAction<number | null>>;
    setLinkedCitizen: Dispatch<SetStateAction<number | null>>;
  }
) {
  const {
    dirty, setDocState, setSettings, setLetterheads, setTemplates, setClips, templateId, draftId, documentId, toast, setToast,
    letterheads, letterheadId, setLetterheadId, setLayoutDirty, setLayout, doc, layout, setSaveLayoutOpen, setActiveTemplate, baseDoc,
    setDocType, setError, setValues, setRegistry, setOwner, setDraft, setLinkedCitizen
  } = ctx;

  const setDoc = useCallback((next: Doc | ((d: Doc) => Doc)) => {
    dirty.current = true;
    setDocState(next);
  }, []);

  useEffect(() => {
    void (async () => {
      const [s, lhs, tpls, cl] = await Promise.all([
        window.diwan.settings.get(),
        window.diwan.letterheads.list(),
        window.diwan.templates.list(),
        window.diwan.clips.list()
      ]);
      setSettings(s);
      setLetterheads(lhs);
      setTemplates(tpls);
      setClips(cl);
      // الترويسة الافتراضية لكتابٍ جديد — ما لم يأتِ الكتاب بترويسته.
      if (templateId === null && draftId === null && documentId === null) {
        const initial = lhs.find((x) => x.isDefault) ?? null;
        if (initial) applyLetterhead(initial, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── الترويسة ─────────────────────────────────────────────────────────
  const letterhead = letterheads.find((x) => x.id === letterheadId) ?? null;

  /** ترويسةٌ من المكتبة تُنسخ إلى الكتاب؛ وكتابٌ فارغٌ يأخذ هوامشها معها. */
  /** `keepMargins`: نموذجٌ يُفتح بهوامشه المحفوظة — فلا تطمسها هوامش ترويسته. */
  function applyLetterhead(found: Letterhead | null, blank = false, keepMargins = false) {
    setLetterheadId(found?.id ?? null);
    setLayoutDirty(false);
    const next = found ? normalizeLayout(found.layout) : emptyLayout();
    setLayout(next);
    if (found && !keepMargins && (blank || !docText(doc).trim())) {
      setDocState((d) => ({ ...d, pageSetup: { ...d.pageSetup, margins: { ...next.margins } } }));
    }
  }

  async function storeLayout(name: string, asNew: boolean) {
    const saved = await window.diwan.letterheads.save({
      id: asNew ? null : letterheadId,
      name: name.trim() || 'ترويسة بلا اسم',
      authorityId: letterhead?.authorityId ?? null,
      layout
    });
    setLetterheads(await window.diwan.letterheads.list());
    setLetterheadId(saved.id);
    setLayoutDirty(false);
    setSaveLayoutOpen(false);
    setToast(asNew ? `حُفظت الترويسة «${saved.name}» في المكتبة` : 'حُدّثت الترويسة المحفوظة');
  }

  // ── النموذج والمسودة والكتاب المكرَّر ─────────────────────────────────
  /** نموذجٌ من المكتبة يُفتح بكتله كما حُفظ — جداوله وتنسيقه — لا ظلَّه النصّي. */
  async function loadTemplate(id: number | null) {
    setActiveTemplate(id);
    if (id === null) return;
    const [detail, tdoc] = await Promise.all([window.diwan.templates.get(id), window.diwan.templates.doc(id)]);
    if (!detail) return;
    const opened = tdoc ?? blankLetter();
    baseDoc.current = opened;
    setDoc(opened);
    setDocType(detail.title);
    if (detail.letterheadId) {
      // القائمة تُجلب هنا لا من حالة الشاشة: تُنادى هذه الدالّة من أوّل تصيير وحالتها فارغة،
      // فكان النموذج المربوط بترويسةٍ يُفتح بلا رأس الجهة (مراجعة ٧ ت١).
      const lhs = await window.diwan.letterheads.list();
      applyLetterhead(lhs.find((l) => l.id === detail.letterheadId) ?? null, false, true);
    }
    setToast(`فُتح النموذج «${detail.title}» — اكتب على الورقة واملأ قيمه من الجانب`);
  }

  useEffect(() => {
    if (templateId !== null && letterheads !== undefined) void loadTemplate(templateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  /** ما حُفظ (مسودةً أو كتابًا صادرًا) يعود بورقته وقيمه وترويسته. */
  function restore(raw: string, keepNumber: boolean) {
    const saved = readSavedLetter(raw);
    if (!saved) {
      setError('تعذّرت قراءة الكتاب المحفوظ — فُتح فارغًا');
      return;
    }
    baseDoc.current = saved.doc;
    setDocState(saved.doc);
    setValues(saved.values);
    setRegistry(keepNumber ? saved.registry : { ...saved.registry, number: '' });
    setDocType(saved.docType);
    setOwner(saved.owner);
    if (saved.layout) setLayout(saved.layout);
  }

  useEffect(() => {
    if (draftId === null) return;
    void window.diwan.drafts.list().then((rows) => {
      const row = rows.find((d) => d.id === draftId);
      if (!row) return;
      setDraft(row.id);
      setActiveTemplate(row.templateId);
      setLinkedCitizen(row.citizenId);
      restore(row.valuesJson, true);
      dirty.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  /** «كرّره»: نسخةٌ تصدر برقمٍ جديد، والأصل في الأرشيف كما صدر. */
  useEffect(() => {
    if (documentId === null) return;
    void window.diwan.documents.get(documentId).then((d: DocumentDetail | null) => {
      if (!d) return;
      setActiveTemplate(d.templateId);
      setLinkedCitizen(d.citizenId);
      restore(d.valuesJson, false);
      setToast(`نسخة عن ${d.serial} — تصدر برقم قيدٍ جديد، والأصل كما صدر`);
      dirty.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return { setDoc, loadTemplate, letterhead, applyLetterhead, storeLayout };
}
