/**
 * قراءة ظهر البطاقة (هـ٧): سطور MRZ بمعيار ICAO 9303 وأرقام تحقّقها.
 *
 * العيّنة مثال المعيار نفسه (Doc 9303 الجزء ٥) — لا بطاقة مواطن؛ والتحقّق ببطاقةٍ
 * عراقية حقيقية ما يزال قائمًا (قرار المالك).
 */
import { describe, expect, it } from 'vitest';
import { checkDigit, findTD1, findTD3, mrzExpired, mrzLatinName, parseTD1, parseTD3, readMrz } from '../src/shared/mrz';

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

describe('المستمسك منتهٍ، والاسم باللاتينية (S29، D179)', () => {
  it('أمسِ منتهٍ، واليوم وما بعده لا، والتاريخ الذي لم يُقرأ عدم', () => {
    const today = new Date(2026, 9, 25);
    expect(mrzExpired('2026-10-24', today)).toBe(true);
    expect(mrzExpired('2026-10-25', today)).toBe(false);
    expect(mrzExpired('2031-02-20', today)).toBe(false);
    expect(mrzExpired(null, today)).toBeNull();
    expect(mrzExpired('2026-1-5', today)).toBeNull();
  });

  it('الأسماء ثمّ اللقب بمسافةٍ واحدة — واللقب الفارغ لا يترك مسافة', () => {
    expect(mrzLatinName({ givenNames: 'ZAINAB ALI', surname: 'HASSAN' })).toBe('ZAINAB ALI HASSAN');
    expect(mrzLatinName({ givenNames: 'ZAINAB ALI HASSAN', surname: '' })).toBe('ZAINAB ALI HASSAN');
  });
});

describe('جواز السفر: سطران من ٤٤ (TD3، S41، D180)', () => {
  // عيّنة ICAO 9303 الجزء ٤ المعروفة (دولةٌ متخيَّلة «UTO»).
  const L1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const L2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';

  it('عيّنة ICAO تُقرأ حقولها وتتحقّق أرقامها كلّها', () => {
    expect(parseTD3([L1, L2])).toMatchObject({
      format: 'TD3',
      documentCode: 'P',
      issuer: 'UTO',
      documentNumber: 'L898902C3',
      nationality: 'UTO',
      birthDate: '1974-08-12',
      sex: 'أنثى',
      expiryDate: '2012-04-15',
      surname: 'ERIKSSON',
      givenNames: 'ANNA MARIA',
      optional1: 'ZE184226B',
      checks: { documentNumber: true, birthDate: true, expiryDate: true, personal: true, composite: true },
      valid: true
    });
    expect(parseTD3([L1, L2.slice(0, 43)])).toBeNull();
    expect(parseTD3([L1])).toBeNull();
  });

  it('رقمٌ واحدٌ أخطأه القارئ يُسقط تحقّقه — ولا تُقبل القراءة', () => {
    const wrong = parseTD3([L1, L2.replace('7408122', '7408132')])!;
    expect(wrong.checks.birthDate).toBe(false);
    expect(wrong.valid).toBe(false);
  });

  it('والرقم الشخصي الخالي («<» كلّه) تحقّقه «<» مقبول', () => {
    const head = 'L898902C36UTO7408122F1204159';
    const body = head + '<'.repeat(14) + '<';
    const composite = String(checkDigit(body.slice(0, 10) + body.slice(13, 20) + body.slice(21, 43)));
    expect(parseTD3([L1, body + composite])).toMatchObject({ optional1: '', checks: { personal: true }, valid: true });
  });

  it('من نصّ القارئ: «‹» والمسافات، والحرف O في خانة رقمٍ صفر — وreadMrz يجرّبه قبل البطاقة', () => {
    const text = ['PASSPORT', 'P‹UTOERIKSSON‹‹ANNA‹MARIA‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹', 'L898902C36UTO 74O8122F12O4159ZE184226B<<<<<1O', ''].join('\n');
    expect(findTD3(text)).toEqual([L1, L2]);
    expect(readMrz(text)).toMatchObject({ format: 'TD3', valid: true });
  });
});
