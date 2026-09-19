import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteKey } from '@shared/routes';
import type { OfficeSettings, PrinterInfo, SidebarCounts } from '@shared/api';
import Sidebar from './shell/Sidebar';
import Header from './shell/Header';
import ServiceScreen from './screens/ServiceScreen';
import EditorScreen, { type EditorHandle } from './screens/EditorScreen';
import ArchiveScreen from './screens/ArchiveScreen';
import CitizensScreen from './screens/CitizensScreen';
import TemplatesScreen from './screens/TemplatesScreen';
import PapersScreen, { type PapersHandle } from './screens/PapersScreen';
import DesignsScreen from './screens/DesignsScreen';
import LetterheadScreen from './screens/LetterheadScreen';
import SearchScreen from './screens/SearchScreen';

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
  const [route, setRoute] = useState<RouteKey>('editor');
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [counts, setCounts] = useState<SidebarCounts>({ templates: 0, issuedToday: 0 });
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<EditorTarget>(NO_TARGET);
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
   * أزرار الشريط العلوي تعمل على المعروض.
   *
   * وفي المحرر تعمل على الكتاب، وفي الأسئلة على الورقة — ومن شاشةٍ ثالثة تنقل
   * إلى المحرر أولًا. فلا يضغط المدرّس «طباعة» فيجد نفسه في كتابٍ رسمي.
   */
  const barAction = useCallback(
    (onEditor: (h: EditorHandle) => void, onPapers: (h: PapersHandle) => void) => () => {
      if (route === 'papers' && papersRef.current) return onPapers(papersRef.current);
      if (route === 'editor' && editorRef.current) return onEditor(editorRef.current);
      navigate('editor');
    },
    [navigate, route]
  );

  const handlePrint = barAction(
    (h) => h.print(),
    (h) => h.print()
  );
  const handleSaveDraft = barAction(
    (h) => h.saveDraft(),
    (h) => h.save()
  );
  const handleExportPdf = barAction(
    (h) => h.exportPdf(),
    (h) => h.exportPdf()
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
        return <DesignsScreen printer={selectedPrinter} onChanged={() => void refresh()} />;
      case 'letterhead':
        return <LetterheadScreen />;
      case 'search':
        return <SearchScreen query={search} />;
    }
  }

  return (
    <>
      <Sidebar
        active={route}
        onNavigate={navigate}
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
          transaction={editorStatus.transaction}
          search={search}
          onSearch={(value) => {
            setSearch(value);
            if (value.trim() && route !== 'search') navigate('search');
          }}
          onSwapTemplate={() => navigate('templates')}
          onSaveDraft={handleSaveDraft}
          onExportPdf={handleExportPdf}
          onPrint={handlePrint}
          exporting={editorStatus.exporting}
          busy={editorStatus.busy}
        />
        {renderScreen()}
      </div>
    </>
  );
}
