/**
 * بطاقة التعبئة (هـ٦): الاسم مفرَّقًا كما تسأل المواقع، والتاريخ والهاتف بصيغها.
 */
import { describe, expect, it } from 'vitest';
import { fillGroups, parseLooseDate, splitArabicName } from '../src/shared/fillCard';

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
    expect(flat['بصيغة السنة أولًا']).toBe('1990-03-05');
    expect(groups.map((g) => g.title)).toEqual(['الاسم', 'الأرقام', 'الولادة']);
  });
});
