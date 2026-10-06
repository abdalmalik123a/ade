/**
 * «نظرة عامة على ديوان» (الموجة ٢، بقرار المالك ٦ تشرين الأول — بدل «جولة اليوم الأوّل»: «لا أراها… يشعر أنّه يُساق»).
 *
 * شرحٌ لا مهمّة: مرّةً بعد التنصيب تمرّ النظرة على الصفحات صفحةً صفحة — ماذا يُعمل هنا وأهمّ مفاتيحه — ويُتخطّى بضغطة.
 * وفي أعلى كلّ صفحةٍ «؟» يشرحها وحدها حتى أوّل عملٍ يخرج من المكتب، ثم يختفي. والنظرة كلّها في «التنبيهات» متى أُريدت.
 * والكلام هنا وحده، فالنظرة و«؟» يقولان الشيء نفسه.
 */
import type { RouteKey } from './routes';

export type PageHelp = { title: string; body: string };

/** شرح كلّ صفحة — لـ«؟» في أعلاها، وللنظرة العامة. */
export const PAGE_HELP: Record<RouteKey, PageHelp> = {
  service: {
    title: 'الشبّاك — عمل اليوم',
    body: 'اكتب ما يطلبه الزبون أو اختره من البطاقات، ثم املأ بياناته مرّةً واحدة، وراجع واطبع. والبطاقات مرتّبةٌ بما يُطلب أكثر، وEnter يملأ ما اخترت.'
  },
  orders: {
    title: 'قيد العمل',
    body: 'ما لم يكتمل بعد: المسودات، والمعاملات المعلّقة، والطلبات بمواعيد تسليمها — فلا يضيع شيءٌ بين يومٍ ويوم.'
  },
  archive: {
    title: 'السجلّ',
    body: 'كلّ ما خرج من المكتب برقمه وتاريخه: يُبحث فيه بالاسم أو الرقم، ويُعاد طبعه أو يُكرَّر لزبونٍ آخر.'
  },
  audit: {
    title: 'الأحداث',
    body: 'ما جرى في البرنامج — النسخ الاحتياطية والحزم والتفعيل — وسلامة الأرشيف: أنّ ما صدر لم يُمسّ بعد صدوره.'
  },
  citizens: {
    title: 'الزبائن',
    body: 'لكلّ زبونٍ ملفّه ومستمسكاته: يُكتب مرّة، ثم يملأ «هات الزبون» أوراقه في الشبّاك، و«صدّر للرفع» يجهّز مستمسكاته لبوابة أور بحجم خانتها.'
  },
  clients: {
    title: 'الجهات',
    body: 'المدارس والدوائر التي تعمل لها بشعاراتها وألوانها — فتخرج ترويساتها وتصاميمها بها، وتُسجَّل طلباتها بأسمائها.'
  },
  templates: {
    title: 'المكتبة — نماذجك',
    body: '«استورد» يجلب ملفات Word ومجلّدها كلّه وكتب Excel والحزم الجاهزة، و«ورقة فارغة» تكتب فيها كما في Word. ظلّل ما يتغيّر واضغط F4 يصر خانةً تُملأ في الشبّاك.'
  },
  letterhead: {
    title: 'الترويسات',
    body: 'رأس الكتاب بشعاره وبياناته: يُبنى مرّةً ويُربط بالنماذج، فلا يُرسم في كلّ كتاب.'
  },
  editor: {
    title: 'المحرّر',
    body: 'اكتب كما في Word: الخطّ والحجم والجداول والصور. ظلّل ما يتغيّر واضغط F4 يصر خانة، وCtrl+P يطبع ما على الورقة.'
  },
  photos: {
    title: 'الصور الشخصية',
    body: 'افتح صورة الزبون — ولو من واتساب — فتُقصّ على وجهه بمقاسها وخلفيّتها، وتُطبع نسخًا على ورقة.'
  },
  pdf: {
    title: 'ملفات PDF',
    body: 'ادمج الملفّات وقسّمها وقصّها واكتب عليها، وصغّرها لحدّ خانة الرفع — كلّه على الجهاز بلا إنترنت.'
  },
  papers: {
    title: 'الأسئلة',
    body: 'ورقة أسئلةٍ بنموذجين، وبنك أسئلةٍ يُحفظ ويُعاد إليه، وورقة إجابةٍ بالدوائر تُصحَّح من الماسح.'
  },
  designs: {
    title: 'التصاميم',
    body: 'شهاداتٌ وهوياتٌ وبطاقات: اختر تصميمًا وجهته، واكتب قائمة الأسماء تخرج ورقةٌ لكلّ اسم.'
  },
  settings: {
    title: 'الإعدادات',
    body: 'اسم المكتب والطابعات وبطاقات الشبّاك والنسخ الاحتياطية — وكلّ ما اخترته في البداية يُعدَّل منها.'
  }
};

export type OverviewStep = PageHelp & {
  /** الصفحة التي تُعرض خلف الشرح. */
  route: RouteKey;
  /** ما يُضاء فيها — وإن لم يوجد عُرض الشرح وسطها. */
  target: string | null;
  /** وما يُضاء حين لا تغادر النظرة صفحة الموظف: وجهة الصفحة في السكّة، أو ما في الشريط العلوي. */
  anchor: string | null;
};

/** وجهات السكّة — تُرى من كلّ صفحة. */
const RAIL = {
  service: '[data-dest="service"]',
  work: '[data-dest="work"]',
  record: '[data-dest="record"]',
  customers: '[data-dest="customers"]',
  library: '[data-dest="library"]',
  settings: '[data-act="open-settings"]'
};

const at = (route: RouteKey, target: string | null, anchor: string | null, help: Partial<PageHelp> = {}): OverviewStep => ({
  route,
  target,
  anchor,
  ...PAGE_HELP[route],
  ...help
});

/** النظرة العامة صفحةً صفحة — دقيقتان، وتُتخطّى بضغطة. */
export const OVERVIEW_STEPS: OverviewStep[] = [
  at('service', '[data-counter-search]', RAIL.service),
  at('service', '[data-cards]', RAIL.service, {
    title: 'أدوات الشبّاك',
    body: 'صورٌ شخصية بالمقاس، واستنساخ هويةٍ بوجهيها، وملفات PDF للرفع، وكتابٌ على ورقة فارغة كما في Word، والمستمسكات على ورقة… وتختار ما يظهر منها من الإعدادات.'
  }),
  at('orders', RAIL.work, RAIL.work),
  at('archive', RAIL.record, RAIL.record),
  at('citizens', RAIL.customers, RAIL.customers),
  at('clients', '[data-tabs]', RAIL.customers),
  at('templates', '[data-act="import-menu"]', RAIL.library),
  at('letterhead', '[data-tabs]', RAIL.library),
  at('service', '[data-global-search]', '[data-global-search]', {
    title: 'البحث الشامل — Ctrl+F',
    body: 'كتابٌ صدر، أو زبون، أو نموذج، أو مستمسك: اكتب أيّ شيءٍ منه تظهر النتائج تحته.'
  }),
  at('service', '[data-act="notifications"]', '[data-act="notifications"]', {
    title: 'التنبيهات',
    body: 'الطلبات المتأخّرة وما موعده اليوم، والمسودات والمعاملات المعلّقة، وتذكير النسخة الاحتياطية — وفيها هذه النظرة متى أردتها.'
  }),
  at('settings', RAIL.settings, RAIL.settings),
  at('service', null, null, {
    title: 'ابدأ العمل',
    body: 'هذه نظرةٌ عامة، وكلّ زرٍّ يقول ما يفعل. وفي أعلى كلّ صفحةٍ «؟» يشرحها وحدها حتى أوّل عملٍ يخرج من مكتبك.'
  })
];

/**
 * خطوات النظرة كما تُعرض. **مرّةً بعد المعالج تمرّ على الصفحات** — لا عمل بعد يضيع. **ومن «التنبيهات» أو «؟» لا تغادر صفحة
 * الموظف** (`stay`): قد يكون في وسط كتابٍ أو ملفّ PDF، والانتقال يُسقط ما لم يُحفظ — فتضيء كلّ صفحةٍ في السكّة وتشرحها.
 * والخطوة الأخيرة تذكر «؟» ما دام في الصفحات، وبعد أوّل عملٍ لا «؟» فلا يُذكر.
 */
export function overviewSteps(worked: boolean, stay = false): OverviewStep[] {
  const steps = stay ? OVERVIEW_STEPS.map((s) => ({ ...s, target: s.anchor })) : OVERVIEW_STEPS;
  if (!worked) return steps;
  const last = steps[steps.length - 1]!;
  return [...steps.slice(0, -1), { ...last, body: 'هذه نظرةٌ عامة، وكلّ زرٍّ يقول ما يفعل — وهي في «التنبيهات» متى أردتها.' }];
}

/**
 * أخرج من المكتب عملٌ؟ — ما تُرجعه قناة إنتاجٍ (`ipc/gate.ts`): أوّل عملٍ يُخفي «؟» الصفحات. وما أُلغي أو لم يتمّ لا يُعدّ:
 * حوار حفظٍ أُغلق (`null`)، أو طباعةٌ فشلت (`{ ok: false }`) أو لم تُرسل منها ورقة (`sent: 0`)، أو لا شيء فيه.
 */
export function produced(out: unknown): boolean {
  if (out === null || out === undefined || out === false) return false;
  if (Array.isArray(out)) return out.length > 0;
  if (typeof out !== 'object') return true;
  const o = out as { ok?: unknown; sent?: unknown };
  return o.ok !== false && o.sent !== 0;
}
