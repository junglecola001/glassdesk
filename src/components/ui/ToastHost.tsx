import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';
import { createPortal } from 'react-dom';
import { dismissToast, useUiState } from '../../stores/ui-store';

export function ToastHost() {
  const { toasts, settingsOpen } = useUiState();
  if (toasts.length === 0) return null;

  return createPortal(
    <div className={`toast-host${settingsOpen ? ' toast-host--modal' : ''}`} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon =
          toast.tone === 'success' ? CheckCircle : toast.tone === 'error' ? WarningCircle : Info;
        return (
          <div
            key={toast.id}
            className="toast glass glass--strong"
            data-tone={toast.tone}
            role="status"
            onClick={() => dismissToast(toast.id)}
          >
            <Icon size={15} weight="fill" aria-hidden />
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
