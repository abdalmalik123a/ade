import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import FillCard from './screens/FillCard';
import { loadFonts } from './lib/fonts';
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
  // خطوط ديوان المستوردة قبل أن تُرسم ورقة (DESIGNS.md ٠٫٧).
  void loadFonts();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary fullPage fallbackTitle="تعذّر عرض ديوان">
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
