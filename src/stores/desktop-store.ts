import type {
  BookmarkCacheEntry,
  BookmarkLayout,
  BookmarkMeta,
  BookmarkNode,
  FolderCandidate,
} from '../types/bookmark';
import type { Desktop, DesktopLayout } from '../types/desktop';
import type { WallpaperId } from '../types/settings';
import type {
  CountdownData,
  NoteColor,
  NoteData,
  PomodoroState,
  WidgetInstance,
  WidgetType,
} from '../types/widget';
import { deriveBookmarkLayout } from '../features/bookmarks/layout';
import { buildBookmarkCache, syncDesktopsWithTree } from '../features/bookmarks/sync';
import {
  collectBookmarkIdsInFolder,
  findNodeById,
} from '../features/bookmarks/tree';
import {
  createDefaultWidgetsForDesktop,
  createWidget,
  widgetLabel,
} from '../features/layout/widget-layout';
import { WALLPAPERS } from '../features/layout/wallpapers';
import { loadBookmarkSnapshot } from '../services/bookmark-service';
import { storageService } from '../services/storage-service';
import { SCHEMA_VERSION } from '../utils/constants';
import { createDefaultPomodoro } from '../utils/defaults';
import { modifierLabel } from '../utils/events';
import { createId } from '../utils/id';
import { parsePersistedSnapshot, snapshotToRaw } from '../utils/migration';
import { STORAGE_KEYS } from '../utils/storage-keys';
import { createStore, useStore } from './create-store';
import { patchSettings, replaceSettings, settingsStore } from './settings-store';
import { closeAllOverlays, pushToast } from './ui-store';

export type WorkspaceStatus = 'booting' | 'ready' | 'onboarding' | 'error';

export interface WorkspaceState {
  status: WorkspaceStatus;
  hydrated: boolean;
  error: string | null;
  isDemo: boolean;
  hasBookmarkPermission: boolean;
  desktops: Desktop[];
  desktopOrder: string[];
  activeDesktopId: string;
  widgets: WidgetInstance[];
  notes: NoteData[];
  countdowns: CountdownData[];
  pomodoro: PomodoroState;
  bookmarkCache: Record<string, BookmarkCacheEntry>;
  liveBookmarks: Map<string, BookmarkMeta>;
  bookmarkFolders: FolderCandidate[];
  bookmarkTree: BookmarkNode[];
  lastSyncedAt: number;
}

const initialState: WorkspaceState = {
  status: 'booting',
  hydrated: false,
  error: null,
  isDemo: false,
  hasBookmarkPermission: false,
  desktops: [],
  desktopOrder: [],
  activeDesktopId: '',
  widgets: [],
  notes: [],
  countdowns: [],
  pomodoro: createDefaultPomodoro(),
  bookmarkCache: {},
  liveBookmarks: new Map(),
  bookmarkFolders: [],
  bookmarkTree: [],
  lastSyncedAt: 0,
};

export const workspaceStore = createStore<WorkspaceState>(initialState);

export function useWorkspace(): WorkspaceState {
  return useStore(workspaceStore, (state) => state);
}

export function useWorkspaceStatus(): WorkspaceStatus {
  return useStore(workspaceStore, (state) => state.status);
}

export function useActiveDesktop(): Desktop | null {
  return useStore(
    workspaceStore,
    (state) => state.desktops.find((desktop) => desktop.id === state.activeDesktopId) ?? null,
  );
}

export function useActiveWidgets(): WidgetInstance[] {
  return useStore(workspaceStore, (state) =>
    state.widgets.filter(
      (widget) => widget.desktopId === state.activeDesktopId && widget.visible,
    ),
  );
}

export function useNotes(): NoteData[] {
  return useStore(workspaceStore, (state) => state.notes);
}

export function useCountdowns(): CountdownData[] {
  return useStore(workspaceStore, (state) => state.countdowns);
}

export function usePomodoro(): PomodoroState {
  return useStore(workspaceStore, (state) => state.pomodoro);
}

export function useDesktopBookmarkViews(): Array<BookmarkView & { desktopId: string }> {
  return useStore(
    workspaceStore,
    (state) => {
      const desktop = state.desktops.find((item) => item.id === state.activeDesktopId);
      if (!desktop) return [];
      return desktop.bookmarkIds.map((id) => ({ ...resolveBookmarkView(state, id), desktopId: desktop.id }));
    },
  );
}

export interface BookmarkView {
  id: string;
  title: string;
  url: string;
  path: string[];
  missing: boolean;
}

export function resolveBookmarkView(state: WorkspaceState, id: string): BookmarkView {
  const live = state.liveBookmarks.get(id);
  if (live) {
    return { id: live.id, title: live.title, url: live.url, path: live.path, missing: false };
  }
  const cached = state.bookmarkCache[id];
  if (cached) {
    return {
      id: cached.id,
      title: cached.title,
      url: cached.url,
      path: cached.path,
      missing: true,
    };
  }
  return { id, title: '已失效的书签', url: '', path: [], missing: true };
}

export function getSearchableBookmarks(state: WorkspaceState): BookmarkMeta[] {
  if (state.lastSyncedAt > 0) return Array.from(state.liveBookmarks.values());
  return Object.values(state.bookmarkCache).map((entry) => ({
    id: entry.id,
    title: entry.title,
    url: entry.url,
    parentId: entry.parentId,
    path: entry.path,
  }));
}

export function getViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1440, height: 900 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function reportPersistenceError(error: unknown): void {
  console.error('[GlassDesk] Persistence failed', error);
  pushToast('更改没有保存成功，请检查浏览器存储空间。', 'error');
}

function uniqueNameFrom(base: string, existingNames: string[]): string {
  const trimmed = base.trim() || '未命名桌面';
  if (!existingNames.includes(trimmed)) return trimmed;
  let index = 2;
  while (existingNames.includes(`${trimmed} ${index}`)) index++;
  return `${trimmed} ${index}`;
}

function uniqueDesktopName(base: string, desktops: Desktop[]): string {
  return uniqueNameFrom(base, desktops.map((desktop) => desktop.name));
}

function buildLayout(desktops: Desktop[], order: string[], activeId: string): DesktopLayout {
  return {
    desktops,
    desktopOrder: order,
    activeDesktopId: activeId,
    showDesktopDots: settingsStore.getState().settings.showDesktopDots,
  };
}

function makeDefaultWidgets(desktopId: string, includePomodoro = false): WidgetInstance[] {
  const state = workspaceStore.getState();
  const widgets = createDefaultWidgetsForDesktop(desktopId, getViewportSize(), { includePomodoro });
  return widgets.map((widget) => {
    if (widget.type === 'note') {
      return { ...widget, settings: { noteId: state.notes[0]?.id ?? null } };
    }
    if (widget.type === 'countdown') {
      return { ...widget, settings: { countdownId: state.countdowns[0]?.id ?? null } };
    }
    return widget;
  });
}

function createDesktopRecord(
  name: string,
  sourceFolderId: string | null,
  bookmarkIds: string[],
  wallpaper: WallpaperId,
): Desktop {
  const now = Date.now();
  return {
    id: createId('desktop'),
    name,
    sourceFolderId,
    wallpaper,
    bookmarkIds,
    createdAt: now,
    updatedAt: now,
  };
}

function mergeOrder(order: string[], desktops: Desktop[]): string[] {
  const ids = new Set(desktops.map((desktop) => desktop.id));
  const result = order.filter((id) => ids.has(id));
  for (const desktop of desktops) {
    if (!result.includes(desktop.id)) result.push(desktop.id);
  }
  return result;
}

function writeLayoutAndBookmarkLayout(layout: DesktopLayout): void {
  void storageService
    .writeItems({
      [STORAGE_KEYS.desktopLayout]: layout,
      [STORAGE_KEYS.bookmarkLayout]: deriveBookmarkLayout(layout.desktops),
    })
    .catch(reportPersistenceError);
}

export function setActiveDesktop(desktopId: string): void {
  const state = workspaceStore.getState();
  if (desktopId === state.activeDesktopId) return;
  if (!state.desktops.some((desktop) => desktop.id === desktopId)) return;
  workspaceStore.setState({ activeDesktopId: desktopId });
  void storageService
    .mutateKey<DesktopLayout>(STORAGE_KEYS.desktopLayout, (current) =>
      current ? { ...current, activeDesktopId: desktopId } : undefined,
    )
    .catch(reportPersistenceError);
}

export function addBlankDesktop(rawName?: string): string | null {
  const state = workspaceStore.getState();
  if (state.desktops.length >= 60) {
    pushToast('桌面数量已经达到上限（60 个）。', 'error');
    return null;
  }
  const settings = settingsStore.getState().settings;
  const desktop = createDesktopRecord(
    uniqueDesktopName(rawName ?? '新桌面', state.desktops),
    null,
    [],
    settings.defaultWallpaper,
  );
  const widgets = makeDefaultWidgets(desktop.id);
  const desktops = [...state.desktops, desktop];
  const order = [...state.desktopOrder, desktop.id];
  workspaceStore.setState({
    desktops,
    desktopOrder: order,
    activeDesktopId: desktop.id,
    widgets: [...state.widgets, ...widgets],
  });
  writeLayoutAndBookmarkLayout(buildLayout(desktops, order, desktop.id));
  void storageService
    .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (current) => {
      const list = current ?? [];
      const ids = new Set(list.map((widget) => widget.id));
      return [...list, ...widgets.filter((widget) => !ids.has(widget.id))];
    })
    .catch(reportPersistenceError);
  return desktop.id;
}

export async function addDesktopFromFolder(folderId: string): Promise<string | null> {
  const state = workspaceStore.getState();
  const existing = state.desktops.find((desktop) => desktop.sourceFolderId === folderId);
  if (existing) {
    setActiveDesktop(existing.id);
    pushToast('这个文件夹已经有一个桌面了。', 'info');
    return existing.id;
  }
  try {
    const loaded = await loadBookmarkSnapshot();
    const folder = findNodeById(loaded.tree, folderId);
    if (!folder || folder.url) {
      pushToast('找不到这个书签文件夹。', 'error');
      return null;
    }
    const bookmarkIds = collectBookmarkIdsInFolder(loaded.tree, folderId);
    const current = workspaceStore.getState();
    const settings = settingsStore.getState().settings;
    const wallpaper =
      WALLPAPERS[(current.desktops.length + 1) % WALLPAPERS.length]?.id ?? settings.defaultWallpaper;
    const desktop = createDesktopRecord(
      uniqueDesktopName(folder.title || '书签桌面', current.desktops),
      folderId,
      bookmarkIds,
      wallpaper,
    );
    const widgets = makeDefaultWidgets(desktop.id);
    const desktops = [...current.desktops, desktop];
    const order = [...current.desktopOrder, desktop.id];
    workspaceStore.setState({
      desktops,
      desktopOrder: order,
      activeDesktopId: desktop.id,
      widgets: [...current.widgets, ...widgets],
      bookmarkTree: loaded.tree,
      liveBookmarks: loaded.index,
      bookmarkFolders: loaded.folders,
      bookmarkCache: { ...current.bookmarkCache, ...loaded.cache },
      lastSyncedAt: Date.now(),
    });
    writeLayoutAndBookmarkLayout(buildLayout(desktops, order, desktop.id));
    void storageService
      .writeItems({ [STORAGE_KEYS.bookmarkCache]: { ...current.bookmarkCache, ...loaded.cache } })
      .catch(reportPersistenceError);
    void storageService
      .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (stored) => {
        const list = stored ?? [];
        const ids = new Set(list.map((widget) => widget.id));
        return [...list, ...widgets.filter((widget) => !ids.has(widget.id))];
      })
      .catch(reportPersistenceError);
    pushToast(`已创建桌面「${desktop.name}」`, 'success');
    return desktop.id;
  } catch (error) {
    console.error('[GlassDesk] Could not add desktop from folder', error);
    pushToast('无法读取书签文件夹，请确认已授予书签权限。', 'error');
    return null;
  }
}

export function renameDesktop(desktopId: string, rawName: string): void {
  const state = workspaceStore.getState();
  const target = state.desktops.find((desktop) => desktop.id === desktopId);
  if (!target) return;
  const name = uniqueDesktopName(
    rawName,
    state.desktops.filter((desktop) => desktop.id !== desktopId),
  );
  if (!name || name === target.name) return;
  const desktops = state.desktops.map((desktop) =>
    desktop.id === desktopId ? { ...desktop, name, updatedAt: Date.now() } : desktop,
  );
  workspaceStore.setState({ desktops });
  void storageService
    .mutateKey<DesktopLayout>(STORAGE_KEYS.desktopLayout, (current) =>
      current
        ? {
            ...current,
            desktops: current.desktops.map((desktop) =>
              desktop.id === desktopId ? { ...desktop, name, updatedAt: Date.now() } : desktop,
            ),
          }
        : undefined,
    )
    .catch(reportPersistenceError);
}

export function setDesktopWallpaper(desktopId: string, wallpaper: WallpaperId): void {
  const state = workspaceStore.getState();
  const desktops = state.desktops.map((desktop) =>
    desktop.id === desktopId ? { ...desktop, wallpaper, updatedAt: Date.now() } : desktop,
  );
  workspaceStore.setState({ desktops });
  void storageService
    .mutateKey<DesktopLayout>(STORAGE_KEYS.desktopLayout, (current) =>
      current
        ? {
            ...current,
            desktops: current.desktops.map((desktop) =>
              desktop.id === desktopId ? { ...desktop, wallpaper, updatedAt: Date.now() } : desktop,
            ),
          }
        : undefined,
    )
    .catch(reportPersistenceError);
}

export function reorderDesktop(desktopId: string, direction: -1 | 1): void {
  const state = workspaceStore.getState();
  const order = [...state.desktopOrder];
  const index = order.indexOf(desktopId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target]!, order[index]!];
  workspaceStore.setState({ desktopOrder: order });
  void storageService
    .mutateKey<DesktopLayout>(STORAGE_KEYS.desktopLayout, (current) =>
      current ? { ...current, desktopOrder: order } : undefined,
    )
    .catch(reportPersistenceError);
}

export function deleteDesktop(desktopId: string): void {
  const state = workspaceStore.getState();
  if (state.desktops.length <= 1) {
    pushToast('至少保留一个桌面。', 'info');
    return;
  }
  const target = state.desktops.find((desktop) => desktop.id === desktopId);
  if (!target) return;
  const desktops = state.desktops.filter((desktop) => desktop.id !== desktopId);
  const order = state.desktopOrder.filter((id) => id !== desktopId);
  let activeDesktopId = state.activeDesktopId;
  if (activeDesktopId === desktopId) {
    const oldIndex = state.desktopOrder.indexOf(desktopId);
    activeDesktopId = desktops[Math.max(0, oldIndex - 1)]?.id ?? desktops[0]!.id;
  }
  const widgets = state.widgets.filter((widget) => widget.desktopId !== desktopId);
  workspaceStore.setState({ desktops, desktopOrder: order, activeDesktopId, widgets });
  writeLayoutAndBookmarkLayout(buildLayout(desktops, order, activeDesktopId));
  void storageService
    .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (current) =>
      (current ?? []).filter((widget) => widget.desktopId !== desktopId),
    )
    .catch(reportPersistenceError);
  pushToast(`已删除桌面「${target.name}」，浏览器书签未受影响。`, 'success');
}

export function reorderBookmarks(desktopId: string, orderedIds: string[]): void {
  const state = workspaceStore.getState();
  const desktop = state.desktops.find((item) => item.id === desktopId);
  if (!desktop) return;
  const allowed = new Set(desktop.bookmarkIds);
  const nextIds = orderedIds.filter((id) => allowed.has(id));
  for (const id of desktop.bookmarkIds) {
    if (!nextIds.includes(id)) nextIds.push(id);
  }
  if (nextIds.every((id, index) => id === desktop.bookmarkIds[index])) return;
  const now = Date.now();
  const desktops = state.desktops.map((item) =>
    item.id === desktopId ? { ...item, bookmarkIds: nextIds, updatedAt: now } : item,
  );
  workspaceStore.setState({ desktops });
  void storageService
    .mutateKey<DesktopLayout>(STORAGE_KEYS.desktopLayout, (current) =>
      current
        ? {
            ...current,
            desktops: current.desktops.map((item) =>
              item.id === desktopId ? { ...item, bookmarkIds: nextIds, updatedAt: now } : item,
            ),
          }
        : undefined,
    )
    .catch(reportPersistenceError);
  void storageService
    .mutateKey<BookmarkLayout[]>(STORAGE_KEYS.bookmarkLayout, () => deriveBookmarkLayout(desktops))
    .catch(reportPersistenceError);
}

export function moveBookmarkToDesktop(
  bookmarkId: string,
  fromDesktopId: string,
  toDesktopId: string,
): void {
  if (fromDesktopId === toDesktopId) return;
  const state = workspaceStore.getState();
  const now = Date.now();
  const target = state.desktops.find((desktop) => desktop.id === toDesktopId);
  if (!target) return;
  const desktops = state.desktops.map((desktop) => {
    if (desktop.id === fromDesktopId) {
      return {
        ...desktop,
        bookmarkIds: desktop.bookmarkIds.filter((id) => id !== bookmarkId),
        updatedAt: now,
      };
    }
    if (desktop.id === toDesktopId) {
      const ids = desktop.bookmarkIds.filter((id) => id !== bookmarkId);
      ids.push(bookmarkId);
      return { ...desktop, bookmarkIds: ids, updatedAt: now };
    }
    return desktop;
  });
  workspaceStore.setState({ desktops });
  void storageService
    .mutateKey<DesktopLayout>(STORAGE_KEYS.desktopLayout, (current) =>
      current
        ? {
            ...current,
            desktops: current.desktops.map((desktop) => {
              if (desktop.id === fromDesktopId) {
                return {
                  ...desktop,
                  bookmarkIds: desktop.bookmarkIds.filter((id) => id !== bookmarkId),
                  updatedAt: now,
                };
              }
              if (desktop.id === toDesktopId) {
                const ids = desktop.bookmarkIds.filter((id) => id !== bookmarkId);
                if (!ids.includes(bookmarkId)) ids.push(bookmarkId);
                return { ...desktop, bookmarkIds: ids, updatedAt: now };
              }
              return desktop;
            }),
          }
        : undefined,
    )
    .catch(reportPersistenceError);
  void storageService
    .mutateKey<BookmarkLayout[]>(STORAGE_KEYS.bookmarkLayout, () => deriveBookmarkLayout(desktops))
    .catch(reportPersistenceError);
  pushToast(`已移动到「${target.name}」`, 'success');
}

export function removeBookmarkFromDesktop(desktopId: string, bookmarkId: string): void {
  const state = workspaceStore.getState();
  const desktop = state.desktops.find((item) => item.id === desktopId);
  if (!desktop || !desktop.bookmarkIds.includes(bookmarkId)) return;
  const desktops = state.desktops.map((item) =>
    item.id === desktopId
      ? { ...item, bookmarkIds: item.bookmarkIds.filter((id) => id !== bookmarkId), updatedAt: Date.now() }
      : item,
  );
  workspaceStore.setState({ desktops });
  void storageService
    .mutateKey<DesktopLayout>(STORAGE_KEYS.desktopLayout, (current) =>
      current
        ? {
            ...current,
            desktops: current.desktops.map((item) =>
              item.id === desktopId
                ? {
                    ...item,
                    bookmarkIds: item.bookmarkIds.filter((id) => id !== bookmarkId),
                    updatedAt: Date.now(),
                  }
                : item,
            ),
          }
        : undefined,
    )
    .catch(reportPersistenceError);
  void storageService
    .mutateKey<BookmarkLayout[]>(STORAGE_KEYS.bookmarkLayout, () => deriveBookmarkLayout(desktops))
    .catch(reportPersistenceError);
  pushToast('已从桌面移除，浏览器书签没有改变。', 'success');
}

export function cleanupMissingBookmarks(): void {
  const state = workspaceStore.getState();
  const live = new Set(state.liveBookmarks.keys());
  let removed = 0;
  const desktops = state.desktops.map((desktop) => {
    const ids = desktop.bookmarkIds.filter((id) => live.has(id));
    removed += desktop.bookmarkIds.length - ids.length;
    return ids.length === desktop.bookmarkIds.length
      ? desktop
      : { ...desktop, bookmarkIds: ids, updatedAt: Date.now() };
  });
  if (removed === 0) {
    pushToast('没有需要清理的书签。', 'info');
    return;
  }
  workspaceStore.setState({ desktops });
  writeLayoutAndBookmarkLayout(
    buildLayout(desktops, state.desktopOrder, state.activeDesktopId),
  );
  pushToast(`已清理 ${removed} 个失效书签。`, 'success');
}

export function addWidget(type: WidgetType): void {
  const state = workspaceStore.getState();
  const desktopId = state.activeDesktopId;
  if (!desktopId) return;
  const existing = state.widgets.filter(
    (widget) => widget.desktopId === desktopId && widget.visible,
  );
  const created = createWidget(type, desktopId, getViewportSize(), existing);
  if (!created) {
    pushToast('这个桌面已经有时钟了。', 'info');
    return;
  }
  let widget = created;
  if (widget.type === 'note') {
    widget = { ...widget, settings: { noteId: state.notes[0]?.id ?? null } };
  } else if (widget.type === 'countdown') {
    widget = { ...widget, settings: { countdownId: state.countdowns[0]?.id ?? null } };
  }
  workspaceStore.setState({ widgets: [...state.widgets, widget] });
  void storageService
    .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (current) => {
      const list = current ?? [];
      if (list.some((item) => item.id === widget.id)) return list;
      return [...list, widget];
    })
    .catch(reportPersistenceError);
  pushToast(`已添加${widgetLabel(type)}`, 'success');
}

export function removeWidget(widgetId: string): void {
  const state = workspaceStore.getState();
  workspaceStore.setState({ widgets: state.widgets.filter((widget) => widget.id !== widgetId) });
  void storageService
    .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (current) =>
      (current ?? []).filter((widget) => widget.id !== widgetId),
    )
    .catch(reportPersistenceError);
}

export function updateWidget(widgetId: string, updater: (widget: WidgetInstance) => WidgetInstance): void {
  const state = workspaceStore.getState();
  const widgets = state.widgets.map((widget) => (widget.id === widgetId ? updater(widget) : widget));
  workspaceStore.setState({ widgets });
  void storageService
    .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (current) =>
      (current ?? []).map((widget) => (widget.id === widgetId ? updater(widget) : widget)),
    )
    .catch(reportPersistenceError);
}

export function moveWidget(widgetId: string, x: number, y: number): void {
  const state = workspaceStore.getState();
  const current = state.widgets.find((widget) => widget.id === widgetId);
  if (!current) return;
  const siblings = state.widgets.filter((widget) => widget.desktopId === current.desktopId);
  const zIndex = Math.max(0, ...siblings.map((widget) => widget.zIndex)) + 1;
  const widgets = state.widgets.map((widget) =>
    widget.id === widgetId ? { ...widget, x, y, zIndex } : widget,
  );
  workspaceStore.setState({ widgets });
  void storageService
    .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (current) =>
      (current ?? []).map((widget) =>
        widget.id === widgetId ? { ...widget, x, y, zIndex } : widget,
      ),
    )
    .catch(reportPersistenceError);
}

export function bringWidgetToFront(widgetId: string): void {
  const state = workspaceStore.getState();
  const current = state.widgets.find((widget) => widget.id === widgetId);
  if (!current) return;
  const siblings = state.widgets.filter((widget) => widget.desktopId === current.desktopId);
  const maxZ = Math.max(0, ...siblings.map((widget) => widget.zIndex));
  if (current.zIndex === maxZ) return;
  const zIndex = maxZ + 1;
  const widgets = state.widgets.map((widget) =>
    widget.id === widgetId ? { ...widget, zIndex } : widget,
  );
  workspaceStore.setState({ widgets });
  void storageService
    .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (stored) =>
      (stored ?? []).map((widget) =>
        widget.id === widgetId ? { ...widget, zIndex } : widget,
      ),
    )
    .catch(reportPersistenceError);
}

const NOTE_COLOR_SEQUENCE: NoteColor[] = ['paper', 'apricot', 'mint', 'lilac'];

export function addNote(overrides: Partial<Omit<NoteData, 'id' | 'updatedAt'>> = {}): string {
  const state = workspaceStore.getState();
  const note: NoteData = {
    id: createId('note'),
    title: overrides.title ?? '',
    content: overrides.content ?? '',
    color: overrides.color ?? NOTE_COLOR_SEQUENCE[state.notes.length % NOTE_COLOR_SEQUENCE.length]!,
    updatedAt: Date.now(),
  };
  workspaceStore.setState({ notes: [...state.notes, note] });
  void storageService
    .mutateKey<NoteData[]>(STORAGE_KEYS.notes, (current) => {
      const list = current ?? [];
      if (list.some((item) => item.id === note.id)) return list;
      return [...list, note];
    })
    .catch(reportPersistenceError);
  return note.id;
}

export function updateNote(
  noteId: string,
  patch: Partial<Pick<NoteData, 'title' | 'content' | 'color'>>,
): void {
  const state = workspaceStore.getState();
  const existing = state.notes.find((note) => note.id === noteId);
  if (!existing) return;
  const next: NoteData = { ...existing, ...patch, updatedAt: Date.now() };
  workspaceStore.setState({
    notes: state.notes.map((note) => (note.id === noteId ? next : note)),
  });
  void storageService
    .mutateKey<NoteData[]>(STORAGE_KEYS.notes, (current) => {
      const list = current ?? [];
      const stored = list.find((note) => note.id === noteId);
      if (stored && stored.updatedAt > next.updatedAt) return list;
      return stored ? list.map((note) => (note.id === noteId ? next : note)) : [...list, next];
    })
    .catch(reportPersistenceError);
}

export function deleteNote(noteId: string): void {
  const state = workspaceStore.getState();
  const notes = state.notes.filter((note) => note.id !== noteId);
  const widgets = state.widgets.map((widget) =>
    widget.type === 'note' && widget.settings.noteId === noteId
      ? { ...widget, settings: { noteId: null } }
      : widget,
  );
  workspaceStore.setState({ notes, widgets });
  void storageService
    .mutateKey<NoteData[]>(STORAGE_KEYS.notes, (current) =>
      (current ?? []).filter((note) => note.id !== noteId),
    )
    .catch(reportPersistenceError);
  void storageService
    .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (current) =>
      (current ?? []).map((widget) =>
        widget.type === 'note' && widget.settings.noteId === noteId
          ? { ...widget, settings: { noteId: null } }
          : widget,
      ),
    )
    .catch(reportPersistenceError);
}

export function addCountdown(title: string, targetTime: number): string {
  const state = workspaceStore.getState();
  const countdown: CountdownData = {
    id: createId('countdown'),
    title: title.trim() || '新倒计时',
    targetTime: Number.isFinite(targetTime) ? targetTime : Date.now() + 86_400_000,
    completed: false,
    createdAt: Date.now(),
  };
  workspaceStore.setState({ countdowns: [...state.countdowns, countdown] });
  void storageService
    .mutateKey<CountdownData[]>(STORAGE_KEYS.countdowns, (current) => {
      const list = current ?? [];
      if (list.some((item) => item.id === countdown.id)) return list;
      return [...list, countdown];
    })
    .catch(reportPersistenceError);
  return countdown.id;
}

export function updateCountdown(
  countdownId: string,
  patch: Partial<Pick<CountdownData, 'title' | 'targetTime' | 'completed'>>,
): void {
  const state = workspaceStore.getState();
  const existing = state.countdowns.find((countdown) => countdown.id === countdownId);
  if (!existing) return;
  const next = { ...existing, ...patch };
  workspaceStore.setState({
    countdowns: state.countdowns.map((countdown) =>
      countdown.id === countdownId ? next : countdown,
    ),
  });
  void storageService
    .mutateKey<CountdownData[]>(STORAGE_KEYS.countdowns, (current) =>
      (current ?? []).map((countdown) => (countdown.id === countdownId ? next : countdown)),
    )
    .catch(reportPersistenceError);
}

export function deleteCountdown(countdownId: string): void {
  const state = workspaceStore.getState();
  const countdowns = state.countdowns.filter((countdown) => countdown.id !== countdownId);
  const widgets = state.widgets.map((widget) =>
    widget.type === 'countdown' && widget.settings.countdownId === countdownId
      ? { ...widget, settings: { countdownId: null } }
      : widget,
  );
  workspaceStore.setState({ countdowns, widgets });
  void storageService
    .mutateKey<CountdownData[]>(STORAGE_KEYS.countdowns, (current) =>
      (current ?? []).filter((countdown) => countdown.id !== countdownId),
    )
    .catch(reportPersistenceError);
  void storageService
    .mutateKey<WidgetInstance[]>(STORAGE_KEYS.widgetsLayout, (current) =>
      (current ?? []).map((widget) =>
        widget.type === 'countdown' && widget.settings.countdownId === countdownId
          ? { ...widget, settings: { countdownId: null } }
          : widget,
      ),
    )
    .catch(reportPersistenceError);
}

export function setPomodoro(next: PomodoroState): void {
  workspaceStore.setState({ pomodoro: next });
  void storageService
    .mutateKey<PomodoroState>(STORAGE_KEYS.pomodoro, () => next)
    .catch(reportPersistenceError);
}

export function togglePinBookmark(bookmarkId: string): void {
  const settings = settingsStore.getState().settings;
  const pinned = settings.dockPinnedBookmarkIds;
  if (pinned.includes(bookmarkId)) {
    patchSettings({ dockPinnedBookmarkIds: pinned.filter((id) => id !== bookmarkId) });
    return;
  }
  if (pinned.length >= 12) {
    pushToast('Dock 最多固定 12 个项目。', 'info');
    return;
  }
  patchSettings({ dockPinnedBookmarkIds: [...pinned, bookmarkId] });
}

let refreshInFlight: Promise<void> | null = null;

export function refreshBookmarks(options: { reimport?: boolean; silent?: boolean } = {}): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const state = workspaceStore.getState();
    const settings = settingsStore.getState().settings;
    let loaded;
    try {
      loaded = await loadBookmarkSnapshot();
    } catch (error) {
      console.error('[GlassDesk] Bookmark refresh failed', error);
      if (!options.silent) {
        pushToast('无法读取书签，请确认扩展仍有书签权限。', 'error');
      }
      return;
    }

    let desktops = state.desktops;
    let cache = { ...state.bookmarkCache, ...loaded.cache };
    let layoutChanged = false;

    if (
      desktops.length > 0 &&
      (options.reimport || settings.bookmarkSyncMode === 'follow' || state.isDemo)
    ) {
      const result = syncDesktopsWithTree(desktops, loaded.tree, Date.now(), cache);
      cache = result.cache;
      if (result.changed) {
        desktops = result.desktops;
        layoutChanged = true;
      }
    }

    const activeDesktopId = desktops.some((desktop) => desktop.id === state.activeDesktopId)
      ? state.activeDesktopId
      : desktops[0]?.id ?? '';
    const desktopOrder = mergeOrder(state.desktopOrder, desktops);

    workspaceStore.setState({
      desktops,
      desktopOrder,
      activeDesktopId,
      liveBookmarks: loaded.index,
      bookmarkCache: cache,
      bookmarkFolders: loaded.folders,
      bookmarkTree: loaded.tree,
      lastSyncedAt: Date.now(),
    });

    if (layoutChanged && state.status === 'ready') {
      void storageService
        .mutateKey<DesktopLayout>(STORAGE_KEYS.desktopLayout, (current) => {
          if (!current) return undefined;
          const byId = new Map(desktops.map((desktop) => [desktop.id, desktop]));
          return {
            ...current,
            desktops: current.desktops.map((desktop) => {
              const next = byId.get(desktop.id);
              if (!next) return desktop;
              return {
                ...desktop,
                bookmarkIds: next.bookmarkIds,
                missingSource: next.missingSource,
                updatedAt: next.updatedAt,
              };
            }),
          };
        })
        .catch(reportPersistenceError);
      void storageService
        .mutateKey<BookmarkLayout[]>(STORAGE_KEYS.bookmarkLayout, () => deriveBookmarkLayout(desktops))
        .catch(reportPersistenceError);
    }

    const cacheChanged = JSON.stringify(cache) !== JSON.stringify(state.bookmarkCache);
    if (cacheChanged) {
      void storageService
        .mutateKey<Record<string, BookmarkCacheEntry>>(STORAGE_KEYS.bookmarkCache, (current) => ({
          ...(current ?? {}),
          ...cache,
        }))
        .catch(reportPersistenceError);
    }

    if (options.reimport && !options.silent) {
      pushToast(
        layoutChanged || cacheChanged ? '书签已重新导入。' : '没有发现新的书签。',
        'success',
      );
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function reimportBookmarks(): Promise<void> {
  await refreshBookmarks({ reimport: true });
}

export function buildWelcomeNote(): NoteData {
  return {
    id: createId('note'),
    title: '开始之前',
    content: `拖动书签可以排序，右键可以固定到 Dock。
按 ${modifierLabel()} K 打开搜索，[ 和 ] 切换桌面。
桌面布局保存在本地，不会改动浏览器书签。`,
    color: 'paper',
    updatedAt: Date.now(),
  };
}

export async function completeOnboarding(selectedFolderIds: string[]): Promise<void> {
  const state = workspaceStore.getState();
  const settings = settingsStore.getState().settings;
  const tree = state.bookmarkTree;
  const uniqueFolders = Array.from(new Set(selectedFolderIds));
  const now = Date.now();
  const desktops: Desktop[] = [];
  const usedNames: string[] = [];

  for (const folderId of uniqueFolders) {
    const folder = findNodeById(tree, folderId);
    if (!folder || folder.url) continue;
    const safeName = uniqueNameFrom(folder.title || '书签桌面', usedNames);
    usedNames.push(safeName);
    const wallpaper =
      WALLPAPERS[desktops.length % WALLPAPERS.length]?.id ?? settings.defaultWallpaper;
    desktops.push(
      createDesktopRecord(
        safeName,
        folderId,
        collectBookmarkIdsInFolder(tree, folderId),
        wallpaper,
      ),
    );
  }

  if (desktops.length === 0) {
    desktops.push(
      createDesktopRecord(
        '我的桌面',
        null,
        [],
        WALLPAPERS[0]?.id ?? settings.defaultWallpaper,
      ),
    );
  }

  const notes = state.notes.length > 0 ? state.notes : [buildWelcomeNote()];
  const cache =
    Object.keys(state.bookmarkCache).length > 0
      ? state.bookmarkCache
      : buildBookmarkCache(tree, now);
  const widgets = desktops.flatMap((desktop) => {
    const list = createDefaultWidgetsForDesktop(desktop.id, getViewportSize());
    return list.map((widget) => {
      if (widget.type === 'note') {
        return { ...widget, settings: { noteId: notes[0]?.id ?? null } };
      }
      if (widget.type === 'countdown') {
        return { ...widget, settings: { countdownId: state.countdowns[0]?.id ?? null } };
      }
      return widget;
    });
  });
  const order = desktops.map((desktop) => desktop.id);
  const nextSettings = { ...settings, onboarded: true, schemaVersion: SCHEMA_VERSION };
  const layout = buildLayout(desktops, order, desktops[0]!.id);

  const raw = snapshotToRaw({
    schemaVersion: SCHEMA_VERSION,
    settings: nextSettings,
    desktopLayout: layout,
    bookmarkLayout: deriveBookmarkLayout(desktops),
    widgets,
    notes,
    countdowns: state.countdowns,
    pomodoro: state.pomodoro,
    bookmarkCache: cache,
  });

  try {
    await storageService.writeItems(raw);
    replaceSettings(nextSettings);
    workspaceStore.setState({
      status: 'ready',
      error: null,
      desktops,
      desktopOrder: order,
      activeDesktopId: desktops[0]!.id,
      widgets,
      notes,
      bookmarkCache: cache,
      lastSyncedAt: now,
    });
    closeAllOverlays();
    pushToast('桌面已准备好。', 'success');
  } catch (error) {
    console.error('[GlassDesk] Could not finish onboarding', error);
    pushToast('无法保存初始桌面，请检查存储权限。', 'error');
  }
}

export async function dismissOnboarding(): Promise<void> {
  await completeOnboarding([]);
}

export async function applyExternalStorageChanges(): Promise<void> {
  let raw;
  try {
    raw = await storageService.readRaw();
  } catch (error) {
    console.error('[GlassDesk] Could not read external changes', error);
    return;
  }
  const parsed = parsePersistedSnapshot(raw);
  if (!parsed.ok) return;
  const state = workspaceStore.getState();
  const snapshot = parsed.snapshot;
  replaceSettings(snapshot.settings);
  const desktops = snapshot.desktopLayout.desktops;
  if (desktops.length === 0) {
    if (state.status === 'ready') {
      workspaceStore.setState({
        status: 'onboarding',
        desktops: [],
        desktopOrder: [],
        activeDesktopId: '',
        widgets: [],
      });
    }
    return;
  }
  const activeDesktopId = desktops.some(
    (desktop) => desktop.id === snapshot.desktopLayout.activeDesktopId,
  )
    ? snapshot.desktopLayout.activeDesktopId
    : desktops[0]!.id;
  workspaceStore.setState({
    desktops,
    desktopOrder: snapshot.desktopLayout.desktopOrder,
    activeDesktopId,
    widgets: snapshot.widgets,
    notes: snapshot.notes,
    countdowns: snapshot.countdowns,
    pomodoro: snapshot.pomodoro,
    bookmarkCache: snapshot.bookmarkCache,
    ...(state.status === 'onboarding' ? { status: 'ready' as const } : {}),
  });
}

export function setWorkspaceStatus(status: WorkspaceStatus, error: string | null = null): void {
  workspaceStore.setState({ status, error });
}
