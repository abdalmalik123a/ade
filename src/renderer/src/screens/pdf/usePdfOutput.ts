/**
 * حفظ ملفّ PDF وإخراجه (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو: البناء بحدّ خانة الرفع (صفحاتٌ صورًا أو صورٌ
 * مصغّرة)، والحفظ، وإلى ملفّ الزبون، واستخراج المحدَّد، والتقسيم، والصفحات صورًا.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { errorText } from '../../lib/errors';
import { type PdfPlan, sizeText, IMAGE_STEPS, fitSearch, RASTER_STEPS, pdfOverhead, rasterNote, LOW_DPI, parseRanges, type PageRef, type Overlay } from '@shared/pdfEdit';
import { type Made, shootPages, type Snap } from './pdfPages';
import { reencode, TOP_DPI, fitJpeg } from '../../lib/fitImage';
import { useToolNav } from '../../components/ToolFrame';
import { count, toIndic } from '@shared/arabic';

export function usePdfOutput(
  ctx: {
    setBusy: Dispatch<SetStateAction<string | null>>;
    setBaseline: Dispatch<SetStateAction<Snap>>;
    latest: MutableRefObject<Snap>;
    say: (text: string, tone?: 'ok' | 'warn') => void;
    gray: boolean;
    limit: number;
    plan: PdfPlan;
    name: string;
    targets: string[];
    pages: PageRef[];
    overlays: Overlay[];
    setSplitText: Dispatch<SetStateAction<string | null>>;
    selected: string[];
  }
) {
  const { setBusy, setBaseline, latest, say, gray, limit, plan, name, targets, pages, overlays, setSplitText, selected } = ctx;

  async function run<T>(label: string, work: () => Promise<T>): Promise<T | null> {
    setBusy(label);
    try {
      const out = await work();
      // ما خرج ملفًّا أو صار في ملفّ الزبون: لا تُسأل الجلسة بعده (ج٣).
      if (out) setBaseline(latest.current);
      return out;
    } catch (e) {
      say(errorText(e, 'تعذّر إتمام العملية'), 'warn');
      return null;
    } finally {
      setBusy(null);
    }
  }

  /**
   * الملف كما يُحفظ: يُبنى، فإن تجاوز الحدّ صُغّرت صوره أوّلًا **ونصّه باقٍ**؛ فإن لم يكفِ
   * (أو طُلب «أبيض وأسود») صارت صفحاته صورًا بأجود درجةٍ تبلغه. وما لم تبلغه درجةٌ يُقال
   * بأصغر ما بلغ — ولا يُحفظ ملفٌّ يرفضه الموقع.
   */
  async function produce(sub: PdfPlan): Promise<Made> {
    const bytes = await window.diwan.pdf.build(sub);
    if (!gray && (!limit || bytes.length <= limit)) return { bytes, raster: false };
    if (!gray) {
      setBusy(`تُصغَّر صوره ليبلغ ${sizeText(limit)}…`);
      for (const step of IMAGE_STEPS) {
        const out = await window.diwan.pdf.shrinkImages(bytes, step);
        if (!out.images) break;
        if (out.bytes.length <= limit) return { bytes: out.bytes, raster: false, shrunk: true };
      }
    }
    setBusy(limit ? `يُصغَّر صفحاتٍ صورًا ليبلغ ${sizeText(limit)}…` : 'يُحوَّل أبيض وأسود…');
    const shots = await shootPages(bytes);
    const fit = await fitSearch(limit, RASTER_STEPS, async (step) => {
      const jpegs: Blob[] = [];
      for (const s of shots) jpegs.push(await reencode(s.shot, step.dpi, step.quality, gray));
      const estimate = jpegs.reduce((n, b) => n + b.size, 0) + pdfOverhead(jpegs.length);
      if (limit && estimate > limit) return { size: estimate, value: null };
      const pages = await Promise.all(jpegs.map(async (b, k) => ({ jpeg: new Uint8Array(await b.arrayBuffer()), width: shots[k]!.w, height: shots[k]!.h })));
      const pdf = await window.diwan.pdf.assemble(pages);
      return { size: pdf.length, value: pdf };
    });
    if ('smallest' in fit) {
      throw new Error(`لم يبلغ الملف ${sizeText(limit)} — أصغر ما بلغه ${sizeText(fit.smallest)}. ${gray ? '' : 'جرّب «أبيض وأسود»، أو '}قسّمه أجزاءً`);
    }
    // والدقّة التي بلغها تُقال (هـ٢) — وكانت تُهمل فيُرفض ملفٌّ «نجح».
    return { bytes: fit.value, raster: true, dpi: fit.step.dpi, gray };
  }

  const madeNote = (m: Made) =>
    `${sizeText(m.bytes.length)}${m.raster ? `، ${rasterNote(m.dpi ?? TOP_DPI, m.gray === true)}` : m.shrunk ? '، صُغّرت صوره ونصّه باقٍ' : ''}`;
  /** ملفٌّ دقّته دون ما تقبله الجهات غالبًا يُقال بلون التنبيه. */
  const madeTone = (m: Made) => (m.raster && (m.dpi ?? TOP_DPI) < LOW_DPI ? 'warn' : 'ok');

  async function saveAs(sub: PdfPlan, fileName: string) {
    return run('يُبنى الملف…', async () => {
      const made = await produce(sub);
      const path = await window.diwan.pdf.save(made.bytes, fileName);
      return path ? { path, made } : null;
    });
  }

  async function save() {
    const out = await saveAs(plan, name || 'ملف معدّل');
    if (out) say(`حُفظ ملفًّا جديدًا (${madeNote(out.made)}): ${out.path} — والأصل كما هو`, madeTone(out.made));
  }

  /** الملف الجاهز في ملفّ الزبون الذي فُتحت له الأداة (المرحلة ٥) — بحدّه كما في الحفظ. */
  const nav = useToolNav();
  async function toCustomer() {
    const who = nav.customer;
    if (!who) return;
    const done = await run('يُبنى الملف…', async () => {
      const made = await produce(plan);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(new Blob([made.bytes as BlobPart], { type: 'application/pdf' }));
      });
      await window.diwan.attachments.addFromDataUrl(who.id, name || 'ملف PDF', dataUrl);
      return made;
    });
    if (done) say(`صار في ملفّ ${who.name || 'الزبون'} (${madeNote(done)})`, madeTone(done));
  }

  /** الصفحات المحدَّدة ملفًّا جديدًا وحدها — بطبقاتها. */
  async function extract() {
    const ids = targets;
    if (!ids.length) return;
    const sub: PdfPlan = { pages: pages.filter((p) => ids.includes(p.id)), overlays };
    const out = await saveAs(sub, `${name || 'ملف'} — صفحات`);
    if (out) say(`حُفظت الصفحات ملفّاتٍ جديدة: ${count(ids.length, 'ملف')} (${madeNote(out.made)})`, madeTone(out.made));
  }

  /** «1-3، 4-6»: كلُّ مجموعةٍ ملفّ؛ وفارغةً: كلُّ صفحةٍ ملفّ. */
  async function split(text: string) {
    const groups = text.trim()
      ? text.split(/[;؛]|\s+و\s+/).map((g) => parseRanges(g, pages.length)).filter((g) => g.length)
      : pages.map((_, i) => [i]);
    if (!groups.length) {
      say('اكتب المجموعات هكذا: 1-3؛ 4-6 — أو اتركها فارغةً لتصير كلّ صفحةٍ ملفًّا', 'warn');
      return;
    }
    setSplitText(null);
    const out = await run('يُقسَّم…', async () => {
      // كلّ جزءٍ يُبنى ويُصغَّر لحدّه وحده — فالجزء الكبير لا يُسقط الصغير.
      const items: { bytes: Uint8Array; name: string }[] = [];
      for (const [k, g] of groups.entries()) {
        const made = await produce({ pages: g.map((i) => pages[i]!), overlays });
        items.push({ bytes: made.bytes, name: `${name || 'ملف'} — جزء ${k + 1}` });
      }
      return window.diwan.pdf.saveMany(items);
    });
    if (out) say(`حُفظ ${count(out.files.length, 'ملف')} في ${out.folder}`);
  }

  /**
   * الصفحات صورًا JPG — من الملف كما يُبنى، فالصورة بطبقاتها وقصّها كما في PDF. وحدّ الحجم
   * لكلّ صورةٍ وحدها: فخانة «الوجه الأول» صورةٌ بحدّها.
   */
  async function toImages() {
    // المحدَّد وحده إن حُدِّد شيء، وإلا فالملف كلّه — لا الصفحة المعروضة وحدها.
    const ids = selected.length ? selected : pages.map((p) => p.id);
    const sub: PdfPlan = { pages: pages.filter((p) => ids.includes(p.id)), overlays };
    const out = await run('تُرسم الصفحات صورًا…', async () => {
      const shots = await shootPages(await window.diwan.pdf.build(sub));
      const images: { name: string; bytes: Uint8Array }[] = [];
      for (const [k, s] of shots.entries()) {
        let blob = s.shot;
        if (gray || (limit && blob.size > limit)) {
          const fit = await fitJpeg(s.shot, limit, gray);
          if ('smallest' in fit) throw new Error(`الصفحة ${toIndic(k + 1)} لم تبلغ ${sizeText(limit)} — أصغر ما بلغته ${sizeText(fit.smallest)}`);
          blob = fit.blob;
        }
        images.push({ name: `${name || 'ملف'} — صفحة ${k + 1}`, bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      return window.diwan.pdf.saveImages(images);
    });
    if (out) say(`حُفظت ${count(out.files.length, 'صورة')} في ${out.folder}`);
  }

  return { saveAs, extract, toImages, save, nav, toCustomer, split };
}
