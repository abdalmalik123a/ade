/**
 * الشبّاك — الشاشة اليومية، والزبون واقف.
 *
 * ثلاث خطوات لا غير: **اختر** البطاقات، ثم **املأ** ورقة إدخال واحدة فيها
 * اتحادُ ما تطلبه المختارات بلا تكرار — الاسم يُكتب مرّة فيملأ الخمس — ثم
 * **راجع** الأوراق مملوءةً ورقةً ورقة، ثم اطبع.
 *
 * والطباعة قرارٌ بعد المراجعة لا نتيجة تلقائية. وتُقيَّد الأوراق **معاملةً
 * واحدة** لزبون واحد، لكل ورقة رقم صادرها وبصمتها.
 *
 * ولا أداة تصميم هنا: من أراد أن يبني استمارة فمكانه الورشة.
 */
import { useEffect, useRef, useState } from 'react';
import { count } from '@shared/arabic';
import type { Attachment } from '@shared/api';
import { papersWord } from '../components/OutputBar';
import { useToast } from '../kit/useToast';
import { trapTab } from '../kit/trapTab';
import { CounterToast, PrintRunBar, RepeatOfBar, StepsHeader } from './service/CounterBars';
import { usePrintRun } from './service/usePrintRun';
import { useCounterLibrary } from './service/useCounterLibrary';
import { useSchoolFile } from './service/useSchoolFile';
import { useNewCitizen } from './service/useNewCitizen';
import { useParked } from './service/useParked';
import { useIssue } from './service/useIssue';
import CounterPick from './service/CounterPick';
import CounterBasket from './service/CounterBasket';
import CounterFill from './service/CounterFill';
import CounterReview from './service/CounterReview';
import DecisionBar from './service/DecisionBar';
import type { Loaded, RepeatOf, ServiceScreenProps, Step } from './service/types';
import { useCounterError } from './service/useCounterError';
import { useCounterFields } from './service/useCounterFields';
import { useFillLoader } from './service/useFillLoader';
import { useCitizenFill } from './service/useCitizenFill';
import { useFillDerived } from './service/useFillDerived';
import { useAfterIssue } from './service/useAfterIssue';
import { useCustomerReturn } from './service/useCustomerReturn';
import { useCounterChecks } from './service/useCounterChecks';
import CounterDialogs from './service/CounterDialogs';

/** المعاملة المعلّقة، وخصائص الشاشة و«كرّره» — أنواعها في `service/types.ts` (وتقرؤها «قيد العمل» وApp). */
export type { Parked, RepeatRequest, ServiceScreenProps } from './service/types';

export default function ServiceScreen({ onIssued, active = true, repeat = null, onOpenTool, onOpenFile, onOpenActivation, resumeRequest = null, customerRequest = null, settingsKey }: ServiceScreenProps) {
  const [step, setStep] = useState<Step>('pick');
  const [picked, setPicked] = useState<number[]>([]);
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  /** العدد على الكتاب كما أعطاه الزبون — وفارغًا تكتبه الجهة بيدها. لا رقم المكتب (§١). */
  const [letterNo, setLetterNo] = useState('');
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const { toast, say, dismiss } = useToast(3200);
  // ── الخطأ بالعربية يبقى حتى يُغلق، ومعه «افتح التفعيل» — `service/useCounterError.ts` ──
  const { sayError } = useCounterError({ say, onOpenActivation, dismiss });
  const [citizenId, setCitizenId] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);

  /** رسالة الزبون من واتساب تُلصق كما هي فتتوزّع على الحقول. */
  const [pasteOpen, setPasteOpen] = useState(false);
  /** استمارةٌ مطبوعةٌ مسبقًا في الطابعة: تُطبع القيم وحدها في فراغاتها. */
  const [valuesOnly, setValuesOnly] = useState(false);
  /** النسخ عند الشبّاك (د٣): «ثلاث نسخ» ضغطةٌ واحدة لا ثلاث عمليات — والأصل ١، ويعود إليه للزبون التالي. */
  const [copies, setCopies] = useState(1);
  /**
   * «نسخة عن …» (د٤): الكتاب الأصل، و«وأبطل الأصل» — **غير مؤشَّرة افتراضيًّا** — بسببها. فإن أُشِّرت أُبطل الأصل بعد
   * نجاح إصدار هذه النسخة: كتابٌ خاطئ يُصحَّح بخطوةٍ واحدة لا بتكرارٍ ثم إبطالٍ في الأرشيف وسببٍ يُكتب مرّتين.
   */
  const [repeatOf, setRepeatOf] = useState<RepeatOf | null>(null);
  /** الدمج: سطرٌ لكل اسم، ولكلٍّ معاملتُه وأوراقُه. */
  const [merge, setMerge] = useState(false);
  const [names, setNames] = useState('');

  const sheets = useRef(new Map<number, HTMLDivElement | null>());

  // ── مكتبة الشبّاك: النماذج والبحث والتصنيف — `service/useCounterLibrary.ts` ──
  const { items, categories, activeCategory, setActiveCategory, letterheads, settings, query, setQuery, topFavorites, shown, ordered } =
    useCounterLibrary({ active, settingsKey });
  const searchRef = useRef<HTMLInputElement | null>(null);

  /**
   * الشبّاك بلوحة المفاتيح (د١١): الكتابة تصفّي، وEnter تملأ، وEsc تمحو البحث. والأرقام ١–٩ التي
   * كانت تختار البطاقات زالت (ن١٥): اختصارٌ لا يعرفه الموظف من Windows ولا Word.
   */
  useEffect(() => {
    if (!active || step !== 'pick') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const inSearch = target === searchRef.current;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (typing && !inSearch) return;
      if (e.key === 'Enter' && picked.length > 0) {
        e.preventDefault();
        void goFill();
        return;
      }
      if (e.key === 'Escape' && query) {
        setQuery('');
        return;
      }
      // حرفٌ يُكتب في أيّ موضع: يذهب إلى البحث.
      if (!inSearch && e.key.length === 1 && e.key.trim()) searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Enter لا تعمل إلا بعد اختيار بطاقة، والاختيار يغيّر `picked` فيُعاد التسجيل بـ`goFill` جديدة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, picked, query]);

  // Tab في «املأ» و«راجع» يدور على الورقة وشريط القرار معًا ولا يخرج من الشاشة (D117، D138) — `trapTab` في `kit/trapTab.ts`.
  const trapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!active || step === 'pick') return;
    const onTab = (e: KeyboardEvent) => trapTab(e, trapRef.current);
    window.addEventListener('keydown', onTab);
    return () => window.removeEventListener('keydown', onTab);
  }, [active, step]);

  // ── الحقول والجنس والقيم كما تُطبع — `service/useCounterFields.ts` ──
  const { fields, needsGender, genderByHand, learned, setGenderByHand, asPrinted, remember, setGenderReview, effective, setMergePicker, mergePicker, genderReview } = useCounterFields({
    loaded, values
  });

  const toggle = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // ── تحميل المختارات عند الانتقال إلى «املأ» — `service/useFillLoader.ts` ──
  const { goFill } = useFillLoader({ picked, setBusy, items, letterheads, setLoaded, setStep, say });

  // ── «ملفّ المدارس»: «هات المدرسة» والعام الدراسي — `service/useSchoolFile.ts` ──
  const { schoolPicker, setSchoolPicker, schools, schoolFilled, schoolOn, schoolNameKey, fillFromSchool } =
    useSchoolFile({ settings, fields, step, values, setValues, say });

  // ── F2: المواطن من السجلّ يملأ حقوله — `service/useCitizenFill.ts` ──
  const { applyCitizen } = useCitizenFill({ setCitizenId, setValues, fields, setPicker, say });

  // ── صاحب العلاقة والناقص ورأس الورقة وأسماء الدمج — `service/useFillDerived.ts` ──
  const { byRole, citizenName, nameField, rows, missing, printsRegistry, registry, resolveHead } = useFillDerived({
    fields, values, letterNo, loaded, needsGender, genderByHand, learned, setValues, names, citizenId
  });

  // ── طباعة ما صدر (خطة Production، ٢٫٣): ورقةً ورقة بسجلٍّ يُستأنف — `service/usePrintRun.ts` ──
  const { printRun, printIssued, resumePrint, dropPrint } = usePrintRun(say);

  /** «ورقتان» — أو «ورقتان × ٣ نسخ» حين تُطبع نسخ. */
  const papersWithCopies = (papers: number, n: number) => (n > 1 ? `${papersWord(papers)} × ${count(n, 'نسخة')}` : papersWord(papers));

  /** ورقة مستمسكات صاحب العلاقة (خطة Production، المرحلة ٥) — من ملفّه في السجل والزبون واقف. */
  const [idSheet, setIdSheet] = useState<{ name: string; attachments: Attachment[] } | null>(null);
  async function openIdSheet() {
    if (citizenId === null) return;
    const detail = await window.diwan.citizens.get(citizenId);
    if (detail) setIdSheet({ name: detail.fullName, attachments: detail.attachments });
  }

  // ── ما خرج الآن: «أعد الطبع» وPDF و«شيءٌ آخر لنفس الزبون» — `service/useAfterIssue.ts` ──
  const { setAfter, after, reprintAfter, pdfAfter, sameCustomer } = useAfterIssue({
    printIssued, say, setValues, setCitizenId, setGenderByHand
  });

  /** معاملةٌ جديدة: كل ما كُتب يُمحى، والنماذج المختارة معه. */
  function reset() {
    setStep('pick');
    setPicked([]);
    setLoaded([]);
    setValues({});
    schoolFilled.current = {};
    setLetterNo('');
    setGenderByHand(false);
    setCitizenId(null);
    setNames('');
    setMerge(false);
    setValuesOnly(false);
    setCopies(1);
    setRepeatOf(null);
    setAt(0);
  }

  // ── الزبون الجديد إلى السجل — `service/useNewCitizen.ts` ──
  const { newCitizen, setNewCitizen, offerToRegistry, saveNewCitizen } = useNewCitizen({ fields, values, byRole, citizenName, say, sayError, setAfter });

  // ── «كرّره» من الأرشيف ─────────────────────────────────────────────
  // «اطبع لي مثل كتاب أمس وبدّل الاسم»: تُفتح نماذج تلك المعاملة بقيمها، والجارية
  // — إن كان فيها شيء — تُعلَّق لا تُمحى. والإصدار برقمٍ جديد، والأصل كما صدر.
  useEffect(() => {
    if (!repeat) return;
    if (loaded.length > 0) park();
    setPicked(repeat.templateIds);
    void goFill(repeat.templateIds).then(() => {
      setValues(repeat.values);
      setRepeatOf({ id: repeat.id, serial: repeat.serial, voidIt: false, reason: 'خطأ في الكتابة' });
      say(`نسخة عن ${repeat.serial} — بدّل ما يلزم ثم اطبع، والأصل يبقى في السجلّ كما خرج`);
    });
    // مرّةً لكلّ «نسخة عن» بمفتاحها
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat?.key]);

  // ── المعاملات المعلّقة: تُعلَّق وتُستأنف وتُلغى بـ«تراجع» — `service/useParked.ts` ──
  const { parked, park, resume, discardTransaction, dropParked } = useParked({
    say, dismiss, citizenName, loaded, step, values, letterNo, citizenId, merge, names, valuesOnly, genderByHand, reset, goFill,
    setStep, setPicked, setValues, setLetterNo, setCitizenId, setMerge, setNames, setValuesOnly, setGenderByHand, setAt, resumeRequest
  });

  // ── الزبون عائدًا من أداة — `service/useCustomerReturn.ts` ──
  useCustomerReturn({ customerRequest, setCitizenId, step, fields, applyCitizen, say });

  // ── الإصدار: المعاملة والدمج ثم الطباعة — `service/useIssue.ts` ──
  const { issue, issueMerged } = useIssue({
    settings, loaded, fields, values, asPrinted, sheets, byRole, citizenName, citizenId, copies, merge, nameField, rows, valuesOnly,
    genderByHand, needsGender, learned, remember, setGenderReview, repeatOf, setAfter, papersWithCopies, printIssued, offerToRegistry,
    setNewCitizen, reset, setBusy, onIssued, say, sayError
  });

  // ── قبل الطباعة: الإملاء والجنس وما يمنع الإصدار — `service/useCounterChecks.ts` ──
  const { typedSpelling, templateSpelling, current, genderUnsure, blocked } = useCounterChecks({
    values, loaded, at, needsGender, citizenName, learned, merge, genderByHand, rows, missing
  });

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-screen="service">
      <div ref={trapRef} className="h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        {/* الخطوات الثلاث */}
        <StepsHeader step={step} />

        {/* في «اختر» صفٌّ: النماذج تمرّ يمينًا، و«سلّة النماذج» يسارًا لا تمرّ (D157، ر175). */}
        <div className={`flex-1 min-h-0 p-space-lg ${step === 'pick' ? 'flex gap-3.5' : 'overflow-y-auto'}`}>
          {/* ١ — اختر */}
          {step === 'pick' && (
            <div className="flex-1 min-w-0 overflow-y-auto px-1 pt-1 pb-space-md">
              <CounterPick
                after={after}
                setAfter={setAfter}
                reprintAfter={reprintAfter}
                pdfAfter={pdfAfter}
                sameCustomer={sameCustomer}
                settings={settings}
                query={query}
                setQuery={setQuery}
                items={items}
                categories={categories}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                topFavorites={topFavorites}
                shown={shown}
                ordered={ordered}
                picked={picked}
                toggle={toggle}
                searchRef={searchRef}
                citizenId={citizenId}
                onOpenTool={onOpenTool}
                onOpenFile={onOpenFile}
                active={active}
                step={step}
                newCitizen={newCitizen}
                setNewCitizen={setNewCitizen}
                saveNewCitizen={saveNewCitizen}
              />
            </div>
          )}
          {step === 'pick' && <CounterBasket picked={picked} items={items} toggle={toggle} goFill={goFill} busy={busy} parked={parked} resume={resume} dropParked={dropParked} />}

          {/* ٢ — املأ */}
          {step === 'fill' && (
            <CounterFill
              loaded={loaded}
              fields={fields}
              values={values}
              setValues={setValues}
              effective={effective}
              citizenId={citizenId}
              setPicker={setPicker}
              setPasteOpen={setPasteOpen}
              openIdSheet={openIdSheet}
              nameField={nameField}
              merge={merge}
              setMerge={setMerge}
              names={names}
              setNames={setNames}
              rows={rows}
              setMergePicker={setMergePicker}
              printsRegistry={printsRegistry}
              letterNo={letterNo}
              setLetterNo={setLetterNo}
              needsGender={needsGender}
              genderByHand={genderByHand}
              setGenderByHand={setGenderByHand}
              schoolOn={schoolOn}
              setSchoolPicker={setSchoolPicker}
              schoolNameKey={schoolNameKey}
              schools={schools}
              fillFromSchool={fillFromSchool}
              schoolFilled={schoolFilled}
              registry={registry}
              resolveHead={resolveHead}
            />
          )}

          {/* ٣ — راجع */}
          <CounterReview
            step={step}
            typedSpelling={typedSpelling}
            templateSpelling={templateSpelling}
            setValues={setValues}
            merge={merge}
            rows={rows}
            loaded={loaded}
            at={at}
            setAt={setAt}
            current={current}
            sheets={sheets}
            valuesOnly={valuesOnly}
            effective={effective}
            registry={registry}
            resolveHead={resolveHead}
          />
        </div>

        {/* «نسخة عن …» (د٤): والأصل يبقى كما خرج — إلا أن يُختار إبطاله بسببه. */}
        {repeatOf && step !== 'pick' && !merge && <RepeatOfBar repeatOf={repeatOf} setRepeatOf={setRepeatOf} />}

        {/* شريط القرار — وفي «اختر» لا شريط: «املأ» في «سلّة النماذج» (D157). */}
        {step !== 'pick' && (
          <DecisionBar
            step={step}
            setStep={setStep}
            busy={busy}
            setAt={setAt}
            park={park}
            discardTransaction={discardTransaction}
            valuesOnly={valuesOnly}
            setValuesOnly={setValuesOnly}
            merge={merge}
            rows={rows}
            loaded={loaded}
            missing={missing}
            genderUnsure={genderUnsure}
            citizenName={citizenName}
            setGenderByHand={setGenderByHand}
            setValues={setValues}
            settings={settings}
            copies={copies}
            setCopies={setCopies}
            blocked={blocked}
            issue={issue}
          />
        )}
      </div>

      <CounterDialogs
        picker={picker}
        setPicker={setPicker}
        applyCitizen={applyCitizen}
        schoolPicker={schoolPicker}
        schools={schools}
        setSchoolPicker={setSchoolPicker}
        fillFromSchool={fillFromSchool}
        schoolOn={schoolOn}
        mergePicker={mergePicker}
        setMergePicker={setMergePicker}
        rows={rows}
        setNames={setNames}
        say={say}
        genderReview={genderReview}
        learned={learned}
        setGenderReview={setGenderReview}
        remember={remember}
        issueMerged={issueMerged}
        pasteOpen={pasteOpen}
        setPasteOpen={setPasteOpen}
        fields={fields}
        values={values}
        setValues={setValues}
        idSheet={idSheet}
        setIdSheet={setIdSheet}
      />

      {printRun && <PrintRunBar printRun={printRun} resumePrint={resumePrint} dropPrint={dropPrint} />}

      {toast && <CounterToast toast={toast} dismiss={dismiss} />}
    </main>
  );
}
