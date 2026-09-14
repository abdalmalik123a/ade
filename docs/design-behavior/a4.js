// سلوك مستخرج من stitch_/a4/code.html — مواصفة مرجعية، لا يُنفَّذ.

(function() {
    // Input elements bindings
    const inputDirectorate = document.getElementById('inputDirectorate');
    const inputDepartment = document.getElementById('inputDepartment');
    const inputSchool = document.getElementById('inputSchool');
    const inputSerial = document.getElementById('inputSerial');
    const inputDateGreg = document.getElementById('inputDateGreg');
    const inputDateHijri = document.getElementById('inputDateHijri');
    const inputName = document.getElementById('inputName');
    const inputCivilId = document.getElementById('inputCivilId');
    const inputJobTitle = document.getElementById('inputJobTitle');
    const inputJobStatus = document.getElementById('inputJobStatus');
    const inputAddressedTo = document.getElementById('inputAddressedTo');
    const inputPurpose = document.getElementById('inputPurpose');
    const inputTextBody = document.getElementById('inputTextBody');
    const inputSignerName = document.getElementById('inputSignerName');
    const inputSignerRole = document.getElementById('inputSignerRole');

    // Checkboxes
    const checkStamp = document.getElementById('checkStamp');
    const checkBarcode = document.getElementById('checkBarcode');
    const checkWatermark = document.getElementById('checkWatermark');

    // Document Canvas Targets
    const docDirectorate = document.getElementById('docDirectorate');
    const docDepartment = document.getElementById('docDepartment');
    const docSchool = document.getElementById('docSchool');
    const docSerial = document.getElementById('docSerial');
    const docDateGreg = document.getElementById('docDateGreg');
    const docDateHijri = document.getElementById('docDateHijri');
    const docAddressedTo = document.getElementById('docAddressedTo');
    const docRenderedBody = document.getElementById('docRenderedBody');
    const docSignerName = document.getElementById('docSignerName');
    const docSignerRole = document.getElementById('docSignerRole');
    const stampWrapper = document.getElementById('stampWrapper');
    const barcodeContainer = document.getElementById('barcodeContainer');
    const watermarkLayer = document.getElementById('watermarkLayer');

    // Live update parser function
    function updateDocument() {
      if(docDirectorate) docDirectorate.textContent = inputDirectorate.value;
      if(docDepartment) docDepartment.textContent = inputDepartment.value;
      if(docSchool) docSchool.textContent = inputSchool.value;
      if(docSerial) docSerial.textContent = inputSerial.value;
      if(docDateGreg) docDateGreg.textContent = inputDateGreg.value;
      if(docDateHijri) docDateHijri.textContent = inputDateHijri.value;
      if(docAddressedTo) docAddressedTo.textContent = inputAddressedTo.value;
      if(docSignerName) docSignerName.textContent = inputSignerName.value;
      if(docSignerRole) docSignerRole.textContent = inputSignerRole.value;

      // Smart replace template tokens in text body
      let rawText = inputTextBody.value;
      let replaced = rawText
        .replace(/\{الاسم\}/g, `<span class="font-bold text-black underline underline-offset-4 decoration-1">${inputName.value}</span>`)
        .replace(/\{المدرسة\}/g, `<span class="font-semibold text-black">${inputSchool.value}</span>`)
        .replace(/\{العنوان_الوظيفي\}/g, `<span class="font-semibold text-black">${inputJobTitle.value}</span>`)
        .replace(/\{الرقم_الوطني\}/g, `<span class="font-mono font-semibold text-black">${inputCivilId.value}</span>`)
        .replace(/\{الغرض\}/g, `<span class="font-semibold text-black">${inputPurpose.value}</span>`)
        .replace(/\{سنة_المباشرة\}/g, `<span class="font-semibold text-black">2012</span>`);

      if(docRenderedBody) docRenderedBody.innerHTML = replaced;

      // Toggles
      if(stampWrapper) stampWrapper.style.display = checkStamp.checked ? 'block' : 'none';
      if(barcodeContainer) barcodeContainer.style.display = checkBarcode.checked ? 'flex' : 'none';
      if(watermarkLayer) watermarkLayer.style.display = checkWatermark.checked ? 'flex' : 'none';
    }

    // Attach listeners
    [inputDirectorate, inputDepartment, inputSchool, inputSerial, inputDateGreg, inputDateHijri, inputName, inputCivilId, inputJobTitle, inputJobStatus, inputAddressedTo, inputPurpose, inputTextBody, inputSignerName, inputSignerRole].forEach(el => {
      if(el) {
        el.addEventListener('input', updateDocument);
      }
    });

    [checkStamp, checkBarcode, checkWatermark].forEach(chk => {
      if(chk) chk.addEventListener('change', updateDocument);
    });

    // Tag injection click
    document.querySelectorAll('.tag-inject').forEach(btn => {
      btn.addEventListener('click', () => {
        const token = btn.getAttribute('data-insert');
        const start = inputTextBody.selectionStart;
        const end = inputTextBody.selectionEnd;
        const current = inputTextBody.value;
        inputTextBody.value = current.substring(0, start) + token + current.substring(end);
        inputTextBody.focus();
        inputTextBody.selectionStart = inputTextBody.selectionEnd = start + token.length;
        updateDocument();
      });
    });

    // Serial generation simulator
    const btnGenSerial = document.getElementById('btnGenSerial');
    if(btnGenSerial) {
      btnGenSerial.addEventListener('click', () => {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        inputSerial.value = `ق/4/${randomNum}`;
        updateDocument();
      });
    }

    // Citizen Import Simulator
    const btnImportCitizen = document.getElementById('btnImportCitizen');
    if(btnImportCitizen) {
      btnImportCitizen.addEventListener('click', () => {
        inputName.value = 'محمد جاسم عبيد الحسيني';
        inputCivilId.value = '198854091244';
        inputJobTitle.value = 'معاون مدير مدرسة / كادر إداري';
        inputSchool.value = 'ثانوية العقيدة للبنات';
        inputPurpose.value = 'معاملة شراء قطعة أرض سكنية';
        updateDocument();
      });
    }

    // Canvas Zooming Architecture
    let currentZoom = 1.0;
    const a4Container = document.getElementById('a4Container');
    const zoomLabel = document.getElementById('zoomLabel');
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnZoomFit = document.getElementById('btnZoomFit');
    const deskViewport = document.getElementById('deskViewport');

    function applyZoom(factor) {
      currentZoom = Math.min(Math.max(factor, 0.45), 1.6);
      if(a4Container) {
        a4Container.style.transform = `scale(${currentZoom})`;
      }
      if(zoomLabel) {
        zoomLabel.textContent = `${Math.round(currentZoom * 100)}%`;
      }
    }

    if(btnZoomIn) {
      btnZoomIn.addEventListener('click', () => applyZoom(currentZoom + 0.1));
    }
    if(btnZoomOut) {
      btnZoomOut.addEventListener('click', () => applyZoom(currentZoom - 0.1));
    }
    if(btnZoomFit) {
      btnZoomFit.addEventListener('click', () => {
        if(deskViewport) {
          const availableWidth = deskViewport.clientWidth - 64;
          const fitFactor = availableWidth / 794;
          applyZoom(fitFactor);
        }
      });
    }

    // Print Canvas Trigger
    const btnPrintCanvas = document.getElementById('btnPrintCanvas');
    if(btnPrintCanvas) {
      btnPrintCanvas.addEventListener('click', () => {
        window.print();
      });
    }

    // PDF / Word Export notification feedback
    const btnExportPdf = document.getElementById('btnExportPdf');
    if(btnExportPdf) {
      btnExportPdf.addEventListener('click', () => {
        const originalText = btnExportPdf.innerHTML;
        btnExportPdf.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">refresh</span><span>جاري التصدير 300DPI...</span>`;
        setTimeout(() => {
          btnExportPdf.innerHTML = originalText;
        }, 1200);
      });
    }

    // Initialize document first pass
    updateDocument();
  })();
