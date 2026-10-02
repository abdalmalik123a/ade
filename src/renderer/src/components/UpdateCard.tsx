/**
 * «التحديث» في الإعدادات (خطة Production، ٧٫١): ملفّ تحديثٍ يوقّعه المطوّر يُختار، فيُرى إصداره و«ما
 * الجديد» قبل أن يُثبَّت. ولا تحديث من الإنترنت. والبيانات تُنسخ قبل أن يُرحّلها الإصدار الجديد.
 */
import { useState, type ReactNode } from 'react';
import { errorText } from '../lib/errors';
import { ChangelogBody } from './WhatsNewDialog';

type Picked = { path: string; version: string; notes: string; size: number; issued: string; current: string };

export default function UpdateCard({ card, title, version }: { card: string; title: ReactNode; version: string | null }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [note, setNote] = useState<{ text: string; warn?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick() {
    setNote(null);
    setPicked(null);
    try {
      const p = await window.diwan.update.pick();
      if (p) setPicked(p);
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّر فحص التحديث'), warn: true });
    }
  }

  async function install() {
    if (!picked) return;
    setBusy(true);
    try {
      const r = await window.diwan.update.install(picked.path);
      setNote({ text: r.launched ? 'يُفتح المثبّت ويُغلق البرنامج — أكمل التثبيت، وتُنسخ البيانات قبل أن تُرحَّل' : `جاهز: ${r.installer}` });
    } catch (e) {
      setNote({ text: errorText(e, 'تعذّر التثبيت'), warn: true });
      setBusy(false);
    }
  }

  return (
    <section className={card} data-update-card="">
      {title}
      <p className="font-label-md text-label-md text-on-surface-variant">
        الإصدار المثبّت {version ?? '…'}. التحديث ملفٌّ يرسله المطوّر (<span dir="ltr">.diwanupdate</span>) — يُفحص توقيعه قبل أن
        يُثبَّت، ولا يتّصل البرنامج بأحد.
      </p>
      <button
        className="h-10 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-space-xs"
        data-act="update-pick"
        disabled={busy}
        type="button"
        onClick={() => void pick()}
      >
        <span className="material-symbols-outlined text-[18px] text-secondary">system_update_alt</span>
        ثبّت تحديثًا…
      </button>
      {picked && (
        <div className="rounded-lg bg-surface-container-low p-space-sm flex flex-col gap-space-xs" data-update-picked={picked.version}>
          <span className="font-label-lg text-label-lg font-semibold text-on-surface">
            الإصدار {picked.version} — موقّعٌ من المطوّر ({(picked.size / 1024 / 1024).toFixed(0)} م.ب)
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">ما الجديد:</span>
          <ChangelogBody body={picked.notes} />
          <button
            className="h-10 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold disabled:opacity-40"
            data-act="update-install"
            disabled={busy}
            type="button"
            onClick={() => void install()}
          >
            {busy ? 'يُجهَّز المثبّت…' : `ثبّت الإصدار ${picked.version} — يُغلق البرنامج`}
          </button>
        </div>
      )}
      {note && (
        <p className={`font-label-sm text-label-sm break-all ${note.warn ? 'text-error' : 'text-secondary'}`} data-update-note="">
          {note.text}
        </p>
      )}
    </section>
  );
}
