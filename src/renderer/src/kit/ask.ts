/**
 * سؤالٌ للموظف في وسط عمل (ج١): حذفٌ لا رجعة فيه، أو مغادرةٌ بعملٍ لم يُحفظ.
 *
 * واحدٌ للبرنامج كلّه: `ConfirmHost` يُركَّب مرّةً في الجذر، ومن أيّ مكانٍ — حتى خارج React —
 * `await ask({...})` أو `await confirmAction({...})`. وكانت الحذوف نقرةً واحدة بلا سؤال، وموضعان فقط
 * بـ`window.confirm` (لا شكل له ولا عربية).
 *
 * وبلا مضيفٍ مركَّب (اختبارٌ، أو قبل التركيب) يكون الجواب هو الاحتياط `fallback`: لا يمضي حذفٌ بلا سؤال.
 */

export type ChoiceTone = 'primary' | 'danger' | 'neutral';

export type Choice<K extends string> = { key: K; label: string; tone?: ChoiceTone };

export type AskOptions<K extends string> = {
  title: string;
  message?: string;
  /** بترتيب عرضها: الأولى على اليمين في الواجهة العربية، والأهمّ أو الأخطر آخرها. */
  choices: readonly Choice<K>[];
  /** ما يُختار بـEsc أو بالنقر خارج الحوار — وعليه التركيز، فلا يمرّ Enter على حذفٍ بالخطأ. */
  fallback: K;
};

type Host = (options: AskOptions<string>) => Promise<string>;

let host: Host | null = null;

/** المضيف المركَّب يُعلن نفسه؛ ويعود ما يُلغي تسجيله. */
export function mountHost(next: Host): () => void {
  host = next;
  return () => {
    if (host === next) host = null;
  };
}

export function ask<K extends string>(options: AskOptions<K>): Promise<K> {
  if (!host) return Promise.resolve(options.fallback);
  return host(options) as Promise<K>;
}

/** سؤال «أتمضي؟» بجوابين. `danger` للحذف النهائي: زرّه أحمر، والتركيز على «ألغِ». */
export async function confirmAction(options: {
  title: string;
  message?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
}): Promise<boolean> {
  const answer = await ask({
    title: options.title,
    message: options.message,
    choices: [
      { key: 'no', label: options.cancel ?? 'ألغِ', tone: 'neutral' },
      { key: 'yes', label: options.confirm, tone: options.danger ? 'danger' : 'primary' }
    ],
    fallback: 'no'
  });
  return answer === 'yes';
}
