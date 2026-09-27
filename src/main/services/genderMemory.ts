/**
 * ما تعلّمه المكتب من التذكير والتأنيث (ج٤).
 *
 * القائمة المبنيّة («زينب» و«مريم» و«حمزة») تعرف الشائع؛ وما سواه يُقترح من لاحقته
 * بلا يقين («رسل»، «نور»، «ضياء» في بعض البيوت). فيُسأل الموظف قبل الطباعة، وجوابه
 * يُحفظ هنا باسم صاحبه الأوّل — فلا يُسأل عن «رسل» ثانيةً في هذا المكتب.
 *
 * والأحدث يغلب: جوابٌ صحّح ما قبله هو ما يعرفه المكتب الآن.
 */
import type { Database } from 'better-sqlite3';
import { firstNameKey, type Gender } from '@shared/gender';

export function prepareGenderMemory(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS name_genders (
    name       TEXT PRIMARY KEY,
    gender     TEXT NOT NULL,
    count      INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

/** يحفظ جواب المكتب لأسماءٍ — ويعيد كم اسمًا حُفظ. */
export function learnGenders(db: Database, answers: { name: string; gender: Gender }[]): number {
  prepareGenderMemory(db);
  const upsert = db.prepare(
    `INSERT INTO name_genders (name, gender) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET
       count = CASE WHEN gender = excluded.gender THEN count + 1 ELSE 1 END,
       gender = excluded.gender,
       updated_at = datetime('now')`
  );
  return db.transaction(() => {
    let n = 0;
    for (const a of answers) {
      const key = firstNameKey(a.name);
      if (!key || (a.gender !== 'ذكر' && a.gender !== 'أنثى')) continue;
      upsert.run(key, a.gender);
      n++;
    }
    return n;
  })();
}

/** ما يعرفه المكتب كلّه — عشرات الأسماء، تُحمَّل مرّةً إلى الواجهة. */
export function learnedGenders(db: Database): Record<string, Gender> {
  prepareGenderMemory(db);
  const rows = db.prepare('SELECT name, gender FROM name_genders').all() as { name: string; gender: Gender }[];
  return Object.fromEntries(rows.map((r) => [r.name, r.gender]));
}
