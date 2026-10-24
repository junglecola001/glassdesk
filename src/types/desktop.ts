import type { WallpaperId } from './settings';

export interface Desktop {
  id: string;
  name: string;
  sourceFolderId: string | null;
  wallpaper?: WallpaperId;
  bookmarkIds: string[];
  createdAt: number;
  updatedAt: number;
  /** The source folder no longer exists. Layout data is intentionally kept. */
  missingSource?: boolean;
}

export interface DesktopSettings {
  activeDesktopId: string;
  desktopOrder: string[];
  showDesktopDots: boolean;
}

export interface DesktopLayout extends DesktopSettings {
  desktops: Desktop[];
}
