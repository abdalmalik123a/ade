import { useCallback, useEffect, useState } from 'react';
import type { RouteKey } from '@shared/routes';
import type { OfficeSettings, PrinterInfo, SidebarCounts } from '@shared/api';
import Sidebar from './shell/Sidebar';
import Header from './shell/Header';
import EditorScreen from './screens/EditorScreen';
import ArchiveScreen from './screens/ArchiveScreen';
import CitizensScreen from './screens/CitizensScreen';
import TemplatesScreen from './screens/TemplatesScreen';
import LetterheadScreen from './screens/LetterheadScreen';
import SearchScreen from './screens/SearchScreen';

export default function App() {
  const [route, setRoute] = useState<RouteKey>('editor');
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [counts, setCounts] = useState<SidebarCounts>({ templates: 0, issuedToday: 0 });
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [search, setSearch] = useState('');
  const [pendingTemplate, setPendingTemplate] = useState<number | null>(null);
  const [pendingCitizen, setPendingCitizen] = useState<number | null>(null);

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

  const handlePrint = useCallback(() => window.print(), []);

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
      case 'editor':
        return <EditorScreen templateId={pendingTemplate} citizenId={pendingCitizen} />;
      case 'templates':
        return (
          <TemplatesScreen
            onOpenInEditor={(id) => {
              setPendingTemplate(id);
              navigate('editor');
            }}
            onChanged={() => void refresh()}
          />
        );
      case 'archive':
        return <ArchiveScreen />;
      case 'citizens':
        return (
          <CitizensScreen
            onInsertIntoEditor={(id) => {
              setPendingCitizen(id);
              navigate('editor');
            }}
            onChanged={() => void refresh()}
          />
        );
      case 'letterhead':
        return <LetterheadScreen />;
      case 'search':
        return <SearchScreen />;
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
          transaction={null}
          search={search}
          onSearch={setSearch}
          onSwapTemplate={() => navigate('templates')}
          onSaveDraft={() => undefined}
          onExportPdf={() => undefined}
          onPrint={handlePrint}
        />
        {renderScreen()}
      </div>
    </>
  );
}
