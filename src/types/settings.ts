export type GlassIntensity = 'low' | 'medium' | 'high';
export type BookmarkSyncMode = 'import' | 'follow';
export type SearchEngineId = 'bing' | 'google' | 'baidu' | 'duckduckgo';
export type WallpaperId = 'sunrise' | 'mint' | 'dune' | 'dusk' | 'paper';
export type Appearance = 'light';
export type BookmarkColumns = 1 | 2 | 3 | 4 | 5;

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
  bookmarkColumns: BookmarkColumns;
  showDesktopDots: boolean;
  onboarded: boolean;
}
