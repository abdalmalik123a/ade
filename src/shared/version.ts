/**
 * مقارنة أرقام الإصدار (`1.2.10` بعد `1.2.9`) — أرقامًا لا نصًّا. وما ليس رقمًا يُعدّ صفرًا،
 * و`-beta` وما بعده يُهمل: فالنسخة تُقارن بإصدارها لا بوسمه.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split('-')[0]!.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
