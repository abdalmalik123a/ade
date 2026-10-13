/**
 * تنبيه إعداد النسخ الاحتياطي التلقائي بعد إصدار أول كتاب رسمي (المرحلة A، ٣ والجواب ٢).
 */
import { ask } from '../kit/ask';
import type { RouteKey } from '@shared/routes';

export async function checkFirstDocumentBackupPrompt(
  navigate: (key: RouteKey) => void
): Promise<void> {
  try {
    const shouldPrompt = await window.diwan.backup.shouldPromptAfterFirstIssue();
    if (!shouldPrompt) return;

    await window.diwan.backup.markFirstIssuePromptShown();

    const choice = await ask({
      title: 'إعداد النسخ الاحتياطي التلقائي',
      message:
        'صدر أول كتاب رسمي بنجاح! لحماية بياناتك وسجلاتك من الضياع عند تعطل الجهاز، ننصح بضبط النسخ الاحتياطي التلقائي واختيار مجلد على قرص مستقل أو وحدة تخزين خارجية (مثل فلاشة USB) بعيدًا عن ملفات البرنامج الأصلية.',
      choices: [
        { key: 'later', label: 'لاحقًا', tone: 'neutral' },
        { key: 'settings', label: 'اضبط النسخ الآن', tone: 'primary' }
      ],
      fallback: 'later'
    });

    if (choice === 'settings') {
      navigate('settings');
    }
  } catch {
    // لا يُسقط تعذّر السؤال عمل البرنامج
  }
}
