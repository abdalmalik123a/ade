import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

/**
 * وضع الطباعة: العملية الرئيسية تفتح هذه الصفحة نفسها لترسم الورقة، فتأخذ
 * أنماط التطبيق وخطوطه كما هي — ولا تُركَّب الواجهة، إذ لا جسر IPC في تلك
 * النافذة ولا حاجة إلى شاشة. الورقة تُحقن في الجسم من هناك.
 */
const printMode = new URLSearchParams(window.location.search).get('mode') === 'print';

if (printMode) {
  document.getElementById('root')?.remove();
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
