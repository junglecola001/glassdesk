import type { DesktopLayout } from '../types/desktop';
import type { BookmarkCacheEntry, BookmarkLayout } from '../types/bookmark';
import { deriveBookmarkLayout } from '../features/bookmarks/layout';
import { syncDesktopsWithTree } from '../features/bookmarks/sync';
import { hasBookmarkAccess, readBookmarkTree, subscribeBookmarkChanges } from '../services/browser-api';
import { storageService } from '../services/storage-service';
import { SCHEMA_VERSION } from '../utils/constants';
import { parsePersistedSnapshot } from '../utils/migration';
import { STORAGE_KEYS } from '../utils/storage-keys';

let syncTimer: ReturnType<typeof setTimeout> | undefined;
let syncing = false;

async function initializeSchema(): Promise<void> {
  try {
    const raw = await storageService.readKeys([STORAGE_KEYS.schemaVersion]);
    if (typeof raw[STORAGE_KEYS.schemaVersion] !== 'number') {
      await storageService.writeItems({ [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
    }
  } catch (error) {
    console.warn('[GlassDesk] Could not initialize schema version', error);
  }
}

async function syncFollowedBookmarks(): Promise<void> {
  if (syncing) {
    scheduleSync(500);
    return;
  }
  if (!hasBookmarkAccess()) return;
  syncing = true;
  try {
    const raw = await storageService.readRaw();
    const parsed = parsePersistedSnapshot(raw);
    if (!parsed.ok) return;
    const snapshot = parsed.snapshot;
    if (snapshot.settings.bookmarkSyncMode !== 'follow') return;
    if (snapshot.desktopLayout.desktops.length === 0) return;

    const tree = await readBookmarkTree();
    const result = syncDesktopsWithTree(
      snapshot.desktopLayout.desktops,
      tree,
      Date.now(),
      snapshot.bookmarkCache,
    );
    const cacheChanged = JSON.stringify(result.cache) !== JSON.stringify(snapshot.bookmarkCache);
    if (result.changed) {
      const byId = new Map(result.desktops.map((desktop) => [desktop.id, desktop]));
      let mergedDesktops = snapshot.desktopLayout.desktops;
      await storageService.mutateKey<DesktopLayout>(STORAGE_KEYS.desktopLayout, (current) => {
        const base = current ?? snapshot.desktopLayout;
        mergedDesktops = base.desktops.map((desktop) => {
          const next = byId.get(desktop.id);
          if (!next) return desktop;
          return {
            ...desktop,
            bookmarkIds: next.bookmarkIds,
            missingSource: next.missingSource,
            updatedAt: next.updatedAt,
          };
        });
        return { ...base, desktops: mergedDesktops };
      });
      await storageService
        .mutateKey<BookmarkLayout[]>(STORAGE_KEYS.bookmarkLayout, () =>
          deriveBookmarkLayout(mergedDesktops),
        )
        .catch(() => undefined);
    }
    if (cacheChanged) {
      await storageService.mutateKey<Record<string, BookmarkCacheEntry>>(
        STORAGE_KEYS.bookmarkCache,
        (current) => ({ ...(current ?? {}), ...result.cache }),
      );
    }
  } catch (error) {
    console.warn('[GlassDesk] Background bookmark sync failed', error);
  } finally {
    syncing = false;
  }
}

function scheduleSync(delay = 700): void {
  if (syncTimer !== undefined) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = undefined;
    void syncFollowedBookmarks();
  }, delay);
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeSchema();
  scheduleSync(1200);
});

chrome.runtime.onStartup.addListener(() => {
  void initializeSchema();
  scheduleSync(1200);
});

subscribeBookmarkChanges(() => scheduleSync());
