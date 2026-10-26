import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteKey } from '@shared/routes';
import type { LicenseStatus, OfficeSettings, PrinterInfo, SidebarCounts } from '@shared/api';
import Sidebar from './shell/Sidebar';
import Header from './shell/Header';
import Onboarding, { type StartAction } from './shell/Onboarding';
import ServiceScreen, { type RepeatRequest } from './screens/ServiceScreen';
import { NO_TARGET, renderScreen, type DesignRequest, type EditorHandle, type EditorStatus, type EditorTarget, type PapersHandle, type PdfIncoming, type PhotoIncoming, type WordIncoming } from './shell/routeScreens';
import { openCounterTool, openInboxFile } from './shell/counterTools';
import { tabBarFor } from './shell/TabBar';
import IdDocsDialog from './screens/idSheet/IdDocsDialog';
import AboutDialog from './components/AboutDialog';
import WhatsNewDialog from './components/WhatsNewDialog';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorBar from './components/ErrorBar';
import { ToolNavProvider, useCustomerName } from './components/ToolFrame';
import ResumePrintDialog from './components/ResumePrintDialog';
import PrintChooser from './components/PrintChooser';
import NotificationsBell from './components/NotificationsBell';
import PageHelp from './components/PageHelp';
import Overview from './components/Overview';
import { overviewSteps } from '@shared/overview';
import { setHijriOffset } from '@shared/dates';
import type { TodayAgenda } from '@shared/api';
import { isCombo, shortcut } from '@shared/shortcuts';
import ClosingOverlay from './shell/ClosingOverlay';
import NoticeHost from './kit/NoticeHost';
import ConfirmHost from './kit/ConfirmHost';
import { canLeaveAll, hasUnsaved, onUnsavedLabel } from './kit/leaveGuard';
import { checkFirstDocumentBackupPrompt } from './lib/backupPrompt';

export default function App() {
  /**
   * الشبّاك هو ما يُفتح عليه التطبيق.
   *
   * كان المحرّر، وهو أداةُ مصمّم: يفتح المكتب برنامجه صباحًا فيجد ورقةً بيضاء
   * وأدوات تأليف، والزبون واقف. والشاشة اليومية هي «اختر واملأ واطبع».
   */
  const [route, setRoute] = useState<RouteKey>('service');
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  // و`worked` قبل أن تُقرأ العدّادات: لا يظهر «؟» لحظةً لمكتبٍ عمل.
  const [counts, setCounts] = useState<SidebarCounts>({ templates: 0, issuedToday: 0, orders: { open: 0, dueToday: 0, overdue: 0 }, pending: 0, worked: true });
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void window.diwan.ui.info().then((i) => setVersion(i.version));
  }, []);

  const [search, setSearch] = useState('');
  /** ملفّ مواطنٍ يُفتح من البحث الشامل. */
  const [citizenFocus, setCitizenFocus] = useState<{ key: number; citizenId: number } | null>(null);
  const [target, setTarget] = useState<EditorTarget>(NO_TARGET);
  /** ما تُفتح به التصاميم من غيرها: تصميم طلبٍ بقائمته، أو المعرض على جهة. */
  const [designRequest, setDesignRequest] = useState<DesignRequest | null>(null);
  /** ملفٌّ من «الملفّات» في الشبّاك، في طريقه إلى أداته (المرحلة ٢، ن٨). */
  const [pdfIncoming, setPdfIncoming] = useState<PdfIncoming | null>(null);
  const [photoIncoming, setPhotoIncoming] = useState<PhotoIncoming | null>(null);
  const [wordIncoming, setWordIncoming] = useState<WordIncoming | null>(null);
  /** «استأنف» من قيد العمل: معاملةٌ معلّقة تُفتح في الشبّاك (المرحلة ٣). */
  const [resumeRequest, setResumeRequest] = useState<{ key: number; parkedKey: number } | null>(null);
  /** طلبٌ جديد من بطاقة الشبّاك (د٨) — بزبون الشبّاك الحاضر إن كان. */
  const [orderRequest, setOrderRequest] = useState<{ key: number; citizenId: number | null } | null>(null);
  /** الزبون الذي فُتحت له الأداة من الشبّاك (المرحلة ٥ — ن٢)، وعودته إليه بـ«شيءٌ آخر لنفس الزبون». */
  const [toolCustomer, setToolCustomer] = useState<number | null>(null);
  const [customerRequest, setCustomerRequest] = useState<{ key: number; citizenId: number } | null>(null);
  const [libraryRequest, setLibraryRequest] = useState<{ key: number; action: StartAction } | null>(null);
  const toolCustomerName = useCustomerName(toolCustomer);
  /** «كرّره» لكتابٍ صدر من الشبّاك: يُفتح فيه لا في المحرّر. */
  const [repeatRequest, setRepeatRequest] = useState<RepeatRequest | null>(null);
  const [idDuplexOpen, setIdDuplexOpen] = useState(false);
  const [idSheetOpen, setIdSheetOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  /** رُحّلت البيانات من إصدارٍ أقدم في هذا الإقلاع: «ما الجديد» مرّةً (خطة Production، ٧٫١). */
  const [whatsNew, setWhatsNew] = useState<{ from: string; to: string } | null>(null);
  /** المدّة التجريبية أو التفعيل (خطة Production، ٦٫٢) — تُسأل عند الإقلاع وكلّ عشر دقائق وبعد كلّ تغيير. */
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [editorStatus, setEditorStatus] = useState<EditorStatus>({ transaction: null, busy: false, exporting: false });

  /** أدوات المحرر التي يناديها الشريط العلوي — تُسجَّل ما دام المحرر معروضًا. */
  const editorRef = useRef<EditorHandle | null>(null);
  /** ومثلها لشاشة الأسئلة: أزرار الشريط تعمل على المعروض لا تقفز به. */
  const papersRef = useRef<PapersHandle | null>(null);

  const refresh = useCallback(async () => {
    const [s, c, p] = await Promise.all([
      window.diwan.settings.get(),
      window.diwan.counts.sidebar(),
      window.diwan.printers.list()
    ]);
    setSettings(s);
    setCounts(c);
    setPrinters(p);
    void window.diwan.license.status().then(setLicense).catch(() => undefined);
    // «التنبيهات» تُقرأ مع العدّادات: بعد كلّ انتقالٍ وإصدار.
    void window.diwan.today.agenda().then(setAgenda).catch(() => undefined);
    // حجم الواجهة الذي اختاره المكتب — يُطبَّق عند كل إقلاع.
    window.diwan.ui.setZoom(s.uiScale);
    // وإزاحة الهجري: كلّ تاريخٍ هجريّ يُكتب بعدها يأخذها (الشبّاك والمحرّر وأداة التاريخ).
    setHijriOffset(s.hijriOffset);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void window.diwan.update.whatsNew().then(setWhatsNew).catch(() => undefined);
  }, []);

  // اليوم يتبدّل والبرنامج مفتوح: الأيّام الباقية تُحسب من جديد.
  useEffect(() => {
    const t = window.setInterval(() => void window.diwan.license.status().then(setLicense).catch(() => undefined), 10 * 60_000);
    return () => window.clearInterval(t);
  }, []);

  /**
   * «التنبيهات» (د٧) في الشريط العلوي: جرسٌ برقمه يُفتح متى شاء الموظف — وكانت نافذة «ما ينتظرك اليوم» تُقاطعه كلّ صباح
   * عند الإقلاع (بقرار المالك ٦ تشرين الأول).
   */
  const [agenda, setAgenda] = useState<TodayAgenda | null>(null);

  /**
   * «نظرة عامة على ديوان» (الموجة ٢): مرّةً بعد معالج البداية تمرّ على الصفحات ثم وجهته (`after`: «استورد مجلدي»…). ومن
   * «التنبيهات» و«؟» متى أُريدت — في مكانها (`stay`): الموظف قد يكون في وسط كتابٍ أو ملفّ، فلا تغادر صفحته.
   */
  const [overview, setOverview] = useState<{ stay: boolean; after?: () => void } | null>(null);
  /** ملخّص الأسبوع في «التنبيهات» يفتح «السجلّ» على هذا الأسبوع. */
  const [archiveRequest, setArchiveRequest] = useState<{ key: number; period: 'week' } | null>(null);

  // «ما لم يُحفظ» في الشاشات التي لا تحرسها مسودّة يصل العملية الرئيسة، فيسأل إغلاق البرنامج (ج١).
  useEffect(() => onUnsavedLabel((label) => window.diwan.ui.setUnsaved(label)), []);

  const routeNow = useRef<RouteKey>(route);
  routeNow.current = route;

  // العدّادات تتغيّر بإصدار كتاب أو إضافة نموذج.
  const navigate = useCallback(
    (key: RouteKey) => {
      const go = () => {
        setRoute(key);
        void refresh();
      };
      // مغادرة شاشةٍ فيها عملٌ لم يُحفظ ولا تحرسه مسودّة: يُسأل الموظف أوّلًا (ج١).
      if (key !== routeNow.current && hasUnsaved()) {
        void canLeaveAll().then((ok) => {
          if (ok) go();
        });
        return;
      }
      go();
    },
    [refresh]
  );

  /** النظرة العامة من «التنبيهات» أو «؟» — في مكانها. */
  const startOverview = () => setOverview({ stay: true });

  const openEditor = useCallback(
    (patch: Partial<EditorTarget>) => {
      setTarget({ ...NO_TARGET, ...patch });
      navigate('editor');
    },
    [navigate]
  );

  /** التصاميم بطلب: تصميمٌ أو مسودّته أو استيرادٌ أو جهة — والمفتاح يتغيّر فيُنفَّذ ولو تكرّر. */
  const openDesigns = (req: Omit<DesignRequest, 'key'>) => {
    setDesignRequest({ key: Date.now(), ...req });
    navigate('designs');
  };

  /** كتابٌ صدر يُكرَّر من حيث كُتب: المحرّر لكتبه، والشبّاك لمعاملاته. */
  const repeatDocument = useCallback(
    async (id: number) => {
      const src = await window.diwan.documents.repeatSource(id);
      if (src?.kind === 'counter' && src.templateIds.length > 0) {
        setRepeatRequest({ key: Date.now(), id, serial: src.serial, templateIds: src.templateIds, values: src.values });
        navigate('service');
      } else {
        openEditor({ documentId: id });
      }
    },
    [navigate, openEditor]
  );

  const handleIssued = useCallback(() => {
    void refresh();
    void checkFirstDocumentBackupPrompt(navigate);
  }, [refresh, navigate]);

  /**
   * `Ctrl+P` يطبع المعروض: الكتاب في المحرّر، والورقة في الأسئلة.
   *
   * وفي غيرهما لا يفعل شيئًا — كان ينقل إلى المحرّر، فيضغطه الموظف في التصاميم
   * أو الشبّاك فيجد نفسه في كتابٍ رسمي لم يطلبه.
   */
  const handlePrint = useCallback(() => {
    if (route === 'papers' && papersRef.current) papersRef.current.print();
    else if (route === 'editor' && editorRef.current) editorRef.current.print();
  }, [route]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // بموضع المفتاح لا بحرفه — فتعمل ولوحة المفاتيح عربية (shared/shortcuts.ts).
      if (isCombo(e, shortcut('print').combo)) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePrint]);


  /** تبويبات الوجهة في رأس الشاشة (`shell/TabBar.tsx`). */
  const tabBar = tabBarFor({ route, setSearch, navigate });

  /** الإطار الواحد للأداة: الزبون الذي فُتحت له، والرجوع إلى الشبّاك (المرحلة ٥). */
  const toolNav = {
    customer: toolCustomer === null ? null : { id: toolCustomer, name: toolCustomerName },
    printRoles: settings?.printRoles ?? null,
    back: () => navigate('service'),
    sameCustomer: () => {
      if (toolCustomer !== null) setCustomerRequest({ key: Date.now(), citizenId: toolCustomer });
      navigate('service');
    }
  };

  return (
    <>
      {settings && !settings.onboarded && (
        <Onboarding
          printers={printers}
          settings={settings}
          onDone={(patch, go, action) => {
            void window.diwan.settings.set(patch).then((s) => {
              setSettings(s);
              window.diwan.ui.setZoom(s.uiScale);
            });
            // «ابدأ جاهزًا»: المكتبة تفتح استيرادها مباشرة — المجلّد أو الحزمة (المرحلة ٥).
            const start = () => {
              if (action) setLibraryRequest({ key: Date.now(), action });
              if (go) navigate(go);
            };
            // أكمل المعالج: النظرة العامة مرّةً ثم وجهته. ومن تخطّاه لم يُرد إرشادًا — والنظرة في «التنبيهات».
            if (go) setOverview({ stay: false, after: start });
            else start();
          }}
        />
      )}
      <Sidebar
        active={route}
        // السكّة تفتح الشاشة نظيفة — لا يُعاد فتح تصميم طلبٍ سابق ولا بحثٍ سابق في الأرشيف.
        onNavigate={(key) => {
          setDesignRequest(null);
          setSearch('');
          // من السكّة لا زبون: الأداة تُفتح لعملٍ لا لشخص.
          setToolCustomer(null);
          navigate(key);
        }}
        onAbout={() => setAboutOpen(true)}
        counts={counts}
        version={version}
        officeName={settings?.officeName ?? ''}
      />
      <div className="pr-20">
        <Header
          // النتائج تحت الحقل في مكانها؛ والأرشيف بالبحث كاملًا حين يُطلب (Enter، أو كتابٌ من النتائج).
          onSearchArchive={(value) => {
            setSearch(value);
            navigate('archive');
          }}
          onOpenCitizen={(id) => {
            setCitizenFocus({ key: Date.now(), citizenId: id });
            navigate('citizens');
          }}
          onOpenTemplate={(id) => openEditor({ templateId: id })}
          license={license}
          onLicense={() => navigate('settings')}
          tools={
            <>
              {/* «؟» الصفحة بارزٌ حتى أوّل عملٍ يخرج من المكتب، ثم «مساعدة» صغيرةٌ دائمة (البند ٨). */}
              <PageHelp route={route} quiet={counts.worked} onOverview={startOverview} />
              <NotificationsBell
                agenda={agenda}
                officeName={settings?.officeName ?? ''}
                onNavigate={navigate}
                onOverview={startOverview}
                onWeek={() => {
                  setArchiveRequest({ key: Date.now(), period: 'week' });
                  navigate('archive');
                }}
              />
            </>
          }
          context={
            // سياق المحرّر وحده: الكتاب الجاري، وتبديله من المكتبة.
            route === 'editor' ? (
              <>
                <span className="flex items-center gap-space-xs px-space-md h-10 rounded-btn border border-outline-variant bg-surface-container-lowest text-on-surface shadow-low">
                  <span className="material-symbols-outlined text-secondary text-[18px]">article</span>
                  <span className="font-label-md text-label-md font-semibold truncate max-w-[220px]">
                    {editorStatus.transaction ?? 'لم يُختر نموذج'}
                  </span>
                </span>
                <button
                  className="flex items-center gap-space-xs px-space-md h-10 rounded-btn border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md shadow-low"
                  type="button"
                  onClick={() => navigate('templates')}
                >
                  <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                  نموذجٌ آخر
                </button>
              </>
            ) : (
              tabBar
            )
          }
        />
        {/* الشبّاك يبقى مركّبًا مخفيًّا حين يُترك: المعاملة الجارية لا تضيع بالانتقال. */}
        <div className={route === 'service' ? '' : 'hidden'}>
          <ErrorBoundary key="service">
            <ServiceScreen
              active={route === 'service'}
              repeat={repeatRequest}
              resumeRequest={resumeRequest}
              customerRequest={customerRequest}
              onOpenActivation={() => navigate('settings')}
              settingsKey={settings}
              onIssued={handleIssued}
              onOpenTool={(t, citizenId) =>
                openCounterTool(t, citizenId, { setToolCustomer, openEditor, setOrderRequest, navigate, setIdDuplexOpen, setIdSheetOpen })
              }
              onOpenFile={(f, as) => openInboxFile(f, as, { setPdfIncoming, setPhotoIncoming, setWordIncoming, navigate })}
            />
          </ErrorBoundary>
        </div>
        <ToolNavProvider value={toolNav}>
          {route !== 'service' && (
            <ErrorBoundary key={route}>
              {renderScreen({
                route, navigate, refresh, editorRef, papersRef, target, setEditorStatus, openEditor, openDesigns, repeatDocument,
                search, setSearch, citizenFocus, setCitizenFocus, wordIncoming, libraryRequest, archiveRequest, designRequest,
                orderRequest, setResumeRequest, photoIncoming, pdfIncoming, onIssued: handleIssued
              })}
            </ErrorBoundary>
          )}
        </ToolNavProvider>
      </div>

      <ErrorBar />

      {/* الإغلاق يُفرغ ما لم يُحفظ أوّلًا، ويقول إنّه يأخذ النسخة التلقائية. */}
      <ClosingOverlay />

      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {whatsNew && <WhatsNewDialog from={whatsNew.from} to={whatsNew.to} onClose={() => setWhatsNew(null)} />}

      {/* «ورقة المستمسكات» (S47) من بطاقتي الشبّاك: «المستمسكات على ورقة» و«استنساخ هوية». */}
      {(idSheetOpen || idDuplexOpen) && (
        <ToolNavProvider value={toolNav}>
          <IdDocsDialog
            start={idSheetOpen ? 'id-sheet' : 'id-copy'}
            onClose={() => {
              setIdSheetOpen(false);
              setIdDuplexOpen(false);
            }}
          />
        </ToolNavProvider>
      )}

      {/* دفعةٌ انقطعت طباعتها (الكهرباء) تُعرض في الإقلاع ليُستأنف منها. */}
      <ResumePrintDialog />

      {/* أسئلة «أتحذف؟» و«اترك بلا حفظ؟» من أيّ مكان (kit/ask.ts)، وكلمةٌ عابرة تبقى بعد مغادرة شاشتها (kit/notice.ts). */}
      <ConfirmHost />
      <NoticeHost />

      {/* «على أيّ طابعة؟» — تسأله الشاشات حين للدور طابعتان أو طلب المكتب أن يُسأل. */}
      <PrintChooser />

      {overview && (
        <Overview
          steps={overviewSteps(counts.worked, overview.stay)}
          onNavigate={overview.stay ? undefined : navigate}
          onClose={() => {
            const after = overview.after;
            setOverview(null);
            after?.();
          }}
        />
      )}

    </>
  );
}
