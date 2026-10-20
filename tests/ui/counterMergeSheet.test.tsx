// @vitest-environment jsdom
/**
 * اختبار استيراد الأسماء من ملف Excel أو CSV في الشبّاك (D121 — S36 · SV-5).
 */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CounterFill, { extractNamesFromSheetText } from '../../src/renderer/src/screens/service/CounterFill';
import { emptyDoc } from '@shared/doc';
import { fakeDiwan, mount, settle } from './mount';

describe('الدمج في الشبّاك من جدول Excel أو CSV (D121 — S36)', () => {
  describe('دالّة استخلاص الأسماء extractNamesFromSheetText', () => {
    it('تستخرج الأسماء من عمود «الاسم» عند وجود ترويسة', () => {
      const tsv = 'ت\tالاسم\tالصف\n1\tزينب علي حسن\tالخامس\n2\tسالم حسن كاظم\tالخامس';
      expect(extractNamesFromSheetText(tsv)).toEqual(['زينب علي حسن', 'سالم حسن كاظم']);
    });

    it('تستخرج الأسماء من عمود «اسم الطالب» أو «اسم الموظف»', () => {
      const tsv = 'اسم الطالب\tالدرجة\nزينب علي حسن\t95\nسالم حسن كاظم\t88';
      expect(extractNamesFromSheetText(tsv)).toEqual(['زينب علي حسن', 'سالم حسن كاظم']);
    });

    it('تأخذ العمود الأول إذا لم تكن هناك ترويسة معروفة', () => {
      const tsv = 'زينب علي حسن\t1990\nسالم حسن كاظم\t1985';
      expect(extractNamesFromSheetText(tsv)).toEqual(['زينب علي حسن', 'سالم حسن كاظم']);
    });

    it('تتعامل مع ملف CSV مفصول بفوارز أو فوارز عربية', () => {
      const csv = 'الاسم,المدينة\nزينب علي حسن,بغداد\nسالم حسن كاظم,البصرة';
      expect(extractNamesFromSheetText(csv)).toEqual(['زينب علي حسن', 'سالم حسن كاظم']);
    });

    it('تتجاهل الأسطر والخلايا الفارغة وعلامات الاقتباس', () => {
      const csv = 'الاسم\n"زينب علي حسن"\n\n  \n"سالم حسن كاظم"';
      expect(extractNamesFromSheetText(csv)).toEqual(['زينب علي حسن', 'سالم حسن كاظم']);
    });

    it('تعيد مصفوفة فارغة لنص فارغ', () => {
      expect(extractNamesFromSheetText('')).toEqual([]);
      expect(extractNamesFromSheetText('   \n  ')).toEqual([]);
    });
  });

  describe('زر الاستيراد في واجهة CounterFill', () => {
    let mockReadSheet: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockReadSheet = vi.fn();
      fakeDiwan({
        files: {
          readSheet: mockReadSheet
        }
      });
    });

    it('الضغط على «من ملف Excel أو CSV» يستدعي readSheet ويلحق الأسماء المستخرجة بحقل names', async () => {
      mockReadSheet.mockResolvedValueOnce({
        name: 'قائمة_الطلاب.xlsx',
        text: 'ت\tالاسم\tالصف\n1\tأحمد عادل كريم\n2\tليلى عبد الله',
        rows: 2
      });

      const setNames = vi.fn();
      const fields: any[] = [
        { key: 'الاسم', label: 'الاسم الكامل', type: 'text', role: 'name', required: true }
      ];

      const host = mount(
        <CounterFill
          loaded={[{ summary: {} as any, detail: {} as any, doc: emptyDoc(), layout: { columns: 0, sections: [], registry: { show: false }, basmala: { show: false } } as any }]}
          fields={fields}
          values={{}}
          setValues={() => {}}
          effective={{}}
          citizenId={null}
          setPicker={() => {}}
          setPasteOpen={() => {}}
          openIdSheet={async () => {}}
          nameField={fields[0]}
          merge={true}
          setMerge={() => {}}
          names="سالم حسن كاظم"
          setNames={setNames}
          rows={['سالم حسن كاظم']}
          setMergePicker={() => {}}
          printsRegistry={false}
          letterNo=""
          setLetterNo={() => {}}
          needsGender={false}
          genderByHand={false}
          setGenderByHand={() => {}}
          schoolOn={false}
          setSchoolPicker={() => {}}
          schoolNameKey={null}
          schools={[]}
          fillFromSchool={() => {}}
          schoolFilled={{ current: {} }}
          registry={{ number: '', date: '' }}
          resolveHead={(t) => t}
        />
      );
      await settle();

      const btn = host.querySelector('button[data-act="merge-sheet"]') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('من ملف Excel أو CSV');

      await act(async () => {
        btn.click();
      });
      await settle();

      expect(mockReadSheet).toHaveBeenCalled();
      expect(setNames).toHaveBeenCalled();
      const updater = setNames.mock.calls[0][0];
      const result = typeof updater === 'function' ? updater('سالم حسن كاظم') : updater;
      expect(result).toBe('سالم حسن كاظم\nأحمد عادل كريم\nليلى عبد الله');
    });

    it('إلغاء حوار فتح الملف لا يغيّر الأسماء', async () => {
      mockReadSheet.mockResolvedValueOnce(null);

      const setNames = vi.fn();
      const fields: any[] = [
        { key: 'الاسم', label: 'الاسم الكامل', type: 'text', role: 'name', required: true }
      ];

      const host = mount(
        <CounterFill
          loaded={[{ summary: {} as any, detail: {} as any, doc: emptyDoc(), layout: { columns: 0, sections: [], registry: { show: false }, basmala: { show: false } } as any }]}
          fields={fields}
          values={{}}
          setValues={() => {}}
          effective={{}}
          citizenId={null}
          setPicker={() => {}}
          setPasteOpen={() => {}}
          openIdSheet={async () => {}}
          nameField={fields[0]}
          merge={true}
          setMerge={() => {}}
          names=""
          setNames={setNames}
          rows={[]}
          setMergePicker={() => {}}
          printsRegistry={false}
          letterNo=""
          setLetterNo={() => {}}
          needsGender={false}
          genderByHand={false}
          setGenderByHand={() => {}}
          schoolOn={false}
          setSchoolPicker={() => {}}
          schoolNameKey={null}
          schools={[]}
          fillFromSchool={() => {}}
          schoolFilled={{ current: {} }}
          registry={{ number: '', date: '' }}
          resolveHead={(t) => t}
        />
      );
      await settle();

      const btn = host.querySelector('button[data-act="merge-sheet"]') as HTMLButtonElement;
      await act(async () => {
        btn.click();
      });
      await settle();

      expect(mockReadSheet).toHaveBeenCalled();
      expect(setNames).not.toHaveBeenCalled();
    });
  });
});
