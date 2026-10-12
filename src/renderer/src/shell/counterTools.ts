/**
 * بطاقات الشبّاك و«الملفّات» إلى أدواتها (تقسيم App بعد ١٫٧٫٠) — منقولٌ من App كما هو: ما تفتحه كلّ بطاقة (شاشةٌ بمسارها،
 * أو نافذةٌ في مكانها)، ومعها زبون الشبّاك؛ وما يُفتح فيه كلّ ملفٍّ وصل. والأداة التي تحتاج غير «انتقل إلى مسارها» تُضاف هنا.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { RouteKey } from '@shared/routes';
import type { CounterCard } from '@shared/counterCards';
import type { InboxFile } from '@shared/api';
import type { InboxOpen } from '../components/InboxPanel';
import type { EditorTarget, PdfIncoming, PhotoIncoming, WordIncoming } from './routeScreens';

/** ما تحتاجه البطاقة من App. */
export type CounterToolContext = {
  setToolCustomer: Dispatch<SetStateAction<number | null>>;
  openEditor: (patch: Partial<EditorTarget>) => void;
  setOrderRequest: Dispatch<SetStateAction<{ key: number; citizenId: number | null } | null>>;
  navigate: (key: RouteKey) => void;
  setIdDuplexOpen: Dispatch<SetStateAction<boolean>>;
  setIdSheetOpen: Dispatch<SetStateAction<boolean>>;
};

export function openCounterTool(t: CounterCard['target'], citizenId: number | null, { setToolCustomer, openEditor, setOrderRequest, navigate, setIdDuplexOpen, setIdSheetOpen }: CounterToolContext) {
  setToolCustomer(citizenId);
  if ('route' in t) {
    if (t.route === 'editor') openEditor({});
    // «طلبٌ يُسلَّم لاحقًا» (د٨): طلبٌ جديد مباشرةً، ومعه زبون الشبّاك إن كان — لا قائمة الطلبات.
    else if (t.route === 'orders') {
      setOrderRequest({ key: Date.now(), citizenId });
      navigate('orders');
    }
    else navigate(t.route);
  } else if (t.dialog === 'id-copy') setIdDuplexOpen(true);
  else setIdSheetOpen(true);
}

/** ما يحتاجه الملفّ الواصل من App. */
export type InboxFileContext = {
  setPdfIncoming: Dispatch<SetStateAction<PdfIncoming | null>>;
  setPhotoIncoming: Dispatch<SetStateAction<PhotoIncoming | null>>;
  setWordIncoming: Dispatch<SetStateAction<WordIncoming | null>>;
  navigate: (key: RouteKey) => void;
};

export async function openInboxFile(f: InboxFile, as: InboxOpen, { setPdfIncoming, setPhotoIncoming, setWordIncoming, navigate }: InboxFileContext) {
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
}
