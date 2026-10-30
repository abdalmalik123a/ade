/**
 * الإعدادات — ما يغيّره صاحب المكتب، في مكانٍ واحد يُعرف من اسمه.
 *
 * كانت إعدادات المكتب والطابعة والمعايرة وحجم الخطّ داخل شاشة «الترويسات»، وزرٌّ
 * اسمه «تبديل الحساب أو خروج» يقود إليها — ولا حسابات في البرنامج. فصارت شاشةً
 * باسمها، ومعها سياسة الخصوصية (أين البيانات وما يُحفظ) والاختصارات الثابتة
 * ورقم الإصدار.
 */
import { useEffect, useRef, useState } from 'react';
import type { OfficeSettings, PrinterInfo } from '@shared/api';
import { academicYearText } from '@shared/schoolFile';
import { PrintRolesTable, PrinterCalibration, calibrationPrinters } from '../components/SettingsPrinters';
import SettingsIndex from '../components/SettingsIndex';
import BackupPanel from '../components/BackupPanel';
import ArchiveIntegrity from '../components/ArchiveIntegrity';
import LicenseCard from '../components/LicenseCard';
import AboutDialog from '../components/AboutDialog';
import UpdateCard from '../components/UpdateCard';
import { CounterCardsSetting } from './settings/CounterCardsSetting';
import { BasmalaSetting } from './settings/BasmalaSetting';
import OfficeCard from './settings/OfficeCard';
import PrivacyCard from './settings/PrivacyCard';
import ShortcutsCard from './settings/ShortcutsCard';
import SupportCard from './settings/SupportCard';

type Toast = { text: string; tone: 'ok' | 'warn' } | null;

export default function SettingsScreen({ onChanged }: { onChanged?: () => void }) {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [dirty, setDirty] = useState(false);
  const [info, setInfo] = useState<{ version: string; dataDir: string; store: boolean } | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [about, setAbout] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    void Promise.all([window.diwan.settings.get(), window.diwan.printers.list(), window.diwan.ui.info()]).then(
      ([s, p, i]) => {
        setSettings(s);
        setPrinters(p);
        setInfo(i);
      }
    );
  }, []);

  const say = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setToast({ text, tone });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3500);
  };

  const patch = (next: Partial<OfficeSettings>) => {
    setSettings((cur) => (cur ? { ...cur, ...next } : cur));
    setDirty(true);
  };

  const save = () => {
    if (!settings) return;
    // بطاقات الشبّاك تُحفظ لحظة تغييرها — فلا يُعيدها الحفظ.
    const { counterCards: _cards, ...office } = settings;
    void window.diwan.settings.set(office).then((saved) => {
      setSettings(saved);
      setDirty(false);
      onChanged?.();
      say('حُفظت إعدادات المكتب');
    });
  };

  const card = 'surface-panel p-space-md flex flex-col gap-space-sm';
  // كلّ عنوان قسمٍ مرساةٌ للفهرس (البند ٢٠) — والهامش فوقه لا يدسّه تحت الفهرس الثابت.
  const title = (icon: string, text: string) => (
    <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs" data-settings-section={text} style={{ scrollMarginTop: 136 }}>
      <span className="material-symbols-outlined text-secondary text-[20px]">{icon}</span>
      {text}
    </h2>
  );

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-settings="">
      <div className="p-space-lg flex flex-col gap-space-md max-w-6xl">
        <header className="flex items-center justify-between gap-space-md">
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold">الإعدادات</h1>
            <p className="font-label-md text-label-md text-on-surface-variant">
              ما يغيّره صاحب المكتب — وسياسة الخصوصية والاختصارات
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            {info && (
              <span className="font-label-md text-label-md text-on-surface-variant" data-version="">
                ديوان — الإصدار {info.version}
              </span>
            )}
            <button
              className="h-9 px-space-md rounded-btn bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-space-xs shadow-low"
              data-act="open-about"
              type="button"
              onClick={() => setAbout(true)}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">info</span>
              عن البرنامج
            </button>
          </div>
        </header>

        <SettingsIndex ready={Boolean(settings)} />

        {settings && (
          <div className="grid lg:grid-cols-2 gap-space-md items-start">
            {/* ── التفعيل ────────────────────────────────────────────── */}
            <LicenseCard card={card} title={title('verified', 'التفعيل')} onChanged={() => onChanged?.()} />

            {/* ── التحديث «أ+» ────────────────────────────────────────── */}
            <UpdateCard card={card} title={title('system_update_alt', 'التحديث')} version={info?.version ?? null} store={info?.store ?? false} />

            {/* ── المكتب ─────────────────────────────────────────────── */}
            <OfficeCard
              card={card}
              title={title}
              dirty={dirty}
              settings={settings}
              patch={patch}
              setSettings={setSettings}
              onChanged={onChanged}
            />

            {/* ── الطابعات ────────────────────────────────────────────── */}
            <section className={`${card} lg:col-span-2`}>
              {title('print', 'الطابعات')}
              <PrintRolesTable
                roles={settings.printRoles}
                printers={printers}
                onChange={(printRoles) =>
                  // طابعة الكتب هي «الافتراضية» القديمة: يُقرأ بها ما لم يعرف الأدوار بعد (المعايرة، معالج البداية).
                  patch({ printRoles, defaultPrinter: printRoles.documents.normal })
                }
              />
              <PrinterCalibration
                printers={calibrationPrinters(settings.printRoles, printers)}
                initial={settings.printRoles.documents.normal}
                offsets={settings.printOffsets ?? {}}
                onSaved={(printOffsets) => setSettings((cur) => (cur ? { ...cur, printOffsets } : cur))}
                say={say}
              />
            </section>

            {/* ── بطاقات الشبّاك ─────────────────────────────────────────── */}
            <CounterCardsSetting
              card={card}
              title={title('dashboard_customize', 'بطاقات الشبّاك')}
              cards={settings.counterCards}
              onChange={(next) => {
                // يُطبَّق ويُحفظ فورًا كحجم الخطّ — تغييرٌ يُرى لا يحتاج «حفظ».
                setSettings((cur) => (cur ? { ...cur, ...next } : cur));
                void window.diwan.settings.set(next).then(() => onChanged?.());
              }}
            />

            {/* ── البيانات والنسخ الاحتياطية ─────────────────────────────── */}
            <ArchiveIntegrity card={card} />
            <BackupPanel
              card={card}
              lastBackupAt={settings.lastBackupAt}
              title={title('database', 'البيانات والنسخ الاحتياطية')}
              onBackedUp={(at) => setSettings((cur) => (cur ? { ...cur, lastBackupAt: at } : cur))}
            />

            {/* ── الترويسات ───────────────────────────────────────────── */}
            <BasmalaSetting
              value={settings.basmala}
              card={card}
              title={title('format_quote', 'البسملة')}
              onChange={(basmala) => setSettings((cur) => (cur ? { ...cur, basmala } : cur))}
              say={say}
            />

            {/* ── ملفّ المدارس (الموجة ٢) ─────────────────────────────────── */}
            <section className={card} data-school-files-setting="">
              {title('school', 'ملفّ المدارس')}
              <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
                <input
                  checked={settings.schoolFiles}
                  className="w-4 h-4 accent-secondary"
                  data-setting="schoolFiles"
                  type="checkbox"
                  onChange={(e) => {
                    const schoolFiles = e.target.checked;
                    // يُطبَّق ويُحفظ فورًا كحجم الخطّ — تغييرٌ يُرى لا يحتاج «حفظ».
                    setSettings((cur) => (cur ? { ...cur, schoolFiles } : cur));
                    void window.diwan.settings.set({ schoolFiles }).then(() => onChanged?.());
                  }}
                />
                مكتبٌ يخدم مدارس: لكلّ مدرسةٍ ملفّها يملأ كتبها
              </label>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                جنس المدرسة ومحافظتها واسم مديرها تُكتب مرّةً في «الجهات»، وفي الشبّاك «هات المدرسة» يملأ بها الكتب — والعام الدراسي
                يُكتب وحده من التاريخ ({academicYearText(new Date())}). ومطفأٌ ما لم يحتجه المكتب.
              </p>
            </section>

            {/* ── وصل الاستلام (الموجة ٢) ─────────────────────────────────── */}
            <section className={card} data-receipt-setting="">
              {title('receipt_long', 'وصل الاستلام')}
              <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
                <input
                  checked={settings.receiptSlip}
                  className="w-4 h-4 accent-secondary"
                  data-setting="receiptSlip"
                  type="checkbox"
                  onChange={(e) => {
                    const receiptSlip = e.target.checked;
                    setSettings((cur) => (cur ? { ...cur, receiptSlip } : cur));
                    void window.diwan.settings.set({ receiptSlip }).then(() => onChanged?.());
                  }}
                />
                وصلٌ للزبون الذي يترك طلبه ويعود
              </label>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                في «قيد العمل»: خانة «ما تركه الزبون عندنا» و«سجّل واطبع الوصل»، وزرّ الوصل على كلّ طلب. نسختان على ورقة A4 — للزبون
                وللمكتب تُرفق بما تركه — باسم المكتب وهاتفه وعنوانه، بلا مبالغ. ومطفأٌ ما لم يحتجه المكتب.
              </p>
            </section>

            <div className="lg:col-span-2">
              <button
                className="w-full h-11 btn-act font-label-lg text-label-lg font-semibold disabled:opacity-40"
                data-act="save-settings"
                disabled={!dirty}
                type="button"
                onClick={save}
              >
                حفظ إعدادات المكتب
              </button>
            </div>

            {/* ── الخصوصية ────────────────────────────────────────────── */}
            <PrivacyCard
              card={card}
              title={title}
              info={info}
            />

            {/* ── مشكلة في البرنامج؟ (البند ٣٢) ───────────────────────────── */}
            <SupportCard card={card} title={title} />

            {/* ── الاختصارات ──────────────────────────────────────────── */}
            <ShortcutsCard
              card={card}
              title={title}
            />
          </div>
        )}
      </div>

      {about && <AboutDialog onClose={() => setAbout(false)} />}

      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-space-lg py-space-sm rounded-card shadow-soft font-label-md text-label-md ${
            toast.tone === 'ok' ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-error text-on-error'
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

