/**
 * المساعدات المشتركة (ز٢) — نسخةٌ واحدة لكلٍّ بدل نسخٍ في عشرات الملفّات، وبالسلوك نفسه.
 */
import { describe, expect, it } from 'vitest';
import { toIndic, toIndicText } from '../src/shared/arabic';
import { escapeHtml } from '../src/shared/html';
import { isoDate, localToday } from '../src/shared/dates';

describe('المساعدات المشتركة (ز٢)', () => {
  it('toIndic: الأرقام هنديةً، والعدد والنصّ سواء', () => {
    expect(toIndic(2026)).toBe('٢٠٢٦');
    expect(toIndic('رقم 12 من 30')).toBe('رقم ١٢ من ٣٠');
    expect(toIndic(0)).toBe('٠');
  });

  it('toIndicText: الرقم بعد حرفٍ لاتيني يبقى («A4»)', () => {
    expect(toIndicText('ورقة A4 عدد 3')).toBe('ورقة A4 عدد ٣');
    expect(toIndic('A4')).toBe('A٤');
  });

  it('escapeHtml: & < > " — وعلامة التنصيص المفردة كما هي (خصائص البرنامج بين علامتين مزدوجتين)', () => {
    expect(escapeHtml(`<b class="x">'a' & b</b>`)).toBe(`&lt;b class=&quot;x&quot;&gt;'a' &amp; b&lt;/b&gt;`);
  });

  it('localToday: اليوم محليًّا لا بالتوقيت العالمي — وهو isoDate لليوم', () => {
    // قبيل منتصف الليل محليًّا: التوقيت العالمي قد يكون في اليوم التالي أو السابق، والمحلّي لا.
    const late = new Date(2026, 9, 9, 23, 59);
    expect(localToday(late)).toBe('2026-10-09');
    expect(localToday(late)).toBe(isoDate(late));
    expect(localToday()).toBe(isoDate(new Date()));
  });
});
