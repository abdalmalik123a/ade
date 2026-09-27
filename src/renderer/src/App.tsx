import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteKey } from '@shared/routes';
import type { OfficeSettings, PrinterInfo, SidebarCounts } from '@shared/api';
import Sidebar from './shell/Sidebar';
import Header from './shell/Header';
import Onboarding from './shell/Onboarding';
import ServiceScreen from './screens/ServiceScreen';
import EditorScreen, { type EditorHandle } from './screens/EditorScreen';
import ArchiveScreen from './screens/ArchiveScreen';
import CitizensScreen from './screens/CitizensScreen';
import TemplatesScreen from './screens/TemplatesScreen';
import PapersScreen, { type PapersHandle } from './screens/PapersScreen';
import DesignsScreen, { type DesignRequest } from './screens/DesignsScreen';
import OrdersScreen from './screens/OrdersScreen';
import ClientsScreen from './screens/ClientsScreen';
import PhotosScreen from './screens/PhotosScreen';
import LetterheadScreen from './screens/LetterheadScreen';
import SearchScreen from './screens/SearchScreen';
import CommandPalette from './components/CommandPalette';
import IdDuplexDialog from './screens/IdDuplexDialog';
import ErrorBoundary from './components/ErrorBoundary';
import LiveDemoRobot from './components/LiveDemoRobot';
import ResumePrintDialog from './components/ResumePrintDialog';

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
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<EditorTarget>(NO_TARGET);
  /** ما تُفتح به التصاميم من غيرها: تصميم طلبٍ بقائمته، أو المعرض على جهة. */
  const [designRequest, setDesignRequest] = useState<DesignRequest | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [idDuplexOpen, setIdDuplexOpen] = useState(false);
  const [robotActive, setRobotActive] = useState(false);
  const [editorStatus, setEditorStatus] = useState<{
    transaction: string | null;
    busy: boolean;
    exporting: boolean;
  }>({ transaction: null, busy: false, exporting: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        setRobotActive((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
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
        return <ServiceScreen printer={selectedPrinter} onIssued={() => void refresh()} />;
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
            onOpenInEditor={(id) => openEditor({ documentId: id })}
            onChanged={() => void refresh()}
          />
        );
      case 'citizens':
        return (
          <CitizensScreen
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
              setDesignRequest({ key: Date.now(), templateId: order.templateId ?? undefined, batchText: order.batchText, clientId: order.clientId ?? undefined });
              navigate('designs');
            }}
          />
        );
      case 'photos':
        return <PhotosScreen printer={selectedPrinter} />;
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
      case 'search':
        return <SearchScreen query={search} />;
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
        onSignOut={() => navigate('letterhead')}
      />
      <div className="pr-72">
        <Header
          search={search}
          onSearch={(value) => {
            setSearch(value);
            if (value.trim() && route !== 'search') navigate('search');
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
        <ErrorBoundary key={route}>
          {renderScreen()}
        </ErrorBoundary>
      </div>

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

      {/* زر عائم لتشغيل محاكاة المستخدم الآلية */}
      <button
        type="button"
        className="fixed bottom-5 left-5 z-40 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-secondary text-on-primary font-bold text-[13px] shadow-[0_4px_20px_rgba(0,0,0,0.25)] flex items-center gap-2.5 border-2 border-white/30 transition-all hover:scale-105 active:scale-95 ring-4 ring-primary/20"
        onClick={() => setRobotActive(true)}
        title="اضغط لتشغيل محاكاة حركة ونقرات المستخدم آليًّا أمامك (أو اضغط F9)"
      >
        <span className="material-symbols-outlined text-[20px] text-amber-300 animate-spin">smart_toy</span>
        <span>🤖 بدء العرض الآلي (محاكاة نقرات المستخدم) [F9]</span>
      </button>

      {/* دفعةٌ انقطعت طباعتها (الكهرباء) تُعرض في الإقلاع ليُستأنف منها. */}
      <ResumePrintDialog />

      <LiveDemoRobot
        isActive={robotActive}
        onStop={() => setRobotActive(false)}
        onNavigate={(r) => navigate(r)}
      />
    </>
  );
}
