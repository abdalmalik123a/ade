/** طلبٌ إلى العملية الرئيسة يُنتظر جوابه — والأبواب كلّها تنادي به (تقسيم الجسر بعد ١٫٧٫٠). */
import { ipcRenderer } from 'electron';

export const invoke = ipcRenderer.invoke.bind(ipcRenderer);
