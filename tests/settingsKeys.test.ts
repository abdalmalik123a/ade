/**
 * ما يُحفظ من «الإعدادات» (و٣): حقول `OfficeSettings` وحدها، وقائمة المفاتيح تطابقها — ومفاتيح التفعيل الفاسدة
 * قائمةٌ فارغة لا خطأٌ يوقف الإصدار.
 */
import { describe, expect, it } from 'vitest';
import type { OfficeSettings } from '../src/shared/api';
import { OFFICE_SETTING_KEYS, SETTING_KEYS_COMPLETE, assertSettingsPatch } from '../src/shared/settingsKeys';
import { keyList } from '../src/main/services/license';

/** إعداداتٌ كاملة: حقلٌ يُضاف إلى `OfficeSettings` يجعل هذا الكائن ناقصًا فلا يُبنى الاختبار حتى يُضاف هنا وفي القائمة. */
const FULL: OfficeSettings = {
  officeName: '',
  officePhone: '',
  officeAddress: '',
  operatorName: '',
  defaultPrinter: null,
  printRoles: {} as OfficeSettings['printRoles'],
  serialPrefix: '',
  serialYear: 2026,
  uiScale: 1,
  onboarded: true,
  printOffsets: {},
  basmala: null,
  lastBackupAt: null,
  hijriOffset: 0,
  counterCards: [],
  schoolFiles: false,
  receiptSlip: false
};

describe('مفاتيح الإعدادات (و٣)', () => {
  it('القائمة = حقول OfficeSettings، بلا تكرار', () => {
    expect([...OFFICE_SETTING_KEYS].sort()).toEqual(Object.keys(FULL).sort());
    expect(new Set(OFFICE_SETTING_KEYS).size).toBe(OFFICE_SETTING_KEYS.length);
    expect(SETTING_KEYS_COMPLETE).toBe(true);
  });

  it('وحفظ الإعدادات كلّها كما ترسلها شاشة الإعدادات يُقبل', () => {
    expect(() => assertSettingsPatch(FULL)).not.toThrow();
    expect(() => assertSettingsPatch({ uiScale: 1.2 })).not.toThrow();
    expect(() => assertSettingsPatch({})).not.toThrow();
  });

  it('وما ليس منها يُرفض كلّه بعربية — `appVersion` تقفل الإقلاع و`licenseKeys` توقف الإصدار', () => {
    expect(() => assertSettingsPatch({ appVersion: '99.0.0' })).toThrow('«appVersion» ليس من إعدادات المكتب — لم يُحفظ شيء');
    expect(() => assertSettingsPatch({ officeName: 'مكتب النور', licenseKeys: 'x' })).toThrow('«licenseKeys»');
    expect(() => assertSettingsPatch({ trialStart: '2020-01-01', autoBackupSecret: 'x' })).toThrow('«trialStart»، «autoBackupSecret»');
  });

  it('وما ليس كائنًا يُرفض', () => {
    for (const bad of [null, undefined, 'officeName', 7, ['officeName']]) {
      expect(() => assertSettingsPatch(bad)).toThrow('لم يُحفظ شيء');
    }
  });
});

describe('قائمة مفاتيح التفعيل (و٣)', () => {
  it('المحفوظة نصًّا والمحفوظة قائمةً تُقرآن', () => {
    expect(keyList('["DW1-a","DW1-b"]')).toEqual(['DW1-a', 'DW1-b']);
    expect(keyList(['DW1-a'])).toEqual(['DW1-a']);
  });

  it('وما فسد فارغٌ لا خطأ — فلا يتوقّف الإصدار', () => {
    expect(keyList('ليس JSON')).toEqual([]);
    expect(keyList('{"a":1}')).toEqual([]);
    expect(keyList('"DW1-a"')).toEqual([]);
    expect(keyList(undefined)).toEqual([]);
    expect(keyList(null)).toEqual([]);
    expect(keyList(42)).toEqual([]);
    expect(keyList(['DW1-a', 7, null, '', '  ', { k: 1 }])).toEqual(['DW1-a']);
  });
});
