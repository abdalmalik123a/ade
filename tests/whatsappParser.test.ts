import { describe, expect, it } from 'vitest';
import { normalizeIndicDigits, parseWhatsAppMessage, valuesFromMessage } from '../src/shared/whatsappParser';

describe('التحليل الذكي لرسائل الواتساب (WhatsApp Smart Parse)', () => {
  it('يحول الأرقام الهندية المشرقية إلى قياسية', () => {
    expect(normalizeIndicDigits('٠٧٧٠١٢٣٤٥٦٧')).toBe('07701234567');
    expect(normalizeIndicDigits('تولد ١٩٩٥/٠٣/١٤')).toBe('تولد 1995/03/14');
  });

  it('يستخرج بيانات المواطن كاملة من رسالة واتساب نمطية', () => {
    const raw = `
السلام عليكم أخي أريد أقدم على استمارة
الاسم الرباعي: حيدر كريم جاسم العبيدي
الرقم الوطني: 199512345678
تاريخ الولادة: 1995/07/21
محل الولادة: بغداد
رقم الهاتف: 07701234567
بطاقة السكن: 123456/A
العنوان: الكرخ - حي الجامعة محلة 612 زقاق 14 دار 8
اقرب نقطة دالة: قرب جامع مالك الاشتر
الوظيفة: مهندس مدني
مكان العمل: وزارة الإعمار والإسكان
اسم الام: مريم عبد الله
`;

    const res = parseWhatsAppMessage(raw);
    expect(res.fullName).toBe('حيدر كريم جاسم العبيدي');
    expect(res.nationalId).toBe('199512345678');
    expect(res.birthDate).toBe('1995/07/21');
    expect(res.birthPlace).toBe('بغداد');
    expect(res.phone).toBe('07701234567');
    expect(res.housingCardNo).toBe('123456/A');
    expect(res.address).toContain('الكرخ - حي الجامعة');
    expect(res.landmark).toBe('قرب جامع مالك الاشتر');
    expect(res.jobTitle).toBe('مهندس مدني');
    expect(res.workplace).toBe('وزارة الإعمار والإسكان');
    expect(res.motherName).toBe('مريم عبد الله');
    expect(res.detectedFieldsCount).toBeGreaterThanOrEqual(10);
  });

  it('يستخرج الرقم الوطني والهاتف حتى لو كتبت بالأرقام الهندية ومن دون تسميات صريحة', () => {
    const raw = `
علي احمد محمود
١٩٨٨١٢٣٤٥٦٧٨
٠٧٨٠٩٨٧٦٥٤٣
البصرة
`;
    const res = parseWhatsAppMessage(raw);
    expect(res.fullName).toBe('علي احمد محمود');
    expect(res.nationalId).toBe('198812345678');
    expect(res.phone).toBe('07809876543');
    // «البصرة» وحدها: أعنوانٌ هي أم محلّ ولادة؟ لا يُخمَّن — تبقى في الملاحظات يراها الموظف.
    expect(res.birthPlace).toBeNull();
    expect(res.notes).toContain('البصرة');
  });

  it('سطرٌ واحد بفواصل: كلّ عنوانٍ لقيمته، والعنوان بفواصله قطعةٌ واحدة', () => {
    const res = parseWhatsAppMessage('الاسم: محمد علي، التولد: 1998، العنوان: بغداد، الكرادة');
    expect(res).toMatchObject({ fullName: 'محمد علي', birthDate: '1998', address: 'بغداد، الكرادة', birthPlace: null });
  });

  it('«ام:» و«موبايل» بلا «ال»', () => {
    const res = parseWhatsAppMessage('الاسم: زينب حسن\nموبايل 07701234567\nام: فاطمة جاسم');
    expect(res).toMatchObject({ phone: '07701234567', motherName: 'فاطمة جاسم' });
  });
});

describe('توزيع الرسالة على حقول الشبّاك', () => {
  it('بالمصدر والدور وعنوان الأم — ولا يطمس ما كُتب باليد', () => {
    const fields = [
      { key: 'الاسم', label: 'الاسم الرباعي', source: 'fullName', role: 'name' },
      { key: 'الرقم_الوطني', label: 'الرقم الوطني', source: 'nationalId', role: 'nationalId' },
      { key: 'الهاتف', label: 'رقم الهاتف', source: 'phone', role: null },
      { key: 'اسم_الأم', label: 'اسم الأم', source: null, role: null },
      { key: 'العنوان', label: 'العنوان', source: 'address', role: null }
    ];
    const extracted = parseWhatsAppMessage('الاسم: زينب حسن\nالهاتف: 07701234567\nام: فاطمة جاسم\nالعنوان: بغداد');
    const out = valuesFromMessage(fields, extracted, { العنوان: 'البصرة' });
    expect(out).toEqual({ الاسم: 'زينب حسن', الهاتف: '07701234567', اسم_الأم: 'فاطمة جاسم' });
  });
});
