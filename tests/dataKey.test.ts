/**
 * مفتاح بيانات المكتب ورمز استرداده (D237): حماية ويندوز أوّلًا، والرمز إن تعذّرت، ولا مفتاحٌ جديد بدل مفقودٍ والبيانات مشفّرة.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KeyMissingError,
  SEALED_NAME,
  acknowledge,
  createKey,
  hasKeys,
  needsAcknowledge,
  newRecoveryCode,
  normalizeCode,
  renewCode,
  storedCode,
  unlockWithCode,
  unlockWithProtector,
  type Protector
} from '../src/main/services/dataKey';

const tmp = () => mkdtempSync(join(tmpdir(), 'diwan-datakey-'));

/** حماية ويندوز مصنوعة: ما يغلّفه حسابٌ لا يفكّه غيره. */
const machine = (id: string): Protector => ({
  encrypt: (text) => Buffer.from(`${id}|${text}`),
  decrypt: (data) => {
    const s = data.toString();
    if (!s.startsWith(`${id}|`)) throw new Error('DPAPI');
    return s.slice(id.length + 1);
  }
});

describe('رمز الاسترداد', () => {
  it('ستّ مجموعاتٍ من أربعة بلا حروفٍ ملتبسة، ويُقرأ بحروفٍ صغيرة ومسافات', () => {
    for (let i = 0; i < 20; i++) expect(newRecoveryCode()).toMatch(/^([A-HJKMNP-Z2-9]{4}-){5}[A-HJKMNP-Z2-9]{4}$/);
    expect(normalizeCode(' abcd-efgh  jkmn ')).toBe('ABCDEFGHJKMN');
    // ما فوق ٢٤٧ يُرفض فلا ينحاز التوزيع.
    let calls = 0;
    const code = newRecoveryCode((n) => (calls++ === 0 ? Buffer.alloc(n, 250) : Buffer.alloc(n, 0)));
    expect(code).toBe('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA');
  });
});

describe('المفتاح', () => {
  it('يُنشأ مرّةً، ويفتحه ويندوز نفسه، ولا يفتحه حسابٌ آخر', () => {
    const dir = tmp();
    const { key, code } = createKey(dir, machine('pc1'));
    expect(hasKeys(dir)).toBe(true);
    expect(readFileSync(join(dir, 'keys.json'), 'utf8')).not.toContain(normalizeCode(code).slice(0, 8));
    expect(unlockWithProtector(dir, machine('pc1'))?.equals(key)).toBe(true);
    expect(unlockWithProtector(dir, machine('pc2'))).toBeNull();
    expect(() => createKey(dir, machine('pc1'))).toThrow(/موجود/);
  });

  it('الرمز يفتحه على ويندوز آخر ثم يُعاد تغليفه له؛ ورمزٌ خاطئ لا يغيّر شيئًا', () => {
    const dir = tmp();
    const { key, code } = createKey(dir, machine('pc1'));
    const before = readFileSync(join(dir, 'keys.json'), 'utf8');
    expect(() => unlockWithCode(dir, 'AAAA-AAAA-AAAA-AAAA-AAAA-AAAA', machine('pc2'))).toThrow(/غير صحيح/);
    expect(readFileSync(join(dir, 'keys.json'), 'utf8')).toBe(before);
    const opened = unlockWithCode(dir, code.toLowerCase().replace(/-/g, ' '), machine('pc2'));
    expect(opened.equals(key)).toBe(true);
    expect(unlockWithProtector(dir, machine('pc2'))?.equals(key)).toBe(true);
    expect(storedCode(dir, machine('pc2'))).toBe(code.toLowerCase().replace(/-/g, ' '));
  });

  it('مفقودٌ أو تالفٌ والبيانات مشفّرة: خطأٌ صريح، لا مفتاحٌ جديد', () => {
    const dir = tmp();
    writeFileSync(join(dir, SEALED_NAME), '');
    expect(() => createKey(dir, machine('pc1'))).toThrow(KeyMissingError);
    expect(hasKeys(dir)).toBe(false);
    const other = tmp();
    createKey(other, machine('pc1'));
    writeFileSync(join(other, 'keys.json'), '{"v":1');
    expect(() => unlockWithProtector(other, machine('pc1'))).toThrow(KeyMissingError);
  });

  it('رمزٌ جديد يُبطل القديم ويُعرض حتى يُقرّ المكتب بحفظه', () => {
    const dir = tmp();
    const { key, code } = createKey(dir, machine('pc1'));
    expect(needsAcknowledge(dir)).toBe(true);
    acknowledge(dir);
    expect(needsAcknowledge(dir)).toBe(false);
    const fresh = renewCode(dir, key, machine('pc1'));
    expect(fresh).not.toBe(code);
    expect(needsAcknowledge(dir)).toBe(true);
    expect(storedCode(dir, machine('pc1'))).toBe(fresh);
    expect(() => unlockWithCode(dir, code, machine('pc1'))).toThrow(/غير صحيح/);
    expect(unlockWithCode(dir, fresh, machine('pc1')).equals(key)).toBe(true);
    expect(storedCode(dir, machine('other'))).toBeNull();
  });
});
