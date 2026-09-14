import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { emptyLayout, type LetterheadLayout } from '../src/shared/letterhead';
import {
  addSeal,
  deleteLetterhead,
  deleteSeal,
  getDefaultLetterhead,
  getLetterhead,
  listLetterheads,
  listSeals,
  saveLetterhead,
  setDefaultLetterhead
} from '../src/main/services/letterheads';

function layoutWith(text: string): LetterheadLayout {
  return {
    ...emptyLayout(),
    blocks: [{ id: 'b1', kind: 'text', value: text, align: 'center', size: 18, bold: true }]
  };
}

describe('الترويسات', () => {
  it('تبدأ فارغة — لا ترويسة مبرمَجة', () => {
    const db = freshDb();
    expect(listLetterheads(db)).toEqual([]);
    expect(getDefaultLetterhead(db)).toBeNull();
  });

  it('أول ترويسة تصير الافتراضية تلقائيًا، والثانية لا', () => {
    const db = freshDb();
    const first = saveLetterhead(db, {
      id: null,
      name: 'مديرية تربية بغداد',
      authorityId: null,
      layout: layoutWith('جمهورية العراق')
    });
    expect(first.isDefault).toBe(true);

    const second = saveLetterhead(db, {
      id: null,
      name: 'محكمة بداءة الكرخ',
      authorityId: null,
      layout: emptyLayout()
    });
    expect(second.isDefault).toBe(false);
    expect(getDefaultLetterhead(db)?.id).toBe(first.id);
  });

  it('تحفظ بنية الكتل وتستردّها كما هي', () => {
    const db = freshDb();
    const saved = saveLetterhead(db, {
      id: null,
      name: 'ترويسة',
      authorityId: null,
      layout: layoutWith('وزارة التربية')
    });
    const loaded = getLetterhead(db, saved.id);
    expect(loaded?.layout.blocks[0]?.value).toBe('وزارة التربية');
    expect(loaded?.layout.blocks[0]?.bold).toBe(true);
    expect(loaded?.layout.margins).toEqual({ top: 20, right: 20, bottom: 20, left: 20 });
  });

  it('التعديل لا ينشئ سجلًا جديدًا', () => {
    const db = freshDb();
    const saved = saveLetterhead(db, {
      id: null,
      name: 'أ',
      authorityId: null,
      layout: emptyLayout()
    });
    saveLetterhead(db, {
      id: saved.id,
      name: 'ب',
      authorityId: null,
      layout: layoutWith('سطر')
    });
    const all = listLetterheads(db);
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe('ب');
    expect(all[0]?.layout.blocks).toHaveLength(1);
  });

  it('تبديل الافتراضية يُلغي السابقة — واحدة فقط دائمًا', () => {
    const db = freshDb();
    const a = saveLetterhead(db, { id: null, name: 'أ', authorityId: null, layout: emptyLayout() });
    const b = saveLetterhead(db, { id: null, name: 'ب', authorityId: null, layout: emptyLayout() });
    setDefaultLetterhead(db, b.id);
    const all = listLetterheads(db);
    expect(all.filter((x) => x.isDefault)).toHaveLength(1);
    expect(getDefaultLetterhead(db)?.id).toBe(b.id);
    expect(getLetterhead(db, a.id)?.isDefault).toBe(false);
  });

  it('حذف الافتراضية يرقّي غيرها — لا يبقى المكتب بلا رأس كتاب', () => {
    const db = freshDb();
    const a = saveLetterhead(db, { id: null, name: 'أ', authorityId: null, layout: emptyLayout() });
    saveLetterhead(db, { id: null, name: 'ب', authorityId: null, layout: emptyLayout() });
    expect(getDefaultLetterhead(db)?.id).toBe(a.id);

    deleteLetterhead(db, a.id);
    const fallback = getDefaultLetterhead(db);
    expect(fallback).not.toBeNull();
    expect(fallback?.name).toBe('ب');
  });

  it('حذف آخر ترويسة يترك القائمة فارغة بلا انهيار', () => {
    const db = freshDb();
    const a = saveLetterhead(db, { id: null, name: 'أ', authorityId: null, layout: emptyLayout() });
    deleteLetterhead(db, a.id);
    expect(listLetterheads(db)).toEqual([]);
    expect(getDefaultLetterhead(db)).toBeNull();
  });

  it('بنية تالفة في القاعدة لا تُسقط الشاشة', () => {
    const db = freshDb();
    db.prepare(
      "INSERT INTO letterheads (name, layout_json, is_default) VALUES ('تالفة', '{ليس JSON', 1)"
    ).run();
    const loaded = listLetterheads(db);
    expect(loaded[0]?.layout.blocks).toEqual([]);
  });
});

describe('الأختام', () => {
  it('تبدأ فارغة وتُضاف وتُحذف', () => {
    const db = freshDb();
    expect(listSeals(db)).toEqual([]);

    const seal = addSeal(db, { name: 'ختم المديرية', kind: 'ختم', imagePath: 'seals/abc.png' });
    expect(seal.name).toBe('ختم المديرية');
    expect(listSeals(db)).toHaveLength(1);

    deleteSeal(db, seal.id);
    expect(listSeals(db)).toEqual([]);
  });
});
