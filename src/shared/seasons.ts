/**
 * صفّ الموسم في الشبّاك (قرار ٣ تشرين الأول، ن١): ما يكثر طلبه في هذا الوقت من السنة — بداية العام
 * الدراسي هوياتٌ وأسئلةٌ شهرية، وآخره نتائجُ وشهاداتٌ وتأييدات تخرّج، والصيف تقديمٌ ورفعُ مستمسكات.
 *
 * وكلّ بندٍ بابٌ لا محتوى: بطاقةٌ تُفتح، أو كلمةٌ يُبحث بها في نماذج المكتب — فلا يُخترع نموذج.
 */
import type { CounterCardId } from './counterCards';
import { normalizeFold } from './arabic';

export type SeasonItem = { label: string } & ({ card: CounterCardId } | { search: string });
export type Season = { title: string; items: SeasonItem[] };

const SEASONS: { months: number[]; season: Season }[] = [
  {
    months: [9, 10],
    season: {
      title: 'موسم بداية العام الدراسي',
      items: [
        { label: 'هويات الطلبة', card: 'designs' },
        { label: 'الامتحانات الشهرية', card: 'papers' },
        { label: 'تأييد استمرار بالدوام', search: 'تأييد' }
      ]
    }
  },
  {
    months: [11, 12, 1],
    season: {
      title: 'موسم امتحانات نصف السنة',
      items: [
        { label: 'أوراق الأسئلة', card: 'papers' },
        { label: 'شهادات التقدير', card: 'designs' },
        { label: 'تأييد استمرار بالدوام', search: 'تأييد' }
      ]
    }
  },
  {
    months: [2, 3, 4],
    season: {
      title: 'موسم الامتحانات الشهرية',
      items: [
        { label: 'أوراق الأسئلة', card: 'papers' },
        { label: 'صور شخصية', card: 'photos' },
        { label: 'استنساخ هوية', card: 'id-copy' }
      ]
    }
  },
  {
    months: [5, 6],
    season: {
      title: 'موسم النتائج والتخرّج',
      items: [
        { label: 'شهادات التقدير', card: 'designs' },
        { label: 'تأييد تخرّج', search: 'تخرج' },
        { label: 'الامتحانات النهائية', card: 'papers' }
      ]
    }
  },
  {
    months: [7, 8],
    season: {
      title: 'موسم التقديم والقبول',
      items: [
        { label: 'صور شخصية', card: 'photos' },
        { label: 'تجهيز ملفات للرفع', card: 'pdf' },
        { label: 'استنساخ المستمسكات', card: 'id-sheet' }
      ]
    }
  }
];

/** موسم اليوم — بالشهر الميلادي، فالعام الدراسي العراقي يتبعه. */
export function seasonOf(date: Date = new Date()): Season | null {
  const m = date.getMonth() + 1;
  return SEASONS.find((s) => s.months.includes(m))?.season ?? null;
}

/**
 * بنود الموسم الظاهرة (البند ٧): البطاقة ما دام المكتب يقدّمها، والكلمة ما دام في نماذجه ما تجده (`texts`: عنوان النموذج
 * وصنفه، كما يبحث الشبّاك) — فلا يُقترح نموذجٌ غير موجود. كان «تأييد استمرار بالدوام» في مكتبٍ جديد يبحث فلا يجد شيئًا،
 * فيُخلي الشبّاك من بطاقاته ويبقى سطرٌ بلا زرّ.
 */
export function seasonItems(season: Season, offered: readonly CounterCardId[], texts: readonly string[]): SeasonItem[] {
  const folded = texts.map((t) => normalizeFold(t));
  return season.items.filter((it) => ('card' in it ? offered.includes(it.card) : folded.some((t) => t.includes(normalizeFold(it.search)))));
}
