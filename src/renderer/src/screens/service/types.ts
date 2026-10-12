/**
 * أنواع الشبّاك المشتركة بين شاشته وأجزائها (تقسيم الشبّاك بعد ١٫٧٫٠).
 */
import type { Doc } from '@shared/doc';
import type { LetterheadLayout } from '@shared/letterhead';
import type { TemplateDetail, TemplateSummary } from '@shared/api';

export type Step = 'pick' | 'fill' | 'review';

/** نموذجٌ مختار بتفاصيله ووثيقته وترويسته — يُحمَّل مرّةً عند الانتقال إلى «املأ». */
export type Loaded = {
  summary: TemplateSummary;
  detail: TemplateDetail;
  doc: Doc;
  layout: LetterheadLayout | null;
};

/** «نسخة عن …» (د٤): الكتاب الأصل، و«وأبطل الأصل» بسببه. */
export type RepeatOf = { id: number; serial: string; voidIt: boolean; reason: string };

/** طباعة ما صدر: كم أُرسل من كم، وأجاريةٌ أم توقّفت بسببها (خطة Production، ٢٫٣). */
export type PrintRun = { id?: string; sent: number; total: number; reason?: string; running: boolean };
