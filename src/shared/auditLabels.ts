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
  { value: 'backup', label: 'النسخ الاحتياطية' }
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
    default:
      return [e.entity, e.action, detail].filter(Boolean).join(' · ');
  }
}
