export const STORAGE_KEYS = {
  schemaVersion: 'storage-schema-version',
  settings: 'settings',
  desktopLayout: 'desktop-layout',
  bookmarkLayout: 'bookmark-layout',
  widgetsLayout: 'widgets-layout',
  notes: 'notes',
  countdowns: 'countdowns',
  pomodoro: 'pomodoro',
  bookmarkCache: 'bookmark-cache',
  faviconRefresh: 'favicon-refresh',
  backup: 'backup-pre-migration',
} as const;

export const CORE_KEYS = [
  STORAGE_KEYS.settings,
  STORAGE_KEYS.desktopLayout,
  STORAGE_KEYS.bookmarkLayout,
  STORAGE_KEYS.widgetsLayout,
  STORAGE_KEYS.notes,
  STORAGE_KEYS.countdowns,
  STORAGE_KEYS.pomodoro,
  STORAGE_KEYS.bookmarkCache,
  STORAGE_KEYS.schemaVersion,
] as const;

export type CoreKey = (typeof CORE_KEYS)[number];
export type RawStorage = Record<string, unknown>;
