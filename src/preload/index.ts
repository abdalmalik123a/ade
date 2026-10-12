import { contextBridge, webFrame } from 'electron';
import type { DiwanApi } from '@shared/api';
import { officeApi } from './office';
import { archiveApi } from './archive';
import { citizensApi } from './citizens';
import { templatesApi } from './templates';
import { toolsApi } from './tools';
import { libraryApi } from './library';

/**
 * الجسر الوحيد بين الواجهة والنظام. لا Node في الواجهة إطلاقًا. وأبوابه في ملفّاتها على أبواب `@shared/api` (تقسيم الجسر
 * بعد ١٫٧٫٠): قنوات الأداة الجديدة تُضاف إلى بابها.
 */
const api: DiwanApi = {
  ...officeApi,
  ...archiveApi,
  ...citizensApi,
  ...templatesApi,
  ...toolsApi,
  ...libraryApi
};

contextBridge.exposeInMainWorld('diwan', api);

// `window.close()` في صندوقٍ (sandbox) يُغلق النافذة فورًا ويتخطّى إغلاقها على مرحلتيه — فتضيع مسودة المحرّر
// والنسخة التلقائية. فيُوجَّه إلى ما يفعله زرّ الإغلاق نفسه (خطة Production، ٦٫٤) — كما كان Electron يفعل
// قبل الصندوق.
void webFrame.executeJavaScript('window.close = () => window.diwan.ui.requestClose();');
