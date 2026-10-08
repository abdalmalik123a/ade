import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  /**
   * حاجز الجذر (ج٥): يملأ النافذة، وزرّه يُعيد تحميل الواجهة لا حالتها — فالخطأ فيها كلّها لا في شاشةٍ منها، وإعادة المحاولة
   * بالحالة نفسها تعيد السقوط. وبلا حاجزٍ يسقط ما فوق حواجز الشاشات (الشريط والسكّة والحوارات) فتبيضّ النافذة.
   */
  fullPage?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  override render() {
    if (this.state.hasError) {
      const full = Boolean(this.props.fullPage);
      return (
        <div
          className={
            full
              ? 'fixed inset-0 flex items-center justify-center p-space-xl bg-surface text-right'
              : 'flex-1 min-h-[400px] flex items-center justify-center p-space-xl bg-surface-container-lowest m-space-lg rounded-2xl border border-error/30 shadow-lg text-right'
          }
          data-error-boundary={full ? 'root' : 'screen'}
        >
          <div className="max-w-md flex flex-col items-center text-center gap-space-md">
            <div className="w-16 h-16 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[36px]">error</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {this.props.fallbackTitle || 'حدث خطأ أثناء عرض هذه الشاشة'}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                {full
                  ? 'بياناتك سليمة ولم يُمسّ شيء. أعد تحميل الواجهة؛ فإن تكرّر فأغلق ديوان وافتحه من جديد.'
                  : 'تم احتواء الخطأ بنجاح دون إغلاق البرنامج. يمكنك إعادة المحاولة أو الانتقال لشاشة أخرى.'}
              </p>
            </div>
            {this.state.error && (
              <pre className="p-space-sm bg-surface-container-low border border-outline-variant rounded-lg font-mono text-[11px] text-error text-left max-h-32 overflow-auto w-full dir-ltr">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex items-center gap-space-sm">
              <button
                type="button"
                className="h-10 px-space-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold flex items-center gap-1.5 shadow-md hover:opacity-90 transition-opacity"
                data-act={full ? 'reload-ui' : 'retry'}
                onClick={full ? () => window.location.reload() : this.handleReset}
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                {full ? 'أعد تحميل الواجهة' : 'إعادة المحاولة'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
