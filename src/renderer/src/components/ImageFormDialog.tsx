/**
 * «من صورة استمارة» (خطّة الترقية، المرحلة ٤ — ن١٨): صورة الدائرة كما هي، والخانات فوقها.
 *
 * تُقوَّم الصورة وتُنظَّف هنا، ويقرؤها القارئ المحلي، وتُكشف صناديقها وفراغاتها فتُسمّى خاناتها
 * (`shared/imageForm.ts`). ثم تُعرض قبل أن تُحفظ: الصورة بخاناتها ملوّنةً، وأسماؤها تُصحَّح وتُترك.
 * وما لم يُكتشف يُرسم في المصمّم. وتُحفظ نموذجًا في المكتبة يُملأ من الشبّاك كأيّ نموذج.
 */
import { useMemo, useState } from 'react';
import { eraseBoxes, preparePaper } from '@shared/paperRules';
import { borderBands, cropPixels, findBoxes, findLeaders, inkShare } from '@shared/formBoxes';
import { assignKeys, imageFormDoc, planImageForm, unreadCells, withCellRead, type FormSlot } from '@shared/imageForm';
import { canvasOf, pixelsOf, pngOf } from '../lib/pixels';
import { useEscape } from '../kit/useEscape';

const KIND: Record<FormSlot['kind'], { label: string; color: string }> = {
  text: { label: 'خانة', color: 'rgba(21,112,218,0.25)' },
  date: { label: 'تاريخ', color: 'rgba(124,58,237,0.25)' },
  check: { label: 'اختيار', color: 'rgba(5,150,105,0.35)' },
  photo: { label: 'صورة', color: 'rgba(234,88,12,0.25)' }
};

/** دقّة الصورة إن مُدّت على عرض A4 — وما دون ١٥٠ يُطبع ضبابيًّا. */
const dpiOf = (width: number) => Math.round(width / 8.27);

type Read = { title: string; view: string; png: Uint8Array; type: 'png' | 'jpg'; w: number; h: number; dpi: number; slots: FormSlot[] };

export default function ImageFormDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (templateId: number, edit: boolean) => void }) {
  useEscape(onClose);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  /** أسماء الأعمدة كما صحّحها الموظف — عمودٌ يُسمّى مرّةً فتتبعه خاناته كلّها. */
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function pick() {
    setError(null);
    const f = await window.diwan.templates.pickPaper();
    if (!f) return;
    try {
      if (!(await window.diwan.scanner.ocrAvailable())) throw new Error('بيانات القارئ المحلي غير مثبّتة مع التطبيق');
      setStep('تُفتح الصورة…');
      // الدقّة من الصورة الأصلية — قبل تكبيرها: تُطبع الخلفيّة بها.
      const probe = new Image();
      probe.src = f.dataUrl;
      await probe.decode();
      const originalDpi = f.dpi ?? dpiOf(Math.min(probe.naturalWidth, probe.naturalHeight));
      // الصغيرة تُكبَّر: صورة واتساب بعرض ٤٦٤ بكسلًا لا يُقرأ فيها شيء.
      const src = await pixelsOf(f.dataUrl, 3600, 2200);
      setStep('تُقوَّم وتُنظَّف…');
      // صورة الدائرة مسحٌ أو لقطةٌ مستقيمة — لا صورةُ هاتفٍ تُسوّى من أركانها: إطار الاستمارة يُحسب
      // ورقةً فتُمطّ «معلومات» الأفقية إلى A4 عمودية وتتشوّه خاناتها.
      const prep = preparePaper(src, { photo: false });
      setStep('تُكشف خاناتها…');
      const boxes = findBoxes(prep.view);
      setStep('يقرؤها القارئ المحلي…');
      // حدود الصناديق تُمحى قبل القراءة: خطوط الجدول تُقرأ حروفًا فتتفكّك كلمات الخانة.
      const page = eraseBoxes(prep.clean, borderBands(boxes, prep.clean.width, prep.clean.height), 0);
      const dpi = dpiOf(Math.min(page.width, page.height));
      let lines = await window.diwan.templates.readPaper(await pngOf(page), dpi);
      const inks = boxes.map((b) => inkShare(prep.view, b));
      // خانةٌ فيها حبرٌ لم يُقرأ منه شيء تُقرأ وحدها: القارئ يُسقط الكلمة الكبيرة وحدها («المجموع»).
      for (const b of unreadCells(boxes, inks, lines)) {
        const c = cropPixels(page, b, 24);
        lines = withCellRead(lines, b, await window.diwan.templates.readPaper(await pngOf(c.px), dpi), c.x, c.y);
      }
      const slots = planImageForm({ width: prep.view.width, height: prep.view.height, boxes, lines, inks, leaders: findLeaders(prep.view) });
      const big = prep.view.width * prep.view.height > 2_500_000;
      setRead({
        title: f.name.replace(/\.[^.]+$/, ''),
        view: canvasOf(prep.view).toDataURL('image/jpeg', 0.85),
        png: await pngOf(prep.view, big ? 'image/jpeg' : 'image/png'),
        type: big ? 'jpg' : 'png',
        w: prep.view.width,
        h: prep.view.height,
        dpi: originalDpi,
        slots
      });
      setTitle(f.name.replace(/\.[^.]+$/, ''));
      setLabels({});
      setColumns({});
      setDropped(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStep(null);
    }
  }

  /** المتروك بمفتاحه — والعمود بـ«عمود:» واسمه. */
  const off = (s: FormSlot) => dropped.has(s.column !== undefined ? `عمود:${s.columnId ?? s.column}` : s.key);
  const kept = useMemo(() => (read ? read.slots.filter((s) => !off(s)) : []), [read, dropped]);
  /** قائمة المراجعة: خانةٌ لكلّ سطر، وعمود الجدول سطرٌ واحد بعدد خاناته. */
  const rows = useMemo(() => {
    if (!read) return [];
    const out: { id: string; kind: FormSlot['kind']; name: string; count: number; column?: string; key?: string }[] = [];
    for (const s of read.slots) {
      if (s.column !== undefined) {
        const id = `عمود:${s.columnId ?? s.column}`;
        const r = out.find((x) => x.id === id);
        if (r) r.count++;
        else out.push({ id, kind: s.kind, name: columns[id] ?? s.column, count: 1, column: id });
      } else out.push({ id: s.key, kind: s.kind, name: labels[s.key] ?? s.label, count: 1, key: s.key });
    }
    return out;
  }, [read, labels, columns]);

  async function save(edit: boolean) {
    if (!read || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const image = await window.diwan.files.storeImage(read.png);
      if (!image) throw new Error('تعذّر حفظ صورة الاستمارة');
      // الأسماء كما صُحّحت، ثم المفاتيح منها — فيتبع زوجُ «رقمًا/كتابةً» الاسمَ الجديد.
      const slots = assignKeys(
        kept.map((s) => (s.column !== undefined ? { ...s, column: columns[`عمود:${s.columnId ?? s.column}`]?.trim() || s.column } : { ...s, label: labels[s.key]?.trim() || s.label }))
      );
      const doc = imageFormDoc({ title: title.trim(), image, width: read.w, height: read.h, dpi: read.dpi, slots });
      const saved = await window.diwan.templates.save({
        id: null,
        code: null,
        title: title.trim(),
        subtitle: 'استمارة مصوّرة',
        category: 'استمارات',
        subjectLine: null,
        bodyHtml: slots.map((s) => s.label).join('\n'),
        letterheadId: null,
        variables: [],
        doc
      });
      onSaved(saved.id, edit);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const lowDpi = read ? read.dpi < 150 : false;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-space-lg" data-image-form="">
      <div className="w-full max-w-6xl max-h-full overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col">
        <div className="h-14 shrink-0 px-space-md flex items-center justify-between border-b border-outline-variant/40">
          <span className="font-headline-sm text-headline-sm text-on-surface">من صورة استمارة</span>
          <button className="w-9 h-9 rounded-lg hover:bg-surface-container-high" title="إغلاق" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {!read ? (
          <div className="p-space-lg flex flex-col items-center gap-space-md text-center">
            <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">
              صورة الاستمارة كما نشرتها الدائرة — تبقى كما هي، وتُكشف خاناتها فتُملأ من الشبّاك وتُطبع كاملةً أو قيمها
              وحدها على ورقة الدائرة.
            </p>
            <button
              className="h-11 px-space-lg rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold disabled:opacity-50"
              data-act="form-image-pick"
              disabled={Boolean(step)}
              type="button"
              onClick={() => void pick()}
            >
              {step ?? 'اختر صورة الاستمارة'}
            </button>
            {error && <span className="font-label-md text-label-md text-error">{error}</span>}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex gap-space-md p-space-md">
            <div className="flex-1 min-w-0 overflow-auto">
              <div className="relative mx-auto" style={{ width: '100%', maxWidth: 720 }}>
                <img alt="الاستمارة" className="w-full block" src={read.view} />
                {kept.map((s) => (
                  <div
                    key={s.key}
                    className="absolute rounded-sm"
                    data-slot={s.kind}
                    style={{ left: pct(s.box.x0, read.w), top: pct(s.box.y0, read.h), width: pct(s.box.x1 - s.box.x0, read.w), height: pct(s.box.y1 - s.box.y0, read.h), background: KIND[s.kind].color }}
                    title={labels[s.key] ?? s.label}
                  />
                ))}
              </div>
            </div>
            <div className="w-80 shrink-0 flex flex-col gap-space-sm min-h-0">
              <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant">
                اسمها في المكتبة
                <input className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md" data-form-title="" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <span className="font-label-md text-label-md text-on-surface font-semibold" data-slot-count={kept.length}>
                {kept.length} خانة كُشفت — صحّح اسمها أو اتركها، وما فات يُرسم في المصمّم
              </span>
              {lowDpi && (
                <span className="p-space-xs rounded-lg bg-error-container text-on-error-container font-label-sm text-label-sm" data-low-dpi="">
                  الصورة ضعيفة الدقّة (نحو {read.dpi} نقطة/إنش) — تُطبع كاملةً ضبابية. اطلب نسخةً أوضح، أو اطبع «القيم وحدها» على
                  ورقة الدائرة.
                </span>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
                {rows.map((r) => {
                  const isOff = dropped.has(r.id);
                  return (
                    <div key={r.id} className={`flex items-center gap-1 p-1 rounded-lg ${isOff ? 'opacity-40' : 'bg-surface-container-low'}`} data-slot-row={r.column !== undefined ? 'column' : r.kind}>
                      <span className="shrink-0 w-14 text-center rounded font-label-sm text-label-sm" style={{ background: KIND[r.kind].color }}>
                        {r.column !== undefined ? `عمود ×${r.count}` : KIND[r.kind].label}
                      </span>
                      <input
                        className="flex-1 min-w-0 h-8 px-2 rounded bg-surface-container-lowest font-label-md text-label-md"
                        disabled={isOff}
                        value={r.name}
                        onChange={(e) =>
                          r.column !== undefined
                            ? setColumns((c) => ({ ...c, [r.column!]: e.target.value }))
                            : setLabels((l) => ({ ...l, [r.key!]: e.target.value }))
                        }
                      />
                      <button
                        className="w-8 h-8 rounded text-on-surface-variant hover:bg-surface-container-high"
                        title={isOff ? 'أعِدها' : 'ليست خانة'}
                        type="button"
                        onClick={() => setDropped((d) => { const n = new Set(d); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                      >
                        <span className="material-symbols-outlined text-[16px]">{isOff ? 'undo' : 'close'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              {error && <span className="font-label-sm text-label-sm text-error">{error}</span>}
              <div className="flex flex-col gap-space-xs">
                <button
                  className="h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-50"
                  data-act="form-image-save"
                  disabled={saving || !title.trim()}
                  type="button"
                  onClick={() => void save(false)}
                >
                  احفظها في المكتبة
                </button>
                <button
                  className="h-10 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-50"
                  data-act="form-image-edit"
                  disabled={saving || !title.trim()}
                  type="button"
                  onClick={() => void save(true)}
                >
                  احفظ وارسم ما فات في المصمّم
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
