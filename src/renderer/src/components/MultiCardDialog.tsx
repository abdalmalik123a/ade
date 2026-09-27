/**
 * «عدّة بطاقاتٍ بمسحةٍ واحدة» (هـ٢) — في ملف المواطن.
 *
 * البطاقات على الزجاج معًا: مسحةٌ للوجوه تُعرف فيها كلّ بطاقةٍ وتُقصّ، ثم تُقلب
 * البطاقات **في أماكنها** ومسحةٌ للظهور يُطابَق فيها كلّ ظهرٍ بوجهه من موضعه. ويُرى
 * كلّ مقصوصٍ قبل الحفظ، ويُسمّى، ويُترك ما لا يُراد.
 */
import { useState } from 'react';
import { detectCards, matchBacks, padRect, type Rect } from '@shared/multiCard';

type Page = { img: HTMLImageElement; rects: Rect[] };

const storeUrl = (rel: string) => `diwan://store/${rel}`;

async function loadPage(rel: string): Promise<Page> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('تعذّر فتح الصورة'));
    i.src = storeUrl(rel);
  });
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return { img, rects: detectCards(ctx.getImageData(0, 0, c.width, c.height)) };
}

function crop(page: Page, r: Rect): string {
  const p = padRect(r, { w: page.img.naturalWidth, h: page.img.naturalHeight });
  const c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h;
  c.getContext('2d')!.drawImage(page.img, p.x, p.y, p.w, p.h, 0, 0, p.w, p.h);
  return c.toDataURL('image/jpeg', 0.92);
}

export default function MultiCardDialog({
  citizenId,
  onSaved,
  onClose
}: {
  citizenId: number;
  onSaved: (count: number) => void;
  onClose: () => void;
}) {
  const [fronts, setFronts] = useState<Page | null>(null);
  const [backs, setBacks] = useState<Page | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function acquire(side: 'fronts' | 'backs', how: 'scan' | 'file') {
    setBusy(side);
    setNote(null);
    try {
      const rel = how === 'scan' ? await window.diwan.scanner.scanImage(300) : await window.diwan.files.pickImage('scans');
      if (!rel) return;
      const page = await loadPage(rel);
      if (side === 'fronts') {
        setFronts(page);
        setBacks(null);
        setNames(page.rects.map((_, i) => `بطاقة ${i + 1}`));
        setKeep(page.rects.map(() => true));
        setNote(page.rects.length ? null : 'لم تُعرف بطاقةٌ في الصورة — أهي على زجاجٍ بغطاءٍ أبيض، ومتباعدة؟');
      } else {
        setBacks(page);
        if (!page.rects.length) setNote('لم تُعرف بطاقةٌ في مسحة الظهور');
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'تعذّر المسح');
    } finally {
      setBusy(null);
    }
  }

  const pairing =
    fronts && backs ? matchBacks(fronts.rects, backs.rects, { w: fronts.img.naturalWidth, h: fronts.img.naturalHeight }) : [];

  async function save() {
    if (!fronts) return;
    setBusy('save');
    let n = 0;
    try {
      for (const [i, r] of fronts.rects.entries()) {
        if (!keep[i]) continue;
        const name = names[i]?.trim() || `بطاقة ${i + 1}`;
        const back = pairing[i];
        await window.diwan.attachments.addFromDataUrl(citizenId, back != null ? `${name} — الوجه` : name, crop(fronts, r));
        n++;
        if (back != null && backs) {
          await window.diwan.attachments.addFromDataUrl(citizenId, `${name} — الظهر`, crop(backs, backs.rects[back]!));
          n++;
        }
      }
      onSaved(n);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'تعذّر الحفظ');
      setBusy(null);
    }
  }

  const sourceButtons = (side: 'fronts' | 'backs') => (
    <div className="flex gap-space-xs">
      <button
        className="h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold disabled:opacity-40"
        data-act={`multi-scan-${side}`}
        type="button"
        disabled={busy !== null}
        onClick={() => void acquire(side, 'scan')}
      >
        {busy === side ? 'يمسح…' : side === 'fronts' ? 'امسح الوجوه' : 'اقلبها في أماكنها وامسح الظهور'}
      </button>
      <button
        className="h-9 px-space-md rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-40"
        data-act={`multi-file-${side}`}
        type="button"
        disabled={busy !== null}
        onClick={() => void acquire(side, 'file')}
      >
        من صورة…
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/60 p-space-md" data-multi-card="">
      <div className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">عدّة بطاقاتٍ بمسحةٍ واحدة</h2>
          <p className="font-label-md text-label-md text-on-surface-variant">
            ضع البطاقات على الزجاج متباعدةً وامسح وجوهها — ثم اقلب كلّ بطاقةٍ في مكانها وامسح ظهورها، فيُطابَق كلّ ظهرٍ بوجهه.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-md">
          {sourceButtons('fronts')}
          {fronts && fronts.rects.length > 0 && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-space-sm" data-multi-cards={fronts.rects.length}>
                {fronts.rects.map((r, i) => (
                  <div key={i} className={`rounded-lg p-space-xs flex flex-col gap-1 ${keep[i] ? 'bg-surface-container-low' : 'bg-surface-container-low opacity-50'}`}>
                    <div className="flex gap-1">
                      <img alt="" className="flex-1 min-w-0 h-24 object-contain bg-white rounded" src={crop(fronts, r)} />
                      {pairing[i] != null && backs && (
                        <img alt="" className="flex-1 min-w-0 h-24 object-contain bg-white rounded" data-multi-back="" src={crop(backs, backs.rects[pairing[i]!]!)} />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <input checked={keep[i]} className="w-4 h-4 accent-secondary" type="checkbox" onChange={(e) => setKeep((k) => k.map((v, j) => (j === i ? e.target.checked : v)))} />
                      <input
                        className="flex-1 min-w-0 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md"
                        value={names[i] ?? ''}
                        onChange={(e) => setNames((n) => n.map((v, j) => (j === i ? e.target.value : v)))}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {sourceButtons('backs')}
              {backs && (
                <p className="font-label-sm text-label-sm text-on-surface-variant" data-multi-pairs="">
                  طوبق {pairing.filter((p) => p != null).length} ظهرًا من {fronts.rects.length} وجهًا بموضعه على الزجاج
                </p>
              )}
            </>
          )}
          {note && <p className="font-label-md text-label-md text-error">{note}</p>}
        </div>

        <div className="p-space-md bg-surface-container-low flex justify-between gap-space-sm">
          <button className="h-10 px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
            إلغاء
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
            data-act="multi-save"
            type="button"
            disabled={!fronts || !keep.some(Boolean) || busy !== null}
            onClick={() => void save()}
          >
            احفظها في مستمسكاته
          </button>
        </div>
      </div>
    </div>
  );
}
