import { describe, expect, it } from 'vitest';
import { SHORTCUTS, isCombo, shortcut } from '../src/shared/shortcuts';

const press = (code: string, key: string, mods: { ctrl?: boolean; shift?: boolean } = {}) => ({
  code,
  key,
  ctrlKey: Boolean(mods.ctrl),
  shiftKey: Boolean(mods.shift)
});

describe('الاختصارات الثابتة', () => {
  it('تعمل ولوحة المفاتيح عربية: Ctrl+F تصل «ب» فتُعرف بموضعها', () => {
    expect(isCombo(press('KeyF', 'ب', { ctrl: true }), shortcut('search').combo)).toBe(true);
    expect(isCombo(press('KeyF', 'f', { ctrl: true }), shortcut('search').combo)).toBe(true);
    expect(isCombo(press('KeyK', 'ن', { ctrl: true }), shortcut('palette').combo)).toBe(true);
  });

  it('ولا تخلط: F بلا Ctrl كتابةٌ لا بحث، وShift يغيّر الاختصار', () => {
    expect(isCombo(press('KeyF', 'ب'), shortcut('search').combo)).toBe(false);
    expect(isCombo(press('KeyF', 'F', { ctrl: true, shift: true }), shortcut('search').combo)).toBe(false);
    expect(isCombo(press('F2', 'F2'), shortcut('citizen').combo)).toBe(true);
  });

  it('ولكلّ اختصارٍ زرٌّ ظاهر يُسمّى، والمعرّفات لا تتكرّر', () => {
    for (const s of SHORTCUTS) expect(s.button.trim()).not.toBe('');
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
    expect(() => shortcut('لا وجود له')).toThrow();
  });
});
