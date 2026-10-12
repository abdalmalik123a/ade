/**
 * «مشكلة في البرنامج؟» في الإعدادات (البند ٣٢): من هنا يُحفظ تقرير المشكلة متى شاء المكتب — لا حين يظهر خطأٌ وحده
 * (ذلك زرٌّ في شريط الأخطاء). والتقرير نفسه في `components/ProblemReportDialog`.
 */
import { useState } from 'react';
import ProblemReportDialog from '../../components/ProblemReportDialog';

type Props = {
  card: string;
  title: (icon: string, text: string) => JSX.Element;
};

export default function SupportCard({ card, title }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <section className={card} data-support="">
      {title('support_agent', 'مشكلة في البرنامج؟')}
      <p className="font-body-sm text-body-sm text-on-surface leading-7">
        احفظ تقرير المشكلة وأرسله إلى المطوّر بواتساب: فيه ما تكتبه عمّا حدث، ورقم الإصدار، وأخطاء البرنامج الأخيرة — ولا شيء من
        سجلّ المكتب ولا أسماء الزبائن.
      </p>
      <div>
        <button
          className="h-10 px-space-md rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md flex items-center gap-1"
          data-act="open-problem-report"
          type="button"
          onClick={() => setOpen(true)}
        >
          <span className="material-symbols-outlined text-[18px]">support_agent</span>
          أرسل تقرير المشكلة
        </button>
      </div>
      {open && <ProblemReportDialog onClose={() => setOpen(false)} />}
    </section>
  );
}
