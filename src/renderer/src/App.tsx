import { useCallback, useEffect, useRef, useState } from 'react';
import { ROUTES, type RouteKey } from '@shared/routes';
import type { LicenseStatus, OfficeSettings, PrinterInfo, SidebarCounts } from '@shared/api';
import Sidebar from './shell/Sidebar';
import Header from './shell/Header';
import Onboarding, { type StartAction } from './shell/Onboarding';
import ServiceScreen, { type RepeatRequest } from './screens/ServiceScreen';
import EditorScreen, { type EditorHandle } from './screens/EditorScreen';
import ArchiveScreen from './screens/ArchiveScreen';
import CitizensScreen from './screens/CitizensScreen';
import TemplatesScreen, { type WordIncoming } from './screens/TemplatesScreen';
import PapersScreen, { type PapersHandle } from './screens/PapersScreen';
import DesignsScreen, { type DesignRequest } from './screens/DesignsScreen';
import OrdersScreen from './screens/OrdersScreen';
import ClientsScreen from './screens/ClientsScreen';
import PhotosScreen, { type PhotoIncoming } from './screens/PhotosScreen';
import PdfScreen, { type PdfIncoming } from './screens/PdfScreen';
import LetterheadScreen from './screens/LetterheadScreen';
import AuditScreen from './screens/AuditScreen';
import SettingsScreen from './screens/SettingsScreen';
import IdDuplexDialog from './screens/IdDuplexDialog';
import IdSheetDialog from './components/IdSheetDialog';
import AboutDialog from './components/AboutDialog';
import WhatsNewDialog from './components/WhatsNewDialog';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorBar from './components/ErrorBar';
import { ToolNavProvider, useCustomerName } from './components/ToolFrame';
import ResumePrintDialog from './components/ResumePrintDialog';
import PrintChooser from './components/PrintChooser';
import TodayPanel from './components/TodayPanel';
import { agendaHasItems } from '@shared/agenda';
import { tabsOf } from './lib/destinations';
import type { TodayAgenda } from '@shared/api';

/** يومُ آخر عرضٍ لـ«ما ينتظرك اليوم» — تفضيلٌ لهذا الجهاز لا بيانات. */
const TODAY_SEEN = 'diwan.todaySeen';
import { isCombo, shortcut } from '@shared/shortcuts';
import { flushBeforeClose } from './lib/beforeClose';

/** ما يفتح به المحرر: نموذج، أو مواطن، أو مسودة، أو كتاب صادر يُنسخ. */
type EditorTarget = {
  templateId: number | null;
  citizenId: number | null;
  draftId: number | null;
  documentId: number | null;
};

const NO_TARGET: EditorTarget = {
  templateId: null,
  citizenId: null,
  draftId: null,
  documentId: null
};

export default function App() {
  /**
   * الشبّاك هو ما يُفتح عليه التطبيق.
   *
   * كان المحرّر، وهو أداةُ مصمّم: يفتح المكتب برنامجه صباحًا فيجد ورقةً بيضاء
   * وأدوات تأليف، والزبون واقف. والشاشة اليومية هي «اختر واملأ واطبع».
   */
  const [route, setRoute] = useState<RouteKey>('service');
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  // المظهر من الإعدادات (المرحلة ٦) — ويُحفظ على الجهاز ليُرسم به الإقلاع التالي من أوّله.
  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme;
    try {
      localStorage.setItem('diwan-theme', settings.theme);
    } catch {
      // لا تخزين — يُقرأ من الإعدادات كلّ مرّة.
    }
  }, [settings?.theme]);
  const [counts, setCounts] = useState<SidebarCounts>({ templates: 0, issuedToday: 0, orders: { open: 0, dueToday: 0, overdue: 0 }, pending: 0 });
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void window.diwan.ui.info().then((i) => setVersion(i.version));
  }, []);

  /**
   * البرنامج يُغلق: يُفرَغ ما لم يُحفظ (مسودة المحرّر) ثم يمضي الإغلاق — ويأخذ نسخته التلقائية
   * إن كانت، فيُقال ذلك لا يُترك نافذةً لا تستجيب.
   */
  const [closing, setClosing] = useState(false);
  useEffect(
    () =>
      window.diwan.ui.onClosing(({ backup }) => {
        if (backup) setClosing(true);
        void flushBeforeClose().finally(() => window.diwan.ui.closeReady());
      }),
    []
  );
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
  const [editorStatus, setEditorStatus] = useState<{
    transaction: string | null;
    busy: boolean;
    exporting: boolean;
  }>({ transaction: null, busy: false, exporting: false });

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
    // حجم الواجهة الذي اختاره المكتب — يُطبَّق عند كل إقلاع.
    window.diwan.ui.setZoom(s.uiScale);
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
   * «ما ينتظرك اليوم» (د٧): مرّةً في اليوم عند الإقلاع، بعد معالج البداية، وإن كان
   * فيه ما يُقال. والطباعة المنقطعة لها حوارها — فتُترك اللوحة إلى إقلاعٍ بعده.
   */
  const [agenda, setAgenda] = useState<TodayAgenda | null>(null);
  const onboarded = settings?.onboarded ?? false;
  useEffect(() => {
    if (!onboarded) return;
    const day = new Date().toLocaleDateString('en-CA');
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(TODAY_SEEN);
    } catch {
      // التخزين راحةٌ لا شرط: بغيره تُعرض اللوحة، وتُغلق بضغطة.
    }
    if (seen === day) return;
    void window.diwan.today
      .agenda()
      .then((a) => {
        if (agendaHasItems(a) && a.pendingPrints.length === 0) setAgenda(a);
      })
      .catch(() => undefined);
  }, [onboarded]);
  const closeAgenda = () => {
    setAgenda(null);
    try {
      localStorage.setItem(TODAY_SEEN, new Date().toLocaleDateString('en-CA'));
    } catch {
      // انظر أعلاه.
    }
  };

  // العدّادات تتغيّر بإصدار كتاب أو إضافة نموذج.
  const navigate = useCallback(
    (key: RouteKey) => {
      setRoute(key);
      void refresh();
    },
    [refresh]
  );

  const openEditor = useCallback(
    (patch: Partial<EditorTarget>) => {
      setTarget({ ...NO_TARGET, ...patch });
      navigate('editor');
    },
    [navigate]
  );

  /** كتابٌ صدر يُكرَّر من حيث كُتب: المحرّر لكتبه، والشبّاك لمعاملاته. */
  const repeatDocument = useCallback(
    async (id: number) => {
      const src = await window.diwan.documents.repeatSource(id);
      if (src?.kind === 'counter' && src.templateIds.length > 0) {
        setRepeatRequest({ key: Date.now(), serial: src.serial, templateIds: src.templateIds, values: src.values });
        navigate('service');
      } else {
        openEditor({ documentId: id });
      }
    },
    [navigate, openEditor]
  );

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


  /** تبويبات الوجهة (الزبائن: أشخاص وجهات…) في رأس الشاشة — بمساراتها، فيصلها الرابط والسيناريو. */
  const tabs = tabsOf(route);
  const tabBar = tabs ? (
    <nav className="flex items-center gap-1 p-1 rounded-xl bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]" data-tabs="">
      {tabs.map((t) => (
        <a
          key={t.route}
          aria-current={t.route === route ? 'page' : undefined}
          className={`h-8 px-space-md rounded-lg flex items-center font-label-md text-label-md transition-colors ${
            t.route === route ? 'bg-primary-container text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
          }`}
          data-path={ROUTES[t.route]}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSearch('');
            navigate(t.route);
          }}
        >
          {t.label}
        </a>
      ))}
    </nav>
  ) : undefined;

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

  function renderScreen() {
    switch (route) {
      case 'service':
        // مركّبٌ دائمًا خارج هذا الاختيار — فلا تضيع المعاملة بالانتقال.
        return null;
      case 'editor':
        return (
          <EditorScreen
            ref={editorRef}
            templateId={target.templateId}
            citizenId={target.citizenId}
            draftId={target.draftId}
            documentId={target.documentId}
            onStatus={setEditorStatus}
            onIssued={() => void refresh()}
          />
        );
      case 'templates':
        return (
          <TemplatesScreen
            incoming={wordIncoming}
            request={libraryRequest}
            onOpenDesign={(templateId) => {
              setDesignRequest({ key: Date.now(), templateId });
              navigate('designs');
            }}
            onOpenInEditor={(id) => openEditor({ templateId: id })}
            onImportDesign={() => {
              setDesignRequest({ key: Date.now(), action: 'import' });
              navigate('designs');
            }}
            onChanged={() => void refresh()}
          />
        );
      case 'archive':
        return (
          <ArchiveScreen
            query={search}
            onOpenInEditor={(id) => void repeatDocument(id)}
            onOpenCitizen={(id) => {
              setCitizenFocus({ key: Date.now(), citizenId: id });
              navigate('citizens');
            }}
            onOpenTemplate={(id) => openEditor({ templateId: id })}
            onChanged={() => void refresh()}
          />
        );
      case 'citizens':
        return (
          <CitizensScreen
            focus={citizenFocus}
            onInsertIntoEditor={(id) => openEditor({ citizenId: id })}
            onChanged={() => void refresh()}
          />
        );
      case 'papers':
        return (
          <PapersScreen
            ref={papersRef}
            onChanged={() => void refresh()}
          />
        );
      case 'designs':
        return <DesignsScreen request={designRequest} onChanged={() => void refresh()} />;
      case 'orders':
        return (
          <OrdersScreen
            onChanged={() => void refresh()}
            onOpenDraft={(id) => openEditor({ draftId: id })}
            onResumeParked={(parkedKey) => {
              setResumeRequest({ key: Date.now(), parkedKey });
              navigate('service');
            }}
            onOpenDesign={(order) => {
              setDesignRequest({
                key: Date.now(),
                templateId: order.templateId ?? undefined,
                batchText: order.batchText,
                clientId: order.clientId ?? undefined,
                order: { id: order.id, title: order.title }
              });
              navigate('designs');
            }}
          />
        );
      case 'photos':
        return <PhotosScreen incoming={photoIncoming} />;
      case 'pdf':
        return <PdfScreen incoming={pdfIncoming} />;
      case 'clients':
        return (
          <ClientsScreen
            onChanged={() => void refresh()}
            onDesignFor={(client) => {
              setDesignRequest({ key: Date.now(), clientId: client.id });
              navigate('designs');
            }}
          />
        );
      case 'letterhead':
        return <LetterheadScreen />;
      case 'audit':
        return (
          <AuditScreen
            onOpenSerial={(serial) => {
              setSearch(serial);
              navigate('archive');
            }}
          />
        );
      case 'settings':
        return <SettingsScreen onChanged={() => void refresh()} />;
    }
  }

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
            if (action) setLibraryRequest({ key: Date.now(), action });
            if (go) navigate(go);
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
          context={
            // سياق المحرّر وحده: الكتاب الجاري، وتبديله من المكتبة.
            route === 'editor' ? (
              <>
                <span className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-lowest text-on-surface shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
                  <span className="material-symbols-outlined text-secondary text-[18px]">article</span>
                  <span className="font-label-md text-label-md font-semibold truncate max-w-[220px]">
                    {editorStatus.transaction ?? 'لم يُختر نموذج'}
                  </span>
                </span>
                <button
                  className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
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
              settingsKey={settings}
              onIssued={() => void refresh()}
              onOpenTool={(t, citizenId) => {
                setToolCustomer(citizenId);
                if ('route' in t) {
                  if (t.route === 'editor') openEditor({});
                  else navigate(t.route);
                } else if (t.dialog === 'id-copy') setIdDuplexOpen(true);
                else setIdSheetOpen(true);
              }}
              onOpenFile={async (f, as) => {
                if (as === 'pdf') {
                  setPdfIncoming({ key: Date.now(), ...(await window.diwan.inbox.openPdf([f.id])) });
                  navigate('pdf');
                } else if (as === 'photo') {
                  setPhotoIncoming({ key: Date.now(), path: await window.diwan.inbox.toPhotos(f.id) });
                  navigate('photos');
                } else {
                  setWordIncoming({ key: Date.now(), imported: await window.diwan.inbox.importWord(f.id) });
                  navigate('templates');
                }
              }}
            />
          </ErrorBoundary>
        </div>
        <ToolNavProvider value={toolNav}>
          {route !== 'service' && <ErrorBoundary key={route}>{renderScreen()}</ErrorBoundary>}
        </ToolNavProvider>
      </div>

      <ErrorBar />

      {closing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-scrim/50" data-closing="">
          <div className="rounded-2xl bg-surface-container-lowest px-space-lg py-space-md shadow-2xl flex items-center gap-space-sm font-label-lg text-label-lg text-on-surface">
            <span className="material-symbols-outlined animate-spin text-secondary">progress_activity</span>
            تُؤخذ النسخة التلقائية قبل الإغلاق…
          </div>
        </div>
      )}

      {idSheetOpen && <IdSheetDialog onClose={() => setIdSheetOpen(false)} />}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {whatsNew && <WhatsNewDialog from={whatsNew.from} to={whatsNew.to} onClose={() => setWhatsNew(null)} />}

      {idDuplexOpen && (
        <ToolNavProvider value={toolNav}>
          <IdDuplexDialog
            isOpen={true}
            onClose={() => setIdDuplexOpen(false)}
          />
        </ToolNavProvider>
      )}

      {/* دفعةٌ انقطعت طباعتها (الكهرباء) تُعرض في الإقلاع ليُستأنف منها. */}
      <ResumePrintDialog />

      {/* «على أيّ طابعة؟» — تسأله الشاشات حين للدور طابعتان أو طلب المكتب أن يُسأل. */}
      <PrintChooser />

      {agenda && (
        <TodayPanel agenda={agenda} officeName={settings?.officeName ?? ''} onClose={closeAgenda} onNavigate={navigate} />
      )}

    </>
  );
}
