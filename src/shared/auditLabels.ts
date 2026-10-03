/**
 * سجلّ التدقيق بلغة المكتب — «أُعيدت طباعته نسختين» لا `document/reprint`.
 *
 * القيد في القاعدة رموزٌ ثابتة (`entity` و`action`) تُسأل وتُرشَّح؛ وما يُقرأ جملةٌ
 * تُبنى هنا. وما لم يُعرف رمزه يُعرض كما هو — لا يُخفى قيدٌ لأنه جديد.
 */
import type { AuditEntry } from './api';

export const AUDIT_ENTITIES: { value: string; label: string }[] = [
  { value: 'document', label: 'الكتب' },
  { value: 'transaction', label: 'المعاملات' },
  { value: 'backup', label: 'النسخ الاحتياطية' },
  { value: 'content', label: 'حزم المحتوى' },
  { value: 'license', label: 'التفعيل' }
];

export function auditLabel(e: Pick<AuditEntry, 'entity' | 'action' | 'detail'>): string {
  const detail = e.detail?.trim() ?? '';
  switch (`${e.entity}/${e.action}`) {
    case 'document/issue':
      return 'صدر';
    case 'document/reprint':
      return detail ? `أُعيدت طباعته (${detail})` : 'أُعيدت طباعته';
    case 'document/void':
      // التفصيل «م/٢٠٢٦/٤ — السبب»: يكفي السبب، فالرقم ظاهرٌ بجانبه.
      return `أُبطل: ${detail.includes(' — ') ? detail.split(' — ').slice(1).join(' — ') : detail}`;
    case 'transaction/issue':
      return `معاملة: ${detail}`;
    case 'transaction/link-citizen':
      return 'رُبطت كتب المعاملة بملف المواطن';
    case 'backup/create':
      return `نسخة احتياطية${detail ? `: ${detail}` : ''}`;
    case 'backup/restore':
      return `استُرجعت نسخة احتياطية${detail ? `: ${detail}` : ''}`;
    case 'content/export':
      return `صُدّرت حزمة محتوى${detail ? `: ${detail}` : ''}`;
    case 'license/activate':
      return `فُعّل البرنامج${detail ? ` لـ${detail}` : ''}`;
    case 'license/subscribe':
      return `اشتراك${detail ? ` ${detail}` : ''}`;
    case 'license/extend':
      return `مُدّت المدّة التجريبية${detail ? ` ${detail}` : ''}`;
    case 'content/import':
      return `استُوردت حزمة محتوى${detail ? `: ${detail}` : ''}`;
    default:
      return [e.entity, e.action, detail].filter(Boolean).join(' · ');
  }
}
