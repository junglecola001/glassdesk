export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
  dateAdded?: number;
}

export type BookmarkItemKind = 'bookmark' | 'folder';

/** A bookmark or a nested folder rendered as one desktop item. */
export interface BookmarkItemView {
  id: string;
  kind: BookmarkItemKind;
  title: string;
  /** Empty for folders. */
  url: string;
  path: string[];
  missing: boolean;
  /** Number of bookmarks inside a folder. Folders only. */
  count?: number;
}

export interface BookmarkMeta {
  id: string;
  title: string;
  url: string;
  parentId: string;
  path: string[];
  dateAdded?: number;
}

export interface BookmarkLayout {
  bookmarkId: string;
  desktopId: string;
  order: number;
  x?: number;
  y?: number;
}

export interface BookmarkCacheEntry {
  id: string;
  title: string;
  url: string;
  parentId: string;
  path: string[];
  cachedAt: number;
}

export interface FolderCandidate {
  id: string;
  title: string;
  path: string[];
  depth: number;
  count: number;
}
