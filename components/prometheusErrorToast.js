import { useEffect } from 'react';

export default function PrometheusErrorToast({ message, onDismiss, duration = 6000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timeoutId = setTimeout(() => {
      if (onDismiss) {
        onDismiss();
      }
    }, duration);
    return () => clearTimeout(timeoutId);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 shadow-lg dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-200">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm">
          <div className="font-semibold">Prometheus error</div>
          <div className="mt-1">{message}</div>
        </div>
        <button
          type="button"
          className="text-xs font-medium hover:underline"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
