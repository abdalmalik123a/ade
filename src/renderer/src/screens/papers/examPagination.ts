/**
 * صفحات ورقة الأسئلة بالقياس (D133) — لا بالتقدير.
 *
 * كان التقسيم يعدّ الحروف والفروع «أسطرًا» (`questionWeight`)، فلا يعرف حجم الخطّ ولا ارتفاع الصورة ولا طول السطر: ورقةٌ تسعها صفحةٌ
 * قُسمت وجهين، وثلاث صورٍ كبيرة فاضت إلى ورقةٍ ثالثة تذييلها «٢ من ٢». فهنا تُرسم الورقة كاملةً مرّةً في حاويةٍ خفيّة بعرض الورقة
 * وحشوها وأنماطها، وتُقرأ ارتفاعات أسئلتها الأمّ ورأسها وما بعدها، ويقسمها `examPageCounts`. ويُعاد القياس حين تتغيّر الورقة،
 * وحين تكتمل صورةٌ أو خطّ (يُرسمان بعد النصّ).
 */
import { useLayoutEffect, useState } from 'react';
import type { Dir, Numerals } from '@shared/doc';
import { examContinuationHtml, examFooterHtml, examPageCounts, type ExamMeasure } from '@shared/examPaper';
import { MM_PX } from '../../components/pageFlow';

/** ما يُترك احتياطًا لفروق التقريب بين المعاينة والطابعة (بكسل). */
const SAFETY = 6;

type Margins = { top: number; right: number; bottom: number; left: number };

export type ExamLayout = { dir: Dir; margins: Margins; pageH: number; numerals: Numerals; head: Record<string, string>; halves: boolean };

const BODY = 'text-black font-body-md text-body-md leading-relaxed';

/** الورقة كاملةً وتحتها رأس المتابعة والتذييل — بأنماط ورقة المعاينة نفسها، خارج الشاشة ولا تُرى ولا تُعدّ في الصفحة. */
function mount(html: string, o: ExamLayout): HTMLElement {
  const pad = `padding:${o.margins.top}mm ${o.margins.right}mm ${o.margins.bottom}mm ${o.margins.left}mm`;
  // بلا علامات الصفحة: فلا يجدها من يبحث عن تذييل الورقة المعروضة.
  const probes = (examContinuationHtml(o.head) + examFooterHtml(1, 2, o.numerals)).replace(/ data-paper-page-(header|footer)="\d+"/g, '');
  const host = document.createElement('div');
  host.dataset.examMeasure = '';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none';
  host.innerHTML =
    `<div class="a4-sheet"><div class="${BODY}" dir="${o.dir}" data-measure-body="" style="${pad}">${html}</div></div>` +
    `<div class="a4-sheet"><div class="${BODY}" dir="${o.dir}" style="${pad}"><div data-measure-probes="" style="display:flow-root">${probes}</div></div></div>`;
  document.body.appendChild(host);
  return host;
}

function read(host: HTMLElement, o: ExamLayout): ExamMeasure | null {
  const body = host.querySelector<HTMLElement>('[data-measure-body]');
  const list = body?.querySelector<HTMLElement>('[data-flow="lines"]');
  const probes = host.querySelector<HTMLElement>('[data-measure-probes]');
  if (!body || !list || !probes) return null;
  const b = body.getBoundingClientRect();
  const top = b.top + o.margins.top * MM_PX;
  const bottom = b.bottom - o.margins.bottom * MM_PX;
  const l = list.getBoundingClientRect();
  const kids = Array.from(list.children, (el) => el.getBoundingClientRect().top);
  // السؤال من أعلاه إلى أعلى ما بعده — فيدخل الهامش بينهما.
  const heights = kids.map((t, i) => (kids[i + 1] ?? l.bottom) - t);
  const [cont, footer] = Array.from(probes.children, (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.height + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
  });
  return {
    page: (o.pageH - o.margins.top - o.margins.bottom) * MM_PX - SAFETY,
    head: l.top - top,
    cont: cont ?? 0,
    footer: footer ?? 0,
    tail: bottom - l.bottom,
    heights
  };
}

const same = (a: Record<string, number[]>, b: Record<string, number[]>): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * عدد الأسئلة في كلّ صفحة لكلّ نسخةٍ من الورقة (`''` الورقة، و«أ» و«ب» النموذجان — فلكلٍّ ترتيب فروعه).
 * وقبل أوّل قياسٍ لا شيء: الورقة صفحةٌ واحدة.
 */
export function useExamPages(variants: Record<string, string>, o: ExamLayout): Record<string, number[]> {
  const [pages, setPages] = useState<Record<string, number[]>>({});
  const { dir, pageH, numerals, head, halves } = o;
  const { top, right, bottom, left } = o.margins;
  useLayoutEffect(() => {
    const layout: ExamLayout = { dir, margins: { top, right, bottom, left }, pageH, numerals, head, halves };
    const hosts = Object.entries(variants).map(([name, html]) => [name, mount(html, layout)] as const);
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const next: Record<string, number[]> = {};
      for (const [name, host] of hosts) {
        const m = read(host, layout);
        next[name] = m ? examPageCounts(m, halves) : [];
      }
      setPages((prev) => (same(prev, next) ? prev : next));
    };
    measure();
    for (const [, host] of hosts) {
      for (const img of Array.from(host.querySelectorAll('img'))) {
        if (img.complete) continue;
        img.addEventListener('load', measure);
        img.addEventListener('error', measure);
      }
    }
    const fonts = document.fonts;
    fonts?.addEventListener('loadingdone', measure);
    void fonts?.ready.then(measure);
    return () => {
      alive = false;
      fonts?.removeEventListener('loadingdone', measure);
      for (const [, host] of hosts) host.remove();
    };
  }, [variants, dir, top, right, bottom, left, pageH, numerals, head, halves]);
  return pages;
}
