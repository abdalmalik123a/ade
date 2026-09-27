/**
 * قراءة ظهر البطاقة (هـ٧): سطور MRZ بمعيار ICAO 9303 وأرقام تحقّقها.
 *
 * العيّنة مثال المعيار نفسه (Doc 9303 الجزء ٥) — لا بطاقة مواطن؛ والتحقّق ببطاقةٍ
 * عراقية حقيقية ما يزال قائمًا (قرار المالك).
 */
import { describe, expect, it } from 'vitest';
import { checkDigit, findTD1, parseTD1, readMrz } from '../src/shared/mrz';

const SAMPLE = ['I<UTOD231458907<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'];

describe('رقم التحقّق', () => {
  it('الأوزان ٧ ٣ ١ — وأمثلة المعيار', () => {
    expect(checkDigit('D23145890')).toBe(7);
    expect(checkDigit('740812')).toBe(2);
    expect(checkDigit('120415')).toBe(9);
    expect(checkDigit('<<<')).toBe(0);
    expect(checkDigit('a')).toBe(-1);
  });
});

describe('ثلاثة أسطرٍ من ٣٠ حرفًا', () => {
  it('الحقول وتحقّقها', () => {
    const r = parseTD1(SAMPLE)!;
    expect(r).toMatchObject({
      documentCode: 'I',
      issuer: 'UTO',
      documentNumber: 'D23145890',
      birthDate: '1974-08-12',
      sex: 'أنثى',
      expiryDate: '2012-04-15',
      nationality: 'UTO',
      surname: 'ERIKSSON',
      givenNames: 'ANNA MARIA',
      valid: true
    });
  });

  it('حرفٌ واحدٌ خاطئ يُكشف برقم تحقّقه', () => {
    const bad = [SAMPLE[0]!.replace('D2314', 'D2315'), SAMPLE[1]!, SAMPLE[2]!];
    const r = parseTD1(bad)!;
    expect(r.checks.documentNumber).toBe(false);
    expect(r.valid).toBe(false);
  });

  it('وما ليس ثلاثة أسطرٍ من ٣٠ لا يُقرأ', () => {
    expect(parseTD1(SAMPLE.slice(0, 2))).toBeNull();
    expect(parseTD1([SAMPLE[0]!.slice(1), SAMPLE[1]!, SAMPLE[2]!])).toBeNull();
  });
});

describe('من نصّ القارئ الضوئي', () => {
  it('مسافاتٌ و«»» مكان «<» وO مكان 0 في التاريخ — تُصحَّح، ويحكم التحقّق', () => {
    const ocr = [
      'REPUBLIC OF IRAQ — back side',
      'I<UTOD231458907«««««««<<<<<<<<',
      '74O8l22F12O4159UTO <<<<<<<<<<<6',
      'ERIKSSON<<ANNA<MARIA<<<<<<<<<<',
      ''
    ].join('\n');
    expect(findTD1(ocr)).toEqual(SAMPLE);
    expect(readMrz(ocr)?.valid).toBe(true);
  });

  it('ونصٌّ بلا سطور MRZ لا يُخترع له شيء', () => {
    expect(readMrz('جمهورية العراق\nالبطاقة الوطنية')).toBeNull();
  });
});
