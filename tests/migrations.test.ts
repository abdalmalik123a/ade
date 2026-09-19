import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { listTemplates, prepareTemplates, saveTemplate } from '../src/main/services/templates';
import { listLetterheads, prepareLetterheads } from '../src/main/services/letterheads';
import { prepareDocuments } from '../src/main/services/documents';
import { listClips, prepareClips } from '../src/main/services/clips';

/**
 * قاعدة مكتبٍ قائمة — كما هي على جهازه لا كما تُنشأ اليوم.
 *
 * سيناريوهات المِقْود تبدأ بقاعدة نظيفة دائمًا، فلا ترى ما يراه المكتب: عمودًا
 * أُضيف بعد أن بُنيت قاعدته. وهذه الطبقة تحذف الأعمدة الجديدة ثم تسأل: أتقوم
 * الشاشات؟
 */
function agedDb(drop: string[]): Database.Database {
  const db = new Database(':memory:');
  const dir = join(process.cwd(), 'src', 'main', 'db');
  for (const file of ['schema.sql', 'search.sql']) {
    db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  for (const stmt of drop) db.exec(stmt);
  return db;
}

describe('قاعدة المكتب القائمة لا تسقط بعمودٍ جديد', () => {
  it('مكتبة النماذج تقوم على قاعدة بلا `doc_json`', () => {
    const db = agedDb(['ALTER TABLE templates DROP COLUMN doc_json']);

    // القراءة نفسها تُرحِّل — فلا تسقط الشاشة على قاعدةٍ سبقت العمود.
    expect(listTemplates(db)).toEqual([]);
    expect(
      (db.prepare('PRAGMA table_info(templates)').all() as { name: string }[]).map((c) => c.name)
    ).toContain('doc_json');

    prepareTemplates(db);
    expect(listTemplates(db)).toEqual([]);

    // والحفظ بعده يكتب الوثيقة كتلًا.
    saveTemplate(db, {
      id: null,
      code: null,
      title: 'تأييد',
      subtitle: null,
      category: null,
      subjectLine: null,
      bodyHtml: 'نؤيد أن {الاسم} موظف',
      letterheadId: null,
      variables: []
    });
    expect(listTemplates(db)).toHaveLength(1);
  });

  it('ومكتبة الترويسات تقوم على قاعدة بلا أعمدة المكتبة', () => {
    const db = agedDb([
      'ALTER TABLE letterheads DROP COLUMN category',
      'ALTER TABLE letterheads DROP COLUMN is_favorite',
      'ALTER TABLE letterheads DROP COLUMN used_at',
      'ALTER TABLE letterheads DROP COLUMN search_fold'
    ]);

    expect(() => listLetterheads(db)).toThrow();
    prepareLetterheads(db);
    expect(listLetterheads(db)).toEqual([]);
  });

  it('وسجل الصادر يقوم على قاعدة بلا المعاملات', () => {
    const db = agedDb([
      'DROP TABLE transactions',
      'ALTER TABLE documents DROP COLUMN transaction_id',
      'ALTER TABLE documents DROP COLUMN letterhead_id'
    ]);

    prepareDocuments(db);
    const cols = (db.prepare('PRAGMA table_info(documents)').all() as { name: string }[]).map(
      (c) => c.name
    );
    expect(cols).toContain('transaction_id');
    expect(cols).toContain('letterhead_id');
  });

  it('والكليشات تقوم على قاعدة بلا جدولها', () => {
    const db = agedDb(['DROP TABLE clips']);
    prepareClips(db);
    expect(listClips(db)).toEqual([]);
  });

  it('والترحيل يُعاد مرّاتٍ بلا ضرر — فالإقلاع يمرّ به كل مرّة', () => {
    const db = agedDb([]);
    for (let i = 0; i < 3; i++) {
      prepareTemplates(db);
      prepareLetterheads(db);
      prepareDocuments(db);
      prepareClips(db);
    }
    expect(listTemplates(db)).toEqual([]);
    expect(listLetterheads(db)).toEqual([]);
    expect(listClips(db)).toEqual([]);
  });
});
