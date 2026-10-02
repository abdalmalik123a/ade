/**
 * «ما الجديد» من CHANGELOG.md (خطة Production، ٧٫١): القسم يبدأ بـ`## X.Y.Z` وما بعده إلى القسم الذي يليه.
 * ويُعرض بعد التحديث ما بين الإصدار القديم والجديد — لا السجلّ كلّه.
 */
import { compareVersions } from './version';

export type ChangelogEntry = { version: string; title: string; body: string };

export function parseChangelog(md: string): ChangelogEntry[] {
  const out: ChangelogEntry[] = [];
  let cur: ChangelogEntry | null = null;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const head = /^## (\d+\.\d+\.\d+)(.*)$/.exec(line);
    if (head) {
      cur = { version: head[1]!, title: line.slice(3).trim(), body: '' };
      out.push(cur);
    } else if (cur) cur.body += `${line}\n`;
  }
  for (const e of out) e.body = e.body.trim();
  return out;
}

/** الأقسام الأحدث من `from` حتى `to` شاملًا — أحدثها أوّلًا. */
export function changesBetween(entries: ChangelogEntry[], from: string, to: string): ChangelogEntry[] {
  return entries
    .filter((e) => compareVersions(e.version, from) > 0 && compareVersions(e.version, to) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}
