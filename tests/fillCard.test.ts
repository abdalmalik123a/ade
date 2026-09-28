/**
 * بطاقة التعبئة (هـ٦): الاسم مفرَّقًا كما تسأل المواقع، والتاريخ والهاتف بصيغها.
 */
import { describe, expect, it } from 'vitest';
import { addressParts, fillGroups, parseLooseDate, splitArabicName } from '../src/shared/fillCard';

describe('الاسم مفرَّقًا', () => {
  it('الرباعي واللقب: الاسم والأب والجد، والباقي لقب', () => {
    expect(splitArabicName('أحمد عادل كريم الموسوي')).toEqual({ first: 'أحمد', father: 'عادل', grandfather: 'كريم', surname: 'الموسوي' });
    expect(splitArabicName('زينب علي حسن جاسم العبيدي')).toMatchObject({ grandfather: 'حسن', surname: 'جاسم العبيدي' });
  });

  it('والمركّب كلمةٌ واحدة: «عبد الله»، «أبو بكر»، «نور الدين»', () => {
    expect(splitArabicName('عبد الله نور الدين أبو بكر الجبوري')).toEqual({
      first: 'عبد الله',
      father: 'نور الدين',
      grandfather: 'أبو بكر',
      surname: 'الجبوري'
    });
  });

  it('والفاصلة لا تفرّق', () => {
    expect(splitArabicName('علي، حسين، كاظم').grandfather).toBe('كاظم');
  });

  it('واللقب المحفوظ في خانته يُعرف موضعه: يُحذف من آخر الاسم، والرابع اسم أب الجد', () => {
    expect(splitArabicName('زينب علي حسن جاسم العبيدي', 'العبيدي')).toEqual({
      first: 'زينب',
      father: 'علي',
      grandfather: 'حسن',
      fourth: 'جاسم',
      surname: 'العبيدي'
    });
    // ولم يُكتب في الاسم: الاسم كلّه أسماء، واللقب من خانته — والهمزة لا تفرّق.
    expect(splitArabicName('زينب علي حسن جاسم', 'الأسدي')).toMatchObject({ fourth: 'جاسم', surname: 'الأسدي' });
    expect(splitArabicName('علي حسن الاسدي', 'الأسدي')).toMatchObject({ grandfather: '', surname: 'الأسدي' });
  });
});

describe('العنوان أجزاءً', () => {
  it('المحلة والزقاق والدار كلٌّ في خانته، بالأرقام اللاتينية وبالمختصر', () => {
    expect(addressParts('محلة ٦١٢ زقاق ١٤ دار ٧')).toEqual({ mahalla: '612', alley: '14', house: '7' });
    expect(addressParts('حي الجامعة م 612 ز 14 د 7/1')).toEqual({ mahalla: '612', alley: '14', house: '7/1' });
    expect(addressParts('قرب جامع الرحمن')).toEqual({ mahalla: '', alley: '', house: '' });
  });
});

describe('التاريخ بأيّ صيغةٍ شائعة', () => {
  it('يومٌ أولًا أو سنةٌ أولًا، وبالأرقام الهندية', () => {
    expect(parseLooseDate('1990-03-05')).toEqual({ d: 5, m: 3, y: 1990 });
    expect(parseLooseDate('5/3/1990')).toEqual({ d: 5, m: 3, y: 1990 });
    expect(parseLooseDate('٠٥/٠٣/١٩٩٠')).toEqual({ d: 5, m: 3, y: 1990 });
    expect(parseLooseDate('35/3/1990')).toBeNull();
    expect(parseLooseDate('آذار ١٩٩٠')).toBeNull();
  });
});

describe('البطاقة بأبوابها', () => {
  it('كل صيغةٍ سطرٌ يُنسخ — وما لا قيمة له لا يُعرض', () => {
    const groups = fillGroups({
      fullName: 'أحمد عادل كريم الموسوي',
      nationalId: '١٩٩٩ ١٢٣٤ ٥٦٧٨',
      phone: '0770 123 4567',
      birthDate: '5/3/1990',
      birthPlace: 'الأنبار'
    });
    const flat = Object.fromEntries(groups.flatMap((g) => g.lines.map((l) => [l.label, l.value])));
    expect(flat['اسم الجد']).toBe('كريم');
    expect(flat['الاسم الثلاثي']).toBe('أحمد عادل كريم');
    expect(flat['الرقم الوطني']).toBe('199912345678');
    expect(flat['الهاتف']).toBe('07701234567');
    expect(flat['الهاتف بلا صفر']).toBe('7701234567');
    expect(flat['الهاتف الدولي']).toBe('+9647701234567');
    expect(flat['تاريخ الولادة']).toBe('05/03/1990');
    expect(flat['تاريخ الولادة (السنة أولًا)']).toBe('1990-03-05');
    expect(groups.map((g) => g.title)).toEqual(['الاسم', 'الولادة والحالة', 'الاتصال', 'البطاقات والأرقام']);
  });

  it('وخانات الاستمارات الحكومية بترتيب أور: الاسم واسم الأم، ثم الولادة، ثم السكن، ثم الأرقام', () => {
    const groups = fillGroups({
      fullName: 'زينب علي حسن جاسم العبيدي',
      surname: 'العبيدي',
      motherName: 'فاطمة كاظم جواد',
      gender: 'أنثى',
      governorate: 'بغداد',
      district: 'الكرخ',
      address: 'محلة ٦١٢ زقاق ١٤ دار ٧',
      familyNumber: '1108L0M١٥٦٠٠٠١٠١٠١',
      nidIssueDate: '2023/06/15',
      rationCardNo: '٤٥٦٧٨'
    });
    const flat = Object.fromEntries(groups.flatMap((g) => g.lines.map((l) => [l.label, l.value])));
    expect(flat['الاسم الرابع']).toBe('جاسم');
    expect(flat['اللقب']).toBe('العبيدي');
    expect(flat['الاسم الرباعي']).toBe('زينب علي حسن جاسم');
    expect([flat['اسم الأم'], flat['اسم أب الأم'], flat['اسم جد الأم']]).toEqual(['فاطمة', 'كاظم', 'جواد']);
    expect([flat['المحافظة'], flat['القضاء'], flat['المحلة'], flat['الزقاق'], flat['الدار']]).toEqual(['بغداد', 'الكرخ', '612', '14', '7']);
    // الأرقام لاتينية والحروف كما هي — فالرقم العائلي لا يصير «l0m».
    expect(flat['الرقم العائلي']).toBe('1108L0M15600010101');
    expect(flat['رقم البطاقة التموينية']).toBe('45678');
    expect(flat['تاريخ إصدار البطاقة']).toBe('15/06/2023');
    expect(groups.map((g) => g.title)).toEqual(['الاسم', 'الولادة والحالة', 'السكن', 'البطاقات والأرقام']);
  });
});
