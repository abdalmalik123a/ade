/**
 * القائمة: الأنواع العشرون بمقاساتها ومجموعاتها وتخطيطها وعيّنتها — ما يطلبه الزبون فعلًا من المكتب. والمنيو والوصل والفاتورة
 * (٣٫١) استماراتٌ تُملأ بالقلم بلا حساب (قرار المالك)، والإمساكية (٣٫٤) آخرها — وتُضاف الأنواع في آخر القائمة أبدًا، فلا
 * تتبدّل لوحات ما قبلها في اللقطات.
 */
import type { CanvasSize } from '../model/types';
import type { KindSpec } from './types';
import { SAMPLE } from './sample';
import { certificate, honour, invitation } from './layouts/sheets';
import { businessCard, examCard, idBack, label, staffId, studentId } from './layouts/cards';
import { eventBadge, greetingCard, modernBusinessCard, trainingCert } from './layouts/more';
import { invoice, menu, receipt } from './layouts/forms';
import { imsakiya } from './layouts/imsakiya';

const A4L: CanvasSize = { w: 297, h: 210 };
const A4P: CanvasSize = { w: 210, h: 297 };
const A5P: CanvasSize = { w: 148, h: 210 };
const A5L: CanvasSize = { w: 210, h: 148 };
const A6L: CanvasSize = { w: 148, h: 105 };
const CR80L: CanvasSize = { w: 85.6, h: 54 };
const CR80P: CanvasSize = { w: 54, h: 85.6 };
const CARD9x5: CanvasSize = { w: 90, h: 50 };

// ── القائمة ──────────────────────────────────────────────────────────

export const KINDS: KindSpec[] = [
  // ── شهادات ──
  {
    key: 'thanks',
    title: 'شكر وتقدير',
    group: 'شهادات',
    size: A4L,
    bleed: 0,
    family: 'sheet',
    layout: certificate('شكر وتقدير', 'تتقدّم {الجهة} بخالص الشكر والتقدير إلى', '{السبب}'),
    sample: SAMPLE
  },
  {
    key: 'excellence',
    title: 'شهادة تفوّق',
    group: 'شهادات',
    size: A4L,
    bleed: 0,
    family: 'sheet',
    layout: certificate(
      'شهادة تفوّق',
      'تمنح {الجهة} هذه الشهادة إلى',
      'لتفوّقه في {المرحلة} للعام الدراسي {العام الدراسي}'
    ),
    sample: SAMPLE
  },
  { key: 'training-cert', title: 'شهادة تدريب وتأهيل', group: 'شهادات', size: A4L, bleed: 0, family: 'sheet', layout: trainingCert, sample: SAMPLE },
  {
    key: 'graduation',
    title: 'شهادة تخرّج',
    group: 'شهادات',
    size: A4L,
    bleed: 0,
    family: 'sheet',
    layout: certificate('شهادة تخرّج', 'تشهد {الجهة} بأنّ', 'قد أتمّ {المرحلة} بنجاح للعام الدراسي {العام الدراسي}'),
    sample: SAMPLE
  },
  {
    key: 'participation',
    title: 'شهادة مشاركة',
    group: 'شهادات',
    size: A4L,
    bleed: 0,
    family: 'sheet',
    layout: certificate('شهادة مشاركة', 'تشهد {الجهة} بأنّ', 'قد شارك في {النشاط} المقام بتاريخ {تاريخ النشاط}'),
    sample: SAMPLE
  },
  { key: 'honour', title: 'لوحة الشرف', group: 'شهادات', size: A4P, bleed: 0, family: 'sheet', layout: honour, sample: SAMPLE },

  // ── هويّات ──
  { key: 'student-id', title: 'هويّة طالب', group: 'هويّات', size: CR80L, bleed: 3, family: 'card', layout: studentId, sample: SAMPLE },
  { key: 'staff-id', title: 'هويّة موظف', group: 'هويّات', size: CR80P, bleed: 3, family: 'card', layout: staffId, sample: SAMPLE },
  { key: 'event-badge', title: 'باج مؤتمر / مشارك', group: 'هويّات', size: CR80P, bleed: 3, family: 'card', layout: eventBadge, sample: SAMPLE },
  { key: 'id-back', title: 'ظهر الهويّة', group: 'هويّات', size: CR80L, bleed: 3, family: 'card', layout: idBack, sample: SAMPLE },

  // ── أعمال وكروت ──
  { key: 'business', title: 'بطاقة عمل كلاسيكية', group: 'أعمال وكروت', size: CARD9x5, bleed: 2, family: 'card', layout: businessCard, sample: SAMPLE },
  { key: 'modern-card', title: 'كرت شخصي حديث مع QR', group: 'أعمال وكروت', size: CARD9x5, bleed: 2, family: 'card', layout: modernBusinessCard, sample: SAMPLE },

  // ── مناسبات ──
  { key: 'invitation', title: 'بطاقة دعوة', group: 'مناسبات', size: A5P, bleed: 3, family: 'sheet', layout: invitation, sample: SAMPLE },
  { key: 'greeting-card', title: 'بطاقة تهنئة ومباركة', group: 'مناسبات', size: A5L, bleed: 2, family: 'sheet', layout: greetingCard, sample: SAMPLE },

  // ── مدرسية ──
  { key: 'exam-card', title: 'البطاقة الامتحانية', group: 'مدرسية', size: A6L, bleed: 3, family: 'card', layout: examCard, sample: SAMPLE },
  { key: 'label', title: 'ملصق دفتر وتغليف', group: 'مدرسية', size: CARD9x5, bleed: 2, family: 'card', layout: label, sample: SAMPLE },

  // ── مطاعم ومحلّات (٣٫١) ──
  { key: 'menu', title: 'منيو مطعم', group: 'مطاعم ومحلّات', size: A4P, bleed: 3, family: 'sheet', layout: menu, sample: SAMPLE },
  { key: 'receipt', title: 'وصل قبض', group: 'مطاعم ومحلّات', size: A5L, bleed: 0, family: 'sheet', layout: receipt, sample: SAMPLE },
  { key: 'invoice', title: 'استمارة فاتورة', group: 'مطاعم ومحلّات', size: A5P, bleed: 0, family: 'sheet', layout: invoice, sample: SAMPLE },

  // ── مناسبات (٣٫٤): الإمساكية بجدولها الرسمي ──
  { key: 'imsakiya', title: 'إمساكية رمضان', group: 'مناسبات', size: A4P, bleed: 3, family: 'sheet', layout: imsakiya, sample: SAMPLE }
];

export const kindOf = (key: string): KindSpec | undefined => KINDS.find((k) => k.key === key);
