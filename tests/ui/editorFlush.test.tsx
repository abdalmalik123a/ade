// @vitest-environment jsdom
/**
 * ما كُتب في المحرّر ولم يُرسل بعد (D143): D122 يؤجّل إرسال الوثيقة ٢٥٠ م.ث، فكان Ctrl+S والحفظ عند المغادرة يحفظان نسخةً أقدم
 * (`bookEditor`: أوزان الأعمدة حُفظت [1,1,1]). والطريق الواحد `flushEditors()`: `latestDoc` يستعجل المحرّر ثم يقرأ بلا انتظار رسم،
 * و`savedLetter` يمرّ به، والمغادرة تستعجله قبل سؤال «لم يُحفظ». والمحرّر هنا مسجَّلٌ كما يسجّله `usePmEditor`: إرساله `setDoc`.
 */
import { act, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorDocument } from '../../src/renderer/src/screens/editor/useEditorDocument';
import { useEditorDraft } from '../../src/renderer/src/screens/editor/useEditorDraft';
import { registerEditor } from '../../src/renderer/src/components/pageEditor/flushEditors';
import { emptyDoc, paragraph, run, type Doc } from '@shared/doc';
import { emptyLayout } from '@shared/letterhead';
import { NO_REGISTRY } from '@shared/letterDraft';
import { fakeDiwan, mount, settle, unmountAll } from './mount';

const letter = (text: string): Doc => ({ ...emptyDoc(), blocks: [paragraph([run(text)])] });
/** قيمٌ ثابتة كحالة الشاشة: فلا يُعاد موعد الحفظ التلقائي إلا بتغيّر الوثيقة. */
const NO_VALUES: Record<string, string> = {};
const savedText = (values: Record<string, string>) => JSON.stringify((JSON.parse(values.__doc!) as Doc).blocks);

type Api = {
  setDoc: (d: Doc) => void;
  latestDoc: () => Doc;
  live: () => Doc;
  saveDraft: (silent: boolean) => Promise<void>;
  dirty: { current: boolean };
};
let api: Api;
let saved: Record<string, string>[];
let unregister: () => void = () => undefined;

/** شاشة المحرّر بما يمسّ الوثيقة والمسودّة وحده — كما يجمعهما `EditorScreen`. */
function Screen() {
  const [doc, setDocState] = useState<Doc>(letter('كتاب تأييد'));
  // حالةٌ حقيقية كما في الشاشة: `saveDraft` يغيّرها قبل أن يقرأ، فلا يُحسب `setDoc` بعدها فورًا في React (والوثيقة حاضرةٌ بغيره).
  const [, setSaving] = useState(false);
  const dirty = useRef(false);
  const noop = vi.fn();
  const { setDoc, latestDoc, liveDoc } = useEditorDocument({
    dirty, setDocState, setSettings: noop, setLetterheads: noop, setTemplates: noop, setClips: noop, templateId: null, draftId: null,
    documentId: null, toast: null, setToast: noop, letterheads: [], letterheadId: null, setLetterheadId: noop, setLayoutDirty: noop,
    setLayout: noop, doc, layout: emptyLayout(), setSaveLayoutOpen: noop, setActiveTemplate: noop, baseDoc: { current: null },
    setDocType: noop, setError: noop, setValues: noop, setRegistry: noop, setOwner: noop, setDraft: noop, setLinkedCitizen: noop
  });
  const savedLetter = () => ({ doc: latestDoc(), values: NO_VALUES, registry: NO_REGISTRY, layout: null, docType: 'تأييد', owner: 'زينب علي حسن' });
  const { saveDraft } = useEditorDraft({
    draftId: null, draft: null, setDraft: noop, hasContent: true, setError: noop, setSaving, activeTemplate: null, linkedCitizen: null,
    draftName: 'تأييد', savedLetter, doc, values: NO_VALUES, setSavedAt: noop, dirty, setToast: noop, registry: NO_REGISTRY,
    layout: emptyLayout(), owner: 'زينب علي حسن', onLeave: undefined
  });
  api = { setDoc, latestDoc, live: () => liveDoc.current, saveDraft, dirty };
  return null;
}

/** محرّرٌ عنده ما لم يُرسل بعد: يرسله `setDoc` مرّةً كما يفعل `flushEmit` — باستعجالٍ، أو بموعده هو (ما يعود). */
function pending(text: string): () => void {
  let sent = false;
  const flush = () => {
    if (sent) return;
    sent = true;
    api.setDoc(letter(text));
  };
  unregister = registerEditor({ flush, pending: () => !sent });
  return flush;
}

beforeEach(async () => {
  saved = [];
  fakeDiwan({
    settings: { get: async () => null },
    letterheads: { list: async () => [] },
    templates: { list: async () => [] },
    clips: { list: async () => [] },
    drafts: {
      save: async (input: { values: Record<string, string> }) => {
        saved.push(input.values);
        return 7;
      }
    }
  });
  mount(<Screen />);
  await settle();
});
afterEach(() => unregister());

describe('ما كُتب ولم يُرسل يصل إلى من يقرأ الوثيقة (D143)', () => {
  it('latestDoc يستعجل المحرّر ويأخذ ما أرسله في الحدث نفسه — قبل أيّ رسم', () => {
    pending('كتاب تأييد عاجل');
    let read: Doc | null = null;
    act(() => {
      read = api.latestDoc();
    });
    expect(JSON.stringify(read!.blocks)).toContain('عاجل');
  });

  it('«احفظ» وCtrl+S (saveDraft) يحفظان ما كُتب للتوّ', async () => {
    pending('كتاب تأييد جدًّا');
    await act(() => api.saveDraft(false));
    expect(saved).toHaveLength(1);
    expect(savedText(saved[0]!)).toContain('جدًّا');
  });

  it('والمغادرة بعد حفظٍ ثم كتابةٍ لم تُرسل: تُحفظ الكتابة («لم يُحفظ» يُسأل بعد الاستعجال)', async () => {
    await act(() => api.saveDraft(true));
    expect(api.dirty.current).toBe(false);
    pending('كتاب تأييد قبل المغادرة');
    unmountAll();
    await settle();
    expect(saved).toHaveLength(2);
    expect(savedText(saved[1]!)).toContain('قبل المغادرة');
  });

  it('والحفظ التلقائي لا يستعجل في وسط الكتابة: ينتظر إرسال المحرّر ثم يحفظ آخرها', async () => {
    vi.useFakeTimers();
    try {
      act(() => api.setDoc(letter('كتاب تأييد')));
      const emit = pending('كتاب تأييد والكتابة جارية');
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      expect(saved).toHaveLength(0);
      expect(JSON.stringify(api.live().blocks)).not.toContain('جارية');
      act(() => emit());
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      expect(saved).toHaveLength(1);
      expect(savedText(saved[0]!)).toContain('جارية');
    } finally {
      vi.useRealTimers();
    }
  });
});
