import type { BookmarkCacheEntry, BookmarkNode } from '../../types/bookmark';
import type { Desktop } from '../../types/desktop';
import {
  collectBookmarkIdsInFolder,
  findNodeById,
  indexBookmarks,
  mergeBookmarkIds,
} from './tree';

export interface BookmarkSyncResult {
  desktops: Desktop[];
  cache: Record<string, BookmarkCacheEntry>;
  changed: boolean;
}

export function buildBookmarkCache(
  roots: BookmarkNode[],
  now = Date.now(),
): Record<string, BookmarkCacheEntry> {
  const cache: Record<string, BookmarkCacheEntry> = {};
  for (const meta of indexBookmarks(roots).values()) {
    cache[meta.id] = {
      id: meta.id,
      title: meta.title,
      url: meta.url,
      parentId: meta.parentId,
      path: meta.path,
      cachedAt: now,
    };
  }
  return cache;
}

/**
 * Idempotently reconciles mapped desktops with the live bookmark tree.
 * Missing bookmarks are kept as-is so a temporary failure or a moved source
 * folder cannot erase a user's custom layout.
 */
export function syncDesktopsWithTree(
  desktops: Desktop[],
  roots: BookmarkNode[],
  now = Date.now(),
  previousCache: Record<string, BookmarkCacheEntry> = {},
): BookmarkSyncResult {
  let changed = false;
  const next = desktops.map((desktop) => {
    if (!desktop.sourceFolderId) return desktop;
    const folder = findNodeById(roots, desktop.sourceFolderId);
    if (!folder || folder.url) {
      if (desktop.missingSource) return desktop;
      changed = true;
      return { ...desktop, missingSource: true, updatedAt: now };
    }

    const liveIds = collectBookmarkIdsInFolder(roots, desktop.sourceFolderId);
    const merged = mergeBookmarkIds(desktop.bookmarkIds, liveIds);
    const wasMissing = desktop.missingSource === true;
    if (merged.added.length === 0 && !wasMissing) return desktop;

    changed = true;
    return {
      ...desktop,
      bookmarkIds: merged.ids,
      updatedAt: now,
      ...(wasMissing ? { missingSource: undefined } : {}),
    };
  });

  return {
    desktops: next,
    cache: { ...previousCache, ...buildBookmarkCache(roots, now) },
    changed,
  };
}
