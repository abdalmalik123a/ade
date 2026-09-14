// سلوك مستخرج من stitch_/_3/code.html — مواصفة مرجعية، لا يُنفَّذ.

// Simple micro-interaction for category switcher
  (function() {
    const filterContainer = document.getElementById('categoryFilterContainer');
    if (!filterContainer) return;
    const buttons = filterContainer.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => {
          b.className = 'px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors';
        });
        btn.className = 'px-space-md py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold shrink-0 transition-colors';
      });
    });
  })();
