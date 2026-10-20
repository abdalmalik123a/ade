// @vitest-environment jsdom
/**
 * ضبط انتقال «اكتبه على ورقة فارغة» ومحليّة إخفاء أسماء الملفّات (D128 — S16):
 * ١. البحث في الشبّاك ثم نقر «اكتبه على ورقة فارغة» لا يُمرّر استعلام البحث نوعًا للكتاب (docType فارغ).
 * ٢. openCounterTool مع { route: 'editor' } يفتح المحرّر بـ openEditor({}) خالية من أيّ نوع كتاب.
 * ٣. تفضيل إخفاء أسماء الملفّات في InboxPanel محليٌّ في localStorage ولا يتسرّب إلى إعدادات المكتب.
 * ٤. استرجاع تفضيل الإخفاء من localStorage عند إعادة فتح اللوحة دون لمس قاعدة البيانات.
 */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CounterPick from '../../src/renderer/src/screens/service/CounterPick';
import InboxPanel from '../../src/renderer/src/components/InboxPanel';
import { openCounterTool, type CounterToolContext } from '../../src/renderer/src/shell/counterTools';
import { fakeDiwan, mount, settle } from './mount';
import { draftTitle } from '@shared/letterDraft';
import { emptyDoc, paragraph, run } from '@shared/doc';

describe('ضبط ورقة فارغة ومحلية إخفاء الأسماء (D128 — S16)', () => {
  beforeEach(() => {
    localStorage.clear();
    fakeDiwan({
      inbox: {
        list: async () => [
          { id: 1, name: 'هوية سالم حسن.pdf', kind: 'pdf', source: 'downloads', modified: new Date().toISOString() },
          { id: 2, name: 'صورة شخصية.jpg', kind: 'image', source: 'desktop', modified: new Date().toISOString() }
        ]
      },
      settings: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => ({}))
      }
    });
  });

  it('البحث في الشبّاك بلا نتيجة يُظهر «اكتبه على ورقة فارغة» وينادي onOpenTool بـ route editor بلا استعلام', async () => {
    const onOpenTool = vi.fn();
    const setQuery = vi.fn();
    const searchRef = { current: null };

    const host = mount(
      <CounterPick
        after={null}
        setAfter={vi.fn()}
        reprintAfter={vi.fn()}
        pdfAfter={vi.fn()}
        sameCustomer={vi.fn()}
        settings={null}
        query="طلب سلفة مالية"
        setQuery={setQuery}
        items={[]}
        categories={[]}
        activeCategory={null}
        setActiveCategory={vi.fn()}
        topFavorites={[]}
        shown={[]}
        ordered={[]}
        picked={[]}
        toggle={vi.fn()}
        searchRef={searchRef}
        citizenId={12}
        onOpenTool={onOpenTool}
        onOpenFile={vi.fn()}
        active={true}
        step="pick"
        newCitizen={null}
        setNewCitizen={vi.fn()}
        saveNewCitizen={vi.fn()}
        parked={[]}
        resume={vi.fn()}
        dropParked={vi.fn()}
      />
    );

    await settle();

    // التحقق من ظهور زر اكتبه على ورقة فارغة
    const blankBtn = host.querySelector('[data-act="counter-blank"]') as HTMLButtonElement;
    expect(blankBtn).not.toBeNull();

    act(() => {
      blankBtn.click();
    });

    // التأكد من استدعاء onOpenTool مع { route: 'editor' } و citizenId فقط دون تمرير نص البحث
    expect(onOpenTool).toHaveBeenCalledTimes(1);
    expect(onOpenTool).toHaveBeenCalledWith({ route: 'editor' }, 12);
  });

  it('openCounterTool يُمرّر كائنًا فارغًا إلى openEditor({}) ولا يحمل أي نوع للوثيقة', () => {
    const setToolCustomer = vi.fn();
    const openEditor = vi.fn();
    const setOrderRequest = vi.fn();
    const navigate = vi.fn();
    const setIdDuplexOpen = vi.fn();
    const setIdSheetOpen = vi.fn();

    const ctx: CounterToolContext = {
      setToolCustomer,
      openEditor,
      setOrderRequest,
      navigate,
      setIdDuplexOpen,
      setIdSheetOpen
    };

    openCounterTool({ route: 'editor' }, 15, ctx);

    expect(setToolCustomer).toHaveBeenCalledWith(15);
    expect(openEditor).toHaveBeenCalledWith({});
    expect(openEditor).toHaveBeenCalledTimes(1);
  });

  it('docType الفارغ يجعل عنوان المسودة يشتق من موضوع الورقة ولا يتقيد ببحث الشبّاك السابق', () => {
    const doc = emptyDoc();
    doc.blocks = [
      paragraph([run('إلى / مديرية المرور العامة')]),
      paragraph([run('م / طلب تجديد إجازة سوق')]),
      paragraph([run('يرجى التفضل بالموافقة...')])
    ];

    // لو كان docType فارغًا (كما ينبغي للورقة الفارغة)
    const cleanTitle = draftTitle({ docType: '', owner: '', doc, values: {} });
    expect(cleanTitle).toBe('طلب تجديد إجازة سوق');

    // لو تسربت كلمة بحث الشبّاك كـ docType لطمست موضوع الكتاب الحقيقي
    const leakedTitle = draftTitle({ docType: 'طلب سلفة', owner: '', doc, values: {} });
    expect(leakedTitle).toBe('طلب سلفة');
  });

  it('زر إخفاء أسماء الملفات في InboxPanel يحفظ في localStorage ولا يمس OfficeSettings', async () => {
    const onOpen = vi.fn();
    const host = mount(<InboxPanel active={true} onOpen={onOpen} />);
    await settle();
    await settle();

    const toggleBtn = host.querySelector('[data-act="inbox-names"]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('diwan.inbox.hideNames')).toBeNull();

    // النقر لإخفاء الأسماء
    act(() => {
      toggleBtn.click();
    });
    await settle();

    expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('diwan.inbox.hideNames')).toBe('1');

    // التأكد من استبدال الاسم بـ «ملفّ PDF»
    const hiddenLabel = host.querySelector('[data-name-hidden]');
    expect(hiddenLabel).not.toBeNull();
    expect(hiddenLabel?.textContent?.trim()).toBe('ملفّ PDF');

    // النقر مجددًا لإظهار الأسماء
    act(() => {
      toggleBtn.click();
    });
    await settle();

    expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('diwan.inbox.hideNames')).toBeNull();

    // التحقق التام من عدم استدعاء إعدادات المكتب المشتركة
    const settingsApi = (window as any).diwan.settings;
    expect(settingsApi.set).not.toHaveBeenCalled();
  });

  it('إعادة فتح InboxPanel تستعيد حالة الإخفاء المحفوظة في localStorage تلقائيًّا', async () => {
    localStorage.setItem('diwan.inbox.hideNames', '1');

    const host = mount(<InboxPanel active={true} onOpen={vi.fn()} />);
    await settle();
    await settle();

    const toggleBtn = host.querySelector('[data-act="inbox-names"]') as HTMLButtonElement;
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');

    const hiddenLabel = host.querySelector('[data-name-hidden]');
    expect(hiddenLabel).not.toBeNull();
    expect(hiddenLabel?.textContent?.trim()).toBe('ملفّ PDF');
  });
});
