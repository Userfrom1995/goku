import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let addToastFn: ((message: string, type?: ToastType) => void) | null = null;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  addToastFn = addToast;

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

export function toast(message: string, type: ToastType = 'info') {
  addToastFn?.(message, type);
}

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-slide-in ${
            t.type === 'error' ? 'bg-red-900 text-red-200 border border-red-700' :
            t.type === 'success' ? 'bg-green-900 text-green-200 border border-green-700' :
            'bg-gray-800 text-gray-200 border border-gray-700'
          }`}
        >
          <span>{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-2 text-gray-500 hover:text-gray-300">×</button>
        </div>
      ))}
    </div>
  );
}
