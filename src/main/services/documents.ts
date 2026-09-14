import type { Database } from 'better-sqlite3';
import { createHash } from 'node:crypto';

/**
 * أرقام الصادر وبصمة التوثيق.
 *
 * التسلسل مستقلّ لكل سنة. «الاطّلاع» لا يستهلك رقمًا — الاستهلاك عند الإصدار فقط،
 * وإلا احترقت أرقام كلما فتح الموظف شاشة المحرر.
 */

export function peekSerial(db: Database, prefix: string, year: number): string {
  const row = db
    .prepare("SELECT last_value AS v FROM counters WHERE scope = 'outgoing' AND year = ?")
    .get(year) as { v: number } | undefined;
  return `${prefix}/${year}/${(row?.v ?? 0) + 1}`;
}

export function reserveSerial(
  db: Database,
  prefix: string,
  year: number
): { serial: string; seq: number } {
  const seq = db.transaction(() => {
    db.prepare(
      `INSERT INTO counters (scope, year, last_value) VALUES ('outgoing', ?, 0)
       ON CONFLICT(scope, year) DO NOTHING`
    ).run(year);
    db.prepare(
      "UPDATE counters SET last_value = last_value + 1 WHERE scope = 'outgoing' AND year = ?"
    ).run(year);
    return (
      db
        .prepare("SELECT last_value AS v FROM counters WHERE scope = 'outgoing' AND year = ?")
        .get(year) as { v: number }
    ).v;
  })();
  return { serial: `${prefix}/${year}/${seq}`, seq };
}

/** البصمة تغطي المتن والرقم والتاريخ وصاحب العلاقة — أي تحريف لاحق يكسرها. */
export function fingerprint(input: {
  serial: string;
  bodyHtml: string;
  gregorianDate: string;
  citizenName: string;
  destination: string;
}): string {
  const NUL = String.fromCharCode(0);
  return createHash('sha256')
    .update(
      [
        input.serial,
        input.gregorianDate,
        input.citizenName,
        input.destination,
        input.bodyHtml
      ].join(NUL),
      'utf8'
    )
    .digest('hex');
}

export function shortFingerprint(hex: string): string {
  return `${hex.slice(0, 6)}...${hex.slice(-4)}`;
}
