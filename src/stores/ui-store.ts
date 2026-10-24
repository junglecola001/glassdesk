import { createStore, useStore } from './create-store';
import { createId } from '../utils/id';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
}

export type SettingsSection = 'appearance' | 'desktops' | 'search' | 'data' | 'about';

interface UiState {
  searchOpen: boolean;
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  widgetMenuOpen: boolean;
  toasts: ToastMessage[];
}

export const uiStore = createStore<UiState>({
  searchOpen: false,
  settingsOpen: false,
  settingsSection: 'appearance',
  widgetMenuOpen: false,
  toasts: [],
});

export function useUiState(): UiState {
  return useStore(uiStore, (state) => state);
}

export function setSearchOpen(open: boolean): void {
  uiStore.setState({ searchOpen: open });
}

export function setSettingsOpen(open: boolean, section?: SettingsSection): void {
  uiStore.setState({
    settingsOpen: open,
    ...(open && section ? { settingsSection: section } : {}),
  });
}

export function setWidgetMenuOpen(open: boolean): void {
  uiStore.setState({ widgetMenuOpen: open });
}

export function closeAllOverlays(): void {
  uiStore.setState({ searchOpen: false, settingsOpen: false, widgetMenuOpen: false });
}

export function pushToast(message: string, tone: ToastTone = 'info'): void {
  const toast: ToastMessage = { id: createId('toast'), message, tone };
  uiStore.setState({ toasts: [...uiStore.getState().toasts, toast].slice(-4) });
  window.setTimeout(() => dismissToast(toast.id), tone === 'error' ? 6000 : 3800);
}

export function dismissToast(id: string): void {
  uiStore.setState({ toasts: uiStore.getState().toasts.filter((toast) => toast.id !== id) });
}
