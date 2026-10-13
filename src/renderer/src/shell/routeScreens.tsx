/**
 * شاشات البرنامج بمساراتها (تقسيم App بعد ١٫٧٫٠): كلّ مسارٍ وشاشته وما تأخذه من App — منقولةٌ منه كما هي (`renderScreen`).
 * فالأداة الجديدة تُضاف هنا: استيرادها وسطرها في الاختيار، ولا يكبر App بها. والشبّاك لا يُرسم هنا: مركّبٌ دائمًا في App
 * فلا تضيع المعاملة بالانتقال.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { RouteKey } from '@shared/routes';
import type { StartAction } from './Onboarding';
import EditorScreen, { type EditorHandle } from '../screens/EditorScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import CitizensScreen from '../screens/CitizensScreen';
import TemplatesScreen, { type WordIncoming } from '../screens/TemplatesScreen';
import PapersScreen, { type PapersHandle } from '../screens/PapersScreen';
import DesignsScreen, { type DesignRequest } from '../screens/DesignsScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ClientsScreen from '../screens/ClientsScreen';
import PhotosScreen, { type PhotoIncoming } from '../screens/PhotosScreen';
import PdfScreen, { type PdfIncoming } from '../screens/PdfScreen';
import LetterheadScreen from '../screens/LetterheadScreen';
import FontsScreen from '../screens/FontsScreen';
import ElementsScreen from '../screens/ElementsScreen';
import AuditScreen from '../screens/AuditScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { notice } from '../kit/notice';

export type { DesignRequest, EditorHandle, PapersHandle, PdfIncoming, PhotoIncoming, WordIncoming };

/** ما يفتح به المحرر: نموذج، أو مواطن، أو مسودة، أو كتاب صادر يُنسخ. */
export type EditorTarget = {
  templateId: number | null;
  citizenId: number | null;
  draftId: number | null;
  documentId: number | null;
};

export const NO_TARGET: EditorTarget = {
  templateId: null,
  citizenId: null,
  draftId: null,
  documentId: null
};

/** حال المحرّر في الشريط العلوي: الكتاب الجاري، وأمشغولٌ هو. */
export type EditorStatus = { transaction: string | null; busy: boolean; exporting: boolean };

/** ما تأخذه الشاشات من App: حاله وطلباته ودوالّ التنقّل بينها. */
export type ScreenContext = {
  route: RouteKey;
  navigate: (key: RouteKey) => void;
  refresh: () => Promise<void>;
  editorRef: MutableRefObject<EditorHandle | null>;
  papersRef: MutableRefObject<PapersHandle | null>;
  target: EditorTarget;
  setEditorStatus: Dispatch<SetStateAction<EditorStatus>>;
  openEditor: (patch: Partial<EditorTarget>) => void;
  openDesigns: (req: Omit<DesignRequest, 'key'>) => void;
  repeatDocument: (id: number) => Promise<void>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  citizenFocus: { key: number; citizenId: number } | null;
  setCitizenFocus: Dispatch<SetStateAction<{ key: number; citizenId: number } | null>>;
  wordIncoming: WordIncoming | null;
  libraryRequest: { key: number; action: StartAction } | null;
  archiveRequest: { key: number; period: 'week' } | null;
  designRequest: DesignRequest | null;
  orderRequest: { key: number; citizenId: number | null } | null;
  setResumeRequest: Dispatch<SetStateAction<{ key: number; parkedKey: number } | null>>;
  photoIncoming: PhotoIncoming | null;
  pdfIncoming: PdfIncoming | null;
  onIssued?: () => void;
};

/** الشاشة المعروضة لمسارها — وللشبّاك لا شيء (مركّبٌ في App). */
export function renderScreen({
  route,
  navigate,
  refresh,
  editorRef,
  papersRef,
  target,
  setEditorStatus,
  openEditor,
  openDesigns,
  repeatDocument,
  search,
  setSearch,
  citizenFocus,
  setCitizenFocus,
  wordIncoming,
  libraryRequest,
  archiveRequest,
  designRequest,
  orderRequest,
  setResumeRequest,
  photoIncoming,
  pdfIncoming,
  onIssued
}: ScreenContext) {
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
          onIssued={onIssued ?? (() => void refresh())}
          onLeave={(d) =>
            notice(`حُفظ ما كتبته في «قيد العمل»: «${d.title}»`, { label: 'افتحه', run: () => openEditor({ draftId: d.id }) })
          }
        />
      );
    case 'templates':
      return (
        <TemplatesScreen
          incoming={wordIncoming}
          request={libraryRequest}
          onOpenDesign={(templateId) => openDesigns({ templateId })}
          onOpenInEditor={(id) => openEditor({ templateId: id })}
          onImportDesign={() => openDesigns({ action: 'import' })}
          onChanged={() => void refresh()}
        />
      );
    case 'archive':
      return (
        <ArchiveScreen
          query={search}
          request={archiveRequest}
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
          onRepeatDocument={(id) => void repeatDocument(id)}
          onChanged={() => void refresh()}
        />
      );
    case 'papers':
      return <PapersScreen ref={papersRef} onChanged={() => void refresh()} />;
    case 'designs':
      return <DesignsScreen request={designRequest} onChanged={() => void refresh()} />;
    case 'orders':
      return (
        <OrdersScreen
          request={orderRequest}
          onChanged={() => void refresh()}
          onOpenDraft={(id) => openEditor({ draftId: id })}
          onOpenDesignDraft={(id) => openDesigns({ draftId: id })}
          onResumeParked={(parkedKey) => {
            setResumeRequest({ key: Date.now(), parkedKey });
            navigate('service');
          }}
          onOpenDesign={(order) =>
            openDesigns({
              templateId: order.templateId ?? undefined,
              batchText: order.batchText,
              clientId: order.clientId ?? undefined,
              order: { id: order.id, title: order.title, quantity: order.quantity }
            })
          }
        />
      );
    case 'photos':
      return <PhotosScreen incoming={photoIncoming} />;
    case 'pdf':
      return <PdfScreen incoming={pdfIncoming} />;
    case 'clients':
      return <ClientsScreen onChanged={() => void refresh()} onDesignFor={(client) => openDesigns({ clientId: client.id })} />;
    case 'letterhead':
      return <LetterheadScreen />;
    case 'fonts':
      return <FontsScreen />;
    case 'elements':
      return <ElementsScreen />;
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
