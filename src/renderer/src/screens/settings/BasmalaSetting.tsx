/**
 * البسملة تفضيلًا للمكتب في الإعدادات (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `SettingsScreen` كما هي.
 */
import { type ReactNode, useState, useEffect } from 'react';
import { normalizeLayout } from '@shared/letterhead';

/**
 * البسملة تفضيلٌ للمكتب (FOUNDATION §٥): تُشعل وتُطفأ هنا، وبها تبدأ كل ترويسةٍ
 * جديدة. وما حُفظ من الترويسات لا يتغيّر وحده — فمن الجهات ما يكتب بها ومنها ما
 * لا يكتب — وإنما بزرٍّ صريح يذكر عددها قبل أن يُمسّ شيء.
 */
export function BasmalaSetting({
  value,
  card,
  title,
  onChange,
  say
}: {
  value: boolean | null;
  card: string;
  title: ReactNode;
  onChange: (next: boolean) => void;
  say: (text: string, tone?: 'ok' | 'warn') => void;
}) {
  const on = value === true;
  /** الترويسات المحفوظة المخالفة للتفضيل — ورأسٌ فُصل من ورقة بسملته في كتله فلا يُعدّ. */
  const [differ, setDiffer] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  const differing = async (want: boolean) =>
    (await window.diwan.letterheads.list()).filter((l) => {
      const layout = normalizeLayout(l.layout);
      return !layout.sheet?.length && layout.basmala.show !== want;
    });

  useEffect(() => {
    setConfirm(false);
    void differing(on).then((list) => setDiffer(list.length));
  }, [on]);

  async function toggle(next: boolean) {
    const saved = await window.diwan.settings.set({ basmala: next });
    onChange(saved.basmala === true);
  }

  async function applyAll() {
    const list = await differing(on);
    for (const l of list) {
      const layout = normalizeLayout(l.layout);
      await window.diwan.letterheads.save({
        id: l.id,
        name: l.name,
        authorityId: l.authorityId ?? null,
        layout: { ...layout, basmala: { ...layout.basmala, show: on } },
        category: l.category ?? null
      });
    }
    setConfirm(false);
    setDiffer(0);
    say(on ? `أُضيفت البسملة إلى ${list.length} ترويسة` : `أُزيلت البسملة من ${list.length} ترويسة`);
  }

  return (
    <section className={card} data-basmala-setting="">
      {title}
      <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
        <input
          checked={on}
          className="w-4 h-4 accent-secondary"
          data-setting="basmala"
          type="checkbox"
          onChange={(e) => void toggle(e.target.checked)}
        />
        كل ترويسةٍ جديدة تبدأ بـ«بسم الله الرحمن الرحيم»
      </label>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        {value === null
          ? 'لم يختر المكتب بعد — وأوّل مرّةٍ تُشعلها في ترويسةٍ تصير تفضيله.'
          : 'وتبقى لكل ترويسةٍ بسملتها تُشعل وتُطفأ من شاشة الترويسات.'}
      </p>
      {differ !== null && differ > 0 && (
        <div className="flex items-center gap-space-xs flex-wrap">
          {confirm ? (
            <>
              <span className="font-label-sm text-label-sm text-on-surface">
                {on ? `تُضاف البسملة إلى ${differ} ترويسة محفوظة` : `تُزال البسملة من ${differ} ترويسة محفوظة`} — تأكيد؟
              </span>
              <button
                className="h-8 px-3 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                data-act="basmala-apply-confirm"
                type="button"
                onClick={() => void applyAll()}
              >
                نعم
              </button>
              <button
                className="h-8 px-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
                type="button"
                onClick={() => setConfirm(false)}
              >
                تراجع
              </button>
            </>
          ) : (
            <button
              className="h-8 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
              data-act="basmala-apply"
              type="button"
              onClick={() => setConfirm(true)}
            >
              {on ? `أضِفها إلى الترويسات المحفوظة (${differ})` : `أزِلها من الترويسات المحفوظة (${differ})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
