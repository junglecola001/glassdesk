export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
  dateAdded?: number;
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
