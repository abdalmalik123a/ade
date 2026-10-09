/**
 * «المكتبة ← العناصر» — مكتبة العناصر (DESIGNS.md ٣٫٧ و٠٫٨): زخارف وإطارات وأيقونات وصور ظلّية يستوردها المكتب (SVG يُعقَّم،
 * وPNG يُفحص) فتُحفظ داخل ديوان وتنتقل في النسخة الاحتياطية، وبجانبها رسومات ديوان المدمجة. ومن هنا ومن «رسومات» في
 * التصاميم تُدرج في التصميم. والمحتوى الحرّ الأوسع في المرحلة ١.
 */
import { useCallback, useEffect, useState } from 'react';
import { BUILTIN_CLIPARTS, svgToDataUrl } from '@shared/clipart';
import { ELEMENT_CATEGORIES, type ElementCategory, type ElementImport, type LibraryElement } from '@shared/design/elements';
import { toIndic } from '@shared/arabic';
import { confirmAction } from '../kit/ask';
import { useToast } from '../kit/useToast';
import { errorText } from '../lib/errors';

const BUTTON = 'h-10 px-space-md rounded-lg font-label-md text-label-md font-semibold flex items-center gap-1.5 disabled:opacity-50';
const TILE = 'rounded-xl bg-surface-container-lowest p-space-sm flex flex-col gap-1 shadow-[0_1px_3px_rgba(15,23,42,0.08)]';

function importMessage(out: ElementImport): { text: string; tone: 'ok' | 'warn' } {
  const added = out.added.length ? `أُضيف ${toIndic(out.added.length)} عنصرًا` : '';
  const failed = out.errors.map((e) => `${e.name}: ${e.reason}`).join(' — ');
  if (!added && !failed) return { text: 'لم يُختر ملف', tone: 'warn' };
  return { text: [added, failed && `لم يُضَف: ${failed}`].filter(Boolean).join('. '), tone: failed ? 'warn' : 'ok' };
}

export default function ElementsScreen() {
  const { toast, say } = useToast(5000);
  const [items, setItems] = useState<LibraryElement[]>([]);
  const [category, setCategory] = useState<ElementCategory>('زخارف');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setItems(await window.diwan.elements.list());
    } catch (e) {
      setItems([]);
      say(errorText(e, 'تعذّر تحميل العناصر'), 'warn');
    }
  }, [say]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const importFiles = async () => {
    setBusy(true);
    try {
      const msg = importMessage(await window.diwan.elements.importFiles(category));
      say(msg.text, msg.tone);
      await reload();
    } catch (e) {
      say(errorText(e, 'تعذّر الاستيراد'), 'warn');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (el: LibraryElement) => {
    const ok = await confirmAction({
      title: `أتحذف «${el.name}» من مكتبة العناصر؟`,
      message: 'التصاميم التي أُدرج فيها تبقى كما هي — يُحذف من المكتبة وحدها.',
      confirm: 'احذفه',
      danger: true
    });
    if (!ok) return;
    try {
      await window.diwan.elements.remove(el.id);
      await reload();
      say(`حُذف «${el.name}»`);
    } catch (e) {
      say(errorText(e, 'تعذّر الحذف'), 'warn');
    }
  };

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="max-w-[1200px] mx-auto px-space-xl py-space-lg space-y-space-lg">
        <header className="flex flex-wrap items-start justify-between gap-space-md">
          <div className="space-y-1">
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold">مكتبة العناصر</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-[640px]">
              زخارف وإطارات وأيقونات وصور ظلّية تُدرج في التصاميم. ما تستورده يُفحص — والرسمة المتّجهة تُنظَّف من كلّ شيفرةٍ ورابط —
              ويُحفظ داخل ديوان وينتقل مع النسخة الاحتياطية.
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <select
              aria-label="صنف ما يُستورد"
              className="h-10 px-2 rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface"
              data-act="elements-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ElementCategory)}
            >
              {ELEMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button className={`${BUTTON} bg-primary text-on-primary shadow-md`} data-act="elements-import" disabled={busy} type="button" onClick={() => void importFiles()}>
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              استورد SVG أو PNG
            </button>
          </div>
        </header>

        <section className="space-y-space-sm" data-elements="imported">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">ما أضافه المكتب ({toIndic(items.length)})</h2>
          {items.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">لا عناصر مضافة بعد — اختر صنفًا ثم «استورد».</p>}
          {ELEMENT_CATEGORIES.filter((c) => items.some((el) => el.category === c)).map((c) => (
            <div key={c} className="space-y-space-xs">
              <h3 className="font-label-md text-label-md text-on-surface-variant">{c}</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-space-sm">
                {items
                  .filter((el) => el.category === c)
                  .map((el) => (
                    <article key={el.id} className={TILE} data-element={el.name}>
                      <img alt={el.name} className="w-full aspect-square object-contain bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px] rounded" src={`diwan://store/${el.file}`} />
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-label-sm text-label-sm text-on-surface truncate">{el.name}</span>
                        <button className="w-6 h-6 shrink-0 rounded text-on-surface-variant hover:bg-error-container hover:text-on-error-container flex items-center justify-center" data-act="element-remove" title="احذفه من المكتبة" type="button" onClick={() => void remove(el)}>
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-space-sm" data-elements="bundled">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">رسومات ديوان ({toIndic(BUILTIN_CLIPARTS.length)})</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-space-sm">
            {BUILTIN_CLIPARTS.map((item) => (
              <article key={item.id} className={TILE} data-element={item.name}>
                <img alt={item.name} className="w-full aspect-square object-contain" src={svgToDataUrl(item.svg)} />
                <span className="font-label-sm text-label-sm text-on-surface truncate">{item.name}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-6 z-50 max-w-[560px] px-space-lg py-space-sm rounded-xl shadow-lg font-label-md text-label-md ${toast.tone === 'ok' ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'}`}>
          {toast.text}
        </div>
      )}
    </main>
  );
}
