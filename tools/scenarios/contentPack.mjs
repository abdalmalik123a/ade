/**
 * سيناريو: حزمة المحتوى (خطة Production، ٤٫٣) على التطبيق الحقيقي.
 *
 * مكتبٌ فيه ترويسة ونموذجٌ عليها وكليشة: تُصدَّر حزمته من المكتبة، ثم يُحذف النموذج والكليشة كأنّ
 * الجهاز جديد، وتُستورد الحزمة: يعودان بمعرّفيهما، والترويسة الموجودة تُترك ولا تتكرّر. ومرّةً ثانية
 * لا يُضاف شيء. وفي الحزمة لا شيء من مجلّدات الناس.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { unzipSync } from 'fflate';

const DIR = join(process.env.TEMP ?? '.', `diwan-content-${Date.now()}`);
const PACK = join(DIR, `diwan-content-${new Date().toLocaleDateString('en-CA')}.diwanpack`);

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  // الحفظ والفتح بلا حوار: ما يُصدَّر يُكتب في المجلّد، وهو نفسه ما يُستورد.
  return { DIWAN_TEST_SAVE_DIR: DIR, DIWAN_TEST_OPEN_FILE: PACK };
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const db = (fn) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return fn(d);
    } finally {
      d.close();
    }
  };
  const toast = () => page.eval(`return document.body.innerText;`);

  const ids = await page.eval(`
    const lh = await window.diwan.letterheads.save({ id: null, name: 'مديرية تربية الأنبار', authorityId: null, category: 'تربية',
      layout: { sections: [{ id: 's', weight: 1, blocks: [{ id: 'b', kind: 'text', value: 'جمهورية العراق', align: 'center', size: 14, bold: true }] }] } });
    const t = await window.diwan.templates.save({ id: null, code: 'DIW-7', title: 'تأييد استمرار بالدوام', subtitle: null, category: 'ملاك',
      subjectLine: null, bodyHtml: '<p>نؤيد أن {الاسم} مستمرٌّ بالدوام.</p>', letterheadId: lh.id,
      variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }] });
    const c = await window.diwan.clips.save({ id: null, title: 'ختام', body: 'مع وافر التقدير.', category: null });
    await window.diwan.citizens.save({ id: null, fullName: 'زينب كاظم', verified: false });
    return { lh: lh.id, t: t.id, c: c.id };
  `);
  const uuids = db((d) => ({
    t: d.prepare('SELECT uuid FROM templates WHERE id = ?').get(ids.t).uuid,
    c: d.prepare('SELECT uuid FROM clips WHERE id = ?').get(ids.c).uuid
  }));

  await page.goto('templates-library-drafts');
  await wait(800);
  await page.eval(`document.querySelector('[data-act="content-export"]').click(); return true;`);
  await wait(1500);
  ok('صُدّرت الحزمة من المكتبة وقيل ما فيها', existsSync(PACK) && (await toast()).includes('صُدّرت حزمة المحتوى: 1 نموذجًا، 1 ترويسة، 1 كليشة'));
  const inside = existsSync(PACK) ? Object.keys(unzipSync(readFileSync(PACK))) : [];
  const json = existsSync(PACK) ? Buffer.from(unzipSync(readFileSync(PACK))['diwan-content.json'] ?? []).toString() : '';
  ok('وليس فيها قاعدةٌ ولا مواطن', inside.includes('diwan-content.json') && !inside.includes('diwan.db') && !json.includes('زينب كاظم'));

  // جهازٌ «جديد»: يُحذف النموذج والكليشة، وتبقى الترويسة.
  await page.eval(`await window.diwan.templates.delete(${ids.t}); await window.diwan.clips.delete(${ids.c}); return true;`);
  await page.goto('office-settings');
  await page.goto('templates-library-drafts');
  await wait(800);
  await page.eval(`document.querySelector('[data-act="content-import"]').click(); return true;`);
  await wait(1500);
  ok('الاستيراد يعيد النموذج والكليشة، ويترك الترويسة الموجودة', (await toast()).includes('أُضيف 1 نموذجًا، 0 ترويسة، 1 كليشة') && (await toast()).includes('1 موجودٌ في المكتب'));
  const back = db((d) => ({
    t: d.prepare('SELECT uuid, code, letterhead_id AS lh FROM templates').all(),
    c: d.prepare('SELECT uuid FROM clips').all(),
    lh: d.prepare('SELECT COUNT(*) AS n FROM letterheads').get().n
  }));
  ok('بمعرّفيهما نفسيهما، والنموذج على ترويسته', back.t.length === 1 && back.t[0].uuid === uuids.t && back.t[0].lh === ids.lh && back.c[0]?.uuid === uuids.c && back.lh === 1);
  ok('وظهر في المكتبة', (await page.text()).includes('تأييد استمرار بالدوام'));

  await page.eval(`document.querySelector('[data-act="content-import"]').click(); return true;`);
  await wait(1500);
  ok('ومرّةً ثانية لا يُضاف شيء', (await toast()).includes('أُضيف 0 نموذجًا، 0 ترويسة، 0 كليشة') && db((d) => d.prepare('SELECT COUNT(*) AS n FROM templates').get().n) === 1);
  ok('وقُيّد التصدير والاستيراد في سجلّ التدقيق', db((d) => d.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'content'").get().n) === 3);

  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
