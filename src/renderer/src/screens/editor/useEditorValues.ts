/**
 * قيم الكتاب في المحرّر (تقسيمه بعد ١٫٧٫٠) — منقولةٌ من `EditorScreen` كما هي: صاحب العلاقة ومقترحه من المتن، والحقول بأدوارها، والجنس
 * مقترحًا من الاسم، والقيم كما تُطبع وكتابتها، وما يُملأ من ملفّ الزبون، وحقلٌ من كتالوج المعاملات.
 */
import { nameFieldOf, sampleValues } from '@shared/letterDraft';
import { type DocField, makeField, type Doc } from '@shared/doc';
import type { CitizenDetail } from '@shared/api';
import { useEffect, useMemo } from 'react';
import { fieldHints } from '@shared/fieldHints';
import { docHasChoices, guessGender, GENDER_KEY } from '@shared/gender';
import { derivedWords, wordsForField, amountWordsField } from '@shared/tafqeet';
import type { CatalogField } from '@shared/letterFields';
import type { EditorApi } from '../../components/editorKit';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { LearnedGenders } from '@shared/gender';

export function useEditorValues(
  ctx: {
    doc: Doc;
    values: Record<string, string>;
    owner: string;
    dirty: MutableRefObject<boolean>;
    setError: Dispatch<SetStateAction<string | null>>;
    setValues: Dispatch<SetStateAction<Record<string, string>>>;
    setLinkedCitizen: Dispatch<SetStateAction<number | null>>;
    setOwner: Dispatch<SetStateAction<string>>;
    setToast: Dispatch<SetStateAction<string | null>>;
    citizenId: number | null;
    genderByHand: boolean;
    learned: LearnedGenders;
    trial: boolean;
    api: MutableRefObject<EditorApi | null>;
    setDoc: (next: Doc | ((d: Doc) => Doc)) => void;
    setFieldPickerOpen: Dispatch<SetStateAction<boolean>>;
  }
) {
  const {
    doc, values, owner, dirty, setError, setValues, setLinkedCitizen, setOwner, setToast, citizenId, genderByHand, learned, trial, api,
    setDoc, setFieldPickerOpen
  } = ctx;

  const nameField = nameFieldOf(doc);
  const ownerName = (nameField ? values[nameField.key] : owner)?.trim() ?? '';
  const byRole = (role: DocField['role']) => {
    const f = doc.fields.find((x) => x.role === role);
    return f ? (values[f.key]?.trim() ?? '') : '';
  };
  const setValue = (key: string, value: string) => {
    dirty.current = true;
    setError(null);
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  /** F2: ما يعرفه البرنامج عن المواطن يملأ ما يطابقه — وما كُتب باليد لا يُطمس. */
  function fillFromCitizen(c: CitizenDetail) {
    const citizen = c as unknown as Record<string, unknown>;
    setLinkedCitizen(c.id);
    setValues((prev) => {
      const next = { ...prev };
      for (const f of doc.fields) {
        const raw = f.source ? citizen[f.source] : f.role === 'name' ? c.fullName : f.role === 'nationalId' ? c.nationalId : null;
        if (typeof raw === 'string' && raw.trim() && !next[f.key]?.trim()) next[f.key] = raw;
      }
      return next;
    });
    if (!nameField) setOwner(c.fullName);
    dirty.current = true;
    setToast('استُوردت بيانات المواطن');
  }

  useEffect(() => {
    if (citizenId === null) return;
    void window.diwan.citizens.get(citizenId).then((c) => c && fillFromCitizen(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citizenId, doc.fields.length]);

  /**
   * الاسم مكتوبٌ في الكتاب نفسه («…بأن السيدة زينب علي حسن…»): يُقترح لصاحب العلاقة بضغطة، فلا يُكتب مرّتين (البند ٩).
   * بكاشف الاسم الذي يقترح خانة «الاسم» في المصمّم (`fieldHints`) — حين لا خانة للاسم على الورقة ولم يُكتب بعد. اقتراحٌ لا قرار.
   */
  const ownerHints = useMemo(
    () => (nameField || owner.trim() ? [] : fieldHints(doc).flatMap((h) => (h.kind === 'name' ? [h.text] : [])).slice(0, 3)),
    [doc, nameField, owner]
  );
  const takeOwner = (name: string) => {
    dirty.current = true;
    setError(null);
    setOwner(name);
  };

  /** الجنس لـ«{الطالب|الطالبة}»: مقترحٌ من الاسم ما لم يختره الموظف، ويُقلب بضغطة. */
  const needsGender = useMemo(() => docHasChoices(doc), [doc]);
  useEffect(() => {
    if (!needsGender || genderByHand || !ownerName) return;
    const g = guessGender(ownerName, learned);
    if (g && values[GENDER_KEY] !== g.gender) setValues((prev) => ({ ...prev, [GENDER_KEY]: g.gender }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGender, genderByHand, ownerName, learned]);

  const keys = useMemo(() => doc.fields.map((f) => f.key), [doc.fields]);
  /** القيم كما تُطبع: ما كُتب، وحقول «كتابةً» الفارغة من أرقامها. */
  const effective = useMemo(() => derivedWords(values, keys), [values, keys]);
  const shown = useMemo(() => (trial ? sampleValues(doc.fields, effective) : effective), [trial, doc.fields, effective]);

  /** حقول التفقيط بصيغتها: المفتاح وسمٌ، والقيمة معه. */
  const named = useMemo(
    () => doc.fields.map((f) => ({ id: f.key, token: f.key.replace(/\s+/g, '_'), label: f.label, value: values[f.key] ?? '' })),
    [doc.fields, values]
  );
  function writeWords(key: string) {
    const field = named.find((n) => n.id === key);
    if (!field) return;
    const words = wordsForField(field, named);
    if (!words) return;
    const partner = amountWordsField(field, named);
    if (partner) {
      setValue(partner.id, words);
      setToast(`كُتب «${words}» في «${partner.label}»`);
    } else {
      void window.diwan.ui.copyText(words);
      setToast('لا حقلَ «كتابة» لهذا الرقم — نُسخت كلماته، فالصقها حيث تريد');
    }
  }

  /** حقلٌ من كتالوج المعاملات: يُعرَّف ويُدرج في الورقة حيث وقف المؤشّر. */
  function addCatalogField(c: CatalogField) {
    let key = c.label;
    for (let n = 2; doc.fields.some((f) => f.key === key); n++) key = `${c.label} ${n}`;
    const f = makeField({ key, label: c.label, source: c.source ?? null, role: c.role ?? null, required: c.role === 'name', ...(c.date ? { type: 'date' as const } : {}) });
    if (api.current) api.current.insertNewField(f);
    else setDoc((d) => ({ ...d, fields: [...d.fields, f] }));
    setFieldPickerOpen(false);
    setToast(`أُدرج الحقل «${c.label}» في الورقة`);
  }

  return {
    shown, effective, ownerName, needsGender, byRole, nameField, ownerHints, takeOwner, setValue, named, writeWords, fillFromCitizen,
    addCatalogField
  };
}
