import type { AppSettings } from '../types/settings';
import { SCHEMA_VERSION } from '../utils/constants';
import { createDefaultSettings } from '../utils/defaults';
import { STORAGE_KEYS } from '../utils/storage-keys';
import { storageService } from '../services/storage-service';
import { createStore, useStore } from './create-store';
import { pushToast } from './ui-store';

interface SettingsState {
  settings: AppSettings;
}

export const settingsStore = createStore<SettingsState>({
  settings: createDefaultSettings(),
});

export function useSettings(): AppSettings {
  return useStore(settingsStore, (state) => state.settings);
}

export function replaceSettings(settings: AppSettings): void {
  settingsStore.setState({ settings });
}

export function patchSettings(patch: Partial<AppSettings>): void {
  const next: AppSettings = {
    ...settingsStore.getState().settings,
    ...patch,
    schemaVersion: SCHEMA_VERSION,
  };
  settingsStore.setState({ settings: next });
  void storageService
    .mutateKey<AppSettings>(STORAGE_KEYS.settings, (current) => ({
      ...(current ?? createDefaultSettings()),
      ...patch,
      schemaVersion: SCHEMA_VERSION,
    }))
    .catch((error: unknown) => {
      console.error('[GlassDesk] Failed to save settings', error);
      pushToast('设置没有保存成功，请检查存储空间。', 'error');
    });
}
