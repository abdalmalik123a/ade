/**
 * قارئ XML صغير لملفّات Word، وأدوات السير في شجرته — لقارئ الوثيقة (`docxDoc.ts`) وكاشف ما لا يُنقل (`wordScan.ts`).
 *
 * كان في `docxDoc.ts` حتى بلغ سقفه، فنُقل كما هو (محادثة «محرّر الكتاب»، ما بعد البند ٣).
 */

// ── قارئ XML صغير ────────────────────────────────────────────────────

/**
 * عقدة XML: اسمٌ وسماتٌ وأبناءٌ ونصّ.
 *
 * ملف Word شجرة — جدولٌ في خليّته فقرة في مقطعها نصّ — والتعابير النمطية تقرؤه
 * سطحًا فتخلط فقرة الخليّة بفقرة المتن. وقارئٌ بأربعين سطرًا يكفي: الملف مولَّدٌ
 * سليم البنية دائمًا.
 */
export type XNode = { name: string; attrs: Record<string, string>; kids: XNode[]; text: string };

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

export function parseXml(xml: string): XNode {
  const root: XNode = { name: '#root', attrs: {}, kids: [], text: '' };
  const stack: XNode[] = [root];
  const re =
    /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!\[CDATA\[([\s\S]*?)\]\]>|<[?!][\s\S]*?>|([^<]+)/g;

  for (const m of xml.matchAll(re)) {
    const top = stack[stack.length - 1]!;
    if (m[6] !== undefined) {
      top.text += decode(m[6]);
      continue;
    }
    if (m[5] !== undefined) {
      top.text += m[5];
      continue;
    }
    if (!m[2]) continue; // تعليق أو تعليمة معالجة
    if (m[1]) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of (m[3] ?? '').matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[a[1]!] = decode(a[2] ?? a[3] ?? '');
    }
    const node: XNode = { name: m[2], attrs, kids: [], text: '' };
    top.kids.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}

export const kid = (n: XNode | undefined, name: string) => n?.kids.find((k) => k.name === name);
export const kidsOf = (n: XNode | undefined, name: string) => n?.kids.filter((k) => k.name === name) ?? [];
export const val = (n: XNode | undefined) => n?.attrs['w:val'];
export const num = (s: string | undefined) => (s === undefined || s === '' ? undefined : Number(s));
/** خاصيةٌ مفتاحية: وجودها تشغيل، إلا أن تُطفأ صراحةً بـ`w:val="0"`. */
export const toggle = (n: XNode | undefined) =>
  n === undefined ? undefined : !['0', 'false', 'off', 'none'].includes(n.attrs['w:val'] ?? '');

export function find(n: XNode, name: string): XNode | undefined {
  for (const k of n.kids) {
    if (k.name === name) return k;
    const deep = find(k, name);
    if (deep) return deep;
  }
  return undefined;
}
