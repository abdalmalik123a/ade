import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import FillCard from './screens/FillCard';
import './styles.css';

/**
 * وضع الطباعة: العملية الرئيسية تفتح هذه الصفحة نفسها لترسم الورقة، فتأخذ
 * أنماط التطبيق وخطوطه كما هي — ولا تُركَّب الواجهة، إذ لا جسر IPC في تلك
 * النافذة ولا حاجة إلى شاشة. الورقة تُحقن في الجسم من هناك.
 */
const params = new URLSearchParams(window.location.search);
const printMode = params.get('mode') === 'print';

// المظهر قبل أوّل رسم — من آخر ما اختير على هذا الجهاز، فلا يومض النهاريّ ثم يصير ليلًا. ونافذة
// الطباعة بلا مظهر: الورقة بألوان النهار (styles.css). والإعدادات تُصحّحه حين تُقرأ (App).
if (!printMode) {
  let theme = 'dark';
  try {
    theme = localStorage.getItem('diwan-theme') === 'light' ? 'light' : 'dark';
  } catch {
    // لا تخزين — الليليّ.
  }
  document.documentElement.dataset.theme = theme;
}

if (printMode) {
  document.getElementById('root')?.remove();
} else if (params.get('mode') === 'fillcard') {
  // بطاقة التعبئة (هـ٦): نافذتها الصغيرة فوق المتصفّح — بطاقة المواطن وحدها.
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <FillCard citizenId={Number(params.get('citizen'))} />
    </StrictMode>
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
