import { describe, expect, it } from 'vitest';
import { SYMBOL_GROUPS, allSymbols } from '../src/shared/symbols';

describe('لوحة الرموز كاملة', () => {
  it('فيها القسمة والكسور والأسس والأدلّة والإغريقية والأسهم والكيمياء', () => {
    const all = allSymbols();
    for (const s of ['÷', '×', '√', '½', '⅞', '²', '₂', 'π', 'Ω', 'α', 'ω', '⇌', '→', '∠', '∈', '℃'])
      expect(all).toContain(s);
    expect(all.length).toBeGreaterThan(200);
  });

  it('ولا يتكرّر رمزٌ داخل مجموعته، ولا مجموعةٌ بلا اسم', () => {
    for (const g of SYMBOL_GROUPS) {
      expect(g.name.trim()).not.toBe('');
      expect(new Set(g.symbols).size).toBe(g.symbols.length);
    }
  });
});
