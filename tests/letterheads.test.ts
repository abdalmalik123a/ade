import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import {
  defaultAlign,
  emptyLayout,
  isLayoutEmpty,
  normalizeLayout,
  visibleSections,
  type LetterheadBlock,
  type LetterheadLayout
} from '../src/shared/letterhead';
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

const line = (id: string, value: string): LetterheadBlock => ({
  id,
  kind: 'text',
  value,
  align: 'center',
  size: 18,
  bold: true
});

/** ترويسة بقسم واحد فيه سطر. */
function layoutWith(text: string): LetterheadLayout {
  const layout = emptyLayout();
  layout.sections[0].blocks = [line('b1', text)];
  return layout;
}

/** ترويسة بثلاثة أقسام: جهة يمينًا، وشعار وسطًا، وعدد وتاريخ يسارًا. */
function threeColumn(): LetterheadLayout {
  const layout = emptyLayout();
  layout.columns = 3;
  layout.sections[0].blocks = [line('r1', 'جمهورية العراق'), line('r2', 'وزارة التربية')];
  layout.sections[1].blocks = [
    { id: 'c1', kind: 'image', value: 'letterheads/crest.png', align: 'center', size: 12, bold: false, width: 70 }
  ];
  layout.sections[2].blocks = [
    { id: 'l1', kind: 'field', value: '{رقم_الصادر}', align: 'left', size: 12, bold: false }
  ];
  return layout;
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
    expect(loaded?.layout.sections[0]?.blocks[0]?.value).toBe('وزارة التربية');
    expect(loaded?.layout.sections[0]?.blocks[0]?.bold).toBe(true);
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
    expect(all[0]?.layout.sections[0]?.blocks).toHaveLength(1);
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
    expect(loaded[0] && isLayoutEmpty(loaded[0].layout)).toBe(true);
  });
});

describe('الترويسة بالأقسام', () => {
  it('تحفظ الأقسام الثلاثة وترجع بمحتواها وترتيبها', () => {
    const db = freshDb();
    const saved = saveLetterhead(db, {
      id: null,
      name: 'ترويسة بثلاثة أقسام',
      authorityId: null,
      layout: threeColumn()
    });

    const layout = getLetterhead(db, saved.id)!.layout;
    expect(layout.columns).toBe(3);
    expect(visibleSections(layout)).toHaveLength(3);
    expect(layout.sections[0].blocks.map((b) => b.value)).toEqual([
      'جمهورية العراق',
      'وزارة التربية'
    ]);
    expect(layout.sections[1].blocks[0]?.kind).toBe('image');
    expect(layout.sections[2].blocks[0]?.value).toBe('{رقم_الصادر}');
  });

  it('تقليل الأقسام لا يمحو ما كُتب فيها', () => {
    const db = freshDb();
    const layout = threeColumn();
    layout.columns = 1;
    const saved = saveLetterhead(db, {
      id: null,
      name: 'قسم واحد',
      authorityId: null,
      layout
    });

    const loaded = getLetterhead(db, saved.id)!.layout;
    expect(loaded.columns).toBe(1);
    expect(visibleSections(loaded)).toHaveLength(1);
    // القسمان الآخران محفوظان، يعودان بمجرّد زيادة العدد.
    expect(loaded.sections[1].blocks).toHaveLength(1);
    expect(loaded.sections[2].blocks).toHaveLength(1);
  });

  it('المحاذاة الافتراضية تتبع موضع القسم', () => {
    expect(defaultAlign(0, 3)).toBe('right');
    expect(defaultAlign(1, 3)).toBe('center');
    expect(defaultAlign(2, 3)).toBe('left');
    expect(defaultAlign(0, 2)).toBe('right');
    expect(defaultAlign(1, 2)).toBe('left');
    expect(defaultAlign(0, 1)).toBe('center');
  });
});

describe('العدد والتاريخ في الترويسة', () => {
  it('لا يظهران إلا باختيار المكتب، والأصل فراغ يُملأ باليد', () => {
    const fresh = emptyLayout();
    expect(fresh.registry).toEqual({ show: false, mode: 'manual' });
  });

  it('يُحفظان مع الترويسة ويعودان معها', () => {
    const db = freshDb();
    const layout = threeColumn();
    layout.registry = { show: true, mode: 'printed' };
    const saved = saveLetterhead(db, {
      id: null,
      name: 'بعدد وتاريخ',
      authorityId: null,
      layout
    });
    expect(getLetterhead(db, saved.id)?.layout.registry).toEqual({ show: true, mode: 'printed' });
  });

  it('ترويسة بلا كتل لكن بعدد وتاريخ ليست فارغة', () => {
    const layout = emptyLayout();
    expect(isLayoutEmpty(layout)).toBe(true);
    layout.registry = { show: true, mode: 'manual' };
    expect(isLayoutEmpty(layout)).toBe(false);
  });

  it('قيمة غريبة في الترحيل تعود إلى الأصل الآمن', () => {
    expect(normalizeLayout({ columns: 2, sections: [], registry: 'نعم' }).registry).toEqual({
      show: false,
      mode: 'manual'
    });
    expect(
      normalizeLayout({ sections: [{ blocks: [] }], registry: { show: true, mode: 'خطأ' } }).registry
    ).toEqual({ show: true, mode: 'manual' });
  });
});

describe('ترحيل الترويسات القديمة', () => {
  it('ترويسة بُنيت قبل الأقسام تصير قسمًا واحدًا بعرض الورقة', () => {
    const db = freshDb();
    // الصيغة القديمة كما كانت تُحفظ حرفيًا في القاعدة.
    const legacy = JSON.stringify({
      margins: { top: 15, right: 18, bottom: 15, left: 18 },
      blocks: [line('old1', 'جمهورية العراق'), line('old2', 'وزارة التربية')]
    });
    db.prepare("INSERT INTO letterheads (name, layout_json, is_default) VALUES ('قديمة', ?, 1)").run(
      legacy
    );

    const loaded = listLetterheads(db)[0]!;
    expect(loaded.layout.columns).toBe(1);
    expect(loaded.layout.sections[0].blocks.map((b) => b.value)).toEqual([
      'جمهورية العراق',
      'وزارة التربية'
    ]);
    expect(loaded.layout.margins).toEqual({ top: 15, right: 18, bottom: 15, left: 18 });
    expect(isLayoutEmpty(loaded.layout)).toBe(false);
  });

  it('الترحيل لا يعبث ببنية جديدة، ويصمد أمام قيمة غريبة', () => {
    const layout = threeColumn();
    expect(normalizeLayout(layout)).toEqual(layout);
    expect(isLayoutEmpty(normalizeLayout(null))).toBe(true);
    expect(isLayoutEmpty(normalizeLayout('نصّ لا علاقة له'))).toBe(true);
    expect(normalizeLayout({ columns: 9 }).columns).toBe(1);
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
