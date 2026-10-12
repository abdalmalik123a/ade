/**
 * بطاقة الاختصارات الثابتة في الإعدادات (تقسيم الإعدادات بعد ١٫٧٫٠) — منقولةٌ من `SettingsScreen` كما هي.
 */
import { SHORTCUTS } from '@shared/shortcuts';

type Props = {
  card: string;
  title: (icon: string, text: string) => JSX.Element;
};

export default function ShortcutsCard({ card, title }: Props) {
  return (
    <section className={card} data-shortcuts="">
      {title('keyboard', 'الاختصارات الثابتة')}
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        تعمل ولوحة المفاتيح عربيةٌ أو إنجليزية. ولكلّ اختصارٍ زرٌّ ظاهر يفعل الشيء نفسه.
      </p>
      <table className="w-full font-label-md text-label-md">
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.id} className="border-t border-outline-variant/40">
              <td className="py-1.5 pl-space-sm whitespace-nowrap">
                <kbd className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-surface-container-high" dir="ltr">
                  {s.keys}
                </kbd>
              </td>
              <td className="py-1.5 text-on-surface">{s.label}</td>
              <td className="py-1.5 text-on-surface-variant font-label-sm text-label-sm">
                {s.where} — {s.button}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
