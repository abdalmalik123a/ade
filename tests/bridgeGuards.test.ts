/**
 * حرّاس الجسر و`handleChecked` (A04، D70): كلّ حارسٍ يقبل ما صحّ ويرفض ما فسد برسالةٍ تسمّي المعامل ·
 * و`handleChecked` بـ`ipcMain` مزيّف يلتقط المعالج: السليم يصل المعالج كما هو، والفاسد والزائد لا يصلانه ويُرفضان برسالتهما.
 */
import { describe, expect, it, vi } from 'vitest';
import { id, listOf, oneOf, optional, text } from '../src/shared/bridgeGuards';

const handlers = vi.hoisted(() => new Map<string, (event: unknown, ...args: unknown[]) => unknown>());
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => void handlers.set(channel, listener) }
}));
const { handleChecked } = await import('../src/main/ipc/checked');

describe('حرّاس الجسر', () => {
  it('id: رقمٌ صحيحٌ موجب وحده', () => {
    expect(id(1, 'id')).toBe(1);
    expect(id(42, 'id')).toBe(42);
    for (const bad of ['1', -1, 0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, null, undefined, {}]) {
      expect(() => id(bad, 'id'), String(bad)).toThrow('المعامل «id» رقمٌ صحيحٌ موجب');
    }
  });

  it('text(max): نصٌّ بطوله — والفارغ نصّ', () => {
    const t = text(5);
    expect(t('', 'title')).toBe('');
    expect(t('سالم', 'title')).toBe('سالم');
    expect(t('١٢٣٤٥', 'title')).toBe('١٢٣٤٥');
    expect(() => t('١٢٣٤٥٦', 'title')).toThrow('المعامل «title» نصٌّ لا يزيد على 5 حرفًا');
    expect(() => t(5, 'title')).toThrow('«title»');
    expect(() => t(null, 'title')).toThrow('«title»');
  });

  it('oneOf(list): عضوٌ من القائمة وحده', () => {
    const kind = oneOf(['template', 'letterhead', 'clip'] as const);
    expect(kind('clip', 'kind')).toBe('clip');
    for (const bad of ['Template', 'templates', 'documents', '', 1, null]) {
      expect(() => kind(bad, 'kind'), String(bad)).toThrow('المعامل «kind» واحدٌ من: template، letterhead، clip');
    }
  });

  it('optional(guard): null والغائب يصيران null، وما سواهما بحارسه', () => {
    const maybe = optional(id);
    expect(maybe(null, 'parent')).toBeNull();
    expect(maybe(undefined, 'parent')).toBeNull();
    expect(maybe(7, 'parent')).toBe(7);
    expect(() => maybe('7', 'parent')).toThrow('المعامل «parent» رقمٌ صحيحٌ موجب');
  });

  it('listOf(guard, max): قائمةٌ بطولها، وكلّ عنصرٍ بحارسه ورقمه', () => {
    const ids = listOf(id, 3);
    expect(ids([], 'ids')).toEqual([]);
    expect(ids([1, 2, 3], 'ids')).toEqual([1, 2, 3]);
    expect(() => ids([1, 2, 3, 4], 'ids')).toThrow('المعامل «ids» قائمةٌ لا تزيد على 3');
    expect(() => ids('1,2', 'ids')).toThrow('«ids» قائمةٌ');
    expect(() => ids([1, -2], 'ids')).toThrow('المعامل «ids[2]» رقمٌ صحيحٌ موجب');
  });
});

describe('handleChecked', () => {
  const kinds = ['template', 'letterhead', 'clip'] as const;

  it('السليم يصل المعالج كما هو، ومعه الحدث', async () => {
    const fn = vi.fn((args: { kind: string; id: number; revision: number }, event: unknown) => ({ args, event }));
    handleChecked('test:get', { kind: oneOf(kinds), id, revision: id }, fn);
    const event = { sender: 'نافذة' };
    const out = await handlers.get('test:get')!(event, 'letterhead', 12, 3);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ args: { kind: 'letterhead', id: 12, revision: 3 }, event });
    expect(Object.keys(fn.mock.calls[0]![0])).toEqual(['kind', 'id', 'revision']);
  });

  it('والفاسد لا يصله ويُرفض برسالةٍ تسمّي القناة والمعامل', () => {
    const fn = vi.fn();
    handleChecked('test:list', { kind: oneOf(kinds), id }, fn);
    const handler = handlers.get('test:list')!;
    expect(() => handler({}, 'documents', 1)).toThrow('test:list: المعامل «kind» واحدٌ من: template، letterhead، clip');
    expect(() => handler({}, 'template', '1')).toThrow('test:list: المعامل «id» رقمٌ صحيحٌ موجب');
    expect(() => handler({}, 'template')).toThrow('test:list: المعامل «id»');
    expect(() => handler({}, 'template', 1, 2)).toThrow('test:list: معاملاتٌ زائدة — ينتظر 2 وجاءه 3');
    expect(fn).not.toHaveBeenCalled();
  });

  it('والمفتاح الرقميّ يُرفض عند التسجيل (يقلب ترتيب المعاملات)', () => {
    expect(() => handleChecked('test:bad', { name: text(9), 0: id }, () => null)).toThrow('test:bad: أسماء المعاملات حروفٌ لا أرقام');
    expect(handlers.has('test:bad')).toBe(false);
  });
});
