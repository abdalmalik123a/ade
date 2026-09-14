-- فهارس البحث العربي (FTS5)
-- الشروط الإلزامية للأداء:
--   1) content='' — فهرس خارجي بلا تكرار للنص، والمحتوى يُحقن يدويًا من طبقة التطبيق.
--   2) الحقول المفهرسة تُخزَّن مُطبَّعة مسبقًا (normalizeFold) — لا تطبيع وقت الاستعلام.
--   3) prefix='2 3 4' — يجعل البحث الجزئي فوريًا وهو النمط الغالب عند الموظف.
--   4) detail='none' — يقلّص الفهرس كثيرًا، ولا نحتاج مواضع الكلمات.

CREATE VIRTUAL TABLE IF NOT EXISTS citizens_fts USING fts5(
  full_name,
  national_id,
  job_title,
  workplace,
  employee_code,
  phone,
  content='',
  prefix='2 3 4',
  detail='none'
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  serial,
  doc_type,
  destination,
  purpose,
  citizen_name,
  body_text,
  content='',
  prefix='2 3 4',
  detail='none'
);

CREATE VIRTUAL TABLE IF NOT EXISTS templates_fts USING fts5(
  code,
  title,
  subtitle,
  category,
  body_text,
  content='',
  prefix='2 3 4',
  detail='none'
);

CREATE VIRTUAL TABLE IF NOT EXISTS attachments_fts USING fts5(
  doc_type,
  ocr_text,
  content='',
  prefix='2 3 4',
  detail='none'
);
