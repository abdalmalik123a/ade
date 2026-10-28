/**
 * «الحزمة المختومة» `.diwanseal` (S48، ر181 ر182، D203): ملفٌّ يختمه المالك فلا يقبل ديوان غيره، ويُشفَّر فلا يُفتح في غيره.
 *
 *   DIWANSEAL1\n · طول الرأس (u32) · الرأس JSON · طول الختم (u32) · الختم · الحمولة المشفّرة ووسمها (AES-256-GCM)
 *
 * **الختم** Ed25519 بمفتاح التحديث (ر177 §٣، فلا مفتاح جديد على المالك) على `diwan-seal\n` + الرأس — والبادئة تمنع أن يصلح توقيع
 * تحديثٍ ختمًا أو العكس · والرأس فيه **بصمة الحمولة** وحجمها، فما عُبث به بعد الختم يُعرف قبل الفكّ · و**مفتاح التشفير** يُشتقّ
 * (HKDF-SHA256) من مفتاح التحديث العامّ نفسه — بلا سرٍّ جديدٍ يُنسخ بين البرنامج وأداة المالك.
 * والحمولة بعد الفكّ: طول القائمة (u32) · القائمة JSON `{ items }` · بايتات القطع بترتيبها.
 *
 * والكاتب في `tools/keytool/core.mjs` (`writeSealedPack`) بالقواعد نفسها نصًّا — واختبار `sealedPack` يجمعهما.
 */
export const SEAL_MAGIC = 'DIWANSEAL1\n';
/** بادئة ما يُختم: فلا يصلح توقيع تحديثٍ (JSON بلا بادئة) ختمًا. */
export const SEAL_CONTEXT = 'diwan-seal\n';
export const SEAL_EXT = 'diwanseal';
/** ملح اشتقاق مفتاح التشفير ومعلومته. */
export const SEAL_HKDF = { salt: 'diwan-seal-v1', info: 'content' } as const;

/** ما في الحزمة: القاط اليوم، والمعاملات والترويسات والكليشات في م١٠. */
export type ContentSection = 'templates' | 'clips' | 'letterheads';
export type SealContent = 'suits' | ContentSection;
/** «حزمةٌ أولى» تعمل في التجربة، و«حزمة المشتري» في ديوانٍ مفعّل وحده (ر182). */
export type SealKind = 'first' | 'buyer';
export type SealHead = {
  v: 1;
  app: 'diwan';
  content: SealContent;
  kind: SealKind;
  title: string;
  issued: string;
  /** أوّل ستّة عشر حرفًا من بصمة المفتاح العامّ (SPKI) — يُعرف به أيّ مفتاحٍ ختم. */
  keyId: string;
  iv: string;
  /** طول الحمولة المشفّرة ووسمها، وبصمتها SHA-256. */
  size: number;
  sha256: string;
};
export type SealItemExt = 'png' | 'psd' | 'diwanpack';
export type SealItem = { name: string; ext: SealItemExt; size: number; sha256: string };

export const CONTENT_SECTIONS: readonly ContentSection[] = ['templates', 'clips', 'letterheads'];
export const SEAL_CONTENTS: readonly SealContent[] = ['suits', ...CONTENT_SECTIONS];
export const SECTION_LABEL: Record<ContentSection, string> = { templates: 'المعاملات', clips: 'الكليشات', letterheads: 'الترويسات' };
export const SEAL_EXTS: readonly SealItemExt[] = ['png', 'psd', 'diwanpack'];
export const SEAL_LIMITS = { pack: 2 * 1024 ** 3, items: 2000, item: 200 * 1024 ** 2, name: 80, head: 64 * 1024, list: 4 * 1024 ** 2, signature: 1024 } as const;

export const SEAL_ERRORS = {
  notPack: 'الملف ليس حزمةً مختومة لديوان',
  unsigned: 'الحزمة ليست مختومةً من صاحب ديوان',
  tampered: 'عُبث بالحزمة بعد ختمها — اطلب نسخةً سليمة',
  tooBig: 'الحزمة أكبر ممّا يقبله ديوان'
} as const;

export const SEAL_KIND_LABEL: Record<SealKind, string> = { first: 'حزمةٌ أولى', buyer: 'حزمة المشتري' };

/** اسم القطعة كما يُعرض: بلا مسارٍ ولا محارف تحكّم، وثمانون حرفًا على الأكثر. */
export function cleanName(name: unknown): string {
  return String(name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEAL_LIMITS.name);
}

const HEX = /^[0-9a-f]+$/;

/** الرأس بعد JSON.parse — بحقوله وأنواعها، وإلا `null`. */
export function validHead(x: unknown): SealHead | null {
  const h = x as Partial<SealHead> | null;
  if (!h || typeof h !== 'object' || h.v !== 1 || h.app !== 'diwan') return null;
  if (!SEAL_CONTENTS.includes(h.content as SealContent) || (h.kind !== 'first' && h.kind !== 'buyer')) return null;
  if (typeof h.title !== 'string' || typeof h.issued !== 'string' || typeof h.iv !== 'string' || typeof h.keyId !== 'string') return null;
  if (typeof h.sha256 !== 'string' || h.sha256.length !== 64 || !HEX.test(h.sha256) || !HEX.test(h.keyId)) return null;
  if (!Number.isSafeInteger(h.size) || h.size! < 16 || h.size! > SEAL_LIMITS.pack) return null;
  return h as SealHead;
}

/** قائمة القطع بعد الفكّ — والمجموع يطابق ما بقي من الحمولة. */
export function validItems(x: unknown, bytesLeft: number, content: SealContent = 'suits'): SealItem[] | null {
  const items = (x as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > SEAL_LIMITS.items) return null;
  if (content !== 'suits' && items.length !== 1) return null;
  let total = 0;
  const out: SealItem[] = [];
  for (const it of items as Partial<SealItem>[]) {
    const name = cleanName(it?.name);
    if (!name || !SEAL_EXTS.includes(it?.ext as SealItemExt)) return null;
    if (content === 'suits' ? it.ext === 'diwanpack' : it.ext !== 'diwanpack') return null;
    if (!Number.isSafeInteger(it?.size) || it!.size! <= 0 || it!.size! > SEAL_LIMITS.item) return null;
    if (typeof it?.sha256 !== 'string' || it.sha256.length !== 64 || !HEX.test(it.sha256)) return null;
    total += it.size!;
    out.push({ name, ext: it.ext as SealItemExt, size: it.size!, sha256: it.sha256 });
  }
  return total === bytesLeft ? out : null;
}
