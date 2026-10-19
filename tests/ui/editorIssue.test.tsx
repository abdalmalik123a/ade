// @vitest-environment jsdom
/**
 * إصدار الكتاب من المحرّر (`useEditorOutput`، D99): الأرشيف يحفظ ما كتبه الموظف لا ما حسبه البرنامج —
 * فـ«كتابة» الرقم الفارغة تُحسب عند كلّ رسم، و«كرّره» بعد تغيير الرقم يكتب كلماته الجديدة لا القديمة.
 * وكان D96 يحفظ ما طُبع (`effective`)، فخرج كتابٌ بالمبلغ ٣٠٠٠٠٠ وكتابته «مئتان وخمسون ألف».
 * والإلزامي يُفحص في الرئيسة على ما كُتب، فلا يُطلب فيه حقل «كتابة» يملؤه رقمه.
 */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorOutput } from '../../src/renderer/src/screens/editor/useEditorOutput';
import { emptyDoc, fieldRef, makeField, paragraph, run, type Doc } from '@shared/doc';
import { derivedWords } from '@shared/tafqeet';
import { readSavedLetter, NO_REGISTRY } from '@shared/letterDraft';
import type { IssueInput, OfficeSettings } from '@shared/api';
import { fakeDiwan, mount } from './mount';

const AMOUNT = 'المبلغ';
const WORDS = 'المبلغ كتابة';

function letter(): Doc {
  const d = emptyDoc();
  d.fields = [makeField({ key: AMOUNT, label: AMOUNT, required: true }), makeField({ key: WORDS, label: WORDS, required: true })];
  d.blocks = [paragraph([run('بمبلغ '), fieldRef(AMOUNT), run(' ('), fieldRef(WORDS), run(')')])];
  return d;
}

let sent: IssueInput | null = null;
beforeEach(() => {
  sent = null;
  fakeDiwan({
    documents: {
      issue: async (input: IssueInput) => {
        sent = input;
        return { serial: 'م/2026/1', printed: 'none' };
      }
    },
    clips: { repeated: async () => [] }
  });
});

/** يُصدر الورقة بقيمها كما يفعل المحرّر، ويعيد ما وصل إلى الرئيسة. */
async function issue(doc: Doc, values: Record<string, string>): Promise<IssueInput> {
  const effective = derivedWords(values, doc.fields.map((f) => f.key));
  let out: ReturnType<typeof useEditorOutput> | null = null;
  const noop = vi.fn();
  function Probe() {
    out = useEditorOutput({
      printRef: { current: null }, doc, docType: 'تأييد', ownerName: 'زينب علي حسن', values, effective,
      headLayout: null, resolvePrinted: (t) => t, regValues: { number: '', date: '' }, registry: NO_REGISTRY, checks: [],
      settings: { operatorName: '', serialPrefix: 'م', serialYear: 2026 } as unknown as OfficeSettings,
      activeTemplate: null, linkedCitizen: null, letterhead: null, letterheadId: null, byRole: () => '',
      savedLetter: () => ({ doc, values, registry: NO_REGISTRY, layout: null, docType: 'تأييد', owner: 'زينب علي حسن' }),
      learned: {}, needsGender: false, genderByHand: false, remember: noop, draft: null, setDraft: noop, dirty: { current: true },
      setExporting: noop, setBusy: noop, setError: noop, setToast: noop, setTrial: noop, setIssueOpen: noop, setIssued: noop,
      setRepeated: noop, setTemplates: noop, setTemplateOpen: noop, onIssued: undefined
    });
    return null;
  }
  mount(<Probe />);
  await act(async () => {
    await out!.issue({ copies: 1, copyKind: 'نسخة أصلية', print: false });
  });
  expect(sent).not.toBeNull();
  return sent!;
}

describe('إصدار الكتاب من المحرّر — ما يُحفظ في الأرشيف (D99)', () => {
  it('«كتابة» المحسوبة لا تُجمَّد: الأرشيف بما كُتب، و«كرّره» بعد تغيير المبلغ يكتب الجديد', async () => {
    const input = await issue(letter(), { [AMOUNT]: '250000', [WORDS]: '' });
    expect(input.values?.[WORDS] ?? '').toBe('');
    // والإلزامي: المبلغ يُفحص، وكتابته لا — يملؤها رقمها
    expect(input.required).toEqual([AMOUNT]);

    const again = readSavedLetter(input.values ?? {});
    expect(again).not.toBeNull();
    const reissued = derivedWords({ ...again!.values, [AMOUNT]: '300000' }, again!.doc.fields.map((f) => f.key));
    expect(reissued[WORDS]).toContain('ثلاثمئة ألف');
    expect(reissued[WORDS]).not.toContain('مئتان وخمسون');
  });

  it('«كتابة» كتبها الموظف بيده تُحفظ كما كتبها وتُفحص', async () => {
    const input = await issue(letter(), { [AMOUNT]: '250000', [WORDS]: 'مئتان وخمسون ألف دينار فقط' });
    expect(input.values?.[WORDS]).toBe('مئتان وخمسون ألف دينار فقط');
    expect(input.required).toEqual([AMOUNT, WORDS]);
  });
});
