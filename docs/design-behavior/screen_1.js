// سلوك مستخرج من stitch_/_1/code.html — مواصفة مرجعية، لا يُنفَّذ.

const sampleRecords = {
      1: {
        serial: "ص/2024/9184",
        name: "كرار ضياء مهدي الربيعي",
        dest: "إدارة مصرف الرشيد المحترمين",
        type: "كتاب تأييد سكن ومحل إقامة",
        text: "نؤيد لكم بأن المواطن كرار ضياء مهدي الربيعي، الحامل للبطاقة الوطنية رقم (199482019482)، يسكن بصورة فعلية ودائمة ضمن الرقعة الجغرافية لمنطقتنا (بغداد / الكرخ - محلة 604 - زقاق 12 - دار 8)، وقد زُوّد بهذا التأييد بناءً على طلبه لتقديمه إلى جهتكم الموقرة..."
      },
      2: {
        serial: "ص/2024/9183",
        name: "مروة جاسم محمد العزاوي",
        dest: "وزارة التعليم العالي والبحث العلمي",
        type: "براءة ذمة وظيفية وأكاديمية",
        text: "تشهد الدائرة بأن الموظفة مروة جاسم محمد العزاوي قد أتمت تسليم كافة العهد الإدارية والمالية المودعة بذمتها وفق الأصول المرعية، ولا يترتب عليها أي التزام مالي أو إداري حتى تاريخ تحرير هذا الكتاب..."
      },
      3: {
        serial: "ص/2024/9182",
        name: "سالم حاتم عبد الرزاق",
        dest: "هيئة التقاعد الوطنية / المقر العام",
        type: "شهادة استمرار بالخدمة الفعلية",
        text: "نؤيد بأن السيد سالم حاتم عبد الرزاق لا يزال مستمراً في أداء مهامه الوظيفية الرسمية ضمن ملاك دائرتنا بصورة منتظمة وبسيرة مهنية متميزة، زُوّد بهذا الكتاب لغرض إنجاز معاملة التقاعد التكميلي..."
      },
      4: {
        serial: "ص/2024/9181",
        name: "هناء عزيز غائب الشمري",
        dest: "صندوق الإسكان العراقي / بغداد",
        type: "تأييد كفالة ضامنة",
        text: "تؤيد الدائرة بأن السيدة هناء عزيز غائب موظفة على الملاك الدائم ويحق لها كفالة المقترضين وفق التعليمات والضوابط المعمول بها لضمان تسديد الأقساط الشهرية المستحقة..."
      },
      5: {
        serial: "ص/2024/9180",
        name: "وسام طه ياسين الدوري",
        dest: "مديرية المرور العامة / القاطع الجنوبي",
        type: "تعهد خطي ملزم",
        text: "بناءً على المعاملة المرورية المقدمة، يتعهد المواطن وسام طه ياسين بتحمل كامل التبعات القانونية والمادية حيال المركبة المسجلة أصولياً..."
      },
      6: {
        serial: "ص/2024/9179",
        name: "أنور ناطق جميل البياتي",
        dest: "شركة توزيع المنتجات النفطية",
        type: "كتاب تأييد سكن معنون",
        text: "نؤيد لكم صحة سكن المواطن أنور ناطق جميل في قاطعنا البلدي، وذلك لتجديد وتثبيت البطاقة الوقودية السكنية المخصصة للأسرة..."
      }
    };

    function selectLedgerRecord(id) {
      const rec = sampleRecords[id];
      if (!rec) return;

      const serialEl = document.getElementById('inspectedSerial');
      const nameEl = document.getElementById('inspectorCitizenName');
      const bodyEl = document.getElementById('inspectorBodyPreview');

      if (serialEl) serialEl.innerText = rec.serial;
      if (nameEl) nameEl.innerText = rec.name;
      if (bodyEl) {
        bodyEl.innerHTML = `إلى / <span class="font-bold text-on-surface">${rec.dest}</span><br/>${rec.text}`;
      }

      // Highlight active row visually
      const rows = document.querySelectorAll('#transactionsTableBody tr');
      rows.forEach((r, idx) => {
        if (idx === id - 1) {
          r.classList.add('bg-surface-container-highest/60');
          r.classList.remove('bg-transparent');
        } else {
          r.classList.remove('bg-surface-container-highest/60');
        }
      });
    }

    function copyText(text, event) {
      if (event) event.stopPropagation();
      navigator.clipboard?.writeText(text).then(() => {
        const btn = event.currentTarget;
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined text-[16px] text-secondary">check</span>';
        setTimeout(() => {
          btn.innerHTML = orig;
        }, 1200);
      }).catch(() => {});
    }

    // Client-side quick filter behavior
    document.getElementById('ledgerSearchInput')?.addEventListener('input', function(e) {
      const term = e.target.value.toLowerCase().trim();
      const rows = document.querySelectorAll('#transactionsTableBody tr');
      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });

// ── معالِجات مضمّنة في العلامات ──
// <tr onclick> selectLedgerRecord(1)
// <td onclick> event.stopPropagation()
// <button onclick> copyText('ص/2024/9184', event)
// <td onclick> event.stopPropagation()
// <tr onclick> selectLedgerRecord(2)
// <td onclick> event.stopPropagation()
// <button onclick> copyText('ص/2024/9183', event)
// <td onclick> event.stopPropagation()
// <tr onclick> selectLedgerRecord(3)
// <td onclick> event.stopPropagation()
// <button onclick> copyText('ص/2024/9182', event)
// <td onclick> event.stopPropagation()
// <tr onclick> selectLedgerRecord(4)
// <td onclick> event.stopPropagation()
// <button onclick> copyText('ص/2024/9181', event)
// <td onclick> event.stopPropagation()
// <tr onclick> selectLedgerRecord(5)
// <td onclick> event.stopPropagation()
// <button onclick> copyText('ص/2024/9180', event)
// <td onclick> event.stopPropagation()
// <tr onclick> selectLedgerRecord(6)
// <td onclick> event.stopPropagation()
// <button onclick> copyText('ص/2024/9179', event)
// <td onclick> event.stopPropagation()
