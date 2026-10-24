import type { BookmarkCacheEntry, BookmarkLayout } from '../types/bookmark';
import type { Desktop, DesktopLayout } from '../types/desktop';
import type {
  AppSettings,
  BookmarkSyncMode,
  GlassIntensity,
  SearchEngineId,
  WallpaperId,
} from '../types/settings';
import type {
  CountdownData,
  NoteColor,
  NoteData,
  PomodoroPhase,
  PomodoroState,
  WidgetInstance,
  WidgetType,
} from '../types/widget';
import { SCHEMA_VERSION } from './constants';
import {
  createDefaultPomodoro,
  createDefaultSettings,
  GLASS_INTENSITIES,
  NOTE_COLORS,
  SEARCH_ENGINE_IDS,
  SYNC_MODES,
  WALLPAPER_IDS,
} from './defaults';
import type { RawStorage } from './storage-keys';
import { STORAGE_KEYS } from './storage-keys';

export interface PersistedSnapshot {
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

export type ParseSnapshotResult =
  | {
      ok: true;
      snapshot: PersistedSnapshot;
      /** The stored data is missing or older than the current schema. */
      needsWrite: boolean;
      issues: string[];
    }
  | {
      ok: false;
      reason: 'future-version' | 'invalid';
      message: string;
      raw: RawStorage;
    };

type RecordValue = Record<string, unknown>;

const WIDGET_TYPES: WidgetType[] = ['clock', 'note', 'countdown', 'pomodoro', 'search'];
const MAX_DESKTOPS = 60;
const MAX_WIDGETS = 240;
const MAX_NOTES = 100;
const MAX_COUNTDOWNS = 100;
const MAX_CACHE_ENTRIES = 6000;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): RecordValue | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asCleanString(value: unknown, maxLength: number, fallback = ''): string {
  const text = asString(value).trim();
  return (text || fallback).slice(0, maxLength);
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asPositiveNumber(value: unknown, fallback: number): number {
  const parsed = asNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const clean = item.slice(0, maxLength);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length >= maxItems) break;
  }
  return result;
}

function sanitizeSettings(raw: unknown, issues: string[]): AppSettings {
  const record = asRecord(raw);
  if (!record) {
    if (raw !== undefined) issues.push('settings: expected an object');
  }
  const value = record ?? {};
  const base = createDefaultSettings();
  return {
    schemaVersion: SCHEMA_VERSION,
    appearance: 'light',
    glassIntensity: oneOf<GlassIntensity>(value.glassIntensity, GLASS_INTENSITIES, base.glassIntensity),
    reducedMotion: asBoolean(value.reducedMotion, base.reducedMotion),
    bookmarkSyncMode: oneOf<BookmarkSyncMode>(value.bookmarkSyncMode, SYNC_MODES, base.bookmarkSyncMode),
    dockAutoHide: asBoolean(value.dockAutoHide, base.dockAutoHide),
    searchEngine: oneOf<SearchEngineId>(value.searchEngine, SEARCH_ENGINE_IDS, base.searchEngine),
    defaultWallpaper: oneOf<WallpaperId>(value.defaultWallpaper, WALLPAPER_IDS, base.defaultWallpaper),
    dockPinnedBookmarkIds: stringArray(value.dockPinnedBookmarkIds, 12, 200),
    showDesktopDots: asBoolean(value.showDesktopDots, base.showDesktopDots),
    onboarded: asBoolean(value.onboarded, base.onboarded),
  };
}

function sanitizeDesktops(rawLayout: unknown, settings: AppSettings, issues: string[]): DesktopLayout {
  const layout = asRecord(rawLayout);
  if (!layout) {
    if (rawLayout !== undefined) issues.push('desktop-layout: expected an object');
  }
  const rawDesktops = Array.isArray(layout?.desktops) ? layout.desktops : [];
  const desktops: Desktop[] = [];
  const seen = new Set<string>();
  for (const rawDesktop of rawDesktops.slice(0, MAX_DESKTOPS)) {
    const record = asRecord(rawDesktop);
    if (!record) {
      issues.push('desktop-layout: skipped a non-object desktop');
      continue;
    }
    const id = asCleanString(record.id, 120);
    if (!id || seen.has(id)) {
      issues.push('desktop-layout: skipped a desktop without a unique id');
      continue;
    }
    seen.add(id);
    const now = Date.now();
    const wallpaperValue = record.wallpaper;
    const wallpaper = WALLPAPER_IDS.includes(wallpaperValue as WallpaperId)
      ? (wallpaperValue as WallpaperId)
      : undefined;
    desktops.push({
      id,
      name: asCleanString(record.name, 60, '未命名桌面'),
      sourceFolderId: typeof record.sourceFolderId === 'string' && record.sourceFolderId
        ? record.sourceFolderId
        : null,
      ...(wallpaper ? { wallpaper } : {}),
      bookmarkIds: stringArray(record.bookmarkIds, 1000, 300),
      createdAt: asPositiveNumber(record.createdAt, now),
      updatedAt: asPositiveNumber(record.updatedAt, now),
      ...(record.missingSource === true ? { missingSource: true } : {}),
    });
  }

  const ids = new Set(desktops.map((desktop) => desktop.id));
  const rawOrder = stringArray(layout?.desktopOrder, MAX_DESKTOPS, 120);
  const desktopOrder = rawOrder.filter((id) => ids.has(id));
  for (const desktop of desktops) {
    if (!desktopOrder.includes(desktop.id)) desktopOrder.push(desktop.id);
  }
  const activeCandidate = asCleanString(layout?.activeDesktopId, 120);
  const activeDesktopId = ids.has(activeCandidate) ? activeCandidate : desktops[0]?.id ?? '';

  return {
    desktops,
    desktopOrder,
    activeDesktopId,
    showDesktopDots: settings.showDesktopDots,
  };
}

function sanitizeWidgets(rawWidgets: unknown, desktopIds: Set<string>, issues: string[]): WidgetInstance[] {
  if (rawWidgets !== undefined && !Array.isArray(rawWidgets)) {
    issues.push('widgets-layout: expected an array');
  }
  if (!Array.isArray(rawWidgets)) return [];
  const widgets: WidgetInstance[] = [];
  const seenIds = new Set<string>();
  const clockDesktops = new Set<string>();
  for (const rawWidget of rawWidgets.slice(0, MAX_WIDGETS)) {
    const record = asRecord(rawWidget);
    if (!record) continue;
    const id = asCleanString(record.id, 120);
    const desktopId = asCleanString(record.desktopId, 120);
    const type = oneOf<WidgetType>(record.type, WIDGET_TYPES, 'note');
    if (!id || !desktopId || seenIds.has(id) || !desktopIds.has(desktopId)) continue;
    if (type === 'clock') {
      if (clockDesktops.has(desktopId)) continue;
      clockDesktops.add(desktopId);
    }
    seenIds.add(id);
    const base = {
      id,
      desktopId,
      x: Math.max(-2000, Math.min(4000, asNumber(record.x, 48))),
      y: Math.max(-2000, Math.min(4000, asNumber(record.y, 48))),
      width: Math.max(220, Math.min(760, asNumber(record.width, 300))),
      height: Math.max(80, Math.min(900, asNumber(record.height, 220))),
      zIndex: Math.max(1, Math.min(1000, Math.round(asNumber(record.zIndex, 4)))),
      visible: asBoolean(record.visible, true),
    };
    const settings = asRecord(record.settings) ?? {};
    if (type === 'clock') {
      widgets.push({ ...base, type: 'clock', settings: { showGreeting: asBoolean(settings.showGreeting, true) } });
    } else if (type === 'note') {
      widgets.push({
        ...base,
        type: 'note',
        settings: { noteId: typeof settings.noteId === 'string' ? settings.noteId.slice(0, 120) : null },
      });
    } else if (type === 'countdown') {
      widgets.push({
        ...base,
        type: 'countdown',
        settings: {
          countdownId:
            typeof settings.countdownId === 'string' ? settings.countdownId.slice(0, 120) : null,
        },
      });
    } else if (type === 'pomodoro') {
      widgets.push({ ...base, type: 'pomodoro', settings: {} });
    } else {
      widgets.push({ ...base, type: 'search', settings: {} });
    }
  }
  return widgets;
}

function sanitizeNotes(rawNotes: unknown, issues: string[]): NoteData[] {
  if (rawNotes !== undefined && !Array.isArray(rawNotes)) {
    issues.push('notes: expected an array');
  }
  if (!Array.isArray(rawNotes)) return [];
  const notes: NoteData[] = [];
  const seen = new Set<string>();
  for (const rawNote of rawNotes.slice(0, MAX_NOTES)) {
    const record = asRecord(rawNote);
    if (!record) continue;
    const id = asCleanString(record.id, 120);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const content = asString(record.content).slice(0, 20_000);
    notes.push({
      id,
      title: asCleanString(record.title, 120),
      content,
      color: oneOf<NoteColor>(record.color, NOTE_COLORS, 'paper'),
      updatedAt: asPositiveNumber(record.updatedAt, Date.now()),
    });
  }
  return notes;
}

function sanitizeCountdowns(rawCountdowns: unknown, issues: string[]): CountdownData[] {
  if (rawCountdowns !== undefined && !Array.isArray(rawCountdowns)) {
    issues.push('countdowns: expected an array');
  }
  if (!Array.isArray(rawCountdowns)) return [];
  const countdowns: CountdownData[] = [];
  const seen = new Set<string>();
  for (const rawCountdown of rawCountdowns.slice(0, MAX_COUNTDOWNS)) {
    const record = asRecord(rawCountdown);
    if (!record) continue;
    const id = asCleanString(record.id, 120);
    const targetTime = asPositiveNumber(record.targetTime, 0);
    if (!id || seen.has(id) || targetTime <= 0) continue;
    seen.add(id);
    countdowns.push({
      id,
      title: asCleanString(record.title, 80, '未命名倒计时'),
      targetTime,
      completed: asBoolean(record.completed, false),
      createdAt: asPositiveNumber(record.createdAt, Date.now()),
    });
  }
  return countdowns;
}

function sanitizePomodoro(raw: unknown, issues: string[]): PomodoroState {
  const record = asRecord(raw);
  if (!record) {
    if (raw !== undefined) issues.push('pomodoro: expected an object');
  }
  const value = record ?? {};
  const base = createDefaultPomodoro();
  const settings = asRecord(value.settings) ?? {};
  const phase = oneOf<PomodoroPhase>(value.phase, ['focus', 'break'], base.phase);
  const running = asBoolean(value.running, false);
  const endsAt =
    typeof value.endsAt === 'number' && Number.isFinite(value.endsAt) && value.endsAt > 0
      ? value.endsAt
      : null;
  const remainingMs = Math.max(
    0,
    Math.min(3 * 86_400_000, asNumber(value.remainingMs, phase === 'focus' ? 25 * 60_000 : 5 * 60_000)),
  );
  return {
    phase,
    running: running && endsAt !== null,
    endsAt,
    remainingMs,
    completedFocus: Math.max(0, Math.min(100_000, Math.round(asNumber(value.completedFocus, 0)))),
    settings: {
      focusMinutes: Math.max(1, Math.min(180, Math.round(asNumber(settings.focusMinutes, 25)))),
      breakMinutes: Math.max(1, Math.min(60, Math.round(asNumber(settings.breakMinutes, 5)))),
    },
  };
}

function sanitizeBookmarkLayout(raw: unknown, issues: string[]): BookmarkLayout[] {
  if (raw !== undefined && !Array.isArray(raw)) {
    issues.push('bookmark-layout: expected an array');
  }
  if (!Array.isArray(raw)) return [];
  const layouts: BookmarkLayout[] = [];
  const seen = new Set<string>();
  for (const rawLayout of raw.slice(0, 10_000)) {
    const record = asRecord(rawLayout);
    if (!record) continue;
    const bookmarkId = asCleanString(record.bookmarkId, 300);
    const desktopId = asCleanString(record.desktopId, 120);
    if (!bookmarkId || !desktopId || seen.has(bookmarkId)) continue;
    seen.add(bookmarkId);
    const layout: BookmarkLayout = {
      bookmarkId,
      desktopId,
      order: Math.max(0, Math.round(asNumber(record.order, layouts.length))),
    };
    if (typeof record.x === 'number' && Number.isFinite(record.x)) layout.x = record.x;
    if (typeof record.y === 'number' && Number.isFinite(record.y)) layout.y = record.y;
    layouts.push(layout);
  }
  return layouts;
}

function sanitizeBookmarkCache(raw: unknown, issues: string[]): Record<string, BookmarkCacheEntry> {
  if (raw !== undefined && !isRecord(raw)) {
    issues.push('bookmark-cache: expected an object');
  }
  const result: Record<string, BookmarkCacheEntry> = {};
  if (!isRecord(raw)) return result;
  let count = 0;
  for (const [key, rawEntry] of Object.entries(raw)) {
    if (count >= MAX_CACHE_ENTRIES) break;
    const entry = asRecord(rawEntry);
    if (!entry) continue;
    const id = asCleanString(entry.id, 300, key);
    const url = asString(entry.url);
    if (!id || !url) continue;
    result[id] = {
      id,
      title: asCleanString(entry.title, 300, url),
      url,
      parentId: asString(entry.parentId),
      path: Array.isArray(entry.path)
        ? entry.path.filter((part): part is string => typeof part === 'string').slice(0, 12)
        : [],
      cachedAt: asPositiveNumber(entry.cachedAt, Date.now()),
    };
    count++;
  }
  return result;
}

function detectVersion(raw: RawStorage): number {
  const direct = raw[STORAGE_KEYS.schemaVersion];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const settings = asRecord(raw[STORAGE_KEYS.settings]);
  const nested = settings?.schemaVersion;
  return typeof nested === 'number' && Number.isFinite(nested) ? nested : 0;
}

/**
 * Each entry upgrades from version N to N+1. Version 1 is the initial schema, so
 * the table starts empty. Add migrations here before introducing schema 2.
 */
const MIGRATIONS: Record<number, (raw: RawStorage) => RawStorage> = {};

function runMigrations(raw: RawStorage, fromVersion: number): RawStorage {
  let current = raw;
  for (let version = Math.max(0, fromVersion); version < SCHEMA_VERSION; version++) {
    const step = MIGRATIONS[version];
    if (!step) break;
    current = step(current);
  }
  return current;
}

export function createEmptySnapshot(): PersistedSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: createDefaultSettings(),
    desktopLayout: {
      desktops: [],
      activeDesktopId: '',
      desktopOrder: [],
      showDesktopDots: true,
    },
    bookmarkLayout: [],
    widgets: [],
    notes: [],
    countdowns: [],
    pomodoro: createDefaultPomodoro(),
    bookmarkCache: {},
  };
}

export function parsePersistedSnapshot(raw: RawStorage): ParseSnapshotResult {
  const version = detectVersion(raw);
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'future-version',
      message: `存储数据版本为 ${version}，当前 GlassDesk 只支持到版本 ${SCHEMA_VERSION}。请升级扩展后重试。`,
      raw,
    };
  }

  try {
    const migratedRaw = runMigrations(raw, version);
    const issues: string[] = [];
    const settings = sanitizeSettings(migratedRaw[STORAGE_KEYS.settings], issues);
    const desktopLayout = sanitizeDesktops(migratedRaw[STORAGE_KEYS.desktopLayout], settings, issues);
    const desktopIds = new Set(desktopLayout.desktops.map((desktop) => desktop.id));
    const widgets = sanitizeWidgets(migratedRaw[STORAGE_KEYS.widgetsLayout], desktopIds, issues);
    const notes = sanitizeNotes(migratedRaw[STORAGE_KEYS.notes], issues);
    const countdowns = sanitizeCountdowns(migratedRaw[STORAGE_KEYS.countdowns], issues);
    const pomodoro = sanitizePomodoro(migratedRaw[STORAGE_KEYS.pomodoro], issues);
    const bookmarkLayout = sanitizeBookmarkLayout(migratedRaw[STORAGE_KEYS.bookmarkLayout], issues);
    const bookmarkCache = sanitizeBookmarkCache(migratedRaw[STORAGE_KEYS.bookmarkCache], issues);
    const hasAnyData = Object.keys(raw).some((key) =>
      (Object.values(STORAGE_KEYS) as string[]).includes(key),
    );
    return {
      ok: true,
      snapshot: {
        schemaVersion: SCHEMA_VERSION,
        settings,
        desktopLayout,
        bookmarkLayout,
        widgets,
        notes,
        countdowns,
        pomodoro,
        bookmarkCache,
      },
      needsWrite: !hasAnyData || version !== SCHEMA_VERSION,
      issues,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid',
      message: error instanceof Error ? error.message : '存储数据无法解析。',
      raw,
    };
  }
}

export function createMigrationBackup(raw: RawStorage, reason: string): Record<string, unknown> {
  return {
    createdAt: Date.now(),
    reason,
    schemaVersion: detectVersion(raw),
    raw,
  };
}

export function snapshotToRaw(snapshot: PersistedSnapshot): RawStorage {
  return {
    [STORAGE_KEYS.schemaVersion]: snapshot.schemaVersion,
    [STORAGE_KEYS.settings]: snapshot.settings,
    [STORAGE_KEYS.desktopLayout]: snapshot.desktopLayout,
    [STORAGE_KEYS.bookmarkLayout]: snapshot.bookmarkLayout,
    [STORAGE_KEYS.widgetsLayout]: snapshot.widgets,
    [STORAGE_KEYS.notes]: snapshot.notes,
    [STORAGE_KEYS.countdowns]: snapshot.countdowns,
    [STORAGE_KEYS.pomodoro]: snapshot.pomodoro,
    [STORAGE_KEYS.bookmarkCache]: snapshot.bookmarkCache,
  };
}
