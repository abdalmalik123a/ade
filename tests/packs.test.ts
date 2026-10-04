/**
 * اختبارات حزم الجهات الجاهزة (content packs) — (البرومت الأول من خطة الحزم)
 *
 * التحقق من:
 * ١) قراءة الحزم بـ readZipIndex ومطابقة صيغة ديوان.
 * ٢) ثبات UUID v5 بين البناءات وتحديد معرّفاتها.
 * ٣) مرور كل وثيقة doc عبر normalizeDoc بلا فقدان كتل أو حقول.
 * ٤) خلو الحزم تمامًا من مجلدات وبيانات الناس وقواعد البيانات.
 * ٥) تطبيق قواعد التدقيق الإداري الصارم (منع الجهات الصريحة، مصادر التحقق، ضبط التذكير والتأنيث، منع ملء جهة العمل صامتًا).
 * ٦) صحة بصمات sha256 وقابليتها للإعادة بين بناءين متتاليين.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readZipIndex } from '../src/main/services/zip';
import { unzipSync } from 'fflate';
import { normalizeDoc, type Doc, type DocField } from '../src/shared/doc';
import {
  buildPack,
  DIWAN_PACK_NAMESPACE,
  FORBIDDEN_ENTITIES,
  uuidV5,
  validateTemplate,
  type BuiltIndexEntry,
  type RawPackTemplate
} from '../tools/packs/build';
import type { ContentPackage } from '../src/main/services/contentPack';

describe('حزم الجهات الجاهزة (Content Packs)', () => {
  const PACKS_DIR = join(process.cwd(), 'resources', 'packs');
  const EDU_PACK_PATH = join(PACKS_DIR, 'education.diwanpack');
  const INDEX_PATH = join(PACKS_DIR, 'index.json');

  it('حزمة التربية وفهرس الحزم موجودان', () => {
    const indexRaw = readFileSync(INDEX_PATH, 'utf8');
    const index = JSON.parse(indexRaw) as BuiltIndexEntry[];
    expect(Array.isArray(index)).toBe(true);
    const edu = index.find((p) => p.id === 'education');
    expect(edu).toBeDefined();
    expect(edu?.title).toBe('التربية والمدارس');
    expect(edu?.section).toBe('التربية');
    expect(edu?.counts.templates).toBe(6);
    expect(edu?.counts.clips).toBe(4);
  });

  it('بصمة SHA-256 في index.json تطابق ملف الحزمة بدقة', () => {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as BuiltIndexEntry[];
    const edu = index.find((p) => p.id === 'education')!;
    const packBytes = readFileSync(EDU_PACK_PATH);
    const hash = createHash('sha256').update(packBytes).digest('hex');
    expect(hash).toBe(edu.sha256);
  });

  it('تُقرأ الحزمة بـ readZipIndex وتطابق الصيغة القياسية وخالية من بيانات الناس', async () => {
    const entries = await readZipIndex(EDU_PACK_PATH);
    const names = entries.map((e) => e.name);

    expect(names).toContain('diwan-content.json');

    // لا قاعدة بيانات ولا مجلدات مواطنين ولا مرفقات
    for (const name of names) {
      expect(name).not.toMatch(/^diwan\.db$/i);
      expect(name).not.toMatch(/^(people|citizens|attachments|customers)\//i);
    }
  });

  it('محتوى الحزمة يطابق صيغة ContentPackage القياسية', () => {
    const zipData = unzipSync(readFileSync(EDU_PACK_PATH));
    const jsonBytes = zipData['diwan-content.json'];
    expect(jsonBytes).toBeDefined();

    const pkg = JSON.parse(Buffer.from(jsonBytes!).toString('utf8')) as ContentPackage;
    expect(pkg.format).toBe(1);
    expect(pkg.templates.length).toBe(6);
    expect(pkg.clips.length).toBe(4);
    expect(pkg.letterheads.length).toBe(0);

    // التحقق من نماذج التربية الستة
    const codes = pkg.templates.map((t) => t.code).sort();
    expect(codes).toEqual(['EDU-01', 'EDU-02', 'EDU-03', 'EDU-04', 'EDU-05', 'EDU-06']);

    // كل نموذج يحمل doc ومعرف uuid ثابت
    for (const t of pkg.templates) {
      expect(t.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(t.title).toBeTruthy();
      expect(t.category).toBe('التربية');
      expect(t.doc).toBeDefined();
    }
  });

  it('كل وثيقة doc في الحزمة تمر بـ normalizeDoc بلا فقدان في الكتل أو الحقول', () => {
    const zipData = unzipSync(readFileSync(EDU_PACK_PATH));
    const pkg = JSON.parse(Buffer.from(zipData['diwan-content.json']!).toString('utf8')) as ContentPackage;

    for (const t of pkg.templates) {
      const origDoc = t.doc as Doc;
      const normalized = normalizeDoc(origDoc);

      expect(normalized.id).toBe(origDoc.id);
      expect(normalized.schemaVersion).toBe(origDoc.schemaVersion);
      expect(normalized.kind).toBe(origDoc.kind);
      expect(normalized.blocks.length).toBe(origDoc.blocks.length);
      expect(normalized.fields.length).toBe(origDoc.fields.length);

      // التأكد من أن جميع مفاتيح الحقول متطابقة
      const origKeys = origDoc.fields.map((f: DocField) => f.key);
      const normKeys = normalized.fields.map((f: DocField) => f.key);
      expect(normKeys).toEqual(origKeys);
    }
  });

  it('دالة uuidV5 محددة وتنتج UUID صالحًا وثابتًا للأبد لنفس المدخلات', () => {
    const u1 = uuidV5('education:template:EDU-01', DIWAN_PACK_NAMESPACE);
    const u2 = uuidV5('education:template:EDU-01', DIWAN_PACK_NAMESPACE);
    expect(u1).toBe(u2);
    // الإصدار 5 والنوع RFC 4122
    expect(u1[14]).toBe('5');
    expect(['8', '9', 'a', 'b']).toContain(u1[19]?.toLowerCase());

    const diff = uuidV5('education:template:EDU-02', DIWAN_PACK_NAMESPACE);
    expect(diff).not.toBe(u1);
  });

  it('إعادة البناء قابلة للتكرار (Deterministic) بنفس البايتات والبصمة', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'diwan-pack-test-'));
    const packSource = join(process.cwd(), 'content', 'packs', 'education');

    const result = await buildPack(packSource, tempDir);
    const builtBytes = readFileSync(join(tempDir, 'education.diwanpack'));
    const hash = createHash('sha256').update(builtBytes).digest('hex');

    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as BuiltIndexEntry[];
    const edu = index.find((p) => p.id === 'education')!;

    expect(result.sha256).toBe(edu.sha256);
    expect(hash).toBe(edu.sha256);
  });

  describe('قواعد التدقيق الإداري الصارم (validateTemplate)', () => {
    const validBase: RawPackTemplate = {
      slug: 'test-doc',
      title: 'طلب اختبار',
      category: 'عام',
      source: 'بوابة أور الإلكترونية',
      verifiedOn: '2026-10-04',
      body: 'يرجى التفضل بالموافقة على الطلب.'
    };

    it('يرفض النموذج إن غاب المصدر أو تاريخ التحقق', () => {
      expect(() => {
        validateTemplate({ ...validBase, source: '' }, 'test', new Set(), new Set());
      }).toThrow(/غاب المصدر/);

      expect(() => {
        validateTemplate({ ...validBase, verifiedOn: '' }, 'test', new Set(), new Set());
      }).toThrow(/غاب تاريخ التحقق/);
    });

    it('يرفض النموذج إن تضمن اسم جهة صريحة من قائمة الحظر', () => {
      for (const forbidden of FORBIDDEN_ENTITIES.slice(0, 5)) {
        expect(() => {
          validateTemplate(
            { ...validBase, body: `كتاب موجه إلى ${forbidden}` },
            'test',
            new Set(),
            new Set()
          );
        }).toThrow(/المبدأ ١ يمنع أسماء الجهات الصريحة/);
      }
    });

    it('يرفض النموذج إن وُجد خيار تذكير وتأنيث بلا حقل «الجنس»', () => {
      expect(() => {
        validateTemplate(
          { ...validBase, body: 'يرجى قبول {الطالب|الطالبة} في الصف.' },
          'test',
          new Set(),
          new Set()
        );
      }).toThrow(/وُجد خيار تذكير وتأنيث في المتن بلا حقل «الجنس»/);

      // يمر بنجاح إذا كان حقل الجنس معرفًا
      expect(() => {
        validateTemplate(
          {
            ...validBase,
            body: 'يرجى قبول {الطالب|الطالبة} في الصف.',
            fields: {
              الجنس: {
                label: 'الجنس',
                type: 'choice',
                choices: ['ذكر', 'أنثى']
              }
            }
          },
          'test',
          new Set(),
          new Set()
        );
      }).not.toThrow();
    });

    it('يرفض النموذج إن استعمل حقلًا يطابق مكان عمل الزبون صامتًا', () => {
      expect(() => {
        validateTemplate(
          {
            ...validBase,
            body: 'إلى {الجهة_المطلوب_التأييد_لها}',
            fields: {
              الجهة_المطلوب_التأييد_لها: { label: 'الجهة' }
            }
          },
          'test',
          new Set(),
          new Set()
        );
      }).toThrow(/مكان عمل/);
    });

    it('يرفض تكرار slug أو كود النموذج', () => {
      const seenSlugs = new Set(['dup-slug']);
      expect(() => {
        validateTemplate({ ...validBase, slug: 'dup-slug' }, 'test', seenSlugs, new Set());
      }).toThrow(/تكرر المعرف slug/);

      const seenCodes = new Set(['CODE-1']);
      expect(() => {
        validateTemplate(
          { ...validBase, slug: 'unique-slug', code: 'CODE-1' },
          'test',
          new Set(),
          seenCodes
        );
      }).toThrow(/تكرر الكود/);
    });
  });
});
