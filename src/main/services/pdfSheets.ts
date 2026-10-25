/**
 * صفحاتٌ في ورقة (S27، D178): الملفّ المبنيّ نفسه (`buildPdf`) أوراقًا A4، في كلّ ورقةٍ `n` صفحةً بالتخطيط الخالص (`@shared/pdfSheets`) —
 * كلّ صفحةٍ تُضمَّن بما يُرى منها (صندوق القصّ) وتُرسم في خانتها كما تُرى (بدورانها)، وما نقص من الورقة الأخيرة يبقى أبيض. و١ يعيد الملفّ كما هو.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import { totalRotation, shownSize } from '@shared/pdfEdit';
import { placeInCell, sheetLayout } from '@shared/pdfSheets';

export async function toSheets(bytes: Uint8Array, n: number): Promise<Uint8Array> {
  if (!(n > 1)) return bytes;
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  out.setProducer('ديوان');
  out.setCreator('ديوان — محرّر PDF');
  const pages = src.getPages();
  if (!pages.length) throw new Error('لا صفحات في الملف');
  // الشبكة من الصفحة الأولى كما تُرى؛ وكلّ صفحةٍ بعدها في خانتها بنسبتها.
  const box = (p: (typeof pages)[number]) => p.getCropBox();
  const first = shownSize(box(pages[0]!), totalRotation(pages[0]!.getRotation().angle, 0));
  const layout = sheetLayout(n, first);
  const embedded = await out.embedPages(
    pages,
    pages.map((p) => {
      const c = box(p);
      return { left: c.x, bottom: c.y, right: c.x + c.width, top: c.y + c.height };
    })
  );
  for (let at = 0; at < pages.length; at += n) {
    const sheet = out.addPage([layout.sheet.w, layout.sheet.h]);
    for (let k = 0; k < n && at + k < pages.length; k++) {
      const c = box(pages[at + k]!);
      const place = placeInCell(layout.cells[k]!, { w: c.width, h: c.height }, totalRotation(pages[at + k]!.getRotation().angle, 0));
      sheet.drawPage(embedded[at + k]!, { x: place.x, y: place.y, xScale: place.scale, yScale: place.scale, rotate: degrees(place.rotate) });
    }
  }
  return out.save();
}
