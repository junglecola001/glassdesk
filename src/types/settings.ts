export type GlassIntensity = 'low' | 'medium' | 'high';
export type BookmarkSyncMode = 'import' | 'follow';
export type SearchEngineId = 'bing' | 'google' | 'baidu' | 'duckduckgo';
export type WallpaperId = 'sunrise' | 'mint' | 'dune' | 'dusk' | 'paper';
export type Appearance = 'light';

export interface AppSettings {
  schemaVersion: number;
  appearance: Appearance;
  glassIntensity: GlassIntensity;
  reducedMotion: boolean;
  bookmarkSyncMode: BookmarkSyncMode;
  dockAutoHide: boolean;
  searchEngine: SearchEngineId;
  defaultWallpaper: WallpaperId;
  dockPinnedBookmarkIds: string[];
  showDesktopDots: boolean;
  onboarded: boolean;
}
