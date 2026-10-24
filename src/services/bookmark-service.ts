import { buildBookmarkCache } from '../features/bookmarks/sync';
import { indexBookmarks, listFolderCandidates } from '../features/bookmarks/tree';
import type { BookmarkCacheEntry, BookmarkMeta, BookmarkNode, FolderCandidate } from '../types/bookmark';
import { readBookmarkTree } from './browser-api';

export interface BookmarkSnapshot {
  tree: BookmarkNode[];
  index: Map<string, BookmarkMeta>;
  cache: Record<string, BookmarkCacheEntry>;
  folders: FolderCandidate[];
}

export async function loadBookmarkSnapshot(): Promise<BookmarkSnapshot> {
  const tree = await readBookmarkTree();
  return {
    tree,
    index: indexBookmarks(tree),
    cache: buildBookmarkCache(tree),
    folders: listFolderCandidates(tree),
  };
}
