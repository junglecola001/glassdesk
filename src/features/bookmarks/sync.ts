import type { BookmarkCacheEntry, BookmarkNode } from '../../types/bookmark';
import type { Desktop } from '../../types/desktop';
import {
  collectDescendantIds,
  collectDirectItemIds,
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
 * A desktop shows its source folder's direct children: bookmarks stay tiles and
 * nested folders stay folder icons. Older builds flattened nested bookmarks into
 * the desktop, so those legacy ids are replaced by the direct-child structure.
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

    const directIds = collectDirectItemIds(roots, desktop.sourceFolderId);
    const directSet = new Set(directIds);
    const descendantIds = new Set(collectDescendantIds(roots, desktop.sourceFolderId));
    const legacyFlattened = desktop.bookmarkIds.some(
      (id) => descendantIds.has(id) && !directSet.has(id),
    );

    // Keep the user's order for surviving entries; legacy builds also keep
    // bookmarks moved in from outside the source folder.
    const baseline = legacyFlattened
      ? desktop.bookmarkIds.filter((id) => directSet.has(id))
      : desktop.bookmarkIds;
    const merged = mergeBookmarkIds(baseline, directIds);
    const ids = legacyFlattened
      ? mergeBookmarkIds(
          merged.ids,
          desktop.bookmarkIds.filter((id) => !descendantIds.has(id)),
        ).ids
      : merged.ids;
    const wasMissing = desktop.missingSource === true;
    const orderChanged =
      ids.length !== desktop.bookmarkIds.length ||
      ids.some((id, index) => id !== desktop.bookmarkIds[index]);
    if (!orderChanged && !wasMissing) return desktop;

    changed = true;
    return {
      ...desktop,
      bookmarkIds: ids,
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
