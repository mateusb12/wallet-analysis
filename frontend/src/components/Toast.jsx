import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, X, XCircle } from 'lucide-react';

const toastStyles = {
  success: {
    icon: CheckCircle,
    container:
      'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: XCircle,
    container:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    container:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
};

export function useToast() {
  const [toast, setToast] = useState(null);

  const hideToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  return { toast, showToast, hideToast };
}

export default function Toast({ message, type = 'success', onClose }) {
  const style = toastStyles[type] || toastStyles.success;
  const Icon = style.icon;

  useEffect(() => {
    const timeout = setTimeout(onClose, 4500);
    return () => clearTimeout(timeout);
  }, [message, onClose]);

  return (
    <div
      role="status"
      className={`fixed right-5 top-5 z-[100] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-in slide-in-from-right-3 fade-in duration-200 ${style.container}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} />
      <p className="text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
        aria-label="Fechar aviso"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
