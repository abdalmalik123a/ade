/**
 * ما يُفرَغ قبل أن يُغلق البرنامج (خطة Production، ١٫٥): شاشةٌ عندها ما لم يُحفظ بعد — مسودة
 * المحرّر في مهلة حفظها — تسجّل هنا ما يحفظه، وتُنادى كلّها حين يُغلق البرنامج قبل أن يمضي.
 */
type Flush = () => unknown;

const pending = new Set<Flush>();

/** يُسجَّل ما يُفرَغ قبل الإغلاق، ويعود ما يلغي تسجيله (عند مغادرة الشاشة). */
export function onBeforeClose(flush: Flush): () => void {
  pending.add(flush);
  return () => {
    pending.delete(flush);
  };
}

/** يُفرغ كلّ ما سُجّل — وما تعثّر منه لا يحبس غيره ولا الإغلاق. */
export async function flushBeforeClose(): Promise<void> {
  await Promise.allSettled([...pending].map(async (flush) => flush()));
}
