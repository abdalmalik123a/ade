import { describe, expect, it } from 'vitest';
import { VERSION_KEY, examDoc, examList, emptyHead, versionItems } from '../src/shared/examPaper';
import { listScore, type ListItem } from '../src/shared/doc';
import { renderDocHtml } from '../src/shared/docHtml';

const q = (id: string, score?: number, items?: ListItem[]): ListItem => ({ id, inlines: [], score, items });

const paper: ListItem[] = [
  q('س1', undefined, [q('1أ', 5), q('1ب', 5), q('1ج', 10)]),
  q('س2', 20),
  q('س3', undefined, [q('3أ', 10, [q('3أ1', 5), q('3أ2', 5)]), q('3ب', 10)])
];
const ids = (items: ListItem[]): string[] => items.flatMap((i) => [i.id, ...ids(i.items ?? [])]);

describe('نموذجا «أ» و«ب»', () => {
  it('الأسئلة بترتيبها، والفروع بترتيبٍ آخر', () => {
    const b = versionItems(paper);
    expect(b.map((i) => i.id)).toEqual(['س1', 'س2', 'س3']);
    expect(b[0]!.items!.map((i) => i.id)).not.toEqual(['1أ', '1ب', '1ج']);
    expect(b[2]!.items!.map((i) => i.id)).not.toEqual(['3أ', '3ب']);
  });

  it('ولا يضيع فرعٌ ولا تتغيّر الدرجة', () => {
    const b = versionItems(paper);
    expect(ids(b).sort()).toEqual(ids(paper).sort());
    expect(listScore(examList(b))).toBe(listScore(examList(paper)));
  });

  it('وبذرةٌ ثابتة: «ب» اليوم هو «ب» غدًا — فمفتاح التصحيح واحد', () => {
    expect(ids(versionItems(paper))).toEqual(ids(versionItems(paper)));
  });

  it('وسطر «النموذج» يُطبع حين يُملأ وحده', () => {
    const doc = examDoc(emptyHead(), examList(paper));
    expect(renderDocHtml(doc, { [VERSION_KEY]: 'ب' }, { paragraphs: 'blocks' })).toContain('النموذج: ');
    expect(renderDocHtml(doc, {}, { paragraphs: 'blocks' })).not.toContain('النموذج: ');
  });
});
