import type { BookmarkCacheEntry, BookmarkLayout } from '../../types/bookmark';
import type { AppSettings } from '../../types/settings';
import type { CountdownData, NoteData, PomodoroState, WidgetInstance } from '../../types/widget';
import type { DesktopLayout } from '../../types/desktop';
import { deriveBookmarkLayout } from '../bookmarks/layout';
import { findNodeById, remapBookmarkIdsByUrl } from '../bookmarks/tree';
import { loadBookmarkSnapshot } from '../../services/bookmark-service';
import { storageService } from '../../services/storage-service';
import { APP_VERSION } from '../../utils/constants';
import { parsePersistedSnapshot, snapshotToRaw } from '../../utils/migration';
import { STORAGE_KEYS, type RawStorage } from '../../utils/storage-keys';

export interface BackupFile {
  app: 'GlassDesk';
  version: string;
  exportedAt: number;
  schemaVersion: number;
  settings: AppSettings;
  desktopLayout: DesktopLayout;
  bookmarkLayout: BookmarkLayout[];
  widgets: WidgetInstance[];
  notes: NoteData[];
  countdowns: CountdownData[];
  pomodoro: PomodoroState;
  bookmarkCache: Record<string, BookmarkCacheEntry>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function createBackup(): Promise<BackupFile> {
  const raw = await storageService.readRaw();
  const parsed = parsePersistedSnapshot(raw);
  if (!parsed.ok) throw new Error(parsed.message);
  const snapshot = parsed.snapshot;
  return {
    app: 'GlassDesk',
    version: APP_VERSION,
    exportedAt: Date.now(),
    schemaVersion: snapshot.schemaVersion,
    settings: snapshot.settings,
    desktopLayout: snapshot.desktopLayout,
    bookmarkLayout: snapshot.bookmarkLayout,
    widgets: snapshot.widgets,
    notes: snapshot.notes,
    countdowns: snapshot.countdowns,
    pomodoro: snapshot.pomodoro,
    bookmarkCache: snapshot.bookmarkCache,
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `glassdesk-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Imports a same-device backup. Bookmark ids are internal to a browser profile,
 * so ids are remapped by URL whenever the current bookmark tree is available.
 */
export async function importBackupFile(file: File): Promise<{ desktops: number; bookmarks: number }> {
  if (file.size > 6 * 1024 * 1024) {
    throw new Error('备份文件超过 6MB，无法导入。');
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(await file.text());
  } catch {
    throw new Error('文件不是有效的 JSON。');
  }
  if (!isRecord(parsedJson) || parsedJson.app !== 'GlassDesk' || !isRecord(parsedJson.desktopLayout)) {
    throw new Error('这不是有效的 GlassDesk 备份文件。');
  }

  const raw: RawStorage = {
    [STORAGE_KEYS.settings]: parsedJson.settings,
    [STORAGE_KEYS.desktopLayout]: parsedJson.desktopLayout,
    [STORAGE_KEYS.bookmarkLayout]: parsedJson.bookmarkLayout,
    [STORAGE_KEYS.widgetsLayout]: parsedJson.widgets,
    [STORAGE_KEYS.notes]: parsedJson.notes,
    [STORAGE_KEYS.countdowns]: parsedJson.countdowns,
    [STORAGE_KEYS.pomodoro]: parsedJson.pomodoro,
    [STORAGE_KEYS.bookmarkCache]: parsedJson.bookmarkCache,
  };
  if (typeof parsedJson.schemaVersion === 'number') {
    raw[STORAGE_KEYS.schemaVersion] = parsedJson.schemaVersion;
  }
  const parsed = parsePersistedSnapshot(raw);
  if (!parsed.ok) throw new Error(parsed.message);
  if (parsed.snapshot.desktopLayout.desktops.length === 0) {
    throw new Error('备份中没有桌面数据。');
  }

  const snapshot = parsed.snapshot;
  let loaded: Awaited<ReturnType<typeof loadBookmarkSnapshot>> | null = null;
  try {
    loaded = await loadBookmarkSnapshot();
  } catch {
    loaded = null;
  }

  const desktops = snapshot.desktopLayout.desktops.map((desktop) => {
    if (!loaded) return desktop;
    const bookmarkIds = remapBookmarkIdsByUrl(
      desktop.bookmarkIds,
      snapshot.bookmarkCache,
      loaded.index,
    );
    const sourceFolderId =
      desktop.sourceFolderId && findNodeById(loaded.tree, desktop.sourceFolderId)
        ? desktop.sourceFolderId
        : null;
    return {
      ...desktop,
      bookmarkIds,
      sourceFolderId,
      ...(sourceFolderId === null ? { missingSource: undefined } : {}),
    };
  });

  const desktopIds = new Set(desktops.map((desktop) => desktop.id));
  const desktopOrder = snapshot.desktopLayout.desktopOrder.filter((id) => desktopIds.has(id));
  for (const desktop of desktops) {
    if (!desktopOrder.includes(desktop.id)) desktopOrder.push(desktop.id);
  }
  const activeDesktopId = desktopIds.has(snapshot.desktopLayout.activeDesktopId)
    ? snapshot.desktopLayout.activeDesktopId
    : desktops[0]!.id;

  await storageService.writeItems(
    snapshotToRaw({
      ...snapshot,
      settings: { ...snapshot.settings, onboarded: true },
      desktopLayout: {
        ...snapshot.desktopLayout,
        desktops,
        desktopOrder,
        activeDesktopId,
      },
      bookmarkLayout: deriveBookmarkLayout(desktops),
      bookmarkCache: { ...snapshot.bookmarkCache, ...(loaded?.cache ?? {}) },
    }),
  );

  return {
    desktops: desktops.length,
    bookmarks: desktops.reduce((total, desktop) => total + desktop.bookmarkIds.length, 0),
  };
}
