import { useCallback, useEffect, useState } from 'react';
import type { RouteKey } from '@shared/routes';
import type { OfficeSettings, PrinterInfo, SidebarCounts } from '@shared/api';
import Sidebar from './shell/Sidebar';
import Header from './shell/Header';
import EditorRaw from './screens/raw/EditorRaw';
import ArchiveRaw from './screens/raw/ArchiveRaw';
import CitizensRaw from './screens/raw/CitizensRaw';
import TemplatesRaw from './screens/raw/TemplatesRaw';
import LetterheadScreen from './screens/LetterheadScreen';
import SearchScreen from './screens/SearchScreen';

const SCREENS: Record<RouteKey, () => JSX.Element> = {
  editor: EditorRaw,
  templates: TemplatesRaw,
  archive: ArchiveRaw,
  citizens: CitizensRaw,
  letterhead: LetterheadScreen,
  search: SearchScreen
};

export default function App() {
  const [route, setRoute] = useState<RouteKey>('editor');
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [counts, setCounts] = useState<SidebarCounts>({ templates: 0, issuedToday: 0 });
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void (async () => {
      const [s, c, p] = await Promise.all([
        window.diwan.settings.get(),
        window.diwan.counts.sidebar(),
        window.diwan.printers.list()
      ]);
      setSettings(s);
      setCounts(c);
      setPrinters(p);
    })();
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Ctrl+P — الطباعة الفورية، كما يعلن زرّ الهيدر.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setRoute('templates');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePrint]);

  const Screen = SCREENS[route];

  const selectedPrinter =
    printers.find((p) => p.name === settings?.defaultPrinter) ??
    printers.find((p) => p.isDefault) ??
    null;

  return (
    <>
      <Sidebar
        active={route}
        onNavigate={setRoute}
        counts={counts}
        printerName={selectedPrinter?.displayName ?? null}
        printerReady={selectedPrinter?.ready ?? false}
        supplyPercent={null}
        operatorName={settings?.operatorName || 'لم يُسجَّل مشغّل'}
        officeName={settings?.officeName || 'لم يُسمَّ المكتب بعد'}
        onSignOut={() => setRoute('letterhead')}
      />
      <div className="pr-72">
        <Header
          transaction={null}
          search={search}
          onSearch={setSearch}
          onSwapTemplate={() => setRoute('templates')}
          onSaveDraft={() => undefined}
          onExportPdf={() => undefined}
          onPrint={handlePrint}
        />
        <Screen />
      </div>
    </>
  );
}
