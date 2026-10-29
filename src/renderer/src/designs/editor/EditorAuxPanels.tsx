/** مداخل الصفحة والتعبئة؛ لوحاتها الأصلية بلا نسخة جديدة من عملها. */
import BatchPanel from '../BatchPanel';
import FillPanel from '../panels/FillPanel';
import PagePanel from '../panels/PagePanel';
import AddPanel from '../panels/AddPanel';
import BrandKitBar from '../panels/BrandKitBar';
import ImsakiyaPanel from '../imsakiya/ImsakiyaPanel';
import { imsakiyaTable } from '@shared/design/imsakiya';
import EditorPanelDialog from './EditorPanelDialog';
import type { DesignEditor } from './useDesignEditor';

export default function EditorAuxPanels({ ed, panel, close }: {
  ed: DesignEditor; panel: 'page' | 'fill' | null; close: () => void;
}) {
  const imsakiya = imsakiyaTable(ed.canvas);
  return <>
    <EditorPanelDialog open={panel === 'page'} name="page" title="الصفحة والاستيراد" close={close}>
      <BrandKitBar ed={ed} /><PagePanel ed={ed} />
    </EditorPanelDialog>
    <EditorPanelDialog open={panel === 'fill'} name="fill" title="تعبئة ودفعة" close={close}>
      <FillPanel ed={ed} />
      {imsakiya && <ImsakiyaPanel key={imsakiya.id} ed={ed} table={imsakiya} />}
      <AddPanel ed={ed} />
      {ed.doc.fields.length > 0 && <BatchPanel key={ed.batchKey} fields={ed.doc.fields} imageKeys={ed.imageKeys} imp={ed.imp}
        initialText={ed.batchSeed} photoSize={ed.photoSize} onPreview={() => ed.setSheetsOpen(true)} onRows={ed.setBatchRows}
        seedPhotos={ed.batchPhotos} onFromRegistry={() => ed.setRegistryOpen(true)} mapping={ed.batchMap}
        onMapping={(map) => { ed.setBatchMap(map); if (ed.designId !== null) void window.diwan.learning.setBatchMap(ed.designId, map); }} />}
    </EditorPanelDialog>
  </>;
}
