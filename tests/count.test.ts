import { describe, expect, it } from 'vitest';
import { count, countIn } from '../src/shared/arabic';
import { tafqeet } from '../src/shared/tafqeet';

describe('أداة العدّ الواحدة في الواجهة (البند ١٧)', () => {
  it('المعدود بحسب العدد: واحد واثنان بلا رقم، والجمع ٣–١٠، والمنصوب ١١–٩٩، والمفرد للمئة', () => {
    expect(count(1, 'كتاب')).toBe('كتاب واحد');
    expect(count(2, 'كتاب')).toBe('كتابان');
    expect(count(3, 'اسم')).toBe('٣ أسماء');
    expect(count(10, 'ورقة')).toBe('١٠ أوراق');
    expect(count(11, 'اسم')).toBe('١١ اسمًا');
    expect(count(12, 'ورقة')).toBe('١٢ ورقة');
    expect(count(100, 'نموذج')).toBe('١٠٠ نموذج');
    expect(count(103, 'بطاقة')).toBe('١٠٣ بطاقات');
    expect(count(1, 'بطاقة')).toBe('بطاقة واحدة');
    expect(count(25, 'ملف')).toBe('٢٥ ملفًّا');
  });

  it('الصفر «لا …» أو ما يُقال في جملته، والرقم هنديٌّ أبدًا', () => {
    expect(count(0, 'نموذج')).toBe('لا نماذج');
    expect(count(0, 'نموذج', 'لا نماذج بعد')).toBe('لا نماذج بعد');
    expect(count(5, 'سطر')).not.toMatch(/\d/);
  });

  it('بعد الجرّ ومفعولًا: المثنّى بالياء', () => {
    expect(countIn(2, 'ورقة')).toBe('ورقتين');
    expect(countIn(2, 'مرة')).toBe('مرّتين');
    expect(countIn(3, 'ورقة')).toBe('٣ أوراق');
  });
});

describe('تفقيط الآلاف غير المدوّرة (البند ١٧)', () => {
  it('«مئتا ألف وألفان» لا «مئتان واثنان ألف»', () => {
    expect(tafqeet(202000, { currency: 'NONE', prefix: false, suffix: false })).toBe('مئتا ألف وألفان');
    expect(tafqeet(101000, { prefix: false, suffix: false })).toBe('مئة ألف وألف دينار عراقي');
    expect(tafqeet(202500, { currency: 'NONE', prefix: false, suffix: false })).toBe('مئتا ألف وألفان وخمسمئة');
    expect(tafqeet(102000, { prefix: false, suffix: false })).toBe('مئة ألف وألفا دينار عراقي');
    // والمدوّرة كما كانت
    expect(tafqeet(105000, { prefix: false, suffix: false })).toBe('مئة وخمسة آلاف دينار عراقي');
  });
});
