/**
 * «المكتبة ← الخطوط» — خطوط ديوان (DESIGNS.md ٣٫٧ و٠٫٧): ما جاء مع البرنامج، وما يضيفه المكتب من ملفٍّ أو من خطوط Windows
 * بضغطة. سياسةٌ واحدة للبرنامج كلّه: منها يختار محرّر الكتب والترويسات والتصاميم، وما يُضاف هنا يُنسخ إلى المخزن فينتقل
 * في النسخة الاحتياطية — فيخرج الكتاب بخطّه على كلّ جهاز. والمحتوى في المكتبة لا في الإعدادات (قرار ٣ تشرين الأول).
 */
import { useEffect, useMemo, useState } from 'react';
import { stackOf, type FontImport, type LibraryFont, type WindowsFont } from '@shared/fonts';
import { toIndic } from '@shared/arabic';
import { confirmAction } from '../kit/ask';
import { useToast } from '../kit/useToast';
import { errorText } from '../lib/errors';
import { loadFonts, useLibraryFonts } from '../lib/fonts';

const SAMPLE = 'بسم الله الرحمن الرحيم — شهادة شكر وتقدير ١٢٣٤٥';
const BUTTON = 'h-10 px-space-md rounded-btn font-label-md text-label-md font-semibold flex items-center gap-1.5 disabled:opacity-50';

/** ما يُقال بعد استيراد: كم وجهًا أُضيف، وما رُفض بسببه. */
function importMessage(out: FontImport): { text: string; tone: 'ok' | 'warn' } {
  const families = [...new Set(out.added.map((f) => f.family))];
  const added = families.length ? `أُضيف ${families.map((f) => `«${f}»`).join('، ')} (${toIndic(out.added.length)} وجه)` : '';
  const failed = out.errors.map((e) => `${e.name}: ${e.reason}`).join(' — ');
  if (!added && !failed) return { text: 'لم يُختر ملف', tone: 'warn' };
  return { text: [added, failed && `لم يُضَف: ${failed}`].filter(Boolean).join('. '), tone: failed ? 'warn' : 'ok' };
}

export default function FontsScreen() {
  const fonts = useLibraryFonts();
  const { toast, say } = useToast(5000);
  const [busy, setBusy] = useState(false);
  const [windowsOpen, setWindowsOpen] = useState(false);

  const run = async (work: () => Promise<FontImport>) => {
    setBusy(true);
    try {
      const out = await work();
      await loadFonts();
      const msg = importMessage(out);
      say(msg.text, msg.tone);
    } catch (e) {
      say(errorText(e, 'تعذّر استيراد الخطّ'), 'warn');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (family: string) => {
    const ok = await confirmAction({
      title: `أتحذف «${family}» من خطوط ديوان؟`,
      message: 'ما كُتب به من كتبٍ وتصاميم يُنبَّه عليه حين يُفتح ويُقترح له بديل — وما صدر في السجلّ لا يتغيّر.',
      confirm: 'احذفه',
      danger: true
    });
    if (!ok) return;
    try {
      await window.diwan.fonts.remove(family);
      await loadFonts();
      say(`حُذف «${family}»`);
    } catch (e) {
      say(errorText(e, 'تعذّر حذف الخطّ'), 'warn');
    }
  };

  const imported = fonts.filter((f) => f.source === 'imported');
  const bundled = fonts.filter((f) => f.source === 'bundled');
  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="max-w-[1200px] mx-auto px-space-xl py-space-lg space-y-space-lg">
        <header className="flex flex-wrap items-start justify-between gap-space-md">
          <div className="space-y-1">
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold">خطوط ديوان</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-[640px]">
              منها تختار الكتب والترويسات والتصاميم. وما تضيفه يُحفظ داخل ديوان وينتقل مع النسخة الاحتياطية — فيخرج الكتاب بخطّه على كلّ جهاز.
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <button className={`${BUTTON} bg-surface-container-high text-on-surface`} data-act="fonts-windows" disabled={busy} type="button" onClick={() => setWindowsOpen((o) => !o)}>
              <span className="material-symbols-outlined text-[18px]">computer</span>
              من خطوط Windows
            </button>
            <button className={`${BUTTON} btn-act`} data-act="fonts-import" disabled={busy} type="button" onClick={() => void run(() => window.diwan.fonts.importFiles())}>
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              استورد ملفّ خطّ
            </button>
          </div>
        </header>

        {windowsOpen && <WindowsFonts busy={busy} onAdd={(family) => void run(() => window.diwan.fonts.importWindows(family))} />}

        <section className="space-y-space-sm" data-fonts="imported">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">ما أضافه المكتب ({toIndic(imported.length)})</h2>
          {imported.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
              {imported.map((f) => (
                <FontCard key={f.family} font={f} onRemove={() => void remove(f.family)} />
              ))}
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant">
              لا خطوط مضافة بعد. خطوط Word التي تكتب بها (مثل Simplified Arabic) تُضاف «من خطوط Windows» بضغطة.
            </p>
          )}
        </section>

        <section className="space-y-space-sm" data-fonts="bundled">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">المحزومة مع ديوان ({toIndic(bundled.length)})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
            {bundled.map((f) => (
              <FontCard key={f.family} font={f} />
            ))}
          </div>
        </section>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-6 z-50 max-w-[560px] px-space-lg py-space-sm rounded-card shadow-soft font-label-md text-label-md ${toast.tone === 'ok' ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-error text-on-error'}`}>
          {toast.text}
        </div>
      )}
    </main>
  );
}

function FontCard({ font, onRemove }: { font: LibraryFont; onRemove?: () => void }) {
  return (
    <article className="rounded-card bg-surface-container-lowest p-space-md space-y-space-sm shadow-low" data-font={font.family}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-label-md text-label-md text-on-surface font-semibold truncate">{font.label}</div>
          <div className="font-label-sm text-label-sm text-on-surface-variant" dir="ltr">
            {font.family} · {font.weights.map((w) => (w >= 700 ? 'عريض' : w <= 400 ? 'عادي' : String(w))).join(' و')}
            {font.license ? ` · ${font.license}` : ''}
          </div>
        </div>
        {onRemove && (
          <button className="w-8 h-8 shrink-0 rounded-btn text-on-surface-variant hover:bg-error-container hover:text-on-error-container flex items-center justify-center" data-act="font-remove" title="احذفه من خطوط ديوان" type="button" onClick={onRemove}>
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        )}
      </div>
      <div className="text-[22px] leading-relaxed text-on-surface" dir="rtl" style={{ fontFamily: stackOf(font.family) }}>
        {SAMPLE}
      </div>
    </article>
  );
}

/** خطوط Windows على هذا الجهاز — تُضاف عائلةً بضغطة (العادي والعريض والمائل معًا). */
function WindowsFonts({ busy, onAdd }: { busy: boolean; onAdd: (family: string) => void }) {
  const fonts = useLibraryFonts();
  const [list, setList] = useState<WindowsFont[] | null>(null);
  const [query, setQuery] = useState('');
  const [arabicOnly, setArabicOnly] = useState(true);
  useEffect(() => {
    void window.diwan.fonts.windows().then(setList, () => setList([]));
  }, []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter((f) => (!arabicOnly || f.arabic) && (!q || f.family.toLowerCase().includes(q)));
  }, [list, query, arabicOnly]);
  const added = (family: string) => fonts.some((f) => f.source === 'imported' && f.family.toLowerCase() === family.toLowerCase());

  return (
    <section className="rounded-card bg-surface-container-low p-space-md space-y-space-sm" data-panel="windows-fonts">
      <div className="flex flex-wrap items-center gap-space-sm">
        <input
          className="h-9 flex-1 min-w-[220px] px-space-sm rounded-field bg-surface-container-lowest border border-outline-variant font-label-md text-label-md"
          data-windows-fonts-search=""
          placeholder="ابحث باسم الخطّ — Simplified Arabic…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface cursor-pointer">
          <input checked={arabicOnly} className="w-4 h-4 accent-secondary" type="checkbox" onChange={(e) => setArabicOnly(e.target.checked)} />
          ما يكتب العربية وحده
        </label>
      </div>
      {list === null ? (
        <p className="font-body-md text-body-md text-on-surface-variant">يقرأ خطوط Windows…</p>
      ) : shown.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">لا خطّ بهذا الاسم.</p>
      ) : (
        <div className="max-h-[360px] overflow-auto divide-y divide-outline-variant/40 rounded-card bg-surface-container-lowest">
          {shown.map((f) => (
            <div key={f.family} className="flex items-center gap-space-md px-space-md py-space-sm" data-windows-font={f.family}>
              <div className="w-56 shrink-0 font-label-md text-label-md text-on-surface truncate" dir="ltr">
                {f.family}
                <span className="text-on-surface-variant"> · {toIndic(f.faces)}</span>
              </div>
              {/* الخطّ مثبّتٌ على هذا الجهاز، فيُرسم مثاله باسمه قبل أن يُضاف. */}
              <div className="flex-1 min-w-0 truncate text-[18px] text-on-surface" style={{ fontFamily: `'${f.family}'` }}>
                {SAMPLE}
              </div>
              {added(f.family) ? (
                <span className="shrink-0 font-label-md text-label-md text-secondary">في المكتبة ✓</span>
              ) : (
                <button className={`${BUTTON} h-8 shrink-0 btn-act`} data-act="font-add" disabled={busy} type="button" onClick={() => onAdd(f.family)}>
                  أضِف
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
