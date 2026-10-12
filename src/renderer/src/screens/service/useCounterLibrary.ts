/**
 * مكتبة الشبّاك (تقسيمه بعد ١٫٧٫٠): النماذج والتصنيفات والترويسات والإعدادات تُقرأ عند كلّ عودةٍ إليه، والبحث والتصنيف
 * يصفّيانها، والأكثر طلبًا أوّلًا — منقولةٌ من `ServiceScreen` كما هي.
 */
import { useEffect, useMemo, useState } from 'react';
import { normalizeFold } from '@shared/arabic';
import type { Letterhead } from '@shared/letterhead';
import type { OfficeSettings, TemplateSummary } from '@shared/api';

export function useCounterLibrary(
  ctx: {
    active: boolean;
    settingsKey: unknown;
  }
) {
  const { active, settingsKey } = ctx;

  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [query, setQuery] = useState('');

  // النماذج والترويسات والإعدادات تُقرأ عند كل عودةٍ إلى الشبّاك — فما أُضيف في
  // المكتبة يظهر — والمعاملة الجارية لا تُمسّ.
  useEffect(() => {
    if (!active) return;
    void (async () => {
      const [list, cats, lhs, s] = await Promise.all([
        window.diwan.templates.list(null),
        window.diwan.templates.categories(),
        window.diwan.letterheads.list(),
        window.diwan.settings.get()
      ]);
      setItems(list);
      setCategories(cats);
      setLetterheads(lhs);
      setSettings(s);
    })();
  }, [active, settingsKey]);

  const topFavorites = useMemo(() => {
    return [...items].sort((a, b) => b.printCount - a.printCount).slice(0, 4);
  }, [items]);

  const shown = useMemo(() => {
    let res = items;
    if (activeCategory) {
      res = res.filter((t) => t.category === activeCategory);
    }
    // متساهلٌ مع الهمزة والتاء المربوطة: «تاييد» تجد «تأييد».
    const q = normalizeFold(query.trim());
    if (q) {
      res = res.filter((t) => normalizeFold(`${t.title} ${t.subtitle ?? ''} ${t.category ?? ''}`).includes(q));
    }
    return res;
  }, [items, activeCategory, query]);

  /** البطاقات بترتيب عرضها: الأكثر طلبًا أولًا — وأوّل تسعٍ منها بأرقامها (د١١). */
  const ordered = useMemo(() => [...shown].sort((a, b) => b.printCount - a.printCount), [shown]);

  return { items, categories, activeCategory, setActiveCategory, letterheads, settings, query, setQuery, topFavorites, shown, ordered };
}
