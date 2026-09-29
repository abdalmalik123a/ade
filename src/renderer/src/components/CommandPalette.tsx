/**
 * شريط الأوامر والبحث الشامل السريع (Omni Command Palette - Ctrl+K).
 *
 * يتيح للموظف والمشغل في المكتب الوصول السريع والفوري إلى:
 * ١. كافة شاشات البرنامج وأقسامه بنقرة زر أو كتابة حرفين.
 * ٢. البحث المباشر في سجل المواطنين وفتح الملف فوراً.
 * ٣. البحث في مكتبة نماذج الكتب وفتح النموذج في المحرر مباشرة.
 * ٤. أدوات الاستنساخ السريع: صانع الهويات 1:1.
 *
 * يُفتح بالضغط على Ctrl+K أو بالضغط على زر البحث السريع في الشريط العلوي.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { errorText } from '../lib/errors';
import type { RouteKey } from '@shared/routes';
import type { CitizenSummary, TemplateSummary } from '@shared/api';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: RouteKey) => void;
  onOpenCitizen?: (citizenId: number) => void;
  onOpenTemplate?: (templateId: number) => void;
  onOpenIdDuplex?: () => void;
};

type CommandItem = {
  id: string;
  title: string;
  subtitle?: string;
  category: 'شاشات رئيسية' | 'أدوات سريعة' | 'مواطنون' | 'نماذج كتب';
  icon: string;
  action: () => void;
};

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onOpenCitizen,
  onOpenTemplate,
  onOpenIdDuplex
}: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [citizens, setCitizens] = useState<CitizenSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // إعادة ضبط الحالة وتوجيه المؤشر عند الفتح
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // البحث في المواطنين والنماذج عند الكتابة
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setCitizens([]);
      setTemplates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const [cList, tList] = await Promise.all([
          window.diwan.citizens.list({ query: query.trim(), limit: 5 }),
          window.diwan.templates.list(query.trim())
        ]);
        setCitizens(cList.slice(0, 5));
        setTemplates(tList.slice(0, 5));
        setSearchError(null);
      } catch (e) {
        // «لا نتائج» غير «تعذّر البحث» — فلا يُظنّ المواطن غير مسجَّل.
        setCitizens([]);
        setTemplates([]);
        setSearchError(errorText(e, 'تعذّر البحث'));
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // قائمة الأوامر الثابتة
  const baseCommands: CommandItem[] = useMemo(() => {
    return [
      {
        id: 'service',
        title: 'الشبّاك — اختر واملأ واطبع',
        subtitle: 'المعاملة كاملة للزبون: النماذج والمستمسكات والطباعة',
        category: 'شاشات رئيسية',
        icon: 'point_of_sale',
        action: () => {
          onNavigate('service');
          onClose();
        }
      },
      {
        id: 'editor',
        title: 'محرر الكتب الرسمية',
        subtitle: 'صياغة وطباعة وإصدار الكتب والشهادات',
        category: 'شاشات رئيسية',
        icon: 'edit_document',
        action: () => {
          onNavigate('editor');
          onClose();
        }
      },
      {
        id: 'citizens',
        title: 'سجل المواطنين والمستمسكات',
        subtitle: 'إدارة السجل المدني وخزنة المستمسكات ومسح WIA',
        category: 'شاشات رئيسية',
        icon: 'badge',
        action: () => {
          onNavigate('citizens');
          onClose();
        }
      },
      {
        id: 'id-duplex',
        title: 'استنساخ هوية 1:1 (وجه وظهر)',
        subtitle: 'طباعة البطاقة الوطنية وبطاقة السكن بمقاس مليمتر حقيقي على A4',
        category: 'أدوات سريعة',
        icon: 'contact_page',
        action: () => {
          onClose();
          onOpenIdDuplex?.();
        }
      },
      {
        id: 'papers',
        title: 'الأسئلة الامتحانية',
        subtitle: 'نماذج امتحانية وزارية، ترقيم آلي ونموذجا أ و ب',
        category: 'شاشات رئيسية',
        icon: 'quiz',
        action: () => {
          onNavigate('papers');
          onClose();
        }
      },
      {
        id: 'designs',
        title: 'تصاميم البطاقات والهويات',
        subtitle: 'باجات المدارس، الشهادات التقديرية، كروت التهنئة',
        category: 'شاشات رئيسية',
        icon: 'palette',
        action: () => {
          onNavigate('designs');
          onClose();
        }
      },
      {
        id: 'templates',
        title: 'مكتبة نماذج الكتب',
        subtitle: 'نماذج العقود، التأييدات، والكتب الإدارية الجاهزة',
        category: 'شاشات رئيسية',
        icon: 'inventory_2',
        action: () => {
          onNavigate('templates');
          onClose();
        }
      },
      {
        id: 'photos',
        title: 'الصور الشخصية (٣×٤ و ٤×٦)',
        subtitle: 'قص الصور الشخصية للمراجعين وتصفيفها على ورق A4 أو صور',
        category: 'أدوات سريعة',
        icon: 'photo_camera',
        action: () => {
          onNavigate('photos');
          onClose();
        }
      },
      {
        id: 'archive',
        title: 'سجل الكتب الصادرة (الأرشيف)',
        subtitle: 'إحصائيات اليوم والكتب الصادرة وإعادة الطباعة',
        category: 'شاشات رئيسية',
        icon: 'archive',
        action: () => {
          onNavigate('archive');
          onClose();
        }
      },
      {
        id: 'orders',
        title: 'سجل الطلبات والمعاملات',
        subtitle: 'متابعة طلبات المراجعين ودفعات التصاميم',
        category: 'شاشات رئيسية',
        icon: 'receipt_long',
        action: () => {
          onNavigate('orders');
          onClose();
        }
      },
      {
        id: 'clients',
        title: 'جهات التوزيع والزبائن الدائمين',
        subtitle: 'المدارس والدوائر والشركات المتعامل معها',
        category: 'شاشات رئيسية',
        icon: 'domain',
        action: () => {
          onNavigate('clients');
          onClose();
        }
      },
      {
        id: 'letterhead',
        title: 'الترويسات والشعارات',
        subtitle: 'ترويسات الكتب ومكتبة الكليشات',
        category: 'شاشات رئيسية',
        icon: 'verified',
        action: () => {
          onNavigate('letterhead');
          onClose();
        }
      },
      {
        id: 'pdf',
        title: 'ملفات PDF',
        subtitle: 'دمجٌ وتقسيمٌ وتدويرٌ وتصغيرٌ بحدّ خانة الرفع، والاستمارات القابلة للتعبئة',
        category: 'أدوات سريعة',
        icon: 'picture_as_pdf',
        action: () => {
          onNavigate('pdf');
          onClose();
        }
      },
      {
        id: 'audit',
        title: 'سجلّ التدقيق وسلامة الأرشيف',
        subtitle: 'من فعل ماذا ومتى، و«الأرشيف سليم»',
        category: 'شاشات رئيسية',
        icon: 'verified_user',
        action: () => {
          onNavigate('audit');
          onClose();
        }
      },
      {
        id: 'settings',
        title: 'الإعدادات',
        subtitle: 'المكتب والطابعة والنسخ الاحتياطي والاختصارات',
        category: 'شاشات رئيسية',
        icon: 'settings',
        action: () => {
          onNavigate('settings');
          onClose();
        }
      }
    ];
  }, [onNavigate, onClose, onOpenIdDuplex]);

  // تصفية الأوامر حسب نص البحث
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseCommands;
    return baseCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q))
    );
  }, [baseCommands, query]);

  // تحويل نتائج البحث إلى عناصر أوامر
  const citizenCommands: CommandItem[] = useMemo(() => {
    return citizens.map((c) => ({
      id: `citizen-${c.id}`,
      title: c.fullName,
      subtitle: `الرقم الوطني: ${c.nationalId || 'غير محدد'} · ${c.category || 'ملف مواطن'}`,
      category: 'مواطنون',
      icon: 'person',
      action: () => {
        onClose();
        onOpenCitizen?.(c.id);
      }
    }));
  }, [citizens, onClose, onOpenCitizen]);

  const templateCommands: CommandItem[] = useMemo(() => {
    return templates.map((t) => ({
      id: `template-${t.id}`,
      title: t.title,
      subtitle: `تصنيف: ${t.category || 'عام'} · ${t.subtitle || ''}`,
      category: 'نماذج كتب',
      icon: 'description',
      action: () => {
        onClose();
        onOpenTemplate?.(t.id);
      }
    }));
  }, [templates, onClose, onOpenTemplate]);

  // القائمة المدمجة الإجمالية
  const allItems: CommandItem[] = useMemo(() => {
    return [...filteredCommands, ...citizenCommands, ...templateCommands];
  }, [filteredCommands, citizenCommands, templateCommands]);

  // ضبط المؤشر عند تغيّر القائمة
  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems.length]);

  // إدارة اختصارات لوحة المفاتيح
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < allItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex]!.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* شريط الإدخال والبحث */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant bg-surface-container-low">
          <span className="material-symbols-outlined text-[24px] text-primary">search</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none text-on-surface text-base focus:outline-none placeholder:text-on-surface-variant/50 font-medium"
            placeholder="اكتب أمرًا، أو ابحث عن شاشة أو نموذج أو مواطن... (Esc للإغلاق)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-bold border border-outline-variant/40">
            ESC
          </span>
        </div>

        {/* قائمة النتائج */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-outline-variant/10">
          {searchError && (
            <p className="px-3 py-2 text-sm text-error" data-palette-error="">
              {searchError} — ما يظهر أدناه أوامرُ البرنامج وحدها
            </p>
          )}
          {allItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant gap-2 text-sm">
              <span className="material-symbols-outlined text-[36px] opacity-40">search_off</span>
              <span>لا توجد نتائج مطابقة لـ &quot;{query}&quot;</span>
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-right transition-colors ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'hover:bg-surface-container text-on-surface'
                  }`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={item.action}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`material-symbols-outlined text-[20px] p-2 rounded-lg ${
                        isSelected
                          ? 'bg-on-primary/15 text-on-primary'
                          : 'bg-surface-container-high text-primary'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm truncate">{item.title}</span>
                      {item.subtitle && (
                        <span
                          className={`text-xs truncate ${
                            isSelected ? 'text-on-primary/80' : 'text-on-surface-variant'
                          }`}
                        >
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      isSelected
                        ? 'bg-on-primary/20 text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* شريط الإرشادات السفلي */}
        <footer className="px-4 py-2 border-t border-outline-variant bg-surface-container-low flex items-center justify-between text-xs text-on-surface-variant">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-[10px] font-mono border">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-[10px] font-mono border">
                ↓
              </kbd>
              <span>للتنقل</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-[10px] font-mono border">
                ↵
              </kbd>
              <span>للاختيار</span>
            </span>
          </div>
          <span className="text-[11px] opacity-75 font-semibold">ديوان · شريط الأوامر السريع</span>
        </footer>
      </div>
    </div>
  );
}
