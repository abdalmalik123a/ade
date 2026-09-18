import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { freshDb } from './helpers';
import { deleteClip, listClips, prepareClips, saveClip, touchClip } from '../src/main/services/clips';

const clip = (title: string, body: string, category: string | null = null) =>
  ({ id: null, title, body, category }) as const;

describe('مكتبة الكليشات', () => {
  it('تبدأ فارغة — لا عبارة مبرمَجة', () => {
    expect(listClips(freshDb())).toEqual([]);
  });

  it('تُحفظ وتُسترجع بمتنها', () => {
    const db = freshDb();
    const saved = saveClip(db, clip('تأييد استمرار', 'نؤيد لكم أن السيد مستمر بالخدمة'));

    expect(saved.id).toBeGreaterThan(0);
    expect(listClips(db)).toHaveLength(1);
    expect(listClips(db)[0]!.body).toContain('مستمر بالخدمة');
  });

  it('ولا تُحفظ بلا اسم ولا بمتن فارغ', () => {
    const db = freshDb();
    expect(() => saveClip(db, clip('   ', 'متن'))).toThrow(/سمِّ الكليشة/);
    expect(() => saveClip(db, clip('اسم', '   '))).toThrow(/فارغة/);
  });

  it('والبحث متساهل مع الهمزة، ويطال المتن لا الاسم وحده', () => {
    const db = freshDb();
    saveClip(db, clip('خاتمة', 'هذا ولكم التقدير مع الاحترام'));
    saveClip(db, clip('إحالة', 'يرجى التفضل بالإيعاز إلى من يلزم'));

    expect(listClips(db, 'احاله').map((c) => c.title)).toEqual(['إحالة']);
    expect(listClips(db, 'التقدير').map((c) => c.title)).toEqual(['خاتمة']);
    expect(listClips(db, 'لا شيء')).toEqual([]);
  });

  it('والترتيب بآخر استعمال — ما يُدرج كل يوم يتصدّر', () => {
    const db = freshDb();
    const first = saveClip(db, clip('أولى', 'متن أول'));
    saveClip(db, clip('ثانية', 'متن ثانٍ'));

    // الأحدث إنشاءً يتصدّر ما لم يُستعمل غيره.
    expect(listClips(db)[0]!.title).toBe('ثانية');
    touchClip(db, first.id);
    expect(listClips(db)[0]!.title).toBe('أولى');
  });

  it('وتُعدَّل وتُحذف', () => {
    const db = freshDb();
    const saved = saveClip(db, clip('خاتمة', 'متن'));

    saveClip(db, { id: saved.id, title: 'خاتمة رسمية', body: 'هذا ولكم التقدير' });
    expect(listClips(db)).toHaveLength(1);
    expect(listClips(db)[0]!.title).toBe('خاتمة رسمية');

    deleteClip(db, saved.id);
    expect(listClips(db)).toEqual([]);
  });

  it('وقاعدة بلا جدول الكليشات تُرقّى بلا سقوط', () => {
    const db = new Database(':memory:');
    prepareClips(db);
    prepareClips(db);
    expect(listClips(db)).toEqual([]);
  });
});
