// سلوك مستخرج من stitch_/_2/code.html — مواصفة مرجعية، لا يُنفَّذ.

document.addEventListener('DOMContentLoaded', () => {
      // Notification feedback for quick repetition and injection
      const quickBtns = document.querySelectorAll('button');
      quickBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (btn.innerText.includes('تكرار وتحديث') || btn.innerText.includes('تجديد فوري')) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> جاري التوليد...';
            setTimeout(() => {
              btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">check</span> تم إصدار الكتاب في 1.8 ثانية!';
              btn.classList.add('bg-primary-container', 'text-on-primary');
              setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('bg-primary-container', 'text-on-primary');
              }, 3000);
            }, 600);
          }
        });
      });

      // Keyboard Shortcut binding Ctrl + Enter
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
          alert('تم تحويل كامل مستمسكات وبيانات المواطن (سمير صالح مهدي) تلقائياً إلى "المحرر الذكي A4" وهو جاهز للصياغة.');
        }
      });
    });
