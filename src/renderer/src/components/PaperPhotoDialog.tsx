/**
 * «من صورة ورقة» (هـ٨): صورةٌ أو مسحٌ أو لقطة كاميرا ← كتابٌ يُحرَّر.
 *
 * كلّه على هذا الجهاز: الصورة تُسوّى وتُقوَّم ويُمحى ختمها وخطوطها هنا، ويقرؤها
 * القارئ المحلي، ثم تُعرض القراءة **قبل** أن تصير كتابًا: الصورة بمربّعات ما قُرئ،
 * وما يُراجَع بقصاصته من الصورة — كلّ رقمٍ، وكلّ كلمةٍ ضعيفة، واقتراحات الإملاء،
 * وما أُسقط لأنه لا يشبه نصًّا. والتواقيع والأختام لا تُنقل: الكتاب يُكتب ويُوقَّع
 * من جديد، لا يُقلَّد.
 */
import { useMemo, useState } from 'react';
import type { PixelData } from '@shared/deskew';
import type { Doc } from '@shared/doc';
import { preparePaper, type Box } from '@shared/paperRules';
import { paperDoc, planPaper, type PaperPlan, type ReviewReason } from '@shared/paperDoc';
import { applySpelling } from '@shared/spelling';
import CameraCapture from './CameraCapture';

/** الأرقام بالهندية — إلا ما لصق حرفًا لاتينيًّا: «A4» اسمُ مقاسٍ لا عدد. */
const toIndic = (n: number | string) => String(n).replace(/(?<![A-Za-z])\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

const REASON: Record<ReviewReason, string> = {
  digits: 'أرقام — طابقها بالصورة',
  weak: 'قراءةٌ ضعيفة',
  spelling: 'إملاء',
  dropped: 'لم يُنقل'
};

async function pixelsOf(dataUrl: string, maxSide = 3600): Promise<PixelData> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function canvasOf(px: PixelData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = px.width;
  c.height = px.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  return c;
}

async function pngOf(px: PixelData): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) => canvasOf(px).toBlob(r, 'image/png'));
  if (!blob) throw new Error('تعذّر تجهيز الصورة للقراءة');
  return new Uint8Array(await blob.arrayBuffer());
}

/** قصاصةٌ من الصورة حول القطعة — يُقارَن بها ما قُرئ. */
function crop(view: HTMLCanvasElement, b: Box): string {
  const pad = Math.round((b.y1 - b.y0) * 0.35);
  const x0 = Math.max(0, b.x0 - pad);
  const y0 = Math.max(0, b.y0 - pad);
  const w = Math.min(view.width, b.x1 + pad) - x0;
  const h = Math.min(view.height, b.y1 + pad) - y0;
  const c = document.createElement('canvas');
  const k = Math.min(1, 520 / Math.max(1, w));
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d')!.drawImage(view, x0, y0, w, h, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

type Read = { plan: PaperPlan; view: string; crops: Record<string, string>; w: number; h: number; tables: Box[]; marks: Box[] };

export default function PaperPhotoDialog({
  onOpen,
  onClose
}: {
  onOpen: (out: { doc: Doc; title: string; notes: string[] }) => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<'pick' | 'camera' | 'reading' | 'review'>('pick');
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [keep, setKeep] = useState<Record<string, boolean>>({});

  async function readImage(dataUrl: string, fileDpi: number | null, fromCamera: boolean) {
    setError(null);
    setStage('reading');
    const pause = () => new Promise((r) => setTimeout(r, 30));
    try {
      if (!(await window.diwan.scanner.ocrAvailable())) throw new Error('بيانات القارئ المحلي غير مثبّتة مع التطبيق');
      setStep('تُفتح الصورة…');
      await pause();
      const src = await pixelsOf(dataUrl);
      // صورة الهاتف (أو ملفٌّ بلا دقّةٍ معروفة) تُسوّى من أركانها وتُسوّى إضاءتها؛ والمسح لا.
      const photo = fromCamera || fileDpi === null || fileDpi < 150;
      setStep('تُقوَّم ويُمحى الختم والخطوط…');
      await pause();
      const prep = preparePaper(src, { photo });
      setStep('يقرؤها القارئ المحلي…');
      await pause();
      const dpi = prep.warped || fileDpi === null ? Math.round(prep.clean.width / 8.27) : Math.round((fileDpi * prep.clean.width) / src.width);
      const lines = await window.diwan.templates.readPaper(await pngOf(prep.clean), dpi);
      if (!lines.some((l) => l.words.some((w) => w.text.trim()))) throw new Error('لم يُقرأ في الصورة نصّ — صوّرها أقرب، أو امسحها بدقّة ٣٠٠');
      const plan = planPaper({
        width: prep.clean.width,
        height: prep.clean.height,
        lines,
        tables: prep.rules.tables,
        dividers: prep.rules.dividers,
        marks: prep.marks
      });
      if (prep.angle) plan.notes.unshift(`قُوّمت بزاوية ${Math.abs(prep.angle).toFixed(1)}°`);
      if (prep.warped) plan.notes.unshift('سُوّيت الصورة من أركانها إلى ورقة A4');
      const view = canvasOf(prep.view);
      const crops: Record<string, string> = {};
      for (const r of plan.review) {
        const p = plan.pieces.find((x) => x.id === r.id);
        if (p) crops[r.id] = crop(view, p.box);
      }
      setTexts({});
      setKeep({});
      setRead({
        plan,
        view: view.toDataURL('image/jpeg', 0.85),
        crops,
        w: view.width,
        h: view.height,
        tables: prep.rules.tables.map((t) => t.box),
        marks: prep.marks
      });
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('pick');
    }
  }

  async function pickFile() {
    const f = await window.diwan.templates.pickPaper();
    if (f) await readImage(f.dataUrl, f.dpi, false);
  }

  const reviewed = useMemo(() => {
    if (!read) return [];
    return read.plan.review.map((r) => ({ r, p: read.plan.pieces.find((x) => x.id === r.id)! })).filter((x) => x.p);
  }, [read]);

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const boxStyle = (b: Box) =>
    read ? { left: pct(b.x0, read.w), top: pct(b.y0, read.h), width: pct(b.x1 - b.x0, read.w), height: pct(b.y1 - b.y0, read.h) } : {};

  if (stage === 'camera') {
    return (
      <CameraCapture
        confirmLabel="اقرأ هذه الورقة"
        title="صوّر الورقة كلّها — من فوقها، وفي ضوءٍ متساوٍ"
        onCapture={(dataUrl) => void readImage(dataUrl, null, true)}
        onClose={() => setStage('pick')}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-space-md" data-paper-photo="">
      <div className="w-full max-w-6xl max-h-[92vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low flex items-start justify-between gap-space-md">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">كتابٌ من صورة ورقة</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">
              تُقرأ على هذا الجهاز وحده. والتواقيع والأختام لا تُنقل — الكتاب يُكتب ويُوقَّع من جديد.
            </p>
          </div>
          <button className="w-9 h-9 rounded-lg hover:bg-surface-container-high flex items-center justify-center" title="إغلاق" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {stage === 'pick' && (
          <div className="p-space-lg flex flex-col items-center gap-space-md">
            {error && (
              <p className="font-label-md text-label-md text-error" data-paper-error="">
                {error}
              </p>
            )}
            <div className="flex gap-space-md">
              <button
                className="h-24 w-56 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex flex-col items-center justify-center gap-1 font-label-md text-label-md font-semibold"
                data-act="paper-pick"
                type="button"
                onClick={() => void pickFile()}
              >
                <span className="material-symbols-outlined text-[28px]">image</span>
                صورةٌ أو مسحٌ من الجهاز
              </button>
              <button
                className="h-24 w-56 rounded-xl bg-surface-container-high text-on-surface flex flex-col items-center justify-center gap-1 font-label-md text-label-md font-semibold"
                data-act="paper-camera"
                type="button"
                onClick={() => setStage('camera')}
              >
                <span className="material-symbols-outlined text-[28px]">photo_camera</span>
                بالكاميرا
              </button>
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant max-w-lg text-center">
              المسح بدقّة ٣٠٠ أوضح قراءة. وصورة الهاتف تُسوّى من أركانها — صوّر الورقة كلّها على سطحٍ داكن.
            </p>
          </div>
        )}

        {stage === 'reading' && (
          <div className="p-space-lg flex items-center justify-center gap-space-sm font-label-md text-label-md text-on-surface" data-paper-reading="">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            {step}
          </div>
        )}

        {stage === 'review' && read && (
          <>
            <div className="flex-1 min-h-0 flex gap-space-md p-space-md overflow-hidden">
              {/* الصورة بمربّعات ما قُرئ */}
              <div className="w-[42%] shrink-0 overflow-y-auto">
                <div className="relative w-full" data-paper-view="">
                  <img alt="الورقة" className="w-full block rounded-lg border border-outline-variant" src={read.view} />
                  {read.plan.pieces.map((p) => {
                    const flagged = read.plan.review.some((r) => r.id === p.id);
                    const kept = keep[p.id] ?? p.keep;
                    return (
                      <div
                        key={p.id}
                        className={`absolute rounded-sm ${!kept ? 'border border-dashed border-error' : flagged ? 'border-2 border-tertiary bg-tertiary/10' : 'border border-secondary/60'}`}
                        style={boxStyle(p.box)}
                        title={texts[p.id] ?? p.text}
                      />
                    );
                  })}
                  {read.marks.map((b, i) => (
                    <div key={`m${i}`} className="absolute border-2 border-dotted border-outline" style={boxStyle(b)} title="ختمٌ أو توقيع — لا يُنقل" />
                  ))}
                </div>
              </div>

              {/* ما قُرئ وما يُراجَع */}
              <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-space-sm">
                <ul className="flex flex-col gap-1 font-label-md text-label-md text-on-surface" data-paper-notes="">
                  {read.plan.notes.map((n) => (
                    <li key={n} className="flex items-start gap-1">
                      <span aria-hidden className="material-symbols-outlined text-[16px] text-secondary mt-0.5">
                        check_small
                      </span>
                      <span data-paper-note="">{toIndic(n)}</span>
                    </li>
                  ))}
                </ul>
                <p className="font-label-md text-label-md text-on-surface font-semibold">
                  قُرئت {toIndic(read.plan.pieces.filter((p) => p.keep).length)} قطعة —{' '}
                  {reviewed.length ? `${toIndic(reviewed.length)} تُراجَع بصورتها` : 'لا شيء يحتاج مراجعة'}
                </p>
                <div className="flex flex-col gap-space-xs" data-paper-review="">
                  {reviewed.map(({ r, p }) => {
                    const value = texts[p.id] ?? p.text;
                    const dropped = r.reasons.includes('dropped');
                    const kept = keep[p.id] ?? p.keep;
                    return (
                      <div key={p.id} className="p-space-xs rounded-lg bg-surface-container-low flex flex-col gap-1" data-paper-item={p.id}>
                        <div className="flex flex-wrap items-center gap-1">
                          {r.reasons.map((why) => (
                            <span
                              key={why}
                              className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${why === 'digits' ? 'bg-tertiary-container text-on-tertiary-container' : why === 'dropped' ? 'bg-error-container text-on-error-container' : 'bg-secondary-fixed text-on-secondary-fixed'}`}
                            >
                              {REASON[why]}
                              {why === 'weak' && p.weak.length ? `: ${p.weak.join('، ')}` : ''}
                            </span>
                          ))}
                          {p.field && <span className="font-label-sm text-label-sm text-on-surface-variant">— يصير حقل «{p.field.label}»</span>}
                        </div>
                        <img alt="" className="max-w-full self-start rounded border border-outline-variant bg-white" src={read.crops[p.id]} />
                        {dropped ? (
                          <label className="flex items-center gap-space-xs font-label-md text-label-md">
                            <input
                              checked={kept}
                              data-paper-keep={p.id}
                              type="checkbox"
                              onChange={(e) => setKeep((k) => ({ ...k, [p.id]: e.target.checked }))}
                            />
                            انقله نصًّا: «{value}»
                          </label>
                        ) : (
                          <input
                            className="h-9 px-2 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md border border-outline-variant focus:outline-none focus:ring-2 focus:ring-secondary"
                            data-paper-text={p.id}
                            dir="rtl"
                            value={value}
                            onChange={(e) => setTexts((t) => ({ ...t, [p.id]: e.target.value }))}
                          />
                        )}
                        {r.spelling.map((s) => (
                          <button
                            key={s.word + s.fix}
                            className="self-start font-label-sm text-label-sm text-secondary font-semibold hover:underline"
                            data-act="paper-spelling"
                            type="button"
                            onClick={() => setTexts((t) => ({ ...t, [p.id]: applySpelling(t[p.id] ?? p.text, [s]) }))}
                          >
                            اقبل: «{s.word}» ← «{s.fix}» ({s.reason})
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-space-md bg-surface-container-low flex items-center justify-between gap-space-sm">
              <button className="h-10 px-space-md rounded-lg hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={() => setStage('pick')}>
                صورةٌ أخرى
              </button>
              <button
                className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                data-act="paper-open"
                type="button"
                onClick={() => onOpen({ doc: paperDoc(read.plan, { texts, keep }), title: read.plan.title, notes: read.plan.notes })}
              >
                افتحه نموذجًا في المصمّم
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
