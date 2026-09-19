/** مسارات الوحدات — مأخوذة حرفيًا من سمات data-path في التصميم. */
export const ROUTES = {
  /** الشبّاك — الشاشة اليومية. لا مقابل لها في التصميم: بُنيت بتوكناته. */
  service: 'service-counter',
  editor: 'smart-editor-a4-preview',
  templates: 'templates-library-drafts',
  archive: 'transactions-archive-ledger',
  citizens: 'citizens-identity-records',
  /** الأسئلة — قسمٌ قائمٌ بذاته لا فرعٌ من مكتبة الكتب. لا مقابل له في التصميم. */
  papers: 'exam-papers',
  /** التصاميم — اللوحة: شهادةٌ وهويةٌ وملصق. لا مقابل له في التصميم. */
  designs: 'designed-documents',
  letterhead: 'header-seal-configuration',
  search: 'administrative-archive-search'
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
