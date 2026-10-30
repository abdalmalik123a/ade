import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareVersions } from '../src/shared/version';
import { changesBetween, parseChangelog } from '../src/shared/changelog';

/** أرقام الإصدار أرقامًا لا نصًّا — فلا يُسترجع في ١٫٩ ما أُخذ بـ١٫١٠ (خطة Production، ٤٫٢). */
describe('مقارنة الإصدارات', () => {
  it('أرقامًا لا نصًّا، والناقص صفر، والوسم يُهمل', () => {
    expect(compareVersions('1.10.0', '1.9.3')).toBe(1);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.0.0-beta.2', '1.0.0')).toBe(0);
    expect(compareVersions('0.1.0', '1.0.0')).toBe(-1);
  });
});

describe('«ما الجديد» من سجلّ التغييرات', () => {
  const md = '# سجلّ\r\n\r\n## 1.2.0 — كانون\r\n\r\n- ثالث\r\n\r\n## 1.1.0\r\n- ثانٍ\r\n## 1.0.0 — الأوّل\r\n- أوّل\r\n';
  it('أقسامٌ بإصداراتها، وما بين الإصدارين وحده أحدثه أوّلًا', () => {
    const all = parseChangelog(md);
    expect(all.map((e) => e.version)).toEqual(['1.2.0', '1.1.0', '1.0.0']);
    expect(all[0]).toEqual({ version: '1.2.0', title: '1.2.0 — كانون', body: '- ثالث' });
    expect(changesBetween(all, '1.0.0', '1.2.0').map((e) => e.version)).toEqual(['1.2.0', '1.1.0']);
    expect(changesBetween(all, '1.1.0', '1.1.0')).toEqual([]);
  });

  // كان ١٫٨٫٠ ثابتًا حين كان ١٫٩٫٠ القادم (D189)؛ وصار «الإصدار الذي قبله» منذ 2.0.0 (D242) — والمعنى نفسه.
  it('وCHANGELOG.md الحقيقيّ: أعلاه قسم الإصدار القادم بعد الذي قبله ببنوده، فيُعرض «ما الجديد» عند الترقية (D189)', () => {
    const all = parseChangelog(readFileSync(join(__dirname, '..', 'CHANGELOG.md'), 'utf8'));
    expect(compareVersions(all[0]!.version, all[1]!.version)).toBe(1);
    expect(all[0]!.body.split('\n').filter((l) => l.startsWith('- ')).length).toBeGreaterThanOrEqual(10);
    expect(changesBetween(all, all[1]!.version, all[0]!.version).map((e) => e.version)).toEqual([all[0]!.version]);
  });

  it('والقسم الأعلى إصدار package.json نفسه — فلا يُبنى إصدارٌ بلا «ما الجديد» (D242)', () => {
    const all = parseChangelog(readFileSync(join(__dirname, '..', 'CHANGELOG.md'), 'utf8'));
    const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string };
    expect(all[0]!.version).toBe(version);
  });
});
