import type {
  AppSettings,
  BookmarkColumns,
  BookmarkSyncMode,
  GlassIntensity,
  SearchEngineId,
  WallpaperId,
} from '../types/settings';
import type { NoteColor, PomodoroState } from '../types/widget';
import { DEFAULT_SEARCH_ENGINE, SCHEMA_VERSION } from './constants';

export const SEARCH_ENGINE_IDS: SearchEngineId[] = ['bing', 'google', 'baidu', 'duckduckgo'];
export const WALLPAPER_IDS: WallpaperId[] = ['sunrise', 'mint', 'dune', 'dusk', 'paper'];
export const GLASS_INTENSITIES: GlassIntensity[] = ['low', 'medium', 'high'];
export const SYNC_MODES: BookmarkSyncMode[] = ['import', 'follow'];
export const NOTE_COLORS: NoteColor[] = ['paper', 'apricot', 'mint', 'lilac'];
export const BOOKMARK_COLUMNS: BookmarkColumns[] = [1, 2, 3, 4, 5];

export function createDefaultSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    schemaVersion: SCHEMA_VERSION,
    appearance: 'light',
    glassIntensity: 'medium',
    reducedMotion: false,
    bookmarkSyncMode: 'follow',
    dockAutoHide: false,
    searchEngine: DEFAULT_SEARCH_ENGINE,
    defaultWallpaper: 'dusk',
    dockPinnedBookmarkIds: [],
    bookmarkColumns: 2,
    showDesktopDots: true,
    onboarded: false,
    ...overrides,
  };
}

export function createDefaultPomodoro(): PomodoroState {
  return {
    phase: 'focus',
    running: false,
    endsAt: null,
    remainingMs: 25 * 60_000,
    completedFocus: 0,
    settings: { focusMinutes: 25, breakMinutes: 5 },
  };
}
