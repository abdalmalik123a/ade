/** أقسام S49: المحتوى المرتبط يبقى، وما ليس من القسم لا يتسرّب ولا يُكتب من ملف مخالف. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { collectSection, checkSection, exportSection } from '../src/main/services/contentSection';
import { collectContent, importContent, writePack } from '../src/main/services/contentPack';
import { prepareTemplates, saveTemplate } from '../src/main/services/templates';
import { prepareClips, saveClip } from '../src/main/services/clips';
import { prepareLetterheads, saveLetterhead } from '../src/main/services/letterheads';
import { normalizeLayout } from '../src/shared/letterhead';
import { canvasDoc, emptyCanvas } from '../src/shared/canvas';
import { CONTENT_SECTIONS } from '../src/shared/sealedPack';

const opened: ReturnType<typeof freshDb>[] = [];
afterEach(() => { for (const db of opened.splice(0)) db.close(); });
const LOGO = 'letterheads/0123456789abcdef0123456789abcdef.png';
const EXTRA = 'letterheads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png';
const PEOPLE = 'attachments/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png';
function office() {
  const db = freshDb(); opened.push(db);
  prepareTemplates(db); prepareClips(db); prepareLetterheads(db);
  const dir = mkdtempSync(join(tmpdir(), 'diwan-section-'));
  const store = join(dir, 'store');
  return { db, dir, store };
}
function filled() {
  const o = office();
  for (const ref of [LOGO, EXTRA, PEOPLE]) {
    mkdirSync(join(o.store, ref.split('/')[0]!), { recursive: true });
    writeFileSync(join(o.store, ref), ref);
  }
  const head = (name: string, image: string) => saveLetterhead(o.db, {
    id: null, name, category: null, authorityId: null,
    layout: normalizeLayout({ sections: [{ id: 's', weight: 1, blocks: [{ id: 'b', kind: 'image', value: image, align: 'center', size: 14, bold: false, width: 80 }] }] })
  });
  const lh = head('مدرسة النور', LOGO); head('مدرسة الأمل', EXTRA);
  const template = { id: null, code: null, subtitle: null, category: null, subjectLine: null, variables: [], letterheadId: lh.id };
  saveTemplate(o.db, { ...template, title: 'تأييد المدرسة', bodyHtml: `<p>معاملة مصنوعة</p><img src="${PEOPLE}">` });
  saveTemplate(o.db, { ...template, title: 'تصميم مصطنع', bodyHtml: '', doc: canvasDoc(emptyCanvas({ w: 90, h: 50 })) });
  saveClip(o.db, { id: null, title: 'ختام', body: 'مع التقدير.', category: null, direction: null });
  return o;
}

describe('ملفات أقسام المحتوى', () => {
  it('المعاملة تحمل ترويستها وصورتها فقط؛ لا التصميم ولا صور الناس ولا الترويسة الأخرى', () => {
    const a = filled();
    const { pkg, files } = collectSection(a.db, a.store, '1.9.0', 'templates');
    expect(pkg.templates.map((t) => t.title)).toEqual(['تأييد المدرسة']);
    expect(pkg.letterheads.map((l) => l.name)).toEqual(['مدرسة النور']);
    expect(pkg.templates[0]!.letterheadUuid).toBe(pkg.letterheads[0]!.uuid);
    expect(pkg.clips).toEqual([]);
    expect(files).toEqual([LOGO]);
  });

  it('الكليشات والترويسات منفصلتان، ولكل قسم صوره وحده', () => {
    const a = filled();
    const clips = collectSection(a.db, a.store, '1.9.0', 'clips');
    expect([clips.pkg.templates.length, clips.pkg.letterheads.length, clips.pkg.clips.length, clips.files.length]).toEqual([0, 0, 1, 0]);
    const heads = collectSection(a.db, a.store, '1.9.0', 'letterheads');
    expect([heads.pkg.templates.length, heads.pkg.clips.length, heads.pkg.letterheads.length]).toEqual([0, 0, 2]);
    expect(heads.files).toEqual([LOGO, EXTRA].sort());
  });

  it.each(CONTENT_SECTIONS)('%s ذهاب وإياب؛ uuid والربط والصورة والتعديل لا تضيع بتكرار الاستيراد', async (section) => {
    const a = filled(), b = office();
    const path = join(a.dir, `${section}.diwanpack`);
    const counts = await exportSection(path, a.db, a.store, '1.9.0', section);
    const result = await importContent(path, b.db, b.store, join(b.dir, 'work'), (pkg) => checkSection(pkg, section));
    expect(result.added).toEqual(counts);
    if (section === 'templates') {
      const t = b.db.prepare('SELECT letterhead_id AS lh FROM templates').get() as { lh: number };
      expect(t.lh).toBeTruthy();
      expect(readFileSync(join(b.store, LOGO), 'utf8')).toBe(LOGO);
      b.db.exec("UPDATE templates SET title='تعديل المكتب'");
    }
    const again = await importContent(path, b.db, b.store, join(b.dir, 'work'), (pkg) => checkSection(pkg, section));
    expect(again.added).toEqual({ templates: 0, letterheads: 0, clips: 0, files: 0 });
    expect(again.existing).toEqual({ templates: counts.templates, letterheads: counts.letterheads, clips: counts.clips });
    if (section === 'templates') expect(b.db.prepare('SELECT title FROM templates').pluck().get()).toBe('تعديل المكتب');
  });

  it('قسم فارغ أو مكتب فيه تصميم وحده لا ينتج ملف معاملات فارغًا', async () => {
    const a = office();
    for (const section of CONTENT_SECTIONS) expect(() => collectSection(a.db, a.store, '1', section)).toThrow('لا محتوى');
    saveTemplate(a.db, { id: null, code: null, title: 'لوحة', subtitle: null, category: null, subjectLine: null, bodyHtml: '', letterheadId: null, variables: [], doc: canvasDoc(emptyCanvas({ w: 90, h: 50 })) });
    const path = join(a.dir, 'empty.diwanpack');
    await expect(exportSection(path, a.db, a.store, '1', 'templates')).rejects.toThrow('لا محتوى');
    expect(existsSync(path)).toBe(false);
  });

  it('حمولة مختلطة تُرفض قبل كتابة أي صورة أو صف في القسم، وتبقى مقروءة في الطريق القديم', async () => {
    const a = filled(), b = office();
    const mixed = collectContent(a.db, a.store, '1.9.0');
    const path = join(a.dir, 'mixed.diwanpack');
    await writePack(path, mixed.pkg, mixed.files, a.store);
    for (const section of CONTENT_SECTIONS) {
      await expect(importContent(path, b.db, b.store, join(b.dir, 'work'), (pkg) => checkSection(pkg, section))).rejects.toThrow('لا يطابق');
      expect(b.db.prepare('SELECT COUNT(*) FROM templates').pluck().get()).toBe(0);
      expect(b.db.prepare('SELECT COUNT(*) FROM letterheads').pluck().get()).toBe(0);
      expect(b.db.prepare('SELECT COUNT(*) FROM clips').pluck().get()).toBe(0);
      expect(existsSync(b.store) ? readdirSync(b.store) : []).toEqual([]);
    }
    expect((await importContent(path, b.db, b.store, join(b.dir, 'work'))).added.templates).toBe(2);
  });

  it('قسم آخر أو تصميم أو ترويسة مفقودة لا يُقبل تحت رأس المعاملات', () => {
    const a = filled();
    const tx = collectSection(a.db, a.store, '1', 'templates').pkg;
    expect(() => checkSection({ ...tx, letterheads: [] }, 'templates')).toThrow('لا يطابق');
    expect(() => checkSection({ ...tx, templates: [{ ...tx.templates[0]!, doc: canvasDoc(emptyCanvas({ w: 90, h: 50 })) }] }, 'templates')).toThrow('لا يطابق');
    expect(() => checkSection(tx, 'clips')).toThrow('لا يطابق');
  });
});
