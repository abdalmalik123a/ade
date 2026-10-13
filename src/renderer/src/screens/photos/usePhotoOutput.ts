/**
 * إخراج الصورة الشخصية (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PhotosScreen` كما هو: المراجعة والطباعة نسخًا على الورق، وPDF،
 * والصورة، وللرفع بحدّ حجم، وفي ملفّ صاحبها.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { type Scene, renderJpeg, dataUrlOf } from '../../lib/portraitCanvas';
import { errorText } from '../../lib/errors';
import { toIndic } from '@shared/arabic';
import { sizeText } from '@shared/pdfEdit';
import { fitJpeg, rememberLimit } from '../../lib/fitImage';
import { setJpegDpi, type PhotoPreset } from '@shared/photoPresets';
import { photoSheetsHtml, CENTER, type Size, type Crop } from '@shared/photoSheet';
import { choosePrinter } from '../../lib/printChoice';
import { papersWord, type Outcome } from '../../components/OutputBar';
import type { Worn } from './photoShared';

export function usePhotoOutput(
  ctx: {
    natural: Size | null;
    subject: MutableRefObject<HTMLCanvasElement | null>;
    crop: Crop;
    bgColor: string;
    worn: Worn | null;
    px: { w: number; h: number; };
    preset: PhotoPreset;
    setBusy: Dispatch<SetStateAction<string | null>>;
    say: (text: string, warn?: boolean) => void;
    setReview: Dispatch<SetStateAction<{ path: string; px: Size; } | null>>;
    limit: number;
    setPicking: Dispatch<SetStateAction<boolean>>;
    review: { path: string; px: Size; } | null;
    photo: { w: number; h: number; };
    paper: Size;
    copies: number;
    setPrinting: Dispatch<SetStateAction<boolean>>;
    lastPrint: MutableRefObject<{ html: string; count: number; paper: Size; printer: string; system: boolean; } | null>;
    setAfter: Dispatch<SetStateAction<Outcome | null>>;
  }
) {
  const {
    natural, subject, crop, bgColor, worn, px, preset, setBusy, say, setReview, limit, setPicking, review, photo, paper, copies,
    setPrinting, lastPrint, setAfter
  } = ctx;

  const scene = (): Scene => {
    if (!natural || !subject.current) throw new Error('افتح صورة الزبون أوّلًا');
    return { subject: subject.current, natural, crop, background: bgColor, suit: worn && { suit: worn.suit, at: worn.at } };
  };
  const finalJpeg = () => renderJpeg(scene(), px, preset.dpi);
  const fileBase = `صورة ${preset.widthMm}×${preset.heightMm}`.replace(/[\\/:*?"<>|]/g, '-');

  async function run(label: string, job: () => Promise<void>) {
    setBusy(label);
    try {
      await job();
    } catch (e) {
      say(errorText(e, 'تعذّر الحفظ'), true);
    } finally {
      setBusy(null);
    }
  }

  const openReview = () =>
    run('تُجهَّز الورقة…', async () => {
      const path = await window.diwan.photos.storeReview(await dataUrlOf(await finalJpeg()));
      setReview({ path, px });
    });

  const saveImage = () =>
    run('تُحفظ الصورة…', async () => {
      const blob = await finalJpeg();
      const path = await window.diwan.photos.saveImage({ data: new Uint8Array(await blob.arrayBuffer()), suggestedName: `${fileBase}.jpg`, filterName: 'صورة JPEG', ext: 'jpg' });
      if (path) say(`حُفظت: ${toIndic(px.w)}×${toIndic(px.h)} بكسل بدقّة ${toIndic(preset.dpi)} — ${sizeText(blob.size)}`);
    });

  const saveUpload = () =>
    run('تُصغَّر للرفع…', async () => {
      const blob = await finalJpeg();
      const fit = await fitJpeg(blob, limit, false);
      if ('smallest' in fit) {
        say(`أصغر ما بلغته ${sizeText(fit.smallest)} — أكبر من الحدّ`, true);
        return;
      }
      // التصغير يرسم من جديد فتضيع الدقّة المكتوبة: تُكتب بما صارت إليه، والمقاس بالملّم كما هو.
      const bmp = await createImageBitmap(fit.blob);
      const dpi = (preset.dpi * bmp.width) / px.w;
      bmp.close();
      const bytes = setJpegDpi(new Uint8Array(await fit.blob.arrayBuffer()), dpi);
      rememberLimit(limit);
      const path = await window.diwan.photos.saveUpload({ data: bytes, suggestedName: `${fileBase} للرفع.jpg`, filterName: 'صورة JPEG', ext: 'jpg' });
      if (path) say(`حُفظت للرفع: ${sizeText(bytes.length)}`);
    });

  const linkCitizen = (id: number) =>
    run('تُحفظ في ملف المواطن…', async () => {
      setPicking(false);
      const dataUrl = await dataUrlOf(await finalJpeg());
      const res = await window.diwan.photos.saveToCitizen({ citizenId: id, label: `صورة شخصية ${preset.name}`, dataUrl });
      say(`صارت صورة ${res.fullName} في ملفّه`);
    });

  const pages = review
    ? photoSheetsHtml({ src: review.path, natural: review.px, crop: CENTER, photo, paper, count: copies }, (s) => `diwan://store/${s}`)
    : [];

  async function print() {
    const pick = await choosePrinter('photos', { allowSystem: true });
    if (!pick) return;
    await send({ html: pages.join(''), count: pages.length, paper, printer: pick.printer, system: pick.system });
  }

  /** الورقة إلى الطابعة — ثم تُغلق المعاينة ويقول شريط الإخراج ما خرج وأين. */
  async function send(job: { html: string; count: number; paper: Size; printer: string; system: boolean }) {
    setPrinting(true);
    try {
      const out = await window.diwan.output.print({ sheetHtml: job.html, printer: job.printer, copies: 1, silent: !job.system, page: job.paper });
      if (!out.ok) {
        say(out.reason || 'لم تتم الطباعة', true);
        return;
      }
      lastPrint.current = job;
      setReview(null);
      setAfter({ what: papersWord(job.count), printer: job.printer });
    } catch (e) {
      say(errorText(e, 'تعذّرت الطباعة'), true);
    } finally {
      setPrinting(false);
    }
  }

  async function pdf() {
    setPrinting(true);
    try {
      const path = await window.diwan.output.savePdf({ sheetHtml: pages.join(''), suggestedName: 'صور شخصية', page: paper });
      if (path) say('حُفظ PDF بمقاس الورق');
    } finally {
      setPrinting(false);
    }
  }

  return { send, openReview, saveImage, linkCitizen, saveUpload, pages, pdf, print };
}
