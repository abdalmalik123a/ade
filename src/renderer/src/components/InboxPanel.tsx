/**
 * «الملفّات» في الشبّاك (المرحلة ٢، ن٨): ما وصل المكتب الآن — من التنزيلات وسطح المكتب والمستندات
 * وواتساب والفلاشة — ومنطقةٌ يُفلت عليها ملفّ. وكلٌّ يُفتح في أداته: PDF في أداة PDF، والصورة فيها
 * أو في الصور الشخصية، وملفّ Word في المحرّر نموذجًا.
 *
 * والإفلات هنا وحده (ومناطق الأدوات): ملفٌّ يُفلت على غيرها لا يفعل شيئًا، والنافذة لا تغادر صفحتها.
 */
import { useCallback, useEffect, useState } from 'react';
import type { InboxFile } from '@shared/api';
import { toIndic } from '@shared/arabic';

export type InboxOpen = 'pdf' | 'photo' | 'word';

const SOURCE: Record<InboxFile['source'], string> = {
  downloads: 'التنزيلات',
  desktop: 'سطح المكتب',
  documents: 'المستندات',
  whatsapp: 'واتساب',
  flash: 'الفلاشة'
};

const ICON: Record<InboxFile['kind'], string> = { pdf: 'picture_as_pdf', image: 'image', word: 'description' };
/** ما يُقال مكان الاسم حين تُخفى الأسماء. */
const KIND: Record<InboxFile['kind'], string> = { pdf: 'ملفّ PDF', image: 'صورة', word: 'ملفّ Word' };

/**
 * أسماء الملفّات تُخفى على هذا الجهاز (البند ٢١، S16): «آخر ما وصل» في الشاشة الأولى، وأسماء ملفّات الزبائن («هوية زينب علي
 * حسن.pdf») يراها زبونٌ آخر واقفٌ أمام الشاشة. والاختيار تفضيلٌ محليٌّ للشاشة في localStorage لا إعدادٌ للمكتب ولا ينتقل
 * في النسخ الاحتياطية أو الإعدادات المنقولة (OfficeSettings) — وبلا تخزينٍ تبقى ظاهرة.
 */
const HIDE_KEY = 'diwan.inbox.hideNames';
function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}
function writeHidden(on: boolean) {
  try {
    if (on) localStorage.setItem(HIDE_KEY, '1');
    else localStorage.removeItem(HIDE_KEY);
  } catch {
    /* بلا تخزين: يبقى الاختيار لهذه الجلسة */
  }
}

/** «منذ ٥ د» — والرقم هنديّ كبقيّة الواجهة (UI.md ٣). */
function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'الآن';
  if (min < 60) return `منذ ${toIndic(min)} د`;
  const h = Math.round(min / 60);
  if (h < 24) return `منذ ${toIndic(h)} س`;
  const d = Math.round(h / 24);
  return d === 1 ? 'أمس' : `منذ ${toIndic(d)} أيام`;
}

export default function InboxPanel({ active, onOpen: open }: { active: boolean; onOpen: (file: InboxFile, as: InboxOpen) => Promise<void> }) {
  const [files, setFiles] = useState<InboxFile[] | null>(null);
  const [dropping, setDropping] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hidden, setHidden] = useState(readHidden);
  /** يُفتح الملفّ في أداته — وما تعذّر يُقال هنا لا يُبلع. */
  const onOpen = (f: InboxFile, as: InboxOpen) => {
    setNote(null);
    void open(f, as).catch((e: unknown) => setNote(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'تعذّر فتح الملف'));
  };

  const refresh = useCallback(() => {
    void window.diwan.inbox
      .list()
      .then(setFiles)
      .catch(() => setFiles([]));
  }, []);

  // تُقرأ حين يُعرض الشبّاك، وكلّ عشرين ثانيةً ما دام معروضًا — فما وصل الآن يظهر بلا زرّ.
  useEffect(() => {
    if (!active) return;
    refresh();
    const t = window.setInterval(refresh, 20_000);
    return () => window.clearInterval(t);
  }, [active, refresh]);

  /** ما يُفتح به الملفّ أوّلًا: الصورة في أداة PDF (للرفع)، وزرٌّ ثانٍ للصور الشخصية. */
  const primary = (f: InboxFile): InboxOpen => (f.kind === 'word' ? 'word' : 'pdf');

  async function dropped(list: FileList) {
    const adopted = await window.diwan.inbox.adopt([...list]);
    if (!adopted.length) {
      // وملفّ Word أو Excel القديم يُقال له ما يُفعل (هـ١) — لا «ليس ملفّ Word» وهو منه.
      const names = [...list].map((f) => f.name.toLowerCase());
      setNote(
        names.some((n) => /\.(doc|rtf)$/.test(n))
          ? 'ملفّ Word بصيغةٍ قديمة (.doc) — افتحه في Word واحفظه .docx («حفظ باسم») ثم أفلته هنا'
          : names.some((n) => n.endsWith('.xls'))
            ? 'ملفّ Excel بصيغةٍ قديمة (.xls) — احفظه .xlsx من Excel'
            : 'ما أُفلت ليس PDF ولا صورةً ولا ملفّ Word'
      );
      return;
    }
    setNote(null);
    // ملفٌّ واحد يُفتح فورًا، وعدّة ملفّات PDF وصور تُفتح معًا في أداة PDF.
    const first = adopted[0]!;
    onOpen(first, primary(first));
  }

  const shown = (files ?? []).slice(0, 8);

  return (
    <section className="p-space-sm rounded-card border-[1.5px] border-dashed border-outline bg-surface-container-low/80 flex flex-col gap-space-xs" data-inbox="">
      <div className="flex items-center gap-space-xs px-1">
        <span className="material-symbols-outlined text-[18px] text-secondary">inbox</span>
        <span className="font-label-md text-label-md text-on-surface font-semibold">آخر ما وصل</span>
        <span className="font-label-sm text-label-sm text-on-surface-variant truncate">التنزيلات · سطح المكتب · واتساب · الفلاشة</span>
        <button
          className={`ms-auto w-8 h-8 rounded-btn hover:bg-surface-container-high ${hidden ? 'text-primary bg-primary-fixed' : 'text-on-surface-variant'}`}
          aria-pressed={hidden}
          data-act="inbox-names"
          title={hidden ? 'أظهر أسماء الملفّات' : 'أخفِ أسماء الملفّات — يراها من يقف أمام الشاشة'}
          type="button"
          onClick={() => {
            writeHidden(!hidden);
            setHidden(!hidden);
          }}
        >
          <span className="material-symbols-outlined text-[18px]">{hidden ? 'visibility_off' : 'visibility'}</span>
        </button>
        <button
          className="w-8 h-8 rounded-btn text-on-surface-variant hover:bg-surface-container-high"
          data-act="inbox-refresh"
          title="حدّث القائمة"
          type="button"
          onClick={refresh}
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </div>

      <div
        className={`rounded-card border-2 border-dashed px-space-sm py-space-xs text-center font-label-sm text-label-sm transition-colors ${
          dropping ? 'border-cyan bg-grad-sel text-primary' : 'border-outline-variant text-on-surface-variant'
        }`}
        data-dropzone="counter"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          void dropped(e.dataTransfer.files);
        }}
      >
        أفلت ملفًّا هنا — PDF أو صورة أو ملفّ Word
      </div>
      {note && <span className="px-1 font-label-sm text-label-sm text-error">{note}</span>}

      {files && shown.length === 0 && (
        <span className="px-1 py-1 font-label-sm text-label-sm text-on-surface-variant">لا شيء وصل في الأسبوع الأخير — ولا فلاشة موصولة.</span>
      )}
      {shown.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-1">
          {shown.map((f) => (
            <div key={f.id} className="flex items-center gap-space-xs p-1.5 rounded-btn bg-surface-container-lowest border border-outline-variant shadow-low" data-inbox-file={f.kind}>
              <span className="material-symbols-outlined text-[20px] text-secondary shrink-0">{ICON[f.kind]}</span>
              <span className="flex-1 min-w-0 flex flex-col">
                {hidden ? (
                  <span className="font-label-md text-label-md text-on-surface truncate" data-name-hidden="">
                    {KIND[f.kind]}
                  </span>
                ) : (
                  <span className="font-label-md text-label-md text-on-surface truncate" dir="auto" title={f.name}>
                    {f.name}
                  </span>
                )}
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                  {SOURCE[f.source]} · {ago(f.modified)}
                </span>
              </span>
              <button
                className="h-7 px-2 btn-soft font-label-sm text-label-sm shrink-0"
                data-act="inbox-open"
                title={f.kind === 'word' ? 'يُفتح نموذجًا في المحرّر كما كُتب' : 'يُفتح في أداة PDF — للتعديل والتجهيز للرفع'}
                type="button"
                onClick={() => onOpen(f, primary(f))}
              >
                {f.kind === 'word' ? 'افتحه نموذجًا' : 'افتح'}
              </button>
              {f.kind === 'image' && (
                <button
                  className="h-7 px-2 rounded-btn text-secondary hover:bg-surface-container-high font-label-sm text-label-sm shrink-0"
                  data-act="inbox-photo"
                  title="صورةٌ شخصية بالمقاس من هذه الصورة"
                  type="button"
                  onClick={() => onOpen(f, 'photo')}
                >
                  صورة شخصية
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
