// @vitest-environment jsdom
/**
 * اختصارات التنقل Tab وEnter في الشبّاك وحصر Tab داخل الورقة (D117 — S04):
 * - الضغط على Enter في حقل بحث «هات الزبون» يختار أول زبون مطابق.
 * - الضغط على Enter في حقل بحث النماذج يختار أول نموذج.
 * - مفاتيح الأسهم تتنقل بين بطاقات الخدمات والأكثر استخدامًا.
 * - الضغط المتكرّر على Tab في ورقة الإدخال يدور داخل عناصرها ولا يخرج.
 */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CitizenPicker } from '../../src/renderer/src/screens/ServicePickers';
import CounterPick from '../../src/renderer/src/screens/service/CounterPick';
import CounterFill from '../../src/renderer/src/screens/service/CounterFill';
import { fakeDiwan, mount, settle } from './mount';
import { emptyDoc } from '@shared/doc';

describe('اختصارات التنقل في الشبّاك (D117 — S04)', () => {
  beforeEach(() => {
    fakeDiwan({
      inbox: {
        list: async () => []
      },
      citizens: {
        list: async ({ query }: { query: string }) => {
          const all = [
            { id: 1, fullName: 'زينب علي حسن', nationalId: '199012345678' },
            { id: 2, fullName: 'سالم حسن كاظم', nationalId: '198598765432' }
          ];
          if (!query) return all;
          return all.filter((c) => c.fullName.includes(query) || c.nationalId?.includes(query));
        }
      }
    });
  });

  it('الضغط على Enter في حقل بحث «هات الزبون» يختار أول نتيجة مطابقة فورًا', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const host = mount(<CitizenPicker onClose={onClose} onPick={onPick} />);
    await settle();
    await settle();

    const input = host.querySelector('input[type="search"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    // نكتب اسم للبحث
    act(() => {
      input.value = 'زينب';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    await settle();

    // نضغط Enter في حقل البحث
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });

    expect(onPick).toHaveBeenCalledWith(1);
  });

  it('الضغط على Enter في حقل بحث النماذج في الشبّاك يختار أول نموذج مطابق', async () => {
    const toggle = vi.fn();
    const searchRef = { current: null };
    const sampleTemplate: any = {
      id: 42,
      code: 'T01',
      title: 'استمارة تأييد استمرار',
      subtitle: null,
      category: 'تأييدات',
      printCount: 5,
      updatedAt: '2026-10-20'
    };

    const host = mount(
      <CounterPick
        after={null}
        setAfter={() => {}}
        reprintAfter={async () => {}}
        pdfAfter={async () => {}}
        sameCustomer={() => {}}
        settings={null}
        query="تأييد"
        setQuery={() => {}}
        items={[sampleTemplate]}
        categories={[]}
        activeCategory={null}
        setActiveCategory={() => {}}
        topFavorites={[]}
        shown={[sampleTemplate]}
        ordered={[sampleTemplate]}
        picked={[]}
        toggle={toggle}
        searchRef={searchRef}
        citizenId={null}
        onOpenTool={() => {}}
        onOpenFile={async () => {}}
        active={true}
        step="pick"
        newCitizen={null}
        setNewCitizen={() => {}}
        saveNewCitizen={async () => {}}
        parked={[]}
        resume={async () => {}}
        dropParked={() => {}}
      />
    );
    await settle();

    const searchInput = host.querySelector('input[data-counter-search]') as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    act(() => {
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });

    expect(toggle).toHaveBeenCalledWith(42);
  });

  it('مفاتيح الأسهم تتنقل بين بطاقات الخدمات في الشبّاك', async () => {
    const searchRef = { current: null };
    const host = mount(
      <CounterPick
        after={null}
        setAfter={() => {}}
        reprintAfter={async () => {}}
        pdfAfter={async () => {}}
        sameCustomer={() => {}}
        settings={null}
        query=""
        setQuery={() => {}}
        items={[]}
        categories={[]}
        activeCategory={null}
        setActiveCategory={() => {}}
        topFavorites={[]}
        shown={[]}
        ordered={[]}
        picked={[]}
        toggle={() => {}}
        searchRef={searchRef}
        citizenId={null}
        onOpenTool={() => {}}
        onOpenFile={async () => {}}
        active={true}
        step="pick"
        newCitizen={null}
        setNewCitizen={() => {}}
        saveNewCitizen={async () => {}}
        parked={[]}
        resume={async () => {}}
        dropParked={() => {}}
      />
    );
    await settle();

    const cardsContainer = host.querySelector('[data-cards]') as HTMLElement;
    expect(cardsContainer).not.toBeNull();
    const buttons = Array.from(cardsContainer.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(1);

    // التركيز على أول بطاقة
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);

    // ضغط سهم يسار للانتقال للتالية
    act(() => {
      cardsContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(buttons[1]);

    // ضغط سهم يمين للرجوع للأولى
    act(() => {
      cardsContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('الضغط على Tab في آخر عنصر داخل ورقة الإدخال يدور إلى أول عنصر ولا يخرج (focus trap)', async () => {
    const fields: any[] = [
      { key: 'الاسم', label: 'الاسم الكامل', type: 'text', role: 'name', required: true },
      { key: 'ملاحظات', label: 'ملاحظات إضافية', type: 'text' }
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
        merge={false}
        setMerge={() => {}}
        names=""
        setNames={() => {}}
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

    const form = host.querySelector('[data-fill-form]') as HTMLElement;
    expect(form).not.toBeNull();

    const focusable = Array.from(
      form.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
      )
    );
    expect(focusable.length).toBeGreaterThan(1);

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // نضع التركيز على آخر عنصر في النموذج
    last.focus();
    expect(document.activeElement).toBe(last);

    // نضغط Tab
    act(() => {
      form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    // يجب أن يدور التركيز إلى أول عنصر
    expect(document.activeElement).toBe(first);

    // نضغط Shift+Tab من أول عنصر
    act(() => {
      form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    });
    // يجب أن يدور التركيز إلى آخر عنصر
    expect(document.activeElement).toBe(last);
  });
});
