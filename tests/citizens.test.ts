import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import {
  addAttachment,
  citizenStats,
  citizenUsage,
  deleteAttachment,
  deleteCitizen,
  ensureSearchColumn,
  getCitizen,
  isNationalIdTaken,
  listCategories,
  listCitizens,
  saveCitizen,
  setAttachmentOcr
} from '../src/main/services/citizens';
import type { CitizenInput } from '../src/shared/api';

function db() {
  const d = freshDb();
  ensureSearchColumn(d);
  return d;
}

function person(over: Partial<CitizenInput> = {}): CitizenInput {
  return {
    id: null,
    fullName: 'أحمد عادل كريم',
    nationalId: '198421098312',
    jobTitle: 'مدرس أول لغة عربية',
    workplace: 'إعدادية المنصور',
    employeeCode: null,
    serviceStatus: 'مستمر بالخدمة',
    birthDate: '1984-08-12',
    birthPlace: 'بغداد',
    enrollmentDept: null,
    address: null,
    housingCardNo: null,
    landmark: null,
    phone: '07701849201',
    photoPath: null,
    category: 'تربية وتعليم',
    notes: null,
    verified: true,
    ...over
  };
}

describe('خانات الاستمارات الحكومية (أيلول ٢٠٢٦)', () => {
  it('تُحفظ وتُقرأ، وتُقصّ فراغاتها، والفارغة عدمٌ لا نصّ', () => {
    const d = db();
    const saved = saveCitizen(
      d,
      person({ motherName: '  فاطمة كاظم جواد ', surname: 'الموسوي', gender: 'ذكر', familyNumber: '1108L0M15600010101', governorate: 'بغداد', rationCardNo: '' })
    );
    const got = getCitizen(d, saved.id)!;
    expect(got).toMatchObject({ motherName: 'فاطمة كاظم جواد', surname: 'الموسوي', gender: 'ذكر', familyNumber: '1108L0M15600010101', governorate: 'بغداد' });
    expect(got.rationCardNo).toBeNull();
    expect(got.civilRecord).toBeNull();
    const again = saveCitizen(d, { ...got, motherName: 'زينب علي حسن' });
    expect(getCitizen(d, again.id)!.motherName).toBe('زينب علي حسن');
    // والحفظ بالخانات القديمة وحدها لا يمحو الجديدة؛ والفارغة صراحةً تُمحى.
    const { motherName: _m, surname: _s, familyNumber: _f, ...oldShape } = got;
    void _m;
    void _s;
    void _f;
    saveCitizen(d, { ...oldShape, phone: '07811112222', governorate: '' });
    expect(getCitizen(d, saved.id)).toMatchObject({ phone: '07811112222', motherName: 'زينب علي حسن', surname: 'الموسوي', governorate: null });
  });

  it('وقاعدة المكتب القائمة (بلا أعمدتها) تُعطاها عند الإقلاع — وملفّاتها كما هي', () => {
    const d = freshDb();
    for (const col of ['surname', 'mother_name', 'family_number']) d.exec(`ALTER TABLE citizens DROP COLUMN ${col}`);
    d.prepare("INSERT INTO citizens (full_name, national_id) VALUES ('علي حسين', '199012345678')").run();
    ensureSearchColumn(d);
    const cols = (d.prepare('PRAGMA table_info(citizens)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['surname', 'mother_name', 'family_number', 'ration_card_no']));
    const [row] = listCitizens(d);
    expect(getCitizen(d, row!.id)).toMatchObject({ fullName: 'علي حسين', nationalId: '199012345678', motherName: null });
  });
});

describe('ملف المواطن', () => {
  it('يبدأ السجل فارغًا', () => {
    const d = db();
    expect(listCitizens(d)).toEqual([]);
    expect(citizenStats(d)).toEqual({
      activeFiles: 0,
      verifiedFiles: 0,
      attachments: 0,
      ocrAccuracy: null,
      issuedThisMonth: 0
    });
  });

  it('يحفظ كل الحقول ويستردّها', () => {
    const d = db();
    const saved = saveCitizen(d, person());
    const loaded = getCitizen(d, saved.id)!;
    expect(loaded.fullName).toBe('أحمد عادل كريم');
    expect(loaded.nationalId).toBe('198421098312');
    expect(loaded.jobTitle).toBe('مدرس أول لغة عربية');
    expect(loaded.birthPlace).toBe('بغداد');
    expect(loaded.verified).toBe(true);
  });

  it('يرفض ملفًا بلا اسم', () => {
    const d = db();
    expect(() => saveCitizen(d, person({ fullName: '   ' }))).toThrow('اسم المواطن مطلوب');
  });

  it('يمنع تكرار الرقم الوطني — ملفّان لشخص واحد يفسدان الأرشيف', () => {
    const d = db();
    saveCitizen(d, person());
    expect(() => saveCitizen(d, person({ fullName: 'شخص آخر' }))).toThrow('مسجَّل لمواطن آخر');
  });

  it('يسمح بإبقاء الرقم نفسه عند تعديل الملف ذاته', () => {
    const d = db();
    const saved = saveCitizen(d, person());
    expect(() => saveCitizen(d, person({ id: saved.id, fullName: 'أحمد عادل كريم الموسوي' }))).not.toThrow();
    expect(getCitizen(d, saved.id)!.fullName).toBe('أحمد عادل كريم الموسوي');
    expect(listCitizens(d)).toHaveLength(1);
  });

  it('الرقم الوطني الفارغ لا يعدّ تكرارًا', () => {
    const d = db();
    saveCitizen(d, person({ nationalId: null }));
    expect(() => saveCitizen(d, person({ fullName: 'ثانٍ', nationalId: '  ' }))).not.toThrow();
    expect(isNationalIdTaken(d, '000', null)).toBe(false);
  });
});

describe('البحث العربي', () => {
  it('يجد «أحمد» بكتابة «احمد» — الموظف لا يكتب الهمزات', () => {
    const d = db();
    saveCitizen(d, person({ fullName: 'أحمد عادل' }));
    expect(listCitizens(d, { query: 'احمد' })).toHaveLength(1);
    expect(listCitizens(d, { query: 'أحمد' })).toHaveLength(1);
  });

  it('يجد الاسم رغم التاء المربوطة والألف المقصورة', () => {
    const d = db();
    saveCitizen(d, person({ fullName: 'مصطفى حمزة', nationalId: null }));
    expect(listCitizens(d, { query: 'مصطفي حمزه' })).toHaveLength(1);
  });

  it('يبحث بالرقم الوطني والهاتف وبطاقة السكن', () => {
    const d = db();
    saveCitizen(d, person({ housingCardNo: 'R-491028' }));
    expect(listCitizens(d, { query: '198421' })).toHaveLength(1);
    expect(listCitizens(d, { query: '07701' })).toHaveLength(1);
    expect(listCitizens(d, { query: 'R-4910' })).toHaveLength(1);
  });

  it('لا يعيد شيئًا لبحث لا يطابق', () => {
    const d = db();
    saveCitizen(d, person());
    expect(listCitizens(d, { query: 'لا يوجد' })).toEqual([]);
  });

  it('يحدّث صورة البحث عند تعديل الاسم', () => {
    const d = db();
    const saved = saveCitizen(d, person({ fullName: 'أحمد' }));
    saveCitizen(d, person({ id: saved.id, fullName: 'إبراهيم' }));
    expect(listCitizens(d, { query: 'احمد' })).toEqual([]);
    expect(listCitizens(d, { query: 'ابراهيم' })).toHaveLength(1);
  });

  it('الترشيح بالتصنيف يعمل مع البحث ومن دونه', () => {
    const d = db();
    saveCitizen(d, person({ category: 'تربية وتعليم' }));
    saveCitizen(d, person({ fullName: 'سعد', nationalId: '2', category: 'متقاعدين' }));
    expect(listCitizens(d, { category: 'متقاعدين' })).toHaveLength(1);
    expect(listCitizens(d, { category: 'متقاعدين', query: 'سعد' })).toHaveLength(1);
    expect(listCitizens(d, { category: 'متقاعدين', query: 'احمد' })).toHaveLength(0);
  });

  it('التصنيفات تُشتقّ من الملفات المحفوظة', () => {
    const d = db();
    expect(listCategories(d)).toEqual([]);
    saveCitizen(d, person());
    saveCitizen(d, person({ fullName: 'ب', nationalId: '2', category: 'تربية وتعليم' }));
    saveCitizen(d, person({ fullName: 'ج', nationalId: '3', category: 'متقاعدين' }));
    expect(listCategories(d)).toEqual([
      { name: 'تربية وتعليم', count: 2 },
      { name: 'متقاعدين', count: 1 }
    ]);
  });
});

describe('المستمسكات', () => {
  it('تُضاف وتُعدّ وتُحذف، وتُعاد مساراتها للحذف من القرص', () => {
    const d = db();
    const c = saveCitizen(d, person());
    const a = addAttachment(d, {
      citizenId: c.id,
      docType: 'البطاقة الوطنية الموحدة',
      filePath: 'attachments/x.png',
      fileFormat: 'PNG',
      dpi: 600,
      sha256: 'abc'
    });
    expect(getCitizen(d, c.id)!.attachments).toHaveLength(1);
    expect(listCitizens(d)[0]!.attachmentCount).toBe(1);

    const path = deleteAttachment(d, a.id);
    expect(path).toBe('attachments/x.png');
    expect(getCitizen(d, c.id)!.attachments).toEqual([]);
  });

  it('نتيجة OCR تُحفظ وتدخل في متوسط الدقة', () => {
    const d = db();
    const c = saveCitizen(d, person());
    const a = addAttachment(d, {
      citizenId: c.id,
      docType: 'بطاقة سكن',
      filePath: 'attachments/y.png',
      fileFormat: 'PNG',
      dpi: 600,
      sha256: null
    });
    setAttachmentOcr(d, a.id, 'نصّ مستخرَج', 0.94);
    const loaded = getCitizen(d, c.id)!.attachments[0]!;
    expect(loaded.ocrText).toBe('نصّ مستخرَج');
    expect(loaded.ocrAccuracy).toBeCloseTo(0.94);
    expect(citizenStats(d).ocrAccuracy).toBeCloseTo(0.94);
  });

  it('حذف المواطن يعيد مسارات ملفاته كلها لتُمحى من القرص', () => {
    const d = db();
    const c = saveCitizen(d, person({ photoPath: 'photos/p.png' }));
    addAttachment(d, {
      citizenId: c.id,
      docType: 'أ',
      filePath: 'attachments/1.png',
      fileFormat: 'PNG',
      dpi: null,
      sha256: null
    });
    const orphans = deleteCitizen(d, c.id);
    expect(orphans.sort()).toEqual(['attachments/1.png', 'photos/p.png']);
    expect(listCitizens(d)).toEqual([]);
  });
});

describe('الكتب الصادرة للمواطن', () => {
  it('تُحصى قبل الحذف ولا تُمحى معه', () => {
    const d = db();
    const c = saveCitizen(d, person());
    expect(citizenUsage(d, c.id)).toBe(0);

    d.prepare(
      `INSERT INTO documents (serial, serial_year, serial_seq, citizen_id, doc_type,
                              body_html, gregorian_date, sha256)
       VALUES ('م/2026/1', 2026, 1, ?, 'تأييد سكن', '', '2026-09-14', 'x')`
    ).run(c.id);
    expect(citizenUsage(d, c.id)).toBe(1);
    expect(getCitizen(d, c.id)!.documents).toHaveLength(1);

    deleteCitizen(d, c.id);
    const remaining = d.prepare('SELECT citizen_id FROM documents').all() as {
      citizen_id: number | null;
    }[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.citizen_id).toBeNull();
  });
});
