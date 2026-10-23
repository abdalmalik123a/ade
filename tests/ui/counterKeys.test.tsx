// @vitest-environment jsdom
/**
 * اختصارات التنقل Tab وEnter في الشبّاك وحصر Tab داخل الورقة (D117 — S04):
 * - الضغط على Enter في حقل بحث «هات الزبون» يختار أول زبون مطابق.
 * - الضغط على Enter في حقل بحث النماذج يختار أول نموذج.
 * - مفاتيح الأسهم تتنقل بين بطاقات الخدمات والأكثر استخدامًا.
 * - الضغط المتكرّر على Tab في ورقة الإدخال يدور داخل عناصرها ولا يخرج — ومعها شريط القرار: «راجع الأوراق» و«اطبع» (D138).
 */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CitizenPicker } from '../../src/renderer/src/screens/ServicePickers';
import CounterPick from '../../src/renderer/src/screens/service/CounterPick';
import CounterFill, { tabStops, trapTab } from '../../src/renderer/src/screens/service/CounterFill';
import DecisionBar from '../../src/renderer/src/screens/service/DecisionBar';
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

  /** شريط القرار بلا شيءٍ يُصدر — لا يُضغط فيه إلا Tab. */
  const bar = (step: 'fill' | 'review') => (
    <DecisionBar
      step={step} setStep={() => {}} busy={false} picked={[1]} goFill={async () => {}} setAt={() => {}} park={() => {}} discardTransaction={() => {}}
      valuesOnly={false} setValuesOnly={() => {}} merge={false} rows={[]} loaded={[]} missing={[]} genderUnsure={false} citizenName=""
      setGenderByHand={() => {}} setValues={() => {}} settings={null} copies={1} setCopies={() => {}} blocked={false} issue={async () => {}}
    />
  );
  /** يضغط Tab (أو Shift+Tab) حيث التركيز، و`trapTab` على النافذة كما تسجّله `ServiceScreen` — ويعيد الحدث. */
  function press(root: HTMLElement, shiftKey = false): KeyboardEvent {
    const onTab = (e: KeyboardEvent) => trapTab(e, root);
    window.addEventListener('keydown', onTab);
    const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    act(() => {
      (document.activeElement ?? document.body).dispatchEvent(ev);
    });
    window.removeEventListener('keydown', onTab);
    return ev;
  }

  it('Tab في «املأ» يدور على الورقة وشريط القرار معًا: من آخر حقلٍ إلى «راجع الأوراق» ثم إلى الأوّل — كان محصورًا في الورقة (D138)', async () => {
    const fields: any[] = [
      { key: 'الاسم', label: 'الاسم الكامل', type: 'text', role: 'name', required: true },
      { key: 'ملاحظات', label: 'ملاحظات إضافية', type: 'text' }
    ];

    const host = mount(
      <div data-trap="">
        <CounterFill
          loaded={[{ summary: {} as any, detail: {} as any, doc: emptyDoc(), layout: { columns: 0, sections: [], registry: { show: false }, basmala: { show: false } } as any }]}
          fields={fields} values={{}} setValues={() => {}} effective={{}} citizenId={null} setPicker={() => {}} setPasteOpen={() => {}}
          openIdSheet={async () => {}} nameField={fields[0]} merge={false} setMerge={() => {}} names="" setNames={() => {}} rows={[]}
          setMergePicker={() => {}} printsRegistry={false} letterNo="" setLetterNo={() => {}} needsGender={false} genderByHand={false}
          setGenderByHand={() => {}} schoolOn={false} setSchoolPicker={() => {}} schoolNameKey={null} schools={[]} fillFromSchool={() => {}}
          schoolFilled={{ current: {} }} registry={{ number: '', date: '' }} resolveHead={(t) => t}
        />
        {/* «راجع» في «املأ» مخفيّةٌ بصنفها كما في `CounterReview` — كانت ستصير آخرَ الدورة فلا يُبلغ الشريط */}
        <div className="hidden">
          <button type="button">الورقة التالية</button>
        </div>
        {bar('fill')}
      </div>
    );
    await settle();

    const root = host.querySelector('[data-trap]') as HTMLElement;
    const form = root.querySelector('[data-fill-form]') as HTMLElement;
    const stops = tabStops(root);
    const review = stops.find((el) => el.textContent?.includes('راجع الأوراق'))!;
    const inForm = stops.filter((el) => form.contains(el));
    const lastField = inForm[inForm.length - 1]!;
    expect(inForm.length).toBeGreaterThan(1);
    // بعد آخر حقلٍ أزرار الشريط وحدها، وآخرها «راجع الأوراق» — لا المخفيّ.
    expect(stops[stops.length - 1]).toBe(review);
    expect(stops.slice(stops.indexOf(lastField) + 1).every((el) => !form.contains(el))).toBe(true);
    expect(stops.some((el) => el.textContent?.includes('الورقة التالية'))).toBe(false);

    // من آخر حقل: المتصفّح يمضي إلى الشريط كعادته (لا منع)، ومن «راجع الأوراق» يعود إلى الأوّل.
    lastField.focus();
    expect(press(root).defaultPrevented).toBe(false);
    review.focus();
    expect(press(root).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(stops[0]);
    expect(form.contains(document.activeElement)).toBe(true);

    // Shift+Tab من الأوّل ← «راجع الأوراق».
    press(root, true);
    expect(document.activeElement).toBe(review);

    // والتركيز الضائع على الصفحة يعود إلى الحاوية لا إلى السكّة — إلا ونافذةٌ مفتوحة.
    review.blur();
    press(root);
    expect(document.activeElement).toBe(stops[0]);
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('role', 'dialog');
    (document.activeElement as HTMLElement).blur();
    expect(press(root).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(document.body);
    dialog.remove();
  });

  it('وفي «راجع» كذلك: آخر الدورة «اطبع»، وبعده الأوّل (D138)', async () => {
    const host = mount(
      <div data-trap="">
        <button type="button">الورقة السابقة</button>
        {bar('review')}
      </div>
    );
    await settle();
    const root = host.querySelector('[data-trap]') as HTMLElement;
    const stops = tabStops(root);
    const print = stops[stops.length - 1]!;
    expect(print.textContent).toContain('اطبع');
    print.focus();
    press(root);
    expect(document.activeElement?.textContent).toBe('الورقة السابقة');
    press(root, true);
    expect(document.activeElement).toBe(print);
  });
});
