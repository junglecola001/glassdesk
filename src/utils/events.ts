import type { WidgetType } from '../types/widget';

export const REVEAL_WIDGET_EVENT = 'glassdesk:reveal-widget';

export function revealWidget(type: WidgetType): void {
  window.dispatchEvent(new CustomEvent(REVEAL_WIDGET_EVENT, { detail: { type } }));
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

export function modifierLabel(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}
