import type { Desktop, DesktopLayout } from '../../types/desktop';
import { deriveBookmarkLayout } from '../bookmarks/layout';
import { buildBookmarkCache, syncDesktopsWithTree } from '../bookmarks/sync';
import { createDemoSeed } from '../../services/demo-data';
import type { BookmarkSnapshot } from '../../services/bookmark-service';
import { loadBookmarkSnapshot } from '../../services/bookmark-service';
import {
  hasBookmarkAccess,
  isExtensionEnvironment,
  subscribeBookmarkChanges,
} from '../../services/browser-api';
import {
  readStartupMirror,
  refreshStartupMirror,
  storageService,
  wasRecentlyWrittenByThisTab,
} from '../../services/storage-service';
import { SCHEMA_VERSION } from '../../utils/constants';
import { createDefaultSettings } from '../../utils/defaults';
import type { PersistedSnapshot } from '../../utils/migration';
import { parsePersistedSnapshot, snapshotToRaw } from '../../utils/migration';
import { STORAGE_KEYS, type RawStorage } from '../../utils/storage-keys';
import {
  applyExternalStorageChanges,
  getViewportSize,
  refreshBookmarks,
  setWorkspaceStatus,
  workspaceStore,
} from '../../stores/desktop-store';
import { replaceSettings } from '../../stores/settings-store';
import { pushToast } from '../../stores/ui-store';

function activeDesktopIdFor(layoutId: string, desktops: Desktop[]): string {
  if (desktops.some((desktop) => desktop.id === layoutId)) return layoutId;
  return desktops[0]?.id ?? '';
}

function orderFor(order: string[], desktops: Desktop[]): string[] {
  const ids = new Set(desktops.map((desktop) => desktop.id));
  const result = order.filter((id) => ids.has(id));
  for (const desktop of desktops) {
    if (!result.includes(desktop.id)) result.push(desktop.id);
  }
  return result;
}

function layoutFor(
  desktops: Desktop[],
  order: string[],
  activeDesktopId: string,
  showDesktopDots: boolean,
): DesktopLayout {
  return { desktops, desktopOrder: order, activeDesktopId, showDesktopDots };
}

function hasStoredData(raw: RawStorage): boolean {
  const known = Object.values(STORAGE_KEYS) as string[];
  return Object.keys(raw).some((key) => known.includes(key));
}

/**
 * Synchronously paints the last known workspace from the localStorage mirror
 * before chrome.storage has answered. This is the fast first-paint path.
 */
export function primeWorkspaceFromMirror(): boolean {
  const raw = readStartupMirror();
  if (Object.keys(raw).length === 0) return false;
  const parsed = parsePersistedSnapshot(raw);
  if (!parsed.ok) return false;
  const snapshot = parsed.snapshot;
  if (!snapshot.settings.onboarded || snapshot.desktopLayout.desktops.length === 0) return false;
  replaceSettings(snapshot.settings);
  workspaceStore.setState({
    status: 'ready',
    error: null,
    isDemo: !isExtensionEnvironment(),
    hasBookmarkPermission: hasBookmarkAccess(),
    desktops: snapshot.desktopLayout.desktops,
    desktopOrder: snapshot.desktopLayout.desktopOrder,
    activeDesktopId: snapshot.desktopLayout.activeDesktopId,
    widgets: snapshot.widgets,
    notes: snapshot.notes,
    countdowns: snapshot.countdowns,
    pomodoro: snapshot.pomodoro,
    bookmarkCache: snapshot.bookmarkCache,
    lastSyncedAt: 0,
  });
  return true;
}

let bootstrapped = false;
let externalTimer: number | undefined;
let bookmarkTimer: number | undefined;
let visibilityHandler: (() => void) | null = null;

export async function bootstrapWorkspace(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  const extension = isExtensionEnvironment();
  const isDemo = !extension;
  const hasPermission = hasBookmarkAccess();

  let raw: RawStorage;
  try {
    raw = await storageService.readRaw();
  } catch (error) {
    console.error('[GlassDesk] Cannot read storage', error);
    replaceSettings(createDefaultSettings());
    setWorkspaceStatus('error', '无法读取扩展存储，请重新打开新标签页。');
    return;
  }

  const parsed = parsePersistedSnapshot(raw);
  if (!parsed.ok) {
    replaceSettings(createDefaultSettings());
    setWorkspaceStatus('error', parsed.message);
    return;
  }

  const snapshot = parsed.snapshot;
  let settings = snapshot.settings;
  let desktops = snapshot.desktopLayout.desktops;
  let widgets = snapshot.widgets;
  let notes = snapshot.notes;
  let countdowns = snapshot.countdowns;
  let pomodoro = snapshot.pomodoro;
  let cache = snapshot.bookmarkCache;
  let status: 'ready' | 'onboarding' = 'ready';
  let seeded = false;
  let layoutChanged = false;

  let loaded: BookmarkSnapshot | null = null;
  try {
    loaded = await loadBookmarkSnapshot();
    cache = { ...cache, ...loaded.cache };
  } catch (error) {
    console.warn('[GlassDesk] Bookmark access unavailable', error);
  }

  if (desktops.length === 0 && isDemo) {
    const seed = createDemoSeed(Date.now(), getViewportSize());
    desktops = seed.desktops;
    widgets = seed.widgets;
    notes = seed.notes;
    countdowns = seed.countdowns;
    pomodoro = seed.pomodoro;
    settings = seed.settings;
    if (loaded) cache = { ...cache, ...buildBookmarkCache(loaded.tree) };
    seeded = true;
    layoutChanged = true;
    status = 'ready';
  } else if (desktops.length === 0) {
    status = 'onboarding';
  } else if (loaded && settings.bookmarkSyncMode === 'follow') {
    const result = syncDesktopsWithTree(desktops, loaded.tree, Date.now(), cache);
    desktops = result.desktops;
    cache = result.cache;
    layoutChanged = result.changed;
  }

  const desktopOrder = orderFor(snapshot.desktopLayout.desktopOrder, desktops);
  const activeDesktopId = activeDesktopIdFor(
    snapshot.desktopLayout.activeDesktopId,
    desktops,
  );
  const cacheChanged = JSON.stringify(cache) !== JSON.stringify(snapshot.bookmarkCache);

  const writes: RawStorage = {};
  if (parsed.needsWrite && hasStoredData(raw)) {
    try {
      await storageService.backupRaw(raw, 'schema-upgrade');
    } catch (error) {
      console.warn('[GlassDesk] Could not write pre-migration backup', error);
    }
  }

  if (parsed.needsWrite || seeded) {
    const fullSnapshot: PersistedSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      settings,
      desktopLayout: layoutFor(
        desktops,
        desktopOrder,
        activeDesktopId,
        settings.showDesktopDots,
      ),
      bookmarkLayout: deriveBookmarkLayout(desktops),
      widgets,
      notes,
      countdowns,
      pomodoro,
      bookmarkCache: cache,
    };
    Object.assign(writes, snapshotToRaw(fullSnapshot));
  } else {
    if (layoutChanged) {
      writes[STORAGE_KEYS.desktopLayout] = layoutFor(
        desktops,
        desktopOrder,
        activeDesktopId,
        settings.showDesktopDots,
      );
      writes[STORAGE_KEYS.bookmarkLayout] = deriveBookmarkLayout(desktops);
    }
    if (cacheChanged) writes[STORAGE_KEYS.bookmarkCache] = cache;
  }

  if (Object.keys(writes).length > 0) {
    try {
      await storageService.writeItems(writes);
      refreshStartupMirror({ ...raw, ...writes });
    } catch (error) {
      console.error('[GlassDesk] Initial persistence failed', error);
      pushToast('初始数据没有保存成功，请检查浏览器存储空间。', 'error');
    }
  }

  replaceSettings(settings);
  workspaceStore.setState({
    status,
    hydrated: true,
    error: null,
    isDemo,
    hasBookmarkPermission: hasPermission,
    desktops,
    desktopOrder,
    activeDesktopId,
    widgets,
    notes,
    countdowns,
    pomodoro,
    bookmarkCache: cache,
    liveBookmarks: loaded?.index ?? new Map(),
    bookmarkFolders: loaded?.folders ?? [],
    bookmarkTree: loaded?.tree ?? [],
    lastSyncedAt: loaded ? Date.now() : 0,
  });

  setupSubscriptions();
}

function setupSubscriptions(): void {
  storageService.subscribe((changes) => {
    const keys = Object.keys(changes).filter(
      (key) => key !== STORAGE_KEYS.schemaVersion && key !== STORAGE_KEYS.backup,
    );
    if (keys.length === 0) return;
    if (wasRecentlyWrittenByThisTab(keys)) return;
    if (externalTimer !== undefined) window.clearTimeout(externalTimer);
    externalTimer = window.setTimeout(() => {
      externalTimer = undefined;
      void applyExternalStorageChanges();
    }, 180);
  });

  subscribeBookmarkChanges(() => {
    if (document.visibilityState === 'hidden') return;
    if (bookmarkTimer !== undefined) window.clearTimeout(bookmarkTimer);
    bookmarkTimer = window.setTimeout(() => {
      bookmarkTimer = undefined;
      void refreshBookmarks({ silent: true });
    }, 900);
  });

  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
  visibilityHandler = () => {
    if (document.visibilityState !== 'visible') return;
    const { lastSyncedAt } = workspaceStore.getState();
    if (Date.now() - lastSyncedAt > 60_000) {
      void refreshBookmarks({ silent: true });
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}
