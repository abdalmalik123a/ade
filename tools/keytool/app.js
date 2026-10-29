/* واجهة «أداة مفاتيح ديوان» — كلّ عملٍ عبر window.keytool (preload.cjs)، والمفتاح الخاص لا يصل إلى هنا. */
'use strict';

const $ = (id) => document.getElementById(id);
const kt = window.keytool;
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

/** كلّ قناةٍ تُجيب {ok, value} أو {ok:false, error}. */
async function call(fn, ...args) {
  const r = await kt[fn](...args);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

/** يعطّل الزرّ أثناء العمل ويقول الخطأ في مكانه. */
async function run(button, msgEl, work) {
  const label = button.textContent;
  button.disabled = true;
  if (msgEl) {
    msgEl.textContent = '';
    msgEl.className = msgEl.dataset.baseClass ?? msgEl.className;
  }
  try {
    await work();
  } catch (e) {
    if (msgEl) {
      msgEl.textContent = e.message;
      msgEl.classList.add('bad');
    }
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function show(screen) {
  for (const s of document.querySelectorAll('[data-screen]')) s.classList.toggle('hidden', s.dataset.screen !== screen);
  $('lockBtn').classList.toggle('hidden', screen !== 'app');
  const focus = { create: 'newPw', login: 'pw' }[screen];
  if (focus) setTimeout(() => $(focus).focus(), 0);
}

// ── البدء ───────────────────────────────────────────────────────────────

async function start() {
  const s = await call('state');
  $('dir').textContent = s.dir;
  if (s.unlocked) return enter(null);
  show(s.encrypted ? 'login' : s.plain ? 'create' : 'nokey');
}

let summary = null;

function enter(res) {
  if (res) {
    const m = $('match');
    m.textContent = res.matches
      ? 'المفتاح يطابق مفتاح البرنامج — ما يصدر من هنا يقبله ديوان.'
      : 'تنبيه: هذا المفتاح الخاص لا يطابق المفتاح العامّ في البرنامج — ما يصدر منه لن يُقبل.';
    m.classList.toggle('warn', !res.matches);
    setSummary(res.summary);
    setUpdateKey(res.update);
  }
  for (const id of ['pw', 'newPw', 'newPw2']) $(id).value = '';
  $('loginMsg').textContent = '';
  show('app');
  tab('issue');
  $('device').focus();
}

function setSummary(s) {
  summary = s;
  const next = s.lifetime + 1;
  const early =
    next <= s.early
      ? `مدى الحياة: بيع منه ${AR(s.lifetime)} — والتالي رقم ${AR(next)} من أوّل ${AR(s.early)}.`
      : `أوّل ${AR(s.early)} اكتملوا (مدى الحياة: ${AR(s.lifetime)}) — والبيع الآن بالأسعار التي تحدّدها لكلّ خطّة.`;
  $('counter').textContent = `${early}  شهري: ${AR(s.monthly)} · سنوي: ${AR(s.yearly)}${s.demo ? ` · عرض: ${AR(s.demo)}` : ''} · كلّ المفاتيح: ${AR(s.total)}`;
  $('ledgerSum').textContent = $('counter').textContent;
}

// ── كلمة السرّ ──────────────────────────────────────────────────────────

$('createBtn').onclick = () =>
  run($('createBtn'), $('createMsg'), async () => {
    $('createBtn').textContent = 'يُشفَّر…';
    enter(await call('createPassword', $('newPw').value, $('newPw2').value));
  });
// معالجٌ يعيد false يمنع الحرف — فلا يُعاد شيءٌ هنا (كان «e.key === 'Enter' && …» يمنع الكتابة كلّها).
$('newPw').onkeydown = (e) => {
  if (e.key === 'Enter') $('newPw2').focus();
};
$('newPw2').onkeydown = (e) => {
  if (e.key === 'Enter') $('createBtn').click();
};

$('unlockBtn').onclick = () =>
  run($('unlockBtn'), $('loginMsg'), async () => {
    $('unlockBtn').textContent = 'يُفتح…';
    enter(await call('unlock', $('pw').value));
  });
$('pw').onkeydown = (e) => {
  if (e.key === 'Enter') $('unlockBtn').click();
};

$('lockBtn').onclick = async () => {
  await call('lock');
  $('result').classList.add('hidden');
  show('login');
};

kt.onLocked(() => {
  $('result').classList.add('hidden');
  show('login');
  $('loginMsg').textContent = 'قُفلت الأداة بعد عشر دقائق بلا عمل — اكتب كلمة السرّ.';
});

$('changeBtn').onclick = () =>
  run($('changeBtn'), $('changeMsg'), async () => {
    $('changeBtn').textContent = 'يُغيَّر…';
    await call('changePassword', $('oldPw').value, $('chPw').value, $('chPw2').value);
    for (const id of ['oldPw', 'chPw', 'chPw2']) $(id).value = '';
    $('changeMsg').textContent = '✓ تغيّرت كلمة السرّ — اكتب الجديدة على الورقة مكان القديمة.';
    $('changeMsg').classList.add('ok');
  });

// ── الألسنة ─────────────────────────────────────────────────────────────

function tab(name) {
  for (const b of document.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === name);
  for (const p of document.querySelectorAll('[data-pane]')) p.classList.toggle('hidden', p.dataset.pane !== name);
  if (name === 'ledger') void loadLedger();
}
for (const b of document.querySelectorAll('[data-tab]')) b.onclick = () => tab(b.dataset.tab);

// ── مفتاح جديد ──────────────────────────────────────────────────────────

const plan = () => document.querySelector('input[name=plan]:checked').value;
const todayIso = () => new Date().toLocaleDateString('en-CA');
let untilTouched = false;

async function previewUntil() {
  if (untilTouched) return;
  const p = plan();
  if (p !== 'monthly' && p !== 'yearly') return;
  try {
    $('until').value = await call('previewUntil', p, $('start').value || todayIso());
  } catch {
    /* يومٌ ناقص أثناء الكتابة */
  }
}

function onPlan() {
  const p = plan();
  $('subDates').classList.toggle('hidden', p !== 'monthly' && p !== 'yearly');
  $('extDates').classList.toggle('hidden', p !== 'extend');
  if (!$('start').value) $('start').value = todayIso();
  untilTouched = false;
  void previewUntil();
}
for (const r of document.querySelectorAll('input[name=plan]')) r.onchange = onPlan;
$('start').onchange = previewUntil;
$('until').oninput = () => {
  untilTouched = true;
};

$('device').onblur = async () => {
  const v = $('device').value.trim();
  $('deviceMsg').textContent = '';
  $('deviceMsg').className = 'muted';
  if (!v) return;
  try {
    $('device').value = await call('normalizeDevice', v);
  } catch (e) {
    $('deviceMsg').textContent = e.message;
    $('deviceMsg').className = 'bad';
  }
};

let last = null;
/** «جدّد» من السجلّ (البند ٣٤): رمز الجهاز الذي يُجدَّد له — فلا تنبيه «صدر له قبلُ»، ويُقيَّد «تجديد». */
let renewing = null;

function endRenewal() {
  renewing = null;
  $('renewNote').classList.add('hidden');
}

function startRenewal(r) {
  tab('issue');
  document.querySelector(`input[name=plan][value=${r.plan}]`).checked = true;
  onPlan();
  $('device').value = r.device;
  $('office').value = r.office;
  $('phone').value = r.phone;
  $('start').value = r.start;
  untilTouched = false;
  void previewUntil();
  renewing = r.device;
  $('renewNote').textContent = `تجديد اشتراك ${r.office || r.device} (${r.plan === 'yearly' ? 'سنوي' : 'شهري'}): الحاليّ إلى ${r.previousUntil}، والجديد من ${r.start} إلى ${r.until} — راجعه ثم «ولّد».`;
  $('renewNote').classList.remove('hidden');
  $('renewNote').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// رمزٌ آخر يُكتب: لم يعد تجديدًا.
$('device').oninput = () => {
  if (renewing && $('device').value.trim() !== renewing) endRenewal();
};

$('issueBtn').onclick = () =>
  run($('issueBtn'), $('issueMsg'), async () => {
    const p = plan();
    const input = {
      device: $('device').value,
      plan: p,
      office: $('office').value,
      phone: $('phone').value,
      price: $('price').value,
      notes: $('notes').value
    };
    if (p === 'monthly' || p === 'yearly') Object.assign(input, { start: $('start').value || todayIso(), until: $('until').value });
    if (p === 'extend') input.until = $('extUntil').value;
    if (renewing && $('device').value.trim() === renewing && (p === 'monthly' || p === 'yearly')) input.renewal = true;
    last = await call('issue', input);
    endRenewal();
    setSummary(last.summary);
    const pl = last.payload;
    $('resultTitle').textContent = last.demo
      ? `✓ مفتاح عرض مدى الحياة — لا يُعدّ من أوّل ${AR(summary.early)} — ${pl.office ?? pl.device}`
      : pl.kind === 'full'
        ? `✓ مفتاح مدى الحياة — المشتري رقم ${AR(last.buyer)}${last.buyer <= summary.early ? ` من أوّل ${AR(summary.early)}` : ''} — ${pl.office ?? pl.device}`
        : pl.kind === 'sub'
          ? `✓ اشتراك ${pl.plan === 'yearly' ? 'سنوي' : 'شهري'} حتى ${pl.until} — ${pl.office ?? pl.device}`
          : `✓ تمديد التجربة حتى ${pl.until} — ${pl.office ?? pl.device}`;
    $('resultKey').textContent = last.key;
    // ما صدر قبلُ للجهاز أو المكتب أو الهاتف (و٩): يُرى قبل أن يُرسل المفتاح.
    $('resultWarn').textContent = (last.warnings ?? []).map((w) => `⚠ ${w}`).join(String.fromCharCode(10));
    $('resultWarn').classList.toggle('hidden', !(last.warnings ?? []).length);
    $('copied').textContent = '';
    $('result').classList.remove('hidden');
    $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // تُفرَّغ الخانات فلا يُصدر المفتاح نفسه مرّتين بضغطةٍ ثانية — والمفتاح في السجلّ.
    for (const id of ['device', 'office', 'phone', 'price', 'notes', 'extUntil']) $(id).value = '';
    untilTouched = false;
    $('start').value = todayIso();
    void previewUntil();
  });

async function copy(text, label) {
  await call('copy', text);
  $('copied').textContent = `✓ نُسخ ${label}`;
}
$('copyKey').onclick = () => {
  if (last) void copy(last.key, 'المفتاح');
};
$('copyMsg').onclick = () => {
  if (last) void copy(last.message, 'نصّ الرسالة');
};

// ── السجلّ ──────────────────────────────────────────────────────────────

let rows = [];

async function loadLedger() {
  try {
    const r = await call('ledger');
    rows = r.rows;
    setSummary(r.summary);
    renderLedger();
  } catch (e) {
    $('ledgerSum').textContent = e.message;
  }
}

function renderLedger() {
  const q = $('ledgerQ').value.trim().toLowerCase();
  const body = $('ledgerBody');
  body.textContent = '';
  const shown = q ? rows.filter((r) => [r.office, r.phone, r.device, r.plan, r.notes].join(' ').toLowerCase().includes(q)) : rows;
  for (const r of shown) {
    const tr = document.createElement('tr');
    for (const v of [r.date, r.plan || r.kind, r.buyer, r.office, r.phone, r.until]) {
      const td = document.createElement('td');
      td.textContent = v ?? '';
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    const b = document.createElement('button');
    b.textContent = 'انسخ المفتاح';
    b.onclick = async () => {
      await call('copy', r.key);
      b.textContent = '✓ نُسخ';
    };
    td.appendChild(b);
    // الاشتراك يُجدَّد من صفّه: رمز الجهاز والمكتب والهاتف من السجلّ (البند ٣٤).
    if (r.plan === 'شهري' || r.plan === 'سنوي') {
      const renew = document.createElement('button');
      renew.textContent = 'جدّد';
      renew.dataset.act = 'renew';
      renew.style.marginInlineStart = '6px';
      renew.onclick = async () => {
        try {
          startRenewal(await call('renewal', r.device));
        } catch (e) {
          renew.textContent = e.message;
        }
      };
      td.appendChild(renew);
    }
    tr.appendChild(td);
    tr.title = [r.device, r.price && `السعر: ${r.price}`, r.notes].filter(Boolean).join(' — ');
    body.appendChild(tr);
  }
  if (!shown.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'muted';
    td.textContent = rows.length ? 'لا نتيجة' : 'لم يُصدر مفتاحٌ بعد';
    tr.appendChild(td);
    body.appendChild(tr);
  }
}
$('ledgerQ').oninput = renderLedger;

// ── مفتاح التحديث (البند ٣٣) ───────────────────────────────────────────

let updatePublic = '';

function setUpdateKey(u) {
  const exists = Boolean(u && u.exists);
  $('ukNone').classList.toggle('hidden', exists);
  $('ukDone').classList.toggle('hidden', !exists);
  updatePublic = exists ? u.publicKey : '';
  $('ukPub').textContent = updatePublic;
  $('ukState').textContent = !exists
    ? ''
    : u.matches
      ? 'البرنامج يعرف هذا المفتاح — ملفّات التحديث تُوقَّع به.'
      : 'صُنع المفتاح — ولا يعرفه البرنامج بعد: أرسل عامّه أدناه إلى المطوّر. وإلى أن يصدر إصدارٌ يعرفه تبقى ملفّات التحديث تُقبل بمفتاح التراخيص.';
  $('updKeys').textContent = exists
    ? 'يُوقَّع الملفّ بمفتاحين: مفتاح التحديث (للإصدارات التي تعرفه) ومفتاح التراخيص (للإصدارات حتى 1.7.1) — ملفٌّ واحد للمكاتب كلّها.'
    : 'يُوقَّع الملفّ بمفتاح التراخيص — واصنع «مفتاح التحديث» ليُوقَّع به أيضًا.';
}

$('ukBtn').onclick = () =>
  run($('ukBtn'), $('ukMsg'), async () => {
    $('ukBtn').textContent = 'يُصنع…';
    setUpdateKey(await call('createUpdateKey', $('ukPw').value));
    $('ukPw').value = '';
  });
$('ukPw').onkeydown = (e) => {
  if (e.key === 'Enter') $('ukBtn').click();
};
$('ukCopy').onclick = async () => {
  if (!updatePublic) return;
  await call('copy', updatePublic);
  $('ukCopied').textContent = '✓ نُسخ';
};

// ── ملفّ التحديث ────────────────────────────────────────────────────────

let exe = null;

$('pickExe').onclick = () =>
  run($('pickExe'), $('updMsg'), async () => {
    const r = await call('pickInstaller');
    if (!r) return;
    exe = r.exe;
    $('exePath').textContent = r.exe;
    if (r.version) $('version').value = r.version;
    if (r.notes) $('relNotes').value = r.notes;
  });

$('makeUpd').onclick = () =>
  run($('makeUpd'), $('updMsg'), async () => {
    if (!exe) throw new Error('اختر المثبّت أوّلًا');
    $('makeUpd').textContent = 'يُصنع…';
    const r = await call('makeUpdate', { exe, version: $('version').value.trim(), notes: $('relNotes').value });
    const msg = $('updMsg');
    msg.textContent = `✓ ${r.out} — ${(r.size / 1024 / 1024).toFixed(1)} م.ب${r.withUpdateKey ? ' — بالمفتاحين' : ''} `;
    msg.classList.add('ok');
    const b = document.createElement('button');
    b.textContent = 'اعرضه في مجلّده';
    b.onclick = () => {
      void call('showFile', r.out);
    };
    msg.appendChild(b);
  });

// ── الحزمة المختومة (S48، D206) ─────────────────────────────────────────

let pieces = null;
let sectionFile = null;

$('sealContent').onchange = () => {
  pieces = null; sectionFile = null;
  $('sealTitle').value = '';
  $('piecesPath').textContent = ''; $('piecesCount').textContent = ''; $('sealMsg').textContent = '';
  const suits = $('sealContent').value === 'suits';
  $('pickPieces').classList.toggle('hidden', !suits);
  $('pickContent').classList.toggle('hidden', suits);
  $('sealSuitHint').classList.toggle('hidden', !suits);
  $('sealSectionHint').classList.toggle('hidden', suits);
};

$('pickContent').onclick = () =>
  run($('pickContent'), $('sealMsg'), async () => {
    const r = await call('pickContent');
    if (!r) return;
    sectionFile = r.file;
    $('piecesPath').textContent = r.file;
    $('piecesCount').textContent = '— ملف واحد';
    if (!$('sealTitle').value) $('sealTitle').value = r.file.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  });

$('pickPieces').onclick = () =>
  run($('pickPieces'), $('sealMsg'), async () => {
    const r = await call('pickPieces');
    if (!r) return;
    pieces = r.dir;
    $('piecesPath').textContent = r.dir;
    $('piecesCount').textContent = `— ${r.count} قطعة`;
    if (!$('sealTitle').value) $('sealTitle').value = r.dir.split(/[\\/]/).pop();
  });

$('makeSeal').onclick = () =>
  run($('makeSeal'), $('sealMsg'), async () => {
    const content = $('sealContent').value;
    if (content === 'suits' ? !pieces : !sectionFile) throw new Error(content === 'suits' ? 'اختر مجلّد القطع أوّلًا' : 'اختر ملف القسم أوّلًا');
    $('makeSeal').textContent = 'تُختم…';
    const kind = document.querySelector('input[name=sealKind]:checked')?.value;
    const r = await call('makeSeal', { dir: pieces, file: sectionFile, content, kind, title: $('sealTitle').value });
    const msg = $('sealMsg');
    msg.textContent = `✓ ${r.out} — ${r.items} ${content === 'suits' ? 'قطعة' : 'ملف'} — ${(r.size / 1024 / 1024).toFixed(1)} م.ب — ${r.kind === 'buyer' ? 'حزمة المشتري' : 'حزمةٌ أولى'} `;
    msg.classList.add('ok');
    const b = document.createElement('button');
    b.textContent = 'اعرضه في مجلّده';
    b.onclick = () => {
      void call('showFile', r.out);
    };
    msg.appendChild(b);
  });

for (const el of [$('createMsg'), $('loginMsg'), $('issueMsg'), $('updMsg'), $('changeMsg'), $('ukMsg'), $('sealMsg')]) el.dataset.baseClass = el.className;

start().catch((e) => {
  document.body.textContent = e.message;
});
