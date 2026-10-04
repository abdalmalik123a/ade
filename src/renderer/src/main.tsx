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
