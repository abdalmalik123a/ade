/**
 * حزم التصاميم (DESIGNS.md ٣٫٦): تصاميمُ مختارة من «تصاميمك المحفوظة» في ملفٍّ واحد (`.diwanpack` — صيغة حزمة المحتوى نفسها،
 * فتُستورد من المعرض أو من الإعدادات، والمكرّر بمعرّفه لا يُضاف ثانيةً) — بصورها من المخزن.
 *
 * **والحرّ وحده يخرج** (§٣٫٧): خطّ ليس من «خطوط ديوان» المحزومة، وعنصرٌ استورده المكتب إلى مكتبته — ترخيصهما للمكتب، فلا
 * يُحزمان، **ويُقالان بأسمائهما** عند الحزم. وعند الاستيراد يُقال ما غاب في هذا الجهاز: خطٌّ ليس محزومًا ولا في مكتبته
 * (يُرسم ببديله حتى يُستورد)، وصورةٌ لم تأتِ — لا بديلٌ صامت.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from 'better-sqlite3';
import type { ContentCounts } from '@shared/api';
import { bundledFont, familyOf } from '@shared/fonts';
import { collectContent, writePack } from '../contentPack';
import { windowsFamilies } from '../fonts';

type Raw = Record<string, unknown>;
const obj = (v: unknown): v is Raw => typeof v === 'object' && v !== null;
/** مسار ملفٍّ في المخزن: `مجلّد/بصمة.امتداد`. */
const STORE_REF = /\b([a-z][a-z0-9-]{0,31})\/([0-9a-f]{16,64}\.[a-z0-9]{1,5})\b/g;

/** خطوط التصميم (أوّل عائلةٍ في كلّ نصٍّ وجدول) وعناصره المستوردة — من وجهه وظهره وخلفيّتيهما. */
export function designUses(doc: unknown): { fonts: string[]; elements: string[] } {
  const fonts = new Set<string>();
  const elements = new Set<string>();
  if (!obj(doc)) return { fonts: [], elements: [] };
  for (const canvas of [doc['canvas'], doc['backCanvas']]) {
    if (!obj(canvas)) continue;
    const bg = canvas['background'];
    if (obj(bg) && typeof bg['src'] === 'string' && bg['src'].startsWith('elements/')) elements.add(bg['src']);
    for (const el of Array.isArray(canvas['elements']) ? canvas['elements'] : []) {
      if (!obj(el)) continue;
      if ((el['kind'] === 'text' || el['kind'] === 'table') && typeof el['font'] === 'string') {
        const family = familyOf(el['font']);
        if (family) fonts.add(family);
      }
      if (el['kind'] === 'image' && typeof el['src'] === 'string' && el['src'].startsWith('elements/')) elements.add(el['src']);
    }
  }
  return { fonts: [...fonts].sort(), elements: [...elements].sort() };
}

/** ما لا يخرج في الحزمة: خطوطٌ ليست محزومة، وعناصرُ مستوردة بأسمائها في مكتبة المكتب. */
export type LeftOut = { fonts: string[]; elements: string[] };

/** حزمة التصاميم المختارة إلى `target` — وما لم يخرج منها. */
export async function exportDesigns(
  target: string,
  db: Database,
  storeRoot: string,
  appVersion: string,
  ids: number[]
): Promise<ContentCounts & { leftOut: LeftOut }> {
  const { pkg, files } = collectContent(db, storeRoot, appVersion, new Date(), ids);
  if (!pkg.templates.length) throw new Error('لم يُختر تصميمٌ يُحزم');
  const fonts = new Set<string>();
  const elements = new Set<string>();
  for (const t of pkg.templates) {
    const uses = designUses(t.doc);
    for (const f of uses.fonts) if (!bundledFont(f)) fonts.add(f);
    for (const e of uses.elements) elements.add(e);
  }
  await writePack(target, pkg, files, storeRoot);
  const nameOf = db.prepare('SELECT name FROM elements WHERE file = ?');
  const names = [...elements].map((file) => (nameOf.get(file) as { name: string } | undefined)?.name ?? 'عنصرٌ مستورد');
  return { templates: pkg.templates.length, letterheads: 0, clips: 0, files: files.length, leftOut: { fonts: [...fonts].sort(), elements: [...new Set(names)] } };
}

/**
 * ما غاب في التصاميم المضافة من حزمة: خطٌّ ليس محزومًا ولا في مكتبة هذا الجهاز ولا في خطوط Windows عليه (فـ«Simplified
 * Arabic» يُرسم من النظام)، وصورٌ يشير إليها التصميم وليست في المخزن (عنصرٌ مستورد لم يخرج مع الحزمة، أو صورةٌ من مجلّدات الناس).
 */
export function missingAfterImport(db: Database, storeRoot: string, templateIds: number[]): { fonts: string[]; images: number } {
  const docOf = db.prepare('SELECT doc_json AS docJson FROM templates WHERE id = ?');
  const own = new Set((db.prepare('SELECT DISTINCT family FROM fonts').all() as { family: string }[]).map((r) => r.family.toLowerCase()));
  const fonts = new Set<string>();
  const images = new Set<string>();
  for (const id of templateIds) {
    const json = (docOf.get(id) as { docJson: string | null } | undefined)?.docJson;
    if (!json) continue;
    let doc: unknown;
    try {
      doc = JSON.parse(json);
    } catch {
      continue;
    }
    for (const f of designUses(doc).fonts) if (!bundledFont(f) && !own.has(f.toLowerCase())) fonts.add(f);
    for (const m of json.matchAll(STORE_REF)) {
      const rel = `${m[1]}/${m[2]}`;
      if (!existsSync(join(storeRoot, rel))) images.add(rel);
    }
  }
  // خطوط Windows تُقرأ رؤوسها مرّةً في الجلسة — وحين يبقى ما يُسأل عنه وحده.
  const system = fonts.size ? new Set(windowsFamilies().map((w) => w.family.toLowerCase())) : new Set<string>();
  return { fonts: [...fonts].filter((f) => !system.has(f.toLowerCase())).sort(), images: images.size };
}
