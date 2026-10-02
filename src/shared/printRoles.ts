/**
 * أدوار الطابعات (خطة Production، ٢٫١ — قرار المالك ٢٩ أيلول ٢٠٢٦).
 *
 * المكتب لا يطبع كلّ شيءٍ على طابعةٍ واحدة: الكتب على الليزر، والصور على طابعة الصور، والشهادات
 * على الملوّنة. فلكلّ نوع عملٍ دوره: طابعةٌ «عادي» وأخرى «ملوّن» اختيارية — والتكرار بين الأدوار
 * مقبول — وخيار «اعرض نافذة الطباعة».
 *
 * وما يحدث عند «اطبع» حكمٌ واحد هنا (`planPrint`) لكلّ شاشة:
 * - طابعةٌ واحدة بلا نافذة ← تطبع مباشرة.
 * - طابعتان بلا نافذة ← سؤالٌ واحد: «عادي أم ملوّن؟».
 * - النافذة مطلوبة، أو لا طابعة محدّدة ← نافذة البرنامج: تُختار الطابعة مرّةً للمهمّة كلّها.
 *
 * ونافذة البرنامج لا نافذة ويندوز: تلك تُفتح لكلّ ورقة — معاملةٌ من خمس أوراق خمس نوافذ — ولا
 * تقول أيّ طابعةٍ اختير، فلا تُطبع البقيّة عليها. ولا تُدمج الأوراق في مهمّةٍ واحدة لتُفتح مرّة:
 * لكلّ ورقةٍ مقاسها وهوامشها، والدمج يُلبسها هوامش الأخيرة.
 */

export const PRINT_ROLES = [
  { key: 'documents', label: 'الكتب والمعاملات', hint: 'الشبّاك والمحرّر وإعادة الطبع من الأرشيف' },
  { key: 'papers', label: 'أوراق الأسئلة', hint: 'الأوراق ونسخها، وورقة الدوائر' },
  { key: 'photos', label: 'الصور الشخصية', hint: 'صور المعاملة على ورق الصور أو A4' },
  { key: 'designs', label: 'التصاميم والشهادات والهويات', hint: 'الدفعات على ورقٍ يُقصّ' },
  { key: 'copies', label: 'استنساخ المستمسكات', hint: 'الوجه والظهر، والمستمسك من ملف المواطن' }
] as const;

export type PrintRoleKey = (typeof PRINT_ROLES)[number]['key'];

/** طابعة «عادي» و«ملوّن» باسمهما في ويندوز — `null`: لا طابعة. */
export type PrintRole = { normal: string | null; color: string | null; dialog: boolean };

export type PrintRoles = Record<PrintRoleKey, PrintRole>;

const name = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/**
 * الأدوار كما حُفظت — وما لم يُحفظ منها يأخذ الطابعة الافتراضية القديمة بلا نافذة، فيطبع المكتب
 * بعد التحديث كما كان يطبع من المحرّر. و«ملوّن» بلا «عادي» يصير هو العادي.
 */
export function normalizePrintRoles(raw: unknown, fallback: string | null): PrintRoles {
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as PrintRoles;
  for (const { key } of PRINT_ROLES) {
    const r = saved[key];
    if (!r || typeof r !== 'object') {
      out[key] = { normal: name(fallback), color: null, dialog: false };
      continue;
    }
    const role = r as Record<string, unknown>;
    let normal = name(role['normal']);
    let color = name(role['color']);
    if (!normal && color) [normal, color] = [color, null];
    if (color === normal) color = null;
    out[key] = { normal, color, dialog: role['dialog'] === true };
  }
  return out;
}

export type PrintPlan =
  | { kind: 'direct'; printer: string }
  | { kind: 'choose-color'; normal: string; color: string }
  | { kind: 'dialog'; normal: string | null; color: string | null };

/** ما يحدث عند «اطبع» في هذا الدور. */
export function planPrint(role: PrintRole): PrintPlan {
  if (role.dialog || !role.normal) return { kind: 'dialog', normal: role.normal, color: role.color };
  if (role.color) return { kind: 'choose-color', normal: role.normal, color: role.color };
  return { kind: 'direct', printer: role.normal };
}

/** ما يُكتب بعد «الطباعة إلى:» — و`null` حين تُختار الطابعة عند الطبع. */
export function describeRole(role: PrintRole): string | null {
  const plan = planPrint(role);
  if (plan.kind === 'direct') return plan.printer;
  if (plan.kind === 'choose-color') return `${plan.normal} أو ${plan.color} (يُسأل عند الطبع)`;
  return null;
}
