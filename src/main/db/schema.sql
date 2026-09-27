-- ديوان — مخطط الأرشيف المحلي (SQLite)
-- كل الجداول تبدأ فارغة. لا بيانات مبرمَجة إطلاقًا: المكتب هو من يملؤها.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── إعدادات المكتب والترويسة ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الجهات الإدارية (المديرية العامة / القسم / التشكيل) — شجرة حرّة البنية
CREATE TABLE IF NOT EXISTS authorities (
  id          INTEGER PRIMARY KEY,
  parent_id   INTEGER REFERENCES authorities(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT,                       -- مديرية عامة | قسم | مدرسة/تشكيل | جهة خارجية
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_authorities_parent ON authorities(parent_id);

-- الترويسات والأختام — حرّة البنية (الكتاب يصدر عن جهة لا عن المكتب)
CREATE TABLE IF NOT EXISTS letterheads (
  id            INTEGER PRIMARY KEY,
  authority_id  INTEGER REFERENCES authorities(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  layout_json   TEXT NOT NULL,            -- بنية الترويسة: كتل، مواضع، شعار، أسطر
  is_default    INTEGER NOT NULL DEFAULT 0,
  category      TEXT,                     -- يسمّيه المكتب: مدرسة، تربية، بلدية… لا قائمة مفروضة
  is_favorite   INTEGER NOT NULL DEFAULT 0,
  used_at       TEXT,                     -- آخر استعمال — عليه يقوم ترتيب المكتبة
  search_fold   TEXT,                     -- الاسم والتصنيف ونصّ الترويسة، مطبَّعًا
  uuid          TEXT,                     -- هويّة ثابتة لا تتغيّر بالاسم ولا بالجهاز (FOUNDATION §٣)
  revision      INTEGER NOT NULL DEFAULT 1, -- يزيد مع كل حفظٍ غيّر شيئًا؛ وما قبله في revisions
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
-- فهرس search_fold يُنشأ في الترحيل (services/letterheads.ts)، لا هنا — كما في documents.
-- وكذا فهرس uuid الفريد (services/revisions.ts): قاعدة مكتبٍ قائمة لم يُضف عمودها بعد.

CREATE TABLE IF NOT EXISTS seals (
  id            INTEGER PRIMARY KEY,
  authority_id  INTEGER REFERENCES authorities(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  image_path    TEXT,                     -- ملف داخل مخزن التطبيق
  kind          TEXT,                     -- ختم | توقيع | شعار
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── المواطنون والموظفون ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citizens (
  id              INTEGER PRIMARY KEY,
  full_name       TEXT NOT NULL,          -- الاسم الرباعي واللقب
  national_id     TEXT,                   -- الرقم الوطني / البطاقة الموحدة
  job_title       TEXT,                   -- العنوان الوظيفي
  workplace       TEXT,                   -- مكان العمل / المديرية
  employee_code   TEXT,                   -- رمز الموظف
  service_status  TEXT,                   -- الحالة الوظيفية والخدمة
  birth_date      TEXT,                   -- تاريخ الولادة
  birth_place     TEXT,                   -- محل الولادة
  enrollment_dept TEXT,                   -- دائرة الانتساب والدرجة
  address         TEXT,                   -- محلة / زقاق / دار
  housing_card_no TEXT,                   -- رقم بطاقة السكن
  landmark        TEXT,                   -- أقرب نقطة دالة
  phone           TEXT,
  photo_path      TEXT,                   -- الصورة الشخصية 6x4
  category        TEXT,                   -- تصنيف الدليل (تربية وتعليم، متقاعدين، ...)
  verified        INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_citizens_nid ON citizens(national_id);
CREATE INDEX IF NOT EXISTS ix_citizens_cat ON citizens(category);

-- المستمسكات الممسوحة ضوئيًا
CREATE TABLE IF NOT EXISTS attachments (
  id            INTEGER PRIMARY KEY,
  citizen_id    INTEGER NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL,            -- البطاقة الوطنية الموحدة، بطاقة السكن، ...
  file_path     TEXT NOT NULL,
  file_format   TEXT,                     -- PNG | PDF/A | JPG
  dpi           INTEGER,                  -- 600 حسب التصميم
  ocr_text      TEXT,
  ocr_accuracy  REAL,                     -- نسبة استخراج النصوص
  scanned_at    TEXT,
  sha256        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_attach_citizen ON attachments(citizen_id);

-- ── النماذج والمسودات ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id            INTEGER PRIMARY KEY,
  code          TEXT UNIQUE,              -- DIW-EDU-301
  title         TEXT NOT NULL,
  subtitle      TEXT,
  category      TEXT,                     -- ملاك تربوي، قرارات ملزمة، إخطار عدلي، ...
  letterhead_id INTEGER REFERENCES letterheads(id) ON DELETE SET NULL,
  body_html     TEXT NOT NULL DEFAULT '',
  doc_json      TEXT,                     -- الوثيقة كتلًا؛ وbody_html ظلّها نصًّا للبحث والمحرّر القديم
  issuing       TEXT NOT NULL DEFAULT 'registered',  -- registered: كتابٌ يُقيَّد · print-only: ورقةٌ تُطبع
  subject_line  TEXT,                     -- م / ...
  is_active     INTEGER NOT NULL DEFAULT 1,
  print_count   INTEGER NOT NULL DEFAULT 0,
  uuid          TEXT,                     -- هويّة ثابتة (FOUNDATION §٣)
  revision      INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS template_variables (
  id          INTEGER PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,              -- اسم_المواطن
  label       TEXT,
  source      TEXT,                       -- citizen.full_name | manual | auto
  required    INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_tvars_tpl ON template_variables(template_id);

CREATE TABLE IF NOT EXISTS drafts (
  id          INTEGER PRIMARY KEY,
  template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  citizen_id  INTEGER REFERENCES citizens(id) ON DELETE SET NULL,
  title       TEXT,
  values_json TEXT NOT NULL DEFAULT '{}',
  body_html   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── سجل الصادر (الكتب المصدَّرة فعليًا) ───────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id             INTEGER PRIMARY KEY,
  serial         TEXT NOT NULL UNIQUE,    -- م/2024/9184
  serial_year    INTEGER NOT NULL,
  serial_seq     INTEGER NOT NULL,
  template_id    INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  citizen_id     INTEGER REFERENCES citizens(id) ON DELETE SET NULL,
  authority_id   INTEGER REFERENCES authorities(id) ON DELETE SET NULL,
  letterhead_id  INTEGER,                 -- من أي ترويسة جاء؛ واللقطة هي الحقيقة عند الرسم
                                          -- ولا قيد أجنبي: حذفها من المكتبة لا يمسّ الكتاب
  transaction_id INTEGER,                 -- معاملة الزبون الواحد: خمس أوراق قيدٌ واحد
  citizen_name   TEXT,                    -- صورة الاسم وقت الإصدار: الكتاب يبقى شاهدًا
  citizen_nid    TEXT,                    -- ولو حُذف ملف المواطن أو صدر لمن لا ملفّ له
  doc_type       TEXT,                    -- تأييد سكن معنون، براءة ذمة وظيفية، ...
  destination    TEXT,                    -- الجهة الموجه إليها
  purpose        TEXT,                    -- الغرض من التأييد
  values_json    TEXT NOT NULL DEFAULT '{}',
  body_html      TEXT NOT NULL,
  rendered_path  TEXT,                    -- نسخة PDF المؤرشفة
  copies         INTEGER NOT NULL DEFAULT 1,
  copy_kind      TEXT,                    -- نسخة أصلية | مصدقة | مختومة
  fee            INTEGER NOT NULL DEFAULT 0,
  gregorian_date TEXT NOT NULL,
  hijri_date     TEXT,
  issued_at      TEXT NOT NULL DEFAULT (datetime('now')),
  operator       TEXT,
  sha256         TEXT NOT NULL,           -- بصمة التوثيق
  status         TEXT NOT NULL DEFAULT 'issued',
  search_fold    TEXT,                    -- صورة مطبَّعة للبحث العربي المتساهل
  UNIQUE(serial_year, serial_seq)
);
CREATE INDEX IF NOT EXISTS ix_docs_citizen ON documents(citizen_id);
CREATE INDEX IF NOT EXISTS ix_docs_issued ON documents(issued_at);
-- فهرس search_fold يُنشأ في الترحيل (services/documents.ts)، لا هنا:
-- CREATE TABLE IF NOT EXISTS لا يضيف عمودًا إلى جدول قائم، فيسقط الفهرس
-- على قاعدة أُنشئت قبل هذا العمود ويُسقط إقلاع التطبيق كلّه معه.

CREATE TABLE IF NOT EXISTS document_prints (
  id          INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  copies      INTEGER NOT NULL DEFAULT 1,
  printer     TEXT,
  reason      TEXT,                       -- إصدار أول | إعادة طباعة طبق الأصل
  printed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  operator    TEXT
);
CREATE INDEX IF NOT EXISTS ix_prints_doc ON document_prints(document_id);

-- تسلسل أرقام الصادر (لكل سنة عدّاد مستقل)
CREATE TABLE IF NOT EXISTS counters (
  scope       TEXT NOT NULL,              -- 'outgoing'
  year        INTEGER NOT NULL,
  last_value  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, year)
);

-- الكليشات: عبارات المكتب. تبدأ فارغة وتُبنى بالاستعمال.
CREATE TABLE IF NOT EXISTS clips (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  category    TEXT,
  used_at     TEXT,                      -- آخر إدراج — عليه يقوم الترتيب
  search_fold TEXT,
  direction   TEXT,                      -- up | down | peer | NULL: لمن تُكتب (FOUNDATION §٦)
  uuid        TEXT,                      -- هويّة ثابتة (FOUNDATION §٣)
  revision    INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- النسخ السابقة للنماذج والترويسات والكليشات: الحالة قبل كل حفظٍ غيّر شيئًا،
-- فيعود المكتب إلى «نسخة أمس». والجارية في جدول القطعة نفسها.
CREATE TABLE IF NOT EXISTS revisions (
  id         INTEGER PRIMARY KEY,
  kind       TEXT NOT NULL,              -- template | letterhead | clip
  item_uuid  TEXT NOT NULL,
  revision   INTEGER NOT NULL,
  payload    TEXT NOT NULL,              -- JSON: ما يُحرَّر من القطعة
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kind, item_uuid, revision)
);

-- سجل التدقيق
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  action     TEXT NOT NULL,
  detail     TEXT,
  operator   TEXT,
  at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- معاملة الزبون الواحد: يطلب خمس أوراق فتُقيَّد قيدًا واحدًا، ولكل ورقة
-- رقم صادرها وبصمتها. وإن سقطت ورقة لم يُحرق رقم ولا بقيت نصف معاملة.
CREATE TABLE IF NOT EXISTS transactions (
  id           INTEGER PRIMARY KEY,
  citizen_id   INTEGER REFERENCES citizens(id) ON DELETE SET NULL,
  citizen_name TEXT,                      -- صورة الاسم وقت الإصدار: المعاملة شاهد
  citizen_nid  TEXT,
  sheets       INTEGER NOT NULL DEFAULT 0,
  fee          INTEGER NOT NULL DEFAULT 0,
  operator     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);


-- تصحيحات الموظف: ما اقترحه البرنامج وما اختاره هو.
--
-- وهذه لا تُجمع بأثر رجعي: من لم يقيّدها من اليوم الأول فقدها. فيُبنى الجدول
-- الآن ولو لم يُستعمل ما فيه إلا بعد شهور — وبه يتعلّم الكاشف من هذا المكتب
-- وحده، بلا شبكة ولا حساب (§الذكاء المحلي).
CREATE TABLE IF NOT EXISTS corrections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,              -- fieldName · letterheadEdge · category · clip · duplicate
  input      TEXT NOT NULL,              -- ما رآه البرنامج: السطر أو المفتاح
  suggested  TEXT,                       -- ما اقترحه، أو لا شيء
  chosen     TEXT NOT NULL,              -- ما اختاره الموظف
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_corrections_lookup ON corrections(kind, input);

-- ── الطلبات ─────────────────────────────────────────────────────────
-- ما تطلبه جهةٌ أو زبونٌ ويُسلَّم لاحقًا: «٤٠٠ هويّة للصفّ الخامس، الخميس».
-- بلا مبالغ عمدًا: ديوان أداةُ إنتاجٍ لا دفترُ حسابات — المال مرحلةٌ بعيدة.
-- والحالة سلسلة: جديد ← بانتظار الزبون ← قيد العمل ← جاهز ← سُلِّم (أو أُلغي).
CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY,
  authority_id  INTEGER REFERENCES authorities(id) ON DELETE SET NULL,
  customer      TEXT,                     -- زبونٌ فرد بلا جهة: اسمه كما قاله
  phone         TEXT,
  title         TEXT NOT NULL,
  quantity      INTEGER,
  due_date      TEXT,                     -- YYYY-MM-DD
  status        TEXT NOT NULL DEFAULT 'new',
  notes         TEXT,
  template_id   INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  batch_text    TEXT,                     -- قائمة الأسماء كما أُلصقت — تُطبع منها الدفعة
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at  TEXT
);
CREATE INDEX IF NOT EXISTS ix_orders_status ON orders(status, due_date);
CREATE INDEX IF NOT EXISTS ix_orders_authority ON orders(authority_id);

-- بنك الأسئلة: سؤالٌ بفروعه ودرجته وإجابته النموذجية، يُحفظ مرّةً ويُدرج في كل
-- ورقةٍ بعدها. والمادة والصف من رأس الورقة التي حُفظ منها — فيُعرض للمدرّس
-- بنكُ مادّته وصفّه أوّلًا. و`item_json` عقدةُ القائمة نفسها (ListItem).
CREATE TABLE IF NOT EXISTS question_bank (
  id          INTEGER PRIMARY KEY,
  subject     TEXT,
  grade       TEXT,
  item_json   TEXT NOT NULL,
  text        TEXT NOT NULL,               -- نصّ السؤال وفروعه مجرّدًا — للعرض
  search_fold TEXT NOT NULL,               -- مطبَّعًا للبحث المتساهل مع الهمزة
  score       REAL,
  use_count   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  used_at     TEXT
);
CREATE INDEX IF NOT EXISTS ix_question_bank_subject ON question_bank(subject, grade);
