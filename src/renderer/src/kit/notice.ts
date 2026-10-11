/**
 * كلمةٌ عابرة تبقى بعد أن تُغادَر الشاشة التي قالتها (محادثة «الشبّاك واليوم الأوّل»، البند ١٠): «حُفظ ما كتبته في قيد
 * العمل» يقولها المحرّر وهو يُفكّ، فلا يقولها في مكانه. واحدٌ للبرنامج كلّه كالأسئلة (`ask.ts`): `NoticeHost` يُركَّب مرّةً
 * في الجذر، و`notice()` من أيّ مكان. وبلا مضيفٍ مركَّب لا يُقال شيء.
 */
import type { ToastAction } from './useToast';

type Host = (text: string, action?: ToastAction) => void;

let host: Host | null = null;

/** المضيف المركَّب يُعلن نفسه؛ ويعود ما يُلغي تسجيله. */
export function mountNoticeHost(next: Host): () => void {
  host = next;
  return () => {
    if (host === next) host = null;
  };
}

export function notice(text: string, action?: ToastAction): void {
  host?.(text, action);
}
