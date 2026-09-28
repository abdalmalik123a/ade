import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteKey } from '@shared/routes';
import type { OfficeSettings, PrinterInfo, SidebarCounts } from '@shared/api';
import Sidebar from './shell/Sidebar';
import Header from './shell/Header';
import Onboarding from './shell/Onboarding';
import ServiceScreen, { type RepeatRequest } from './screens/ServiceScreen';
import EditorScreen, { type EditorHandle } from './screens/EditorScreen';
import ArchiveScreen from './screens/ArchiveScreen';
import CitizensScreen from './screens/CitizensScreen';
import TemplatesScreen from './screens/TemplatesScreen';
import PapersScreen, { type PapersHandle } from './screens/PapersScreen';
import DesignsScreen, { type DesignRequest } from './screens/DesignsScreen';
import OrdersScreen from './screens/OrdersScreen';
import ClientsScreen from './screens/ClientsScreen';
import PhotosScreen from './screens/PhotosScreen';
import PdfScreen from './screens/PdfScreen';
import LetterheadScreen from './screens/LetterheadScreen';
import AuditScreen from './screens/AuditScreen';
import SettingsScreen from './screens/SettingsScreen';
import CommandPalette from './components/CommandPalette';
import IdDuplexDialog from './screens/IdDuplexDialog';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorBar from './components/ErrorBar';
import ResumePrintDialog from './components/ResumePrintDialog';
import TodayPanel from './components/TodayPanel';
import { agendaHasItems } from '@shared/agenda';
import type { TodayAgenda } from '@shared/api';

/** يومُ آخر عرضٍ لـ«ما ينتظرك اليوم» — تفضيلٌ لهذا الجهاز لا بيانات. */
const TODAY_SEEN = 'diwan.todaySeen';
import { isCombo, shortcut } from '@shared/shortcuts';

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
  const [counts, setCounts] = useState<SidebarCounts>({ templates: 0, issuedToday: 0, orders: { open: 0, dueToday: 0, overdue: 0 } });
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void window.diwan.ui.info().then((i) => setVersion(i.version));
  }, []);

  /** البرنامج يُغلق ويأخذ نسخته التلقائية أوّلًا — فيُقال ذلك لا يُترك نافذةً لا تستجيب. */
  const [closing, setClosing] = useState(false);
  useEffect(() => window.diwan.ui.onClosing(() => setClosing(true)), []);
  const [search, setSearch] = useState('');
  /** ملفّ مواطنٍ يُفتح من البحث الشامل. */
  const [citizenFocus, setCitizenFocus] = useState<{ key: number; citizenId: number } | null>(null);
  const [target, setTarget] = useState<EditorTarget>(NO_TARGET);
  /** ما تُفتح به التصاميم من غيرها: تصميم طلبٍ بقائمته، أو المعرض على جهة. */
  const [designRequest, setDesignRequest] = useState<DesignRequest | null>(null);
  /** «كرّره» لكتابٍ صدر من الشبّاك: يُفتح فيه لا في المحرّر. */
  const [repeatRequest, setRepeatRequest] = useState<RepeatRequest | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [idDuplexOpen, setIdDuplexOpen] = useState(false);
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
    // حجم الواجهة الذي اختاره المكتب — يُطبَّق عند كل إقلاع.
    window.diwan.ui.setZoom(s.uiScale);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      if (isCombo(e, shortcut('palette').combo)) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (isCombo(e, shortcut('print').combo)) {
        e.preventDefault();
        handlePrint();
      }
      if (isCombo(e, shortcut('library').combo)) {
        e.preventDefault();
        navigate('templates');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePrint, navigate]);

  const selectedPrinter =
    printers.find((p) => p.name === settings?.defaultPrinter) ??
    printers.find((p) => p.isDefault) ??
    null;

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
            printer={selectedPrinter}
            onStatus={setEditorStatus}
            onIssued={() => void refresh()}
          />
        );
      case 'templates':
        return (
          <TemplatesScreen
            onOpenInEditor={(id) => openEditor({ templateId: id })}
            onOpenDraft={(id) => openEditor({ draftId: id })}
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
            printer={selectedPrinter}
            onInsertIntoEditor={(id) => openEditor({ citizenId: id })}
            onChanged={() => void refresh()}
          />
        );
      case 'papers':
        return (
          <PapersScreen
            ref={papersRef}
            printer={selectedPrinter}
            onChanged={() => void refresh()}
          />
        );
      case 'designs':
        return <DesignsScreen printer={selectedPrinter} request={designRequest} onChanged={() => void refresh()} />;
      case 'orders':
        return (
          <OrdersScreen
            onChanged={() => void refresh()}
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
        return <PhotosScreen printer={selectedPrinter} />;
      case 'pdf':
        return <PdfScreen />;
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
          onDone={(patch, go) => {
            void window.diwan.settings.set(patch).then((s) => {
              setSettings(s);
              window.diwan.ui.setZoom(s.uiScale);
            });
            if (go) navigate(go);
          }}
        />
      )}
      <Sidebar
        active={route}
        // الشريط يفتح الشاشة نظيفة — لا يُعاد فتح تصميم طلبٍ سابق.
        onNavigate={(key) => {
          setDesignRequest(null);
          navigate(key);
        }}
        counts={counts}
        printerName={selectedPrinter?.displayName ?? null}
        printerReady={selectedPrinter?.ready ?? false}
        supplyPercent={null}
        operatorName={settings?.operatorName || 'لم يُسجّل مشغّل'}
        officeName={settings?.officeName || 'لم يُسمّ المكتب بعد'}
        version={version}
      />
      <div className="pr-72">
        <Header
          search={search}
          onSearch={(value) => {
            setSearch(value);
            // البحث الشامل يصل إلى الأرشيف — وفيه الكتب، ومعها المواطن والنموذج والمستمسك.
            if (value.trim() && route !== 'archive') navigate('archive');
          }}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
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
            ) : undefined
          }
        />
        {/* الشبّاك يبقى مركّبًا مخفيًّا حين يُترك: المعاملة الجارية لا تضيع بالانتقال. */}
        <div className={route === 'service' ? '' : 'hidden'}>
          <ErrorBoundary key="service">
            <ServiceScreen
              active={route === 'service'}
              repeat={repeatRequest}
              printer={selectedPrinter}
              onIssued={() => void refresh()}
            />
          </ErrorBoundary>
        </div>
        {route !== 'service' && <ErrorBoundary key={route}>{renderScreen()}</ErrorBoundary>}
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

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(r) => navigate(r)}
        onOpenCitizen={(cId) => openEditor({ citizenId: cId })}
        onOpenTemplate={(tId) => openEditor({ templateId: tId })}
        onOpenIdDuplex={() => setIdDuplexOpen(true)}
      />

      {idDuplexOpen && (
        <IdDuplexDialog
          isOpen={true}
          onClose={() => setIdDuplexOpen(false)}
          printer={selectedPrinter}
        />
      )}

      {/* دفعةٌ انقطعت طباعتها (الكهرباء) تُعرض في الإقلاع ليُستأنف منها. */}
      <ResumePrintDialog />

      {agenda && (
        <TodayPanel agenda={agenda} officeName={settings?.officeName ?? ''} onClose={closeAgenda} onNavigate={navigate} />
      )}

    </>
  );
}
