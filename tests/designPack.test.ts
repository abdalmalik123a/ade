/**
 * حزم التصاميم (DESIGNS.md ٣٫٦): تصاميمُ مختارة وحدها بصورها في ملفٍّ واحد، والحرّ وحده يخرج — خطٌّ ليس من «خطوط ديوان»
 * وعنصرٌ استورده المكتب يُقالان بأسمائهما ولا يُحزمان — وعند الاستيراد يُقال ما غاب، والمكرّر لا يُضاف ثانيةً.
 * (الأسماء والملفّات مختلَقة.)
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { importContent } from '../src/main/services/contentPack';
import { designUses, exportDesigns, missingAfterImport } from '../src/main/services/design/designPack';
import { prepareTemplates, saveTemplate } from '../src/main/services/templates';
import { readZipIndex } from '../src/main/services/zip';
import { buildDoc, PALETTES } from '../src/shared/design/kit';
import { imageElement, textElement } from '../src/shared/canvas';
import { tokenInlines, type Doc } from '../src/shared/doc';

// خطوط Windows من مجلّدٍ فارغ — فلا يتعلّق الاختبار بما ثُبّت على الجهاز.
const NO_FONTS = mkdtempSync(join(tmpdir(), 'diwan-nofonts-'));
process.env['DIWAN_TEST_WINDOWS_FONTS'] = NO_FONTS;

const BG = 'designs/0123456789abcdef0123456789abcdef.png';
const ELEMENT = 'elements/fedcba9876543210fedcba9876543210.svg';

function office() {
  const db = freshDb();
  prepareTemplates(db);
  const dir = mkdtempSync(join(tmpdir(), 'diwan-designpack-'));
  return { db, dir, store: join(dir, 'store') };
}

const save = (db: ReturnType<typeof freshDb>, title: string, doc: Doc) =>
  saveTemplate(db, { id: null, code: null, title, subtitle: null, category: 'تصاميم', subjectLine: null, bodyHtml: '', letterheadId: null, variables: [], doc });

/** مكتبٌ فيه شهادةٌ بخلفيّةٍ من المخزن وعنصرٍ مستوردٍ وخطٍّ مستورد، وهويّةٌ لا تُختار. */
function designOffice() {
  const o = office();
  for (const rel of [BG, ELEMENT]) {
    mkdirSync(join(o.store, rel.split('/')[0]!), { recursive: true });
    writeFileSync(join(o.store, rel), `bytes of ${rel}`);
  }
  o.db.prepare("INSERT INTO elements (name, category, kind, file, width, height) VALUES ('غصن زيتون', 'زخارف', 'svg', ?, 10, 10)").run(ELEMENT);
  const cert = buildDoc({ kind: 'thanks', style: 'official', palette: PALETTES[0]! });
  cert.canvas!.background = { kind: 'image', src: BG };
  cert.canvas!.elements.push(imageElement({ box: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 }, src: ELEMENT, fit: 'contain', name: 'غصن زيتون' }));
  cert.canvas!.elements.push(textElement({ box: { x: 0.1, y: 0.8, w: 0.5, h: 0.1 }, inlines: tokenInlines('توقيع'), font: "'خط المكتب الخاص', serif" }));
  const a = save(o.db, 'شكر وتقدير — النور', cert);
  const b = save(o.db, 'هوية طالب', buildDoc({ kind: 'student-id', style: 'kids', palette: PALETTES[1]! }));
  return { ...o, a: a.id, b: b.id };
}

describe('حزم التصاميم', () => {
  it('خطوط التصميم وعناصره المستوردة من وجهه وخلفيّته', () => {
    const cert = buildDoc({ kind: 'thanks', style: 'luxury', palette: PALETTES[0]! });
    cert.canvas!.elements.push(imageElement({ box: { x: 0, y: 0, w: 0.1, h: 0.1 }, src: ELEMENT, fit: 'contain' }));
    const uses = designUses(cert);
    expect(uses.elements).toEqual([ELEMENT]);
    expect(uses.fonts).toContain('Aref Ruqaa');
    expect(designUses(null)).toEqual({ fonts: [], elements: [] });
  });

  it('المختار وحده بصوره، والخطّ والعنصر المستوردان لا يخرجان ويُقالان بأسمائهما', async () => {
    const o = designOffice();
    const target = join(o.dir, 'تصاميم.diwanpack');
    const out = await exportDesigns(target, o.db, o.store, '1.6.0', [o.a]);
    expect(out).toMatchObject({ templates: 1, letterheads: 0, clips: 0, files: 1 });
    expect(out.leftOut).toEqual({ fonts: ['خط المكتب الخاص'], elements: ['غصن زيتون'] });
    const names = (await readZipIndex(target)).map((e) => e.name);
    expect(names).toContain(`store/${BG}`);
    expect(names.some((n) => n.startsWith('store/elements/'))).toBe(false);
    await expect(exportDesigns(join(o.dir, 'x.diwanpack'), o.db, o.store, '1.6.0', [999])).rejects.toThrow(/لم يُختر/);
  });

  it('يُستورد في مكتبٍ آخر: التصميم وصورته، وما غاب يُقال — والمرّة الثانية لا تكرّر', async () => {
    const o = designOffice();
    const target = join(o.dir, 'تصاميم.diwanpack');
    await exportDesigns(target, o.db, o.store, '1.6.0', [o.a, o.b]);
    const other = office();
    const first = await importContent(target, other.db, other.store, join(other.dir, 'work'));
    expect(first.added.templates).toBe(2);
    expect(first.added.files).toBe(1);
    expect(missingAfterImport(other.db, other.store, first.addedIds)).toEqual({ fonts: ['خط المكتب الخاص'], images: 1 });
    const again = await importContent(target, other.db, other.store, join(other.dir, 'work'));
    expect(again.added.templates).toBe(0);
    expect(again.existing.templates).toBe(2);
    expect(again.addedIds).toEqual([]);
  });

  it('وحزمة المحتوى العامّة لا تحمل ملفّ عنصرٍ مستورد كذلك', async () => {
    const o = designOffice();
    const { collectContent } = await import('../src/main/services/contentPack');
    expect(collectContent(o.db, o.store, '1.6.0').files).toEqual([BG]);
  });
});
