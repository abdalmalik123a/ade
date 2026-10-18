/**
 * مُنشئ حزم المحتوى الجاهزة (content packs builder).
 *
 * يقرأ content/packs/<pack-id>/pack.json، ويتحقق من كافة القيود الإدارية الصارمة،
 * ويبني النماذج بدوال البرنامج المشتركة بمعرفات UUID v5 ثابتة للأبد،
 * وينتج resources/packs/<id>.diwanpack و resources/packs/index.json.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  docFromLegacy,
  docText,
  walkBlocks,
  type Block,
  type Doc,
  type DocField,
  type Inline,
  type PageSize,
  type Orientation,
  type LetterheadMode
} from '../../src/shared/doc';
import { normalizeDoc } from '../../src/shared/docNormalize';
import {
  AUTO_TOKENS,
  CITIZEN_TOKENS,
  legacyFieldMeta,
  type TemplateVariable,
  type VariableSource
} from '../../src/shared/template';
import { citizenSourceOf } from '../../src/shared/citizenFields';
import { hasChoiceText } from '../../src/shared/gender';
import { ZipWriter, fileSink } from '../../src/main/services/zip';
import type { ContentPackage } from '../../src/main/services/contentPack';

export const DIWAN_PACK_NAMESPACE = '7b6a4805-4f40-42be-921a-42861c8be401';

/**
 * UUID v5 محدد وثابت للأبد (RFC 4122 v5).
 * بمدخل واحد يُخرج البايتات نفسها دائمًا.
 */
export function uuidV5(name: string, namespace = DIWAN_PACK_NAMESPACE): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(Buffer.concat([nsBytes, Buffer.from(name, 'utf8')])).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50; // Version 5
  hash[8] = (hash[8]! & 0x3f) | 0x80; // Variant RFC 4122
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** قائمة الكلمات والجهات الصريحة المحظورة في النماذج (المبدأ ١ — لا جهة بعينها). */
export const FORBIDDEN_ENTITIES = [
  'الرشيد',
  'بداءة الكرخ',
  'بداءة الرصافة',
  'تربية الكرخ',
  'تربية الرصافة',
  'تربية الأنبار',
  'تربية البصرة',
  'تربية نينوى',
  'تربية النجف',
  'تربية كربلاء',
  'تربية بابل',
  'تربية واسط',
  'تربية ذي قار',
  'تربية ميسان',
  'تربية كركوك',
  'تربية ديالى',
  'تربية صلاح الدين',
  'تربية القادسية',
  'تربية المثنى',
  'محكمة بداءة',
  'محكمة تحقيق',
  'محكمة استئناف',
  'محكمة الأحوال الشخصية في',
  'مدرسة النجاح',
  'مدرسة النضال',
  'مدرسة الأمل',
  'ثانوية المتميزين في',
  'إعدادية المركزية'
];

export type PackFieldOverride = {
  label?: string;
  type?: DocField['type'];
  required?: boolean;
  fillMode?: DocField['fillMode'];
  role?: DocField['role'];
  source?: string | null;
  width?: number;
  choices?: string[];
  hint?: string;
  calendar?: DocField['calendar'];
};

export type RawPackTemplate = {
  slug: string;
  title: string;
  subtitle?: string | null;
  category: string;
  code?: string | null;
  paper?: PageSize;
  orientation?: Orientation;
  letterheadMode?: LetterheadMode;
  source: string;
  verifiedOn: string;
  /** المتن نصًّا بوسوم `{}` — ويُبنى وثيقةً بدالة البرنامج. */
  body?: string;
  /**
   * أو الوثيقة نفسها كما رسمها مستورِدٌ (أعمدةٌ وجداول وخانات) — حزمة «مخاطبات المدارس الرسمية» من برنامج مخاطباتٍ في
   * Excel (`tools/packs/excel.ts`). وتُثبَّت معرّفاتها هنا كما تُثبَّت معرّفات المتن.
   */
  doc?: Doc;
  fields?: Record<string, PackFieldOverride>;
};

export type RawPackClip = {
  slug: string;
  title: string;
  body: string;
  category: string;
  direction?: 'up' | 'down' | 'peer' | null;
};

export type RawPack = {
  id: string;
  title: string;
  section: string;
  description: string;
  version: string;
  verifiedOn: string;
  templates?: RawPackTemplate[];
  clips?: RawPackClip[];
};

export type BuiltIndexEntry = {
  id: string;
  title: string;
  section: string;
  description: string;
  version: string;
  verifiedOn: string;
  counts: {
    templates: number;
    letterheads: number;
    clips: number;
    files: number;
  };
  sampleUuid?: string;
  sha256: string;
};

function blockInlines(block: Block): Inline[] {
  if (block.kind === 'paragraph') return block.inlines;
  return [];
}

/** تدقيق النموذج وفق القيود الصارمة المحددة في FOUNDATION.md وقرارات المالك */
export function validateTemplate(t: RawPackTemplate, packId: string, seenSlugs: Set<string>, seenCodes: Set<string>): void {
  const name = `النموذج «${t.title || 'بلا عنوان'}» (${t.slug || 'بلا slug'})`;

  if (!t.slug || !t.slug.trim()) throw new Error(`${name}: المعرف slug مطلوب`);
  if (!t.title || !t.title.trim()) throw new Error(`${name}: العنوان مطلوب`);
  if (seenSlugs.has(t.slug)) throw new Error(`تكرر المعرف slug «${t.slug}» في الحزمة «${packId}»`);
  seenSlugs.add(t.slug);

  if (t.code && t.code.trim()) {
    if (seenCodes.has(t.code.trim())) throw new Error(`تكرر الكود «${t.code}» في ${name}`);
    seenCodes.add(t.code.trim());
  }

  // ١) غاب المصدر أو تاريخ التحقق
  if (!t.source || !t.source.trim()) throw new Error(`${name}: غاب المصدر — المبدأ ٥ «الكتاب الرسمي لا يحتمل التخمين»`);
  if (!t.verifiedOn || !t.verifiedOn.trim()) throw new Error(`${name}: غاب تاريخ التحقق`);
  if (!t.body?.trim() && !t.doc) throw new Error(`${name}: لا متن ولا وثيقة`);

  // ٢) ورد اسم جهة بعينها من قائمة الحظر — والوثيقة الجاهزة بنصّها كلّه (الأعمدة والجداول معه).
  const body = t.doc ? docText(t.doc) : (t.body ?? '');
  const fullText = `${t.title} ${t.subtitle ?? ''} ${body}`;
  for (const forbidden of FORBIDDEN_ENTITIES) {
    if (fullText.includes(forbidden)) {
      throw new Error(`${name}: ورد اسم جهةٍ بعينها («${forbidden}») — المبدأ ١ يمنع أسماء الجهات الصريحة، والجهة المخاطبة يجب أن تكون حقلًا`);
    }
  }

  // ٣) وُجد خيار جنس في المتن بلا حقل «الجنس»
  const hasGenderChoice = hasChoiceText(body) || /\{[^{}|]*\|[^{}]*\}/.test(body);
  const fieldsMap: Record<string, PackFieldOverride> = {
    ...Object.fromEntries((t.doc?.fields ?? []).map((f) => [f.key, { source: f.source }])),
    ...(t.fields ?? {})
  };
  if (hasGenderChoice && !fieldsMap['الجنس'] && !fieldsMap['gender']) {
    throw new Error(`${name}: وُجد خيار تذكير وتأنيث في المتن بلا حقل «الجنس»`);
  }

  // ٤) حقل يُملأ من ملف الزبون ولم يُقصد ذلك (خاصة «الجهة» أو «المديرية» أو «الدائرة»)
  for (const [key, override] of Object.entries(fieldsMap)) {
    const inferred = citizenSourceOf(key);
    if (inferred === 'workplace') {
      throw new Error(
        `${name}: الحقل «${key}» يملأه الشباك تلقائيًا من «مكان عمل» الزبون! استعمل «المرسل_إليه» بدلًا منه لتفادي الطباعة لجهة خاطئة صامتًا`
      );
    }
    // إن طابق خانة أخرى في ملف الزبون ولم يُصرّح بها أو صُرّح بغيرها
    if (inferred && override.source && override.source !== inferred) {
      throw new Error(`${name}: الحقل «${key}» يطابق خانة «${inferred}» في ملف الزبون بينما صُرّح بـ«${override.source}»`);
    }
  }
}

/**
 * وثيقةٌ جاهزة بمعرّفاتٍ ثابتة: كلّ معرّفٍ في شجرتها (الكتل والأعمدة والصفوف والخلايا والخانات في السطر) بترتيب
 * ورودها — فالوثيقة نفسها تُخرج المعرّفات نفسها في كلّ بناء.
 */
export function stableDoc(source: Doc, packId: string, slug: string): Doc {
  const doc = JSON.parse(JSON.stringify(source)) as Doc;
  doc.id = uuidV5(`${packId}:template:${slug}:doc`);
  let n = 0;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (typeof o.id === 'string') o.id = uuidV5(`${packId}:template:${slug}:node:${n++}`);
    for (const v of Object.values(o)) if (v && typeof v === 'object') visit(v);
  };
  visit(doc.blocks);
  for (const f of doc.fields) f.id = uuidV5(`${packId}:template:${slug}:field:${f.key}`);
  return doc;
}

/** بناء كائن Doc لكل قالب بدوال البرنامج المعتمدة مع ثبات تام للـ UUIDs */
export function buildTemplateDoc(t: RawPackTemplate, packId: string): Doc {
  let doc: Doc;
  if (t.doc) {
    // الوثيقة الجاهزة بإعداد صفحتها كما رُسمت — إلا ما صرّحت به الحزمة.
    doc = stableDoc(t.doc, packId, t.slug);
    if (t.paper) doc.pageSetup.size = t.paper;
    if (t.orientation) doc.pageSetup.orientation = t.orientation;
    if (t.letterheadMode) doc.pageSetup.letterheadMode = t.letterheadMode;
  } else {
    doc = docFromLegacy(t.body ?? '', legacyFieldMeta);

    // جعل معرّف الوثيقة ثابتًا
    doc.id = uuidV5(`${packId}:template:${t.slug}:doc`);

    // إعداد الصفحة
    doc.pageSetup.size = t.paper ?? 'A4';
    doc.pageSetup.orientation = t.orientation ?? 'portrait';
    doc.pageSetup.letterheadMode = t.letterheadMode ?? 'print';

    // معرّفات الكتل والأجزاء الداخلية محددة بثبات
    let blockIdx = 0;
    for (const b of walkBlocks(doc.blocks)) {
      b.id = uuidV5(`${packId}:template:${t.slug}:block:${blockIdx}`);
      let inlineIdx = 0;
      for (const inl of blockInlines(b)) {
        if (inl.kind === 'field') {
          inl.id = uuidV5(`${packId}:template:${t.slug}:inline:${blockIdx}:${inlineIdx}`);
        }
        inlineIdx++;
      }
      blockIdx++;
    }
  }

  // تطبيق تجاوزات الحقول وتثبيت الـ UUIDs
  const overrides = t.fields ?? {};
  for (const f of doc.fields) {
    f.id = uuidV5(`${packId}:template:${t.slug}:field:${f.key}`);
    const ov = overrides[f.key];
    if (ov) {
      if (ov.label) f.label = ov.label;
      if (ov.type) f.type = ov.type;
      if (ov.required !== undefined) f.required = ov.required;
      if (ov.width !== undefined) f.width = ov.width;
      if (ov.fillMode) f.fillMode = ov.fillMode;
      if (ov.role !== undefined) f.role = ov.role;
      if (ov.source !== undefined) f.source = ov.source;
      if (ov.choices) f.choices = ov.choices;
      if (ov.hint) f.hint = ov.hint;
      if (ov.calendar) f.calendar = ov.calendar;
    }
  }

  // التحقق والتطبيع النهائي بدالة البرنامج
  return normalizeDoc(doc);
}

/** بناء حزمة كاملة إلى ملف .diwanpack محدد وقابل للإعادة */
export async function buildPack(
  packDir: string,
  outPacksDir: string
): Promise<BuiltIndexEntry> {
  const packJsonPath = join(packDir, 'pack.json');
  if (!existsSync(packJsonPath)) throw new Error(`ملف ${packJsonPath} غير موجود`);

  const rawPack = JSON.parse(readFileSync(packJsonPath, 'utf8')) as RawPack;
  if (!rawPack.id || !rawPack.title || !rawPack.section || !rawPack.version || !rawPack.verifiedOn) {
    throw new Error(`الحزمة في ${packDir} تنقصها حقول أساسية (id, title, section, version, verifiedOn)`);
  }

  const seenSlugs = new Set<string>();
  const seenCodes = new Set<string>();

  // تدقيق وبناء النماذج
  const templates = (rawPack.templates ?? []).slice().sort((a, b) => a.slug.localeCompare(b.slug));
  const builtTemplates = templates.map((t) => {
    validateTemplate(t, rawPack.id, seenSlugs, seenCodes);
    const doc = buildTemplateDoc(t, rawPack.id);
    const uuid = uuidV5(`${rawPack.id}:template:${t.slug}`);

    // استخراج المتغيرات مرتبة — وللوثيقة الجاهزة من خاناتها: ما صرّحت بمصدره من ملف الزبون، كما يحفظها المحرّر.
    const variables: TemplateVariable[] = t.doc
      ? doc.fields.map((f) => ({ token: f.key, label: f.label, source: f.source ? 'citizen' : 'manual', required: f.required }))
      : Object.entries(t.fields ?? {}).map(([key, ov]) => {
          let src: VariableSource = 'manual';
          if (AUTO_TOKENS.some((a) => a.token === key)) src = 'auto';
          else if (ov.source || citizenSourceOf(key) || CITIZEN_TOKENS.some((c) => c.token === key)) src = 'citizen';
          return {
            token: key,
            label: ov.label ?? key.replace(/_/g, ' '),
            source: src,
            required: ov.required === true
          };
        });

    return {
      uuid,
      code: t.code?.trim() || null,
      title: t.title.trim(),
      subtitle: t.subtitle?.trim() || null,
      category: t.category.trim(),
      subjectLine: null,
      // الظلّ النصّي للبحث ولمعاينة البطاقة، كما يحفظه «استورد مجلدي»؛ والحقيقة في `doc`.
      bodyHtml: t.body ?? docText(doc),
      doc,
      letterheadUuid: null,
      variables
    };
  });

  // تدقيق وبناء الكليشات
  const clips = (rawPack.clips ?? []).slice().sort((a, b) => a.slug.localeCompare(b.slug));
  const builtClips = clips.map((c) => {
    if (!c.slug) throw new Error(`كليشة في الحزمة ${rawPack.id} تنقصها slug`);
    if (seenSlugs.has(c.slug)) throw new Error(`تكرر المعرف slug «${c.slug}» في الحزمة «${rawPack.id}»`);
    seenSlugs.add(c.slug);

    return {
      uuid: uuidV5(`${rawPack.id}:clip:${c.slug}`),
      title: c.title.trim(),
      body: c.body.trim(),
      category: c.category.trim() || null,
      direction: c.direction ?? null
    };
  });

  const verifiedDate = new Date(`${rawPack.verifiedOn}T00:00:00.000Z`);

  const pkg: ContentPackage = {
    app: 'diwan',
    kind: 'content',
    format: 1,
    appVersion: rawPack.version,
    createdAt: verifiedDate.toISOString(),
    letterheads: [],
    templates: builtTemplates,
    clips: builtClips
  };

  mkdirSync(outPacksDir, { recursive: true });
  const packFileName = `${rawPack.id}.diwanpack`;
  const packFilePath = join(outPacksDir, packFileName);
  const partFilePath = `${packFilePath}.part`;

  const sink = await fileSink(partFilePath);
  try {
    const zip = new ZipWriter(sink, { date: verifiedDate });
    const contentBytes = Buffer.from(JSON.stringify(pkg, null, 2), 'utf8');
    await zip.addBuffer('diwan-content.json', contentBytes);
    await zip.finish();
    await sink.close();
  } catch (err) {
    await sink.close().catch(() => undefined);
    rmSync(partFilePath, { force: true });
    throw err;
  }

  if (existsSync(packFilePath)) rmSync(packFilePath);
  renameSync(partFilePath, packFilePath);

  const packBytes = readFileSync(packFilePath);
  const sha256 = createHash('sha256').update(packBytes).digest('hex');

  return {
    id: rawPack.id,
    title: rawPack.title,
    section: rawPack.section,
    description: rawPack.description,
    version: rawPack.version,
    verifiedOn: rawPack.verifiedOn,
    counts: {
      templates: builtTemplates.length,
      letterheads: 0,
      clips: builtClips.length,
      files: 0
    },
    sampleUuid: builtTemplates[0]?.uuid ?? builtClips[0]?.uuid ?? '',
    sha256
  };
}

/** بناء كل الحزم الموجودة في content/packs إلى resources/packs */
export async function buildAllPacks(
  contentPacksDir = resolve('content/packs'),
  outPacksDir = resolve('resources/packs')
): Promise<BuiltIndexEntry[]> {
  if (!existsSync(contentPacksDir)) {
    throw new Error(`مجلد الحزم ${contentPacksDir} غير موجود`);
  }

  const entries = readdirSync(contentPacksDir, { withFileTypes: true });
  const packDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const results: BuiltIndexEntry[] = [];
  for (const dirName of packDirs) {
    const packDir = join(contentPacksDir, dirName);
    if (!existsSync(join(packDir, 'pack.json'))) continue;
    const res = await buildPack(packDir, outPacksDir);
    results.push(res);
  }

  results.sort((a, b) => a.id.localeCompare(b.id));
  const indexPath = join(outPacksDir, 'index.json');
  writeFileSync(indexPath, JSON.stringify(results, null, 2) + '\n', 'utf8');

  return results;
}
