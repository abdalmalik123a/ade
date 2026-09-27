/**
 * حزمة نماذج العقود والكمبيالات العرفية والتعهدات القانونية للمكاتب العراقية.
 *
 * نماذج قياسية معتمدة ومطابقة للأعراف القانونية والقضائية في العراق:
 * 1. عقد إيجار عقار (شقة / دار سكنية / محل تجاري)
 * 2. مكاتبة بيع وشراء مركبة / سيارة خارجي
 * 3. كمبيالة دين شرعية وعرفية وتعهد مالي مع كفيل ضامن متضامن
 * 4. تعهد خطي وقانوني عام
 * 5. سند مخالصة وإبراء ذمة وتنازل عن حق
 */

import type { TemplateInput } from './template';

export const CONTRACT_PRESETS: TemplateInput[] = [
  {
    id: null,
    code: 'عقد-إيجار',
    title: 'عقد إيجار دار سكنية أو شقة أو محل تجاري',
    subtitle: 'عقد إيجار عرفي مدني بموجب قانون إيجار العقار العراقي النافذ',
    category: 'عقود وإيجارات',
    subjectLine: 'م/ عقد إيجار عقار',
    letterheadId: null,
    bodyHtml: `<div style="font-family: inherit; line-height: 1.8; color: #111;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">بسم الله الرحمن الرحيم</h2>
    <h3 style="margin: 6px 0 0; font-size: 18px; font-weight: bold; text-decoration: underline;">عـقـد إيـجـار عـقـار</h3>
  </div>

  <p style="margin-bottom: 12px;"><strong>إنه في يوم:</strong> {اليوم} المصادف {تاريخ_العقد}، تم الاتفاق والتعاقد بالتراضي والاتفاق بين كل من:</p>

  <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
    <p style="margin: 0 0 6px;"><strong>الطرف الأول (المؤجر):</strong> {اسم_المؤجر} &nbsp;|&nbsp; <strong>الرقم الوطني / الهوية:</strong> {رقم_هوية_المؤجر}</p>
    <p style="margin: 0 0 6px;"><strong>العنوان السكني:</strong> {عنوان_المؤجر} &nbsp;|&nbsp; <strong>رقم الهاتف:</strong> {هاتف_المؤجر}</p>
  </div>

  <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
    <p style="margin: 0 0 6px;"><strong>الطرف الثاني (المستأجر):</strong> {اسم_المستأجر} &nbsp;|&nbsp; <strong>الرقم الوطني / الهوية:</strong> {رقم_هوية_المستأجر}</p>
    <p style="margin: 0 0 6px;"><strong>العنوان السكني:</strong> {عنوان_المستأجر} &nbsp;|&nbsp; <strong>رقم الهاتف:</strong> {هاتف_المستأجر}</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 14px;">
    <tbody>
      <tr>
        <td style="border: 1px solid #ccc; padding: 8px; width: 25%; font-weight: bold; background-color: #f5f5f5;">نوع ووصف المأجور</td>
        <td style="border: 1px solid #ccc; padding: 8px; width: 75%;">{نوع_العقار} الكائن في {موقع_العقار}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; background-color: #f5f5f5;">مدة الإيجار</td>
        <td style="border: 1px solid #ccc; padding: 8px;">{مدة_الإيجار} تبدأ من {تاريخ_بدء_الإيجار} وتنتهي بتاريخ {تاريخ_انتهاء_الإيجار}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; background-color: #f5f5f5;">بدل الإيجار الشهري</td>
        <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">{بدل_الإيجار_الشهري_رقما} دينار عراقي ({بدل_الإيجار_كتابة})</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; background-color: #f5f5f5;">مبلغ التأمينات النقدية</td>
        <td style="border: 1px solid #ccc; padding: 8px;">{مبلغ_التأمينات} دينار عراقي</td>
      </tr>
    </tbody>
  </table>

  <h4 style="margin: 12px 0 6px; font-size: 15px; font-weight: bold;">الشروط والأحكام المتفق عليها:</h4>
  <ol style="margin: 0; padding-right: 20px; font-size: 13.5px;">
    <li>عاين المستأجر العقار المأجور المعاينة التامة النافية للجهالة وتسلّمه بحالة جيدة وصالحة للغرض المستأجر من أجله.</li>
    <li>يلتزم المستأجر بسداد أجور استهلاك الكهرباء والماء وأجور أمانة بغداد أو البلدية طيلة فترة الإشغال، وتقديم وصولات التسديد الرسمية عند نهاية كل شهر.</li>
    <li>لا يجوز للمستأجر إحداث أي تغيير أو تحوير في البناء أو الهيكل إلا بموافقة خطية مسبقة من المؤجر.</li>
    <li>لا يحق للمستأجر تأجير المأجور للغير كلاً أو جزءاً (التأجير من الباطن) أو التنازل عنه بأي وجه من الوجوه.</li>
    <li>يلتزم المستأجر بإخلاء المأجور وتسليمه للمؤجر خالياً من الشواغل فور انتهاء مدة العقد المحددة أعلاه، وفي حال التأخر يلتزم بدفع ضعف البدل اليومي كتعويض اتفاقي.</li>
  </ol>

  <div style="display: flex; justify-content: space-between; margin-top: 30px; text-align: center;">
    <div style="flex: 1;">
      <strong>الطرف الأول (المؤجر)</strong><br/><br/>
      التوقيع: ...........................
    </div>
    <div style="flex: 1;">
      <strong>الطرف الثاني (المستأجر)</strong><br/><br/>
      التوقيع: ...........................
    </div>
    <div style="flex: 1;">
      <strong>الشاهد الأول</strong><br/><br/>
      التوقيع: ...........................
    </div>
    <div style="flex: 1;">
      <strong>الشاهد الثاني</strong><br/><br/>
      التوقيع: ...........................
    </div>
  </div>
</div>`,
    variables: [
      { token: 'اليوم', label: 'اليوم', source: 'manual', required: true },
      { token: 'تاريخ_العقد', label: 'تاريخ العقد', source: 'manual', required: true },
      { token: 'اسم_المؤجر', label: 'اسم المؤجر', source: 'manual', required: true },
      { token: 'رقم_هوية_المؤجر', label: 'رقم هوية المؤجر', source: 'manual', required: true },
      { token: 'عنوان_المؤجر', label: 'عنوان المؤجر', source: 'manual', required: false },
      { token: 'هاتف_المؤجر', label: 'هاتف المؤجر', source: 'manual', required: false },
      { token: 'اسم_المستأجر', label: 'اسم المستأجر', source: 'citizen', required: true },
      { token: 'رقم_هوية_المستأجر', label: 'رقم هوية المستأجر', source: 'citizen', required: true },
      { token: 'عنوان_المستأجر', label: 'عنوان المستأجر', source: 'citizen', required: false },
      { token: 'هاتف_المستأجر', label: 'هاتف المستأجر', source: 'citizen', required: false },
      { token: 'نوع_العقار', label: 'نوع العقار', source: 'manual', required: true },
      { token: 'موقع_العقار', label: 'موقع العقار ورقم الدار', source: 'manual', required: true },
      { token: 'مدة_الإيجار', label: 'مدة الإيجار', source: 'manual', required: true },
      { token: 'تاريخ_بدء_الإيجار', label: 'تاريخ بدء الإيجار', source: 'manual', required: true },
      { token: 'تاريخ_انتهاء_الإيجار', label: 'تاريخ انتهاء الإيجار', source: 'manual', required: true },
      { token: 'بدل_الإيجار_الشهري_رقما', label: 'بدل الإيجار الشهري (رقماً)', source: 'manual', required: true },
      { token: 'بدل_الإيجار_كتابة', label: 'بدل الإيجار الشهري (كتابة)', source: 'manual', required: true },
      { token: 'مبلغ_التأمينات', label: 'مبلغ التأمينات', source: 'manual', required: false }
    ]
  },
  {
    id: null,
    code: 'مكاتبة-مركبة',
    title: 'مكاتبة بيع وشراء مركبة / سيارة خارجي',
    subtitle: 'مكاتبة بيع قطعي خارجي خارج مديرية المرور العامة مع خلو الغرامات والشاصي',
    category: 'عقود بيع وشراء',
    subjectLine: 'م/ مكاتبة بيع وشراء مركبة',
    letterheadId: null,
    bodyHtml: `<div style="font-family: inherit; line-height: 1.8; color: #111;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">بسم الله الرحمن الرحيم</h2>
    <h3 style="margin: 6px 0 0; font-size: 18px; font-weight: bold; text-decoration: underline;">مكاتبة بيع وشراء مركبة (خارج المرور)</h3>
  </div>

  <p style="margin-bottom: 12px;"><strong>إنه في يوم:</strong> {اليوم} المصادف {تاريخ_المكاتبة}، تم الاتفاق والبيع والشراء برضا تام وإيجاب وقبول بين الطرفين:</p>

  <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 10px 14px; border-radius: 6px; margin-bottom: 10px;">
    <p style="margin: 0 0 4px;"><strong>الطرف الأول (البائع):</strong> {اسم_البائع} &nbsp;|&nbsp; <strong>الرقم الوطني:</strong> {رقم_هوية_البائع}</p>
    <p style="margin: 0;"><strong>العنوان:</strong> {سكن_البائع} &nbsp;|&nbsp; <strong>رقم الهاتف:</strong> {هاتف_البائع}</p>
  </div>

  <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px;">
    <p style="margin: 0 0 4px;"><strong>الطرف الثاني (المشتري):</strong> {اسم_المشتري} &nbsp;|&nbsp; <strong>الرقم الوطني:</strong> {رقم_هوية_المشتري}</p>
    <p style="margin: 0;"><strong>العنوان:</strong> {سكن_المشتري} &nbsp;|&nbsp; <strong>رقم الهاتف:</strong> {هاتف_المشتري}</p>
  </div>

  <p style="margin-bottom: 8px;"><strong>أوصاف وبيانات المركبة موضوع البيع:</strong></p>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13.5px;">
    <tbody>
      <tr>
        <td style="border: 1px solid #ccc; padding: 6px 10px; font-weight: bold; background-color: #f5f5f5; width: 20%;">النوع والموديل</td>
        <td style="border: 1px solid #ccc; padding: 6px 10px; width: 30%;">{نوع_المركبة} / موديل {موديل_المركبة}</td>
        <td style="border: 1px solid #ccc; padding: 6px 10px; font-weight: bold; background-color: #f5f5f5; width: 20%;">رقم اللوحة والمحافظة</td>
        <td style="border: 1px solid #ccc; padding: 6px 10px; width: 30%; font-weight: bold;">{رقم_اللوحة_والمحافظة}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 6px 10px; font-weight: bold; background-color: #f5f5f5;">اللون</td>
        <td style="border: 1px solid #ccc; padding: 6px 10px;">{لون_المركبة}</td>
        <td style="border: 1px solid #ccc; padding: 6px 10px; font-weight: bold; background-color: #f5f5f5;">رقم الشاصي</td>
        <td style="border: 1px solid #ccc; padding: 6px 10px; font-family: monospace;">{رقم_الشاصي}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 6px 10px; font-weight: bold; background-color: #f5f5f5;">سعر البيع الإجمالي</td>
        <td colspan="3" style="border: 1px solid #ccc; padding: 6px 10px; font-weight: bold;">
          {سعر_البيع_رقما} ({سعر_البيع_كتابة})
        </td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 6px 10px; font-weight: bold; background-color: #f5f5f5;">المبلغ الواصل نقداً</td>
        <td style="border: 1px solid #ccc; padding: 6px 10px;">{المبلغ_الواصل}</td>
        <td style="border: 1px solid #ccc; padding: 6px 10px; font-weight: bold; background-color: #f5f5f5;">المتبقي بذمة المشتري</td>
        <td style="border: 1px solid #ccc; padding: 6px 10px;">{المبلغ_المتبقي}</td>
      </tr>
    </tbody>
  </table>

  <h4 style="margin: 10px 0 6px; font-size: 14.5px; font-weight: bold;">التعهدات والالتزامات القانونية:</h4>
  <ol style="margin: 0; padding-right: 20px; font-size: 13px;">
    <li>يقر البائع بأن المركبة ملكه التام شرعاً وقانوناً، وخالية من أي حجز تنفيذي أو رهن مصرفي أو إشارة قضائية أو شبهة سرقة أو تزوير.</li>
    <li>يتحمل البائع كافة الغرامات المرورية والمخالفات والرسوم المترتبة على المركبة لغاية تاريخ وساعة توقيع هذه المكاتبة وتسليم المركبة.</li>
    <li>يتحمل المشتري كافة التبعات القانونية والجزائية والمخالفات والغرامات المرورية اللاحقة لتاريخ استلامه المركبة.</li>
    <li>يلتزم الطرفان بالحضور أمام مديرية المرور المختصة لإكمال نقل ملكية المركبة باسم المشتري خلال مهلة أقصاها {مهلة_التحويل}.</li>
    <li>استلم المشتري المركبة ومفتاحها وسنوية تسجيلها بعد المعاينة والفحص والتجربة ورضي بحالتها الميكانيكية والبدنية.</li>
  </ol>

  <div style="display: flex; justify-content: space-between; margin-top: 25px; text-align: center;">
    <div style="flex: 1;">
      <strong>الطرف الأول (البائع)</strong><br/><br/>
      التوقيع والبصمة: ...................
    </div>
    <div style="flex: 1;">
      <strong>الطرف الثاني (المشتري)</strong><br/><br/>
      التوقيع والبصمة: ...................
    </div>
    <div style="flex: 1;">
      <strong>الشاهد الأول</strong><br/><br/>
      التوقيع: ...................
    </div>
    <div style="flex: 1;">
      <strong>الشاهد الثاني</strong><br/><br/>
      التوقيع: ...................
    </div>
  </div>
</div>`,
    variables: [
      { token: 'اليوم', label: 'اليوم', source: 'manual', required: true },
      { token: 'تاريخ_المكاتبة', label: 'تاريخ المكاتبة', source: 'manual', required: true },
      { token: 'اسم_البائع', label: 'اسم البائع', source: 'manual', required: true },
      { token: 'رقم_هوية_البائع', label: 'رقم هوية البائع', source: 'manual', required: true },
      { token: 'سكن_البائع', label: 'سكن البائع', source: 'manual', required: false },
      { token: 'هاتف_البائع', label: 'هاتف البائع', source: 'manual', required: false },
      { token: 'اسم_المشتري', label: 'اسم المشتري', source: 'citizen', required: true },
      { token: 'رقم_هوية_المشتري', label: 'رقم هوية المشتري', source: 'citizen', required: true },
      { token: 'سكن_المشتري', label: 'سكن المشتري', source: 'citizen', required: false },
      { token: 'هاتف_المشتري', label: 'هاتف المشتري', source: 'citizen', required: false },
      { token: 'نوع_المركبة', label: 'نوع المركبة وطرازها', source: 'manual', required: true },
      { token: 'موديل_المركبة', label: 'الموديل وسنة الصنع', source: 'manual', required: true },
      { token: 'رقم_اللوحة_والمحافظة', label: 'رقم اللوحة والمحافظة', source: 'manual', required: true },
      { token: 'لون_المركبة', label: 'لون المركبة', source: 'manual', required: false },
      { token: 'رقم_الشاصي', label: 'رقم الشاصي', source: 'manual', required: true },
      { token: 'سعر_البيع_رقما', label: 'سعر البيع (رقماً)', source: 'manual', required: true },
      { token: 'سعر_البيع_كتابة', label: 'سعر البيع (كتابة)', source: 'manual', required: true },
      { token: 'المبلغ_الواصل', label: 'المبلغ الواصل نقداً', source: 'manual', required: false },
      { token: 'المبلغ_المتبقي', label: 'المبلغ المتبقي', source: 'manual', required: false },
      { token: 'مهلة_التحويل', label: 'مهلة التحويل في المرور', source: 'manual', required: false }
    ]
  },
  {
    id: null,
    code: 'كمبيالة-دين',
    title: 'كمبيالة دين شرعية وعرفية وتعهد مالي مع كفيل ضامن',
    subtitle: 'إقرار بالمديونية وتعهد بالوفاء مع كفيل حضور وغرم متضامن',
    category: 'كمبيالات وتعهدات',
    subjectLine: 'م/ كمبيالة دين وإقرار مالي',
    letterheadId: null,
    bodyHtml: `<div style="font-family: inherit; line-height: 1.85; color: #111;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">بسم الله الرحمن الرحيم</h2>
    <h3 style="margin: 6px 0 0; font-size: 18px; font-weight: bold; text-decoration: underline;">كمبيالة دين وتعهد مالي مع كفيل ضامن</h3>
  </div>

  <p style="text-align: justify; margin-bottom: 12px;">
    أقر وأعترف أنا الموقع أدناه <strong>(المدين)</strong>: <strong>{اسم_المدين}</strong>، الحامل للبطاقة الوطنية رقم <strong>{الرقم_الوطني_للمدين}</strong>، الساكن في <strong>{سكن_المدين}</strong>، ورقم الهاتف <strong>{هاتف_المدين}</strong>.
  </p>

  <p style="text-align: justify; margin-bottom: 12px;">
    بأنني مدين بذمتي شرعاً وقانوناً للدائن المكرم السيد: <strong>{اسم_الدائن}</strong>، الحامل للبطاقة الوطنية رقم <strong>{الرقم_الوطني_للدائن}</strong>، بمبلغ مالي وقدره:
  </p>

  <div style="background-color: #f3f4f6; border: 2px dashed #9ca3af; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 16px;">
    <span style="font-size: 18px; font-weight: bold;">{مبلغ_الدين_رقما}</span> &nbsp;&mdash;&nbsp; 
    <span style="font-size: 16px; font-weight: bold; color: #1e3a8a;">{مبلغ_الدين_كتابة}</span>
  </div>

  <p style="text-align: justify; margin-bottom: 12px;">
    <strong>سبب الدين:</strong> بذمتي من جراء {سبب_الدين}.<br/>
    <strong>ميعاد السداد:</strong> أتعهد وألتزم بسداد المبلغ المذكور كاملاً دون أي تأخير أو تسويف في موعد أقصاه <strong>{تاريخ_الاستحقاق}</strong>. وفي حال تخلفي عن السداد أكون ملزماً بكافة المصاريف والرسوم القضائية وأتعاب المحاماة والتعويض عن الضرر، وقد أسقطت حقي في أي إنذار أو إعذار رسمي، وأقر بصحة ديني واختصاص محاكم البداءة العراقية بالنظر في أي نزاع.
  </p>

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 16px 0;" />

  <h4 style="margin: 0 0 8px; font-size: 15px; font-weight: bold;">إقرار وتعهد الكفيل الضامن المتضامن (كفيل غارم):</h4>
  <p style="text-align: justify; margin-bottom: 16px;">
    أنا الموقع أدناه (الكفيل): <strong>{اسم_الكفيل}</strong>، أحمل البطاقة الوطنية رقم <strong>{الرقم_الوطني_للكفيل}</strong>، الموظف في <strong>{دائرة_الكفيل}</strong>، بالعنوان الوظيفي <strong>{العنوان_الوظيفي_للكفيل}</strong>، هاتف <strong>{هاتف_الكفيل}</strong>.<br/>
    أكفل المدين المذكور أعلاه كفالة حضورية وغرامية تضامنية متصلة، وأتعهد بأداء كامل مبلغ الدين للدائن من راتبي ومستحقاتي وأموالي حال امتناع أو تعذر سداد المدين لأي سبب كان، دون حاجة لإنذار أو الرجوع على المدين أولاً.
  </p>

  <div style="display: flex; justify-content: space-between; margin-top: 30px; text-align: center;">
    <div style="flex: 1;">
      <strong>المدين (المتعهد)</strong><br/><br/>
      التوقيع: ...........................<br/>
      البصمة: [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
    </div>
    <div style="flex: 1;">
      <strong>الكفيل الضامن</strong><br/><br/>
      التوقيع: ...........................<br/>
      البصمة: [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
    </div>
    <div style="flex: 1;">
      <strong>الشاهد الأول</strong><br/><br/>
      التوقيع: ...........................
    </div>
    <div style="flex: 1;">
      <strong>الشاهد الثاني</strong><br/><br/>
      التوقيع: ...........................
    </div>
  </div>
</div>`,
    variables: [
      { token: 'اسم_المدين', label: 'اسم المدين', source: 'citizen', required: true },
      { token: 'الرقم_الوطني_للمدين', label: 'الرقم الوطني للمدين', source: 'citizen', required: true },
      { token: 'سكن_المدين', label: 'سكن المدين', source: 'citizen', required: false },
      { token: 'هاتف_المدين', label: 'هاتف المدين', source: 'citizen', required: false },
      { token: 'اسم_الدائن', label: 'اسم الدائن', source: 'manual', required: true },
      { token: 'الرقم_الوطني_للدائن', label: 'الرقم الوطني للدائن', source: 'manual', required: false },
      { token: 'مبلغ_الدين_رقما', label: 'مبلغ الدين (رقماً)', source: 'manual', required: true },
      { token: 'مبلغ_الدين_كتابة', label: 'مبلغ الدين (كتابة وتفقيط)', source: 'manual', required: true },
      { token: 'سبب_الدين', label: 'سبب الدين', source: 'manual', required: false },
      { token: 'تاريخ_الاستحقاق', label: 'تاريخ الاستحقاق النهائي', source: 'manual', required: true },
      { token: 'اسم_الكفيل', label: 'اسم الكفيل الضامن', source: 'manual', required: true },
      { token: 'الرقم_الوطني_للكفيل', label: 'الرقم الوطني للكفيل', source: 'manual', required: false },
      { token: 'دائرة_الكفيل', label: 'دائرة أو وظيفة الكفيل', source: 'manual', required: false },
      { token: 'العنوان_الوظيفي_للكفيل', label: 'العنوان الوظيفي للكفيل', source: 'manual', required: false },
      { token: 'هاتف_الكفيل', label: 'هاتف الكفيل', source: 'manual', required: false }
    ]
  },
  {
    id: null,
    code: 'تعهد-قانوني',
    title: 'تعهد خطي وقانوني عام',
    subtitle: 'إقرار وتعهد شخصي بتحمل المسؤولية والتبعات القانونية والجزائية',
    category: 'تعهدات وإقرارات',
    subjectLine: 'م/ تعهد خطي وقانوني',
    letterheadId: null,
    bodyHtml: `<div style="font-family: inherit; line-height: 1.85; color: #111;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">جمهورية العراق</h2>
    <h3 style="margin: 8px 0 0; font-size: 18px; font-weight: bold; text-decoration: underline;">تـعـهـد خـطـي وقـانـونـي</h3>
  </div>

  <p style="text-align: justify; margin-bottom: 14px;">
    أقر وأتعهد أنا الموقع أدناه: <strong>{الاسم}</strong>، أحمل البطاقة الوطنية الموحدة رقم: <strong>{الرقم_الوطني}</strong>، محل وتاريخ التولد: <strong>{محل_وتاريخ_الولادة}</strong>، الساكن في: <strong>{العنوان}</strong>، ورقم الهاتف: <strong>{رقم_الهاتف}</strong>.
  </p>

  <p style="text-align: justify; margin-bottom: 14px;">
    بأني وبكامل أهليتي القانونية والشرعية والمدنية المعتبرة، أتعهد وألتزم بالآتي:
  </p>

  <div style="background-color: #f9f9f9; border: 1px solid #ccc; padding: 16px; border-radius: 6px; margin-bottom: 16px; font-size: 14.5px; min-height: 80px;">
    {موضوع_التعهد}
  </div>

  <p style="text-align: justify; margin-bottom: 20px;">
    وإنني أتحمل كافة التبعات القانونية والجزائية والمدنية والمالية المترتبة على ذلك بموجب القوانين والتشريعات العراقية النافذة في حال مخالفتي لما ورد في هذا التعهد أو ثبوت عدم صحة أي بيان، وهذا تعهد رسمي وإقرار مني بذلك.
  </p>

  <p style="margin-bottom: 25px;"><strong>تحريراً في:</strong> {تاريخ_التعهد}</p>

  <div style="display: flex; justify-content: space-around; margin-top: 30px; text-align: center;">
    <div>
      <strong>المتعهد بما فيه</strong><br/><br/>
      الاسم الثلاثي: {الاسم}<br/>
      التوقيع: ...........................<br/>
      بصمة الإبهام الأيسر: [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
    </div>
    <div>
      <strong>الشاهد الأول</strong><br/><br/>
      الاسم: ...........................<br/>
      التوقيع: ...........................
    </div>
    <div>
      <strong>الشاهد الثاني</strong><br/><br/>
      الاسم: ...........................<br/>
      التوقيع: ...........................
    </div>
  </div>
</div>`,
    variables: [
      { token: 'الاسم', label: 'الاسم الرباعي واللقب', source: 'citizen', required: true },
      { token: 'الرقم_الوطني', label: 'الرقم الوطني', source: 'citizen', required: true },
      { token: 'محل_وتاريخ_الولادة', label: 'محل وتاريخ الولادة', source: 'citizen', required: false },
      { token: 'العنوان', label: 'العنوان السكني', source: 'citizen', required: false },
      { token: 'رقم_الهاتف', label: 'رقم الهاتف', source: 'manual', required: false },
      { token: 'موضوع_التعهد', label: 'موضوع التعهد ونصه', source: 'manual', required: true },
      { token: 'تاريخ_التعهد', label: 'تاريخ التعهد', source: 'manual', required: true }
    ]
  },
  {
    id: null,
    code: 'سند-مخالصة',
    title: 'سند مخالصة وإبراء ذمة وتنازل عن حق',
    subtitle: 'إبراء ذمة شامل ونهائي وتنازل عرفي مسقط لكل حق ودعوى',
    category: 'تعهدات وإقرارات',
    subjectLine: 'م/ سند مخالصة وإبراء ذمة',
    letterheadId: null,
    bodyHtml: `<div style="font-family: inherit; line-height: 1.85; color: #111;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">بسم الله الرحمن الرحيم</h2>
    <h3 style="margin: 8px 0 0; font-size: 18px; font-weight: bold; text-decoration: underline;">سند مخالصة وإبراء ذمة وتنازل</h3>
  </div>

  <p style="text-align: justify; margin-bottom: 14px;">
    أقر وأعترف أنا الموقع أدناه (المُبرئ): <strong>{الاسم}</strong>، أحمل البطاقة الوطنية رقم: <strong>{الرقم_الوطني}</strong>، الساكن في: <strong>{العنوان}</strong>.
  </p>

  <p style="text-align: justify; margin-bottom: 14px;">
    بأنني قد استلمت كامل حقوقي ومستحقاتي المالية والمعنوية من السيد (المُبرأ): <strong>{اسم_الطرف_الثاني}</strong>، الحامل للبطاقة الوطنية رقم: <strong>{رقم_هوية_الطرف_الثاني}</strong>، وذلك بخصوص:
  </p>

  <div style="background-color: #f9f9f9; border: 1px solid #ccc; padding: 14px; border-radius: 6px; margin-bottom: 16px; font-size: 14.5px;">
    {موضوع_المخالصة}
  </div>

  <p style="text-align: justify; margin-bottom: 20px;">
    وعليه، فإن ذمة السيد المذكور بريئة براءة تامة وشاملة من أي حق أو التزام أو مطالبة مالية أو قانونية سابقة أو حالية أو لاحقة متعلقة بهذا الموضوع، وأسقطت حقي في إقامة أي دعوى قضائية أو شكوى مدنية أو جزائية أو عشائرية، وهذا إبراء ومخالصة نافذة لا رجوع فيها.
  </p>

  <p style="margin-bottom: 25px;"><strong>تحريراً في:</strong> {تاريخ_المخالصة}</p>

  <div style="display: flex; justify-content: space-around; margin-top: 30px; text-align: center;">
    <div>
      <strong>الطرف الأول (المُبرئ)</strong><br/><br/>
      التوقيع: ...........................<br/>
      البصمة: [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
    </div>
    <div>
      <strong>الطرف الثاني (المُبرأ)</strong><br/><br/>
      التوقيع: ...........................
    </div>
    <div>
      <strong>الشاهد الأول</strong><br/><br/>
      التوقيع: ...........................
    </div>
  </div>
</div>`,
    variables: [
      { token: 'الاسم', label: 'اسم الطرف الأول (المُبرئ)', source: 'citizen', required: true },
      { token: 'الرقم_الوطني', label: 'الرقم الوطني للطرف الأول', source: 'citizen', required: true },
      { token: 'العنوان', label: 'عنوان الطرف الأول', source: 'citizen', required: false },
      { token: 'اسم_الطرف_الثاني', label: 'اسم الطرف الثاني (المُبرأ)', source: 'manual', required: true },
      { token: 'رقم_هوية_الطرف_الثاني', label: 'رقم هوية الطرف الثاني', source: 'manual', required: false },
      { token: 'موضوع_المخالصة', label: 'موضوع وحيثيات المخالصة', source: 'manual', required: true },
      { token: 'تاريخ_المخالصة', label: 'تاريخ المخالصة', source: 'manual', required: true }
    ]
  }
];

/**
 * دالة مساعدة لتثبيت النماذج العرفية دفعة واحدة
 */
export async function installContracts(
  saveTemplateFn: (input: TemplateInput) => Promise<any>,
  existingCodes: Set<string>
): Promise<{ installed: number; skipped: number }> {
  let installed = 0;
  let skipped = 0;

  for (const preset of CONTRACT_PRESETS) {
    if (preset.code && existingCodes.has(preset.code)) {
      skipped++;
      continue;
    }
    await saveTemplateFn(preset);
    installed++;
  }

  return { installed, skipped };
}
