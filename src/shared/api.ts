/**
 * عقد الاتصال بين الواجهة والعملية الرئيسية. مصدر الحقيقة الوحيد للأنواع.
 *
 * مقسومٌ على أبوابه (المحادثة ٦، البند ٢٨) — وكان ملفًّا واحدًا عند سقفه (١٢٣٨ سطرًا) فأيّ قناةٍ جديدة تبدأ بتقسيمه:
 * كلّ بابٍ بأنواعه وقنواته في ملفّه، وهنا يُجمع. فيُستورد كلّ نوعٍ من `@shared/api` كما كان.
 */
import type { LibraryApis } from './libraryApi';
import type { OfficeApis } from './apiOffice';
import type { ArchiveApis } from './apiArchive';
import type { CitizenApis } from './apiCitizens';
import type { TemplateApis } from './apiTemplates';
import type { ToolApis } from './apiTools';

export type * from './apiOffice';
export type * from './apiArchive';
export type * from './apiCitizens';
export type * from './apiTemplates';
export type * from './apiTools';

/** `window.diwan` كلّه: مكتبة الخطوط والعناصر، وقنوات الأبواب الخمسة. */
export type DiwanApi = LibraryApis & OfficeApis & ArchiveApis & CitizenApis & TemplateApis & ToolApis;
