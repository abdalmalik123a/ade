/**
 * حزم التصاميم في المعرض (DESIGNS.md ٣٫٦): تصاميمُ تُختار من «تصاميمك المحفوظة» فتُحفظ ملفًّا واحدًا (`.diwanpack`) يُعطى لمكتبٍ
 * آخر أو لجهازٍ ثانٍ، وملفٌّ كهذا يُستورد فتظهر تصاميمه هنا — والمكرّر بمعرّفه لا يُضاف ثانيةً. وما لم يخرج (خطٌّ أو عنصرٌ
 * استورده المكتب) وما غاب بعد الاستيراد يُقال بأسمائه.
 */
import { useState } from 'react';
import { toIndic, count } from '@shared/arabic';
import { errorText } from '../../lib/errors';

type Say = (text: string, tone?: 'ok' | 'warn', action?: undefined, opts?: { sticky?: boolean }) => void;

/** «خطّ «A» و«B»» — قائمة أسماءٍ بكلام الموظّف. */
const names = (list: string[]) => list.map((n) => `«${n}»`).join(list.length > 2 ? '، ' : ' و');

export function useDesignPacks({ say, reload }: { say: Say; reload: () => Promise<void> | void }) {
  /** وضع الاختيار: النقر على تصميمٍ يختاره بدل أن يفتحه. */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const cancel = () => {
    setPicking(false);
    setPicked([]);
  };

  const save = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      const out = await window.diwan.content.export(picked);
      if (!out) return;
      const left = out.leftOut;
      const parts = [
        left?.fonts.length ? `خطّ ${names(left.fonts)}` : '',
        left?.elements.length ? `العنصر ${names(left.elements)}` : ''
      ].filter(Boolean);
      const base = `حُفظت حزمة فيها ${count(out.templates, 'تصميم')}`;
      if (parts.length) say(`${base} — ولم يخرج معها ${parts.join(' و')}: مستوردٌ ترخيصه لهذا المكتب، فيحتاجه من يستوردها`, 'warn', undefined, { sticky: true });
      else say(`${base} — تُستورد من «التصاميم» أو «الإعدادات» في أيّ ديوان`);
      cancel();
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ الحزمة'), 'warn');
    } finally {
      setBusy(false);
    }
  };

  const importPack = async () => {
    setBusy(true);
    try {
      const out = await window.diwan.content.import();
      if (!out) return;
      await reload();
      const a = out.added;
      const others = a.letterheads + a.clips;
      const lines = [
        a.templates ? `أُضيف ${toIndic(a.templates)} ${a.templates === 1 ? 'تصميم' : 'تصاميم'} إلى «تصاميمك المحفوظة»` : 'لا تصميم جديد في الحزمة',
        out.existing.templates ? `و${toIndic(out.existing.templates)} موجودٌ من قبل لم يُكرَّر` : '',
        others ? `ومعها ${toIndic(others)} من الترويسات والكليشات` : ''
      ].filter(Boolean);
      const missing = [
        out.missing?.fonts.length ? `خطّ ${names(out.missing.fonts)} ليس في هذا الجهاز — يُرسم ببديله حتى تستورده من «المكتبة ← الخطوط»` : '',
        out.missing?.images ? `و${count(out.missing.images, 'صورة')} لم تأتِ مع الحزمة (عنصرٌ مستوردٌ في المكتب الآخر)` : ''
      ].filter(Boolean);
      say([lines.join(' '), ...missing].join(' — '), missing.length ? 'warn' : 'ok', undefined, missing.length ? { sticky: true } : undefined);
    } catch (e) {
      say(errorText(e, 'تعذّر استيراد الحزمة'), 'warn');
    } finally {
      setBusy(false);
    }
  };

  return { picking, setPicking, picked, toggle, cancel, save, importPack, busy };
}

export type DesignPacks = ReturnType<typeof useDesignPacks>;
