/**
 * نموذج الكتاب الرسمي.
 *
 * صيغة المتغيّر في المتن هي `{الاسم}` — كما يفعل محرّك التصميم تمامًا.
 * أما `[الاسم]` فهي صورة العرض في بطاقات المكتبة، لا صيغة المحرّك.
 */

export type VariableSource = 'manual' | 'citizen' | 'auto';

export type TemplateVariable = {
  token: string;
  label: string;
  source: VariableSource;
  required: boolean;
};

export type TemplateInput = {
  id: number | null;
  code: string | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  subjectLine: string | null;
  bodyHtml: string;
  letterheadId: number | null;
  variables: TemplateVariable[];
};

/** الحقول التي يملؤها المحرّك وحده — لا يكتبها الموظف. */
export const AUTO_TOKENS = [
  { token: 'رقم_الصادر', label: 'رقم الصادر' },
  { token: 'التاريخ_الميلادي', label: 'التاريخ الميلادي' },
  { token: 'التاريخ_الهجري', label: 'التاريخ الهجري' }
] as const;

/** الحقول التي تأتي من ملف المواطن عند الاستيراد بـ F2. */
export const CITIZEN_TOKENS = [
  { token: 'الاسم', label: 'الاسم الرباعي واللقب', field: 'full_name' },
  { token: 'الرقم_الوطني', label: 'الرقم الوطني', field: 'national_id' },
  { token: 'العنوان_الوظيفي', label: 'العنوان الوظيفي', field: 'job_title' },
  { token: 'مكان_العمل', label: 'مكان العمل', field: 'workplace' },
  { token: 'الحالة_الوظيفية', label: 'الحالة الوظيفية', field: 'service_status' },
  { token: 'محل_الولادة', label: 'محل الولادة', field: 'birth_place' },
  { token: 'تاريخ_الولادة', label: 'تاريخ الولادة', field: 'birth_date' },
  { token: 'العنوان', label: 'العنوان السكني', field: 'address' }
] as const;

const TOKEN_RE = /\{([^{}\s][^{}]*)\}/g;

/** يستخرج المتغيّرات المكتوبة فعلًا في المتن — فلا تتعارض القائمة مع النص. */
export function extractTokens(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(TOKEN_RE)) {
    const name = m[1]?.trim();
    if (name) found.add(name);
  }
  return [...found];
}

/** يوفّق قائمة المتغيّرات مع ما في المتن: يضيف الجديد ويحذف ما اختفى. */
export function reconcileVariables(
  body: string,
  existing: TemplateVariable[]
): TemplateVariable[] {
  const tokens = extractTokens(body);
  const byToken = new Map(existing.map((v) => [v.token, v]));
  return tokens.map((token) => {
    const prev = byToken.get(token);
    if (prev) return prev;
    const auto = AUTO_TOKENS.find((a) => a.token === token);
    if (auto) return { token, label: auto.label, source: 'auto' as const, required: false };
    const citizen = CITIZEN_TOKENS.find((c) => c.token === token);
    if (citizen)
      return { token, label: citizen.label, source: 'citizen' as const, required: true };
    return { token, label: token.replace(/_/g, ' '), source: 'manual' as const, required: false };
  });
}

/** يعوّض المتغيّرات بقيمها لعرض المعاينة. الفارغ يبقى وسمًا ظاهرًا ليُنبّه الموظف. */
export function renderBody(
  body: string,
  values: Record<string, string>,
  opts: { markMissing?: boolean } = {}
): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return escape(body)
    .replace(/\{([^{}]+)\}/g, (whole, rawName: string) => {
      const name = rawName.trim();
      const value = values[name];
      if (value) {
        return `<span class="font-bold text-black underline underline-offset-4 decoration-1">${escape(value)}</span>`;
      }
      if (opts.markMissing === false) return '';
      return `<span class="px-1 rounded bg-surface-container-high text-secondary font-mono">${whole}</span>`;
    })
    .replace(/\n/g, '<br/>');
}
