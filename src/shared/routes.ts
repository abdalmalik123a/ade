/** مسارات الوحدات — مأخوذة حرفيًا من سمات data-path في التصميم. */
export const ROUTES = {
  editor: 'smart-editor-a4-preview',
  templates: 'templates-library-drafts',
  archive: 'transactions-archive-ledger',
  citizens: 'citizens-identity-records',
  letterhead: 'header-seal-configuration',
  search: 'administrative-archive-search'
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
