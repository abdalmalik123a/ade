/**
 * حزمةٌ من برنامج مخاطباتٍ في Excel (الموجة ٢): «مخاطبات المدارس الرسمية» من ملفّ المالك بالأداة نفسها التي يستعملها
 * المكتب («استورد ← كتب من ملف Excel»، `planExcelImport`)، ثم تنقيحٌ مكتوبٌ في `curation.json` بجانب الحزمة:
 *
 * - **لكلّ ورقةٍ قرار**: عنوانها وتصنيفها ومعرّفها، أو سبب تركها. وورقةٌ بلا قرارٍ توقف البناء — فلا يدخل الحزمة ما لم
 *   يُراجَع، ولا يبقى في التنقيح ما لم يعد في الملفّ.
 * - **ولكلّ صورةٍ قرارٌ ببصمتها**: شعار الدولة موضعٌ فارغ يضع فيه المكتب شعاره (CATALOG، القاعدة ٤)، والخطّ الزخرفي
 *   خطٌّ فاصلٌ من البرنامج، والبسملة الصورة سطرٌ مكتوب، وصور مواقع الصور تُترك — فلا تخرج في الحزمة صورةٌ من خارج
 *   البرنامج. وصورةٌ بلا قرارٍ توقف البناء كذلك.
 * - **ونصٌّ بقي حرفيًّا من كتابٍ حقيقيّ** (تاريخ وثيقة) خانةٌ تُكتب.
 *
 * فيُكتب `pack.json` بوثائق جاهزة بمعرّفاتٍ ثابتة، ويبنيه `npm run packs` كسائر الحزم. وملفّ Excel نفسه لا يدخل
 * المستودع: فيه بيانات مدرسةٍ وأسماء ناس.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { citizenSourceOf } from '../../src/shared/citizenFields';
import { docText, makeField, newUuid, paragraph, run, type Block, type Doc, type FieldType, type ImageBlock, type Inline } from '../../src/shared/doc';
import { excelToDocs } from '../../src/main/services/excelDoc';
import { planExcelImport } from '../../src/main/services/importFolder';
import { stableDoc, type RawPack, type RawPackTemplate } from './build';

/** ما يصير إليه كلّ صورة: موضعٌ فارغ، أو خطٌّ فاصل، أو بسملةٌ مكتوبة، أو تُترك. */
export type ImageAction = 'slot' | 'rule' | 'basmala' | 'drop';

export type Curation = {
  id: string;
  title: string;
  section: string;
  description: string;
  version: string;
  verifiedOn: string;
  /** مصدر كلّ نموذجٍ في الحزمة (المبدأ ٥). */
  source: string;
  /** أوّل ١٢ حرفًا من بصمة SHA-256 للصورة ← قرارها. */
  images: Record<string, ImageAction>;
  /** ورقةٌ تُترك ← سببها. */
  exclude: Record<string, string>;
  sheets: {
    sheet: string;
    slug: string;
    title: string;
    category: string;
    /** نصٌّ حرفيّ يصير خانة: «في 2022/8/25 والمعنونة» تاريخٌ من كتابٍ حقيقيّ. */
    literal?: { text: string; key: string; label: string; type?: FieldType }[];
  }[];
};

const BASMALA = 'بسم الله الرحمن الرحيم';
const same = (a: string, b: string) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();

/** الصور بقراراتها — في المتن والأعمدة والمجموعات؛ والموضع الفارغ في العمود يُبقي عرضه. */
function curateImages(blocks: Block[], actionOf: (img: ImageBlock) => ImageAction, inColumn = false): Block[] {
  return blocks.flatMap((b): Block[] => {
    if (b.kind === 'columns') return [{ ...b, columns: b.columns.map((col) => curateImages(col, actionOf, true)) }];
    if (b.kind === 'group') return [{ ...b, blocks: curateImages(b.blocks, actionOf, inColumn) }];
    if (b.kind !== 'image') return [b];
    switch (actionOf(b)) {
      case 'rule':
        return [{ id: newUuid(), kind: 'rule' }];
      case 'basmala':
        return [paragraph([run(BASMALA, { bold: true })], { align: 'center', size: 20 })];
      case 'slot':
        // موضع الشعار: في العمود عمودٌ فارغٌ بعرضه، وفي المتن مسافةٌ بارتفاعه — يضع فيه المكتب شعاره.
        return inColumn ? [paragraph([])] : [{ id: newUuid(), kind: 'spacer', height: b.height ?? Math.round(b.width) }];
      case 'drop':
        return inColumn ? [paragraph([])] : [];
    }
  });
}

/** نصٌّ حرفيّ في الوثيقة خانةٌ — أوّل موضعٍ له في المتن أو الأعمدة أو الجداول. */
function literalToField(doc: Doc, text: string, key: string): { doc: Doc; found: boolean } {
  let found = false;
  const fix = (list: Inline[]): Inline[] =>
    list.flatMap((i): Inline[] => {
      if (found || i.kind !== 'run' || !i.text.includes(text)) return [i];
      found = true;
      const at = i.text.indexOf(text);
      return [
        ...(at > 0 ? [{ ...i, text: i.text.slice(0, at) }] : []),
        { kind: 'field', id: newUuid(), ref: key },
        ...(at + text.length < i.text.length ? [{ ...i, text: i.text.slice(at + text.length) }] : [])
      ];
    });
  const walk = (blocks: Block[]): Block[] =>
    blocks.map((b): Block => {
      switch (b.kind) {
        case 'paragraph':
          return { ...b, inlines: fix(b.inlines) };
        case 'columns':
          return { ...b, columns: b.columns.map(walk) };
        case 'group':
          return { ...b, blocks: walk(b.blocks) };
        case 'table':
          return { ...b, rows: b.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, blocks: c.blocks.map((p) => ({ ...p, inlines: fix(p.inlines) })) })) })) };
        default:
          return b;
      }
    });
  return { doc: { ...doc, blocks: walk(doc.blocks) }, found };
}

export async function buildExcelPack(xlsx: string, packDir: string): Promise<{ templates: number; excluded: string[]; images: Record<ImageAction, number> }> {
  const curation = JSON.parse(readFileSync(join(packDir, 'curation.json'), 'utf8')) as Curation;
  const hashOf = new Map<string, string>();
  const plan = await planExcelImport(xlsx, {
    saveImage: (bytes, ext) => {
      const hash = createHash('sha256').update(bytes).digest('hex');
      const src = `excel/${hash.slice(0, 32)}${ext.toLowerCase()}`;
      hashOf.set(src, hash.slice(0, 12));
      return src;
    }
  });

  const counts: Record<ImageAction, number> = { slot: 0, rule: 0, basmala: 0, drop: 0 };
  const actionOf = (img: ImageBlock): ImageAction => {
    const hash = hashOf.get(img.src) ?? '';
    const action = curation.images[hash];
    if (!action) throw new Error(`صورةٌ بلا قرار (${hash}) — أضف بصمتها إلى «images» في curation.json`);
    counts[action]++;
    return action;
  };

  const excluded: string[] = [];
  const templates: RawPackTemplate[] = [];
  for (const c of plan.candidates) {
    if (Object.keys(curation.exclude).some((s) => same(s, c.title))) {
      excluded.push(c.title);
      continue;
    }
    const entry = curation.sheets.find((s) => same(s.sheet, c.title));
    if (!entry) throw new Error(`ورقةٌ بلا قرار: «${c.title}» — أضفها إلى «sheets» أو «exclude» في curation.json`);
    let doc: Doc = { ...c.doc, blocks: curateImages(c.doc.blocks, actionOf) };
    for (const lit of entry.literal ?? []) {
      const out = literalToField(doc, lit.text, lit.key);
      if (!out.found) throw new Error(`«${entry.title}»: لا يوجد «${lit.text}» في الورقة — راجع «literal» في curation.json`);
      doc = { ...out.doc, fields: [...out.doc.fields, makeField({ key: lit.key, label: lit.label, type: lit.type ?? 'text', fillMode: 'hand', width: 12 })] };
    }
    // لا خانةٌ يقرؤها معجم ملف الزبون مكانَ عمله (CATALOG، القاعدة ٧).
    const risky = doc.fields.filter((f) => !f.source && citizenSourceOf(f.key) === 'workplace').map((f) => f.key);
    if (risky.length) throw new Error(`«${entry.title}»: خاناتٌ يملؤها الشبّاك من مكان عمل الزبون (${risky.join('، ')}) — سمّها بغير ذلك`);
    templates.push({
      slug: entry.slug,
      title: entry.title,
      category: entry.category,
      source: curation.source,
      verifiedOn: curation.verifiedOn,
      doc: stableDoc(doc, curation.id, entry.slug)
    });
  }
  const unused = curation.sheets.filter((s) => !plan.candidates.some((c) => same(s.sheet, c.title))).map((s) => s.sheet);
  if (unused.length) throw new Error(`في curation.json أوراقٌ ليست في الملفّ: ${unused.join('، ')}`);

  // ولا قيمةٌ من ورقة البيانات (اسم المدرسة ومديرها ومحافظتها) باقيةٌ نصًّا في كتاب — والقيم لا تُكتب في المستودع: تُقرأ
  // من الملفّ هنا وتُطابَق وحدها.
  const { dataFields } = await excelToDocs(xlsx);
  const fold = (s: string) => s.replace(/ـ+/g, '').replace(/\s+/g, ' ');
  for (const t of templates) {
    const body = fold(docText(t.doc!));
    const leaked = dataFields.filter((f) => (f.sample.match(/[ء-ي]/g) ?? []).length >= 4 && body.includes(fold(f.sample.trim())));
    if (leaked.length) throw new Error(`«${t.title}»: فيه نصًّا ما في ورقة البيانات (${leaked.map((f) => f.label).join('، ')}) — يجب أن يكون خانة`);
  }

  const pack: RawPack = {
    id: curation.id,
    title: curation.title,
    section: curation.section,
    description: curation.description,
    version: curation.version,
    verifiedOn: curation.verifiedOn,
    templates
  };
  writeFileSync(join(packDir, 'pack.json'), `${JSON.stringify(pack, null, 1)}\n`, 'utf8');
  return { templates: templates.length, excluded, images: counts };
}
