/**
 * الجسر — باب المكتبة: خطوط ديوان ومكتبة العناصر (تقسيم الجسر بعد ١٫٧٫٠،
 * على أبواب `@shared/api`): منقولٌ من `index.ts` كما هو، وهو يجمع الأبواب.
 */
import type { LibraryApis } from '@shared/libraryApi';
import { invoke } from './invoke';

export const libraryApi: LibraryApis = {
  fonts: {
    list: () => invoke('fonts:list'),
    importFiles: () => invoke('fonts:importFiles'),
    windows: () => invoke('fonts:windows'),
    importWindows: (family: string) => invoke('fonts:importWindows', family),
    remove: (family: string) => invoke('fonts:remove', family)
  },
  elements: {
    list: () => invoke('elements:list'),
    importFiles: (category: string) => invoke('elements:importFiles', category),
    remove: (id: number) => invoke('elements:remove', id)
  }
};
