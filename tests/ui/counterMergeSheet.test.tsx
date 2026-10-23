// @vitest-environment jsdom
/**
 * اختبار استيراد الأسماء من ملف Excel أو CSV في الشبّاك (D121 — S36 · SV-5)، وعمود الاسم كما يعرفه الاستيراد،
 * والجنس من الزبون المختار (D137).
 */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CounterFill from '../../src/renderer/src/screens/service/CounterFill';
import { namesFromSheet } from '../../src/renderer/src/screens/service/sheetNames';
import { useFillDerived } from '../../src/renderer/src/screens/service/useFillDerived';
import { emptyDoc } from '@shared/doc';
import { GENDER_KEY } from '@shared/gender';
import { fakeDiwan, mount, settle } from './mount';

describe('الدمج في الشبّاك من جدول Excel أو CSV (D121 — S36)', () => {
  describe('أسماء الملفّ namesFromSheet — بقارئ الاستيراد (D137)', () => {
    const two = ['زينب علي حسن', 'سالم حسن كاظم'];

    it('تستخرج الأسماء من عمود «الاسم» عند وجود ترويسة', () => {
      const tsv = 'ت\tالاسم\tالصف\n1\tزينب علي حسن\tالخامس\n2\tسالم حسن كاظم\tالخامس';
      expect(namesFromSheet(tsv)).toEqual(two);
    });

    it('«الإسم» بالهمزة و«الأسم» و«الاسم الثلاثي» و«اسم الطالبة» أسماء، و«ت» أوّلًا لا يُؤخذ — كانت «ت ١ ٢»', () => {
      expect(namesFromSheet('ت\tالإسم\tالصف\n1\tزينب علي حسن\tالخامس\n2\tسالم حسن كاظم\tالخامس')).toEqual(two);
      expect(namesFromSheet('ت\tالأسم\n١\tزينب علي حسن\n٢\tسالم حسن كاظم')).toEqual(two);
      expect(namesFromSheet('ت\tالاسم الثلاثي\tالدرجة\n1\tزينب علي حسن\t95\n2\tسالم حسن كاظم\t88')).toEqual(two);
      expect(namesFromSheet('اسم الطالبة\tالصف\nزينب علي حسن\tالخامس\nليلى عبد الله حسن\tالخامس')).toEqual(['زينب علي حسن', 'ليلى عبد الله حسن']);
    });

    it('تستخرج الأسماء من عمود «اسم الطالب» أو «اسم الموظف» — لا «اسم المدرسة»', () => {
      expect(namesFromSheet('اسم الطالب\tالدرجة\nزينب علي حسن\t95\nسالم حسن كاظم\t88')).toEqual(two);
      expect(namesFromSheet('اسم المدرسة\tاسم الموظف\nمدرسة النور\tزينب علي حسن\nمدرسة النور\tسالم حسن كاظم')).toEqual(two);
    });

    it('والاسم المفرّق في أعمدة يُجمع اسمًا واحدًا', () => {
      expect(namesFromSheet('الاسم\tاسم الأب\tاسم الجد\nزينب\tعلي\tحسن\nسالم\tحسن\tكاظم')).toEqual(two);
    });

    it('بلا ترويسة: أوّل عمودٍ ليس أرقامًا — و«جاسم» أوّل القائمة اسمٌ لا عنوان', () => {
      expect(namesFromSheet('زينب علي حسن\t1990\nسالم حسن كاظم\t1985')).toEqual(two);
      expect(namesFromSheet('1\tجاسم محمد علي\tالخامس\n2\tزينب علي حسن\tالخامس')).toEqual(['جاسم محمد علي', 'زينب علي حسن']);
      expect(namesFromSheet('قاسم علي حسن\nزينب علي حسن')).toEqual(['قاسم علي حسن', 'زينب علي حسن']);
    });

    it('وعنوانٌ لم يُعرف فوق عمود أرقام («ت» فوق ١، ٢) سطر عناوين يُترك', () => {
      expect(namesFromSheet('ت\tالطالب\tالصف\n1\tزينب علي حسن\tالخامس\n2\tسالم حسن كاظم\tالخامس')).toEqual(two);
    });

    it('وCSV يصل بالجدولة كما يصل Excel (exceljs يقرؤه)، وتُترك الأسطر الفارغة وعلامات الاقتباس', () => {
      expect(namesFromSheet('الاسم\tالمدينة\nزينب علي حسن\tبغداد\nسالم حسن كاظم\tالبصرة')).toEqual(two);
      expect(namesFromSheet('الاسم\n"زينب علي حسن"\n\n  \n"سالم حسن كاظم"')).toEqual(two);
    });

    it('ورأس الجمع «أسماء الطلبة» و«الأسماء» عنوانٌ بلا عمود «ت» — كان يدخل اسمًا؛ و«أسماء علي حسن» أوّل قائمةٍ بلا عنوان اسمٌ (D138)', () => {
      expect(namesFromSheet('أسماء الطلبة\tالصف\nزينب علي حسن\tالخامس\nسالم حسن كاظم\tالخامس')).toEqual(two);
      expect(namesFromSheet('الأسماء\nزينب علي حسن\nسالم حسن كاظم')).toEqual(two);
      expect(namesFromSheet('قائمة أسماء الموظفين\nزينب علي حسن\nسالم حسن كاظم')).toEqual(two);
      expect(namesFromSheet('أسماء علي حسن\nزينب علي حسن')).toEqual(['أسماء علي حسن', 'زينب علي حسن']);
      expect(namesFromSheet('أسماء طالب حسن\tالخامس\nزينب علي حسن\tالخامس')).toEqual(['أسماء طالب حسن', 'زينب علي حسن']);
    });

    it('تعيد مصفوفة فارغة لنصٍّ فارغ أو أعمدةٍ كلّها أرقام', () => {
      expect(namesFromSheet('')).toEqual([]);
      expect(namesFromSheet('   \n  ')).toEqual([]);
      expect(namesFromSheet('1\t95\n2\t88')).toEqual([]);
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

  describe('ملفّ الأسماء الذي لا يُقرأ أو الفارغ يُقال تحت الزرّ (D137)', () => {
    const fields: any[] = [{ key: 'الاسم', label: 'الاسم الكامل', type: 'text', role: 'name', required: true }];
    /** يضغط «من ملف Excel أو CSV» بما يعيده الجسر، ويعيد الرسالة تحته. */
    async function pick(readSheet: ReturnType<typeof vi.fn>, setNames: any): Promise<string | null> {
      fakeDiwan({ files: { readSheet } });
      const host = mount(
        <CounterFill
          loaded={[{ summary: {} as any, detail: {} as any, doc: emptyDoc(), layout: { columns: 0, sections: [], registry: { show: false }, basmala: { show: false } } as any }]}
          fields={fields} values={{}} setValues={() => {}} effective={{}} citizenId={null} setPicker={() => {}} setPasteOpen={() => {}}
          openIdSheet={async () => {}} nameField={fields[0]} merge={true} setMerge={() => {}} names="" setNames={setNames} rows={[]}
          setMergePicker={() => {}} printsRegistry={false} letterNo="" setLetterNo={() => {}} needsGender={false} genderByHand={false}
          setGenderByHand={() => {}} schoolOn={false} setSchoolPicker={() => {}} schoolNameKey={null} schools={[]} fillFromSchool={() => {}}
          schoolFilled={{ current: {} }} registry={{ number: '', date: '' }} resolveHead={(t) => t}
        />
      );
      await settle();
      await act(async () => {
        host.querySelector<HTMLButtonElement>('button[data-act="merge-sheet"]')!.click();
      });
      await settle();
      return host.querySelector('[data-merge-sheet-error]')?.textContent ?? null;
    }

    it('`.xls` القديم: سببه بلا بادئة الجسر، والأسماء كما هي — كان استثناءً غير ممسوك بلا رسالة', async () => {
      const why = 'هذا ملف Excel بصيغةٍ قديمة (.xls) — افتحه في Excel واحفظه .xlsx («حفظ باسم») ثم افتحه هنا';
      const setNames = vi.fn();
      const readSheet = vi.fn().mockRejectedValueOnce(new Error(`Error invoking remote method 'files:readSheet': Error: ${why}`));
      expect(await pick(readSheet, setNames)).toBe(why);
      expect(setNames).not.toHaveBeenCalled();
    });

    it('والفارغ يُقال باسمه، والذي أعمدته أرقامٌ كذلك', async () => {
      const setNames = vi.fn();
      expect(await pick(vi.fn().mockResolvedValueOnce({ name: 'قائمة.xlsx', text: '', rows: 0 }), setNames)).toBe('«قائمة.xlsx» فارغ — لا صفوف فيه');
      expect(await pick(vi.fn().mockResolvedValueOnce({ name: 'درجات.xlsx', text: '1\t95\n2\t88', rows: 2 }), setNames)).toContain('لا عمود أسماءٍ في «درجات.xlsx»');
      expect(setNames).not.toHaveBeenCalled();
    });
  });
});

describe('الجنس المحفوظ من الزبون المختار لا من البحث بالاسم (D137 — S03)', () => {
  const nour = [
    { id: 1, fullName: 'نور علي حسن', gender: 'ذكر' },
    { id: 2, fullName: 'نور علي حسن', gender: 'أنثى' }
  ];
  /** يركّب `useFillDerived` باسمٍ على الورقة وزبونٍ مختار، ويعيد الجنس الذي يملؤه — والبحث بالاسم يجد الاثنين. */
  async function genderFor(name: string, citizenId: number | null): Promise<string | undefined> {
    fakeDiwan({
      citizens: {
        list: vi.fn(async () => nour.map(({ id, fullName }) => ({ id, fullName }))),
        get: vi.fn(async (id: number) => nour.find((c) => c.id === id) ?? null)
      }
    });
    let values: Record<string, string> = { الاسم: name };
    const setValues = (u: any) => {
      values = typeof u === 'function' ? u(values) : u;
    };
    const fields: any[] = [{ key: 'الاسم', label: 'الاسم', type: 'text', role: 'name', required: true }];
    function Probe() {
      useFillDerived({ fields, values: { الاسم: name }, letterNo: '', loaded: [], needsGender: true, genderByHand: false, learned: {}, setValues, names: '', citizenId });
      return null;
    }
    mount(<Probe />);
    await settle();
    await settle();
    return values[GENDER_KEY];
  }

  it('زبونان باسمٍ واحد «نور علي حسن»: المختار الثاني أنثى والأوّل ذكر — كان يُؤخذ أوّلهما', async () => {
    expect(await genderFor('نور علي حسن', 2)).toBe('أنثى');
    expect(await genderFor('نور علي حسن', 1)).toBe('ذكر');
  });

  it('وبلا زبونٍ مختار، أو باسمٍ على الورقة غير اسمه: التخمين من الاسم', async () => {
    expect(await genderFor('محمد علي حسن', 2)).toBe('ذكر');
    expect(await genderFor('زينب علي حسن', null)).toBe('أنثى');
  });
});
