/**
 * حزمة المحتوى (خطة Production، ٤٫٣): النماذج والترويسات والكليشات وصورها تنتقل من مكتبٍ إلى مكتب —
 * بلا بيانات الناس — والمكرّر يُعرف بمعرّفه.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { freshDb } from './helpers';
import { collectContent, exportContent, importContent } from '../src/main/services/contentPack';
import { prepareClips, saveClip } from '../src/main/services/clips';
import { prepareLetterheads, saveLetterhead } from '../src/main/services/letterheads';
import { getTemplate, prepareTemplates, saveTemplate } from '../src/main/services/templates';
import { readZipIndex } from '../src/main/services/zip';
import { normalizeLayout } from '../src/shared/letterhead';

const LOGO = 'letterheads/0123456789abcdef0123456789abcdef.png';
const STAMP = 'designs/fedcba9876543210fedcba9876543210.png';
const SCAN = 'attachments/aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb.jpg';

function office() {
  const db = freshDb();
  prepareTemplates(db);
  prepareLetterheads(db);
  prepareClips(db);
  const dir = mkdtempSync(join(tmpdir(), 'diwan-content-'));
  const store = join(dir, 'store');
  return { db, dir, store };
}

/** مكتبٌ فيه ترويسةٌ بشعارها، ونموذجٌ عليها بصورةٍ — وإشارةٌ (خاطئة) إلى مستمسك — وكليشة. */
function filledOffice() {
  const o = office();
  for (const rel of [LOGO, STAMP, SCAN]) {
    mkdirSync(join(o.store, rel.split('/')[0]!), { recursive: true });
    writeFileSync(join(o.store, rel), `bytes of ${rel}`);
  }
  const lh = saveLetterhead(o.db, {
    id: null,
    name: 'مديرية تربية الأنبار',
    authorityId: null,
    category: 'تربية',
    layout: normalizeLayout({
      sections: [{ id: 's1', weight: 1, blocks: [{ id: 'b1', kind: 'image', value: LOGO, align: 'center', size: 14, bold: false, width: 80 }] }]
    })
  });
  const t = saveTemplate(o.db, {
    id: null,
    code: 'DIW-1',
    title: 'تأييد استمرار',
    subtitle: null,
    category: 'ملاك',
    subjectLine: null,
    bodyHtml: `<p>نؤيد أن {الاسم} مستمر.</p><img src="diwan://store/${STAMP}"><img src="diwan://store/${SCAN}">`,
    letterheadId: lh.id,
    variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }]
  });
  const c = saveClip(o.db, { id: null, title: 'ختام', body: 'مع التقدير.', category: null, direction: null });
  return { ...o, lh, t, c };
}

describe('حزمة المحتوى', () => {
  it('تجمع المحتوى وصوره — وما في مجلّدات الناس لا يخرج ولو أُشير إليه', () => {
    const a = filledOffice();
    const { pkg, files } = collectContent(a.db, a.store, '1.0.0');
    expect(pkg.templates.map((t) => t.title)).toEqual(['تأييد استمرار']);
    expect(pkg.templates[0]!.letterheadUuid).toBe(pkg.letterheads[0]!.uuid);
    expect(pkg.letterheads.map((l) => l.name)).toEqual(['مديرية تربية الأنبار']);
    expect(pkg.clips.map((c) => c.title)).toEqual(['ختام']);
    expect(files).toEqual([STAMP, LOGO].sort());
  });

  it('تُستورد في مكتبٍ آخر بمعرّفاتها وصورها وربط النموذج بترويسته — ومرّةً ثانية لا تكرّر شيئًا', async () => {
    const a = filledOffice();
    const pack = join(a.dir, 'content.diwanpack');
    const counts = await exportContent(pack, a.db, a.store, '1.0.0');
    expect(counts).toEqual({ templates: 1, letterheads: 1, clips: 1, files: 2 });
    expect((await readZipIndex(pack)).map((e) => e.name)).not.toContain(`store/${SCAN}`);

    const b = office();
    const first = await importContent(pack, b.db, b.store, join(b.dir, 'work'));
    expect(first.added).toEqual({ templates: 1, letterheads: 1, clips: 1, files: 2 });
    expect(first.existing).toEqual({ templates: 0, letterheads: 0, clips: 0 });
    expect(readFileSync(join(b.store, LOGO), 'utf8')).toBe(`bytes of ${LOGO}`);
    expect(existsSync(join(b.store, SCAN))).toBe(false);

    const uuid = (db: typeof a.db, table: string) => (db.prepare(`SELECT uuid FROM ${table}`).get() as { uuid: string }).uuid;
    for (const table of ['templates', 'letterheads', 'clips']) expect(uuid(b.db, table)).toBe(uuid(a.db, table));
    const t = b.db.prepare('SELECT id, code, letterhead_id AS lh FROM templates').get() as { id: number; code: string; lh: number };
    expect(t.code).toBe('DIW-1');
    expect(t.lh).toBe((b.db.prepare('SELECT id FROM letterheads').get() as { id: number }).id);
    expect(getTemplate(b.db, t.id)!.variables.map((v) => v.token)).toEqual(['الاسم']);

    // تعديل المكتب الثاني لا تمحوه الحزمة نفسها إن استُوردت ثانيةً.
    b.db.prepare("UPDATE templates SET title = 'تأييد — بصيغة المكتب'").run();
    const again = await importContent(pack, b.db, b.store, join(b.dir, 'work'));
    expect(again.added).toEqual({ templates: 0, letterheads: 0, clips: 0, files: 0 });
    expect(again.existing).toEqual({ templates: 1, letterheads: 1, clips: 1 });
    expect((b.db.prepare('SELECT title FROM templates').get() as { title: string }).title).toBe('تأييد — بصيغة المكتب');
  });

  it('وكودٌ يستعمله نموذجٌ في المكتب يُترك: النموذج يُضاف بلا كود', async () => {
    const a = filledOffice();
    const pack = join(a.dir, 'c.diwanpack');
    await exportContent(pack, a.db, a.store, '1.0.0');
    const b = office();
    saveTemplate(b.db, { id: null, code: 'DIW-1', title: 'نموذج المكتب', subtitle: null, category: null, subjectLine: null, bodyHtml: '<p>x</p>', letterheadId: null, variables: [] });
    const r = await importContent(pack, b.db, b.store, join(b.dir, 'work'));
    expect(r.added.templates).toBe(1);
    const codes = (b.db.prepare('SELECT code FROM templates ORDER BY id').all() as { code: string | null }[]).map((x) => x.code);
    expect(codes).toEqual(['DIW-1', null]);
  });

  it('وترويسةٌ ناقصة الصيغة (من إصدارٍ أقدم) تُستورد بصيغة هذا الإصدار — لا تُسقط الاستيراد', async () => {
    const b = office();
    const pack = join(b.dir, 'old.diwanpack');
    const pkg = {
      app: 'diwan',
      kind: 'content',
      format: 1,
      appVersion: '0.9.0',
      createdAt: '2026-01-01T00:00:00Z',
      letterheads: [{ uuid: '11111111-2222-3333-4444-555555555555', name: 'ترويسة قديمة', category: null, layout: { sections: [] } }],
      templates: [],
      clips: []
    };
    writeFileSync(pack, zipSync({ 'diwan-content.json': new TextEncoder().encode(JSON.stringify(pkg)) }));
    const r = await importContent(pack, b.db, b.store, join(b.dir, 'work'));
    expect(r.added.letterheads).toBe(1);
    const row = b.db.prepare('SELECT layout_json AS j FROM letterheads').get() as { j: string };
    expect(JSON.parse(row.j)).toHaveProperty('basmala');
  });

  it('وما ليس حزمةً يُرفض، ومكتبٌ بلا محتوى لا يُصدّر ملفًّا فارغًا', async () => {
    const b = office();
    const notPack = join(b.dir, 'x.diwanpack');
    writeFileSync(notPack, zipSync({ 'diwan.db': new Uint8Array([1]) }));
    await expect(importContent(notPack, b.db, b.store, b.dir)).rejects.toThrow(/ليس حزمة/);
    writeFileSync(notPack, 'نص');
    await expect(importContent(notPack, b.db, b.store, b.dir)).rejects.toThrow(/ليس حزمة/);
    await expect(exportContent(join(b.dir, 'e.diwanpack'), b.db, b.store, '1.0.0')).rejects.toThrow(/لا محتوى/);
  });
});
