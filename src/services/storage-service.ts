import { createMigrationBackup } from '../utils/migration';
import { CORE_KEYS, STORAGE_KEYS, type RawStorage } from '../utils/storage-keys';

const LOCAL_PREFIX = 'glassdesk:storage:';
const MIRROR_KEY = 'glassdesk:mirror:v1';
const MIRROR_LIMIT = 1_200_000;

export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export type StorageChanges = Record<string, StorageChange>;
type ChangeListener = (changes: StorageChanges) => void;

interface Backend {
  get(keys: string[]): Promise<RawStorage>;
  getAll(): Promise<RawStorage>;
  set(items: RawStorage): Promise<void>;
  remove(keys: string[]): Promise<void>;
  bytesInUse(): Promise<number>;
}

function chromeStorageAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  );
}

function readLocalRaw(): RawStorage {
  const result: RawStorage = {};
  if (typeof localStorage === 'undefined') return result;
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(LOCAL_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      result[key.slice(LOCAL_PREFIX.length)] = JSON.parse(raw);
    } catch {
      // Ignore a corrupted value; parsing/migration will rebuild defaults.
    }
  }
  return result;
}

function writeLocalItems(items: RawStorage): StorageChanges {
  const changes: StorageChanges = {};
  for (const [key, value] of Object.entries(items)) {
    const storageKey = `${LOCAL_PREFIX}${key}`;
    const previous = localStorage.getItem(storageKey);
    let oldValue: unknown;
    if (previous) {
      try {
        oldValue = JSON.parse(previous);
      } catch {
        oldValue = undefined;
      }
    }
    localStorage.setItem(storageKey, JSON.stringify(value));
    changes[key] = { oldValue, newValue: value };
  }
  return changes;
}

function createBackend(): Backend {
  if (chromeStorageAvailable()) {
    return {
      async get(keys) {
        return (await chrome.storage.local.get(keys)) as RawStorage;
      },
      async getAll() {
        return (await chrome.storage.local.get(null)) as RawStorage;
      },
      async set(items) {
        await chrome.storage.local.set(items);
      },
      async remove(keys) {
        await chrome.storage.local.remove(keys);
      },
      async bytesInUse() {
        return chrome.storage.local.getBytesInUse(null);
      },
    };
  }

  return {
    async get(keys) {
      const all = readLocalRaw();
      const result: RawStorage = {};
      for (const key of keys) {
        if (key in all) result[key] = all[key];
      }
      return result;
    },
    async getAll() {
      return readLocalRaw();
    },
    async set(items) {
      const changes = writeLocalItems(items);
      dispatchLocalChanges(changes);
    },
    async remove(keys) {
      const changes: StorageChanges = {};
      for (const key of keys) {
        const oldValue = readLocalRaw()[key];
        localStorage.removeItem(`${LOCAL_PREFIX}${key}`);
        changes[key] = { oldValue, newValue: undefined };
      }
      dispatchLocalChanges(changes);
    },
    async bytesInUse() {
      try {
        return new Blob([JSON.stringify(readLocalRaw())]).size;
      } catch {
        return 0;
      }
    },
  };
}

const backend = createBackend();
const listeners = new Set<ChangeListener>();
let subscribed = false;

function isCoreKey(key: string): boolean {
  return (CORE_KEYS as readonly string[]).includes(key);
}

function filterCore(changes: StorageChanges): StorageChanges {
  const filtered: StorageChanges = {};
  for (const [key, change] of Object.entries(changes)) {
    if (isCoreKey(key)) filtered[key] = change;
  }
  return filtered;
}

function dispatchLocalChanges(changes: StorageChanges): void {
  updateMirror(changes);
  for (const listener of listeners) listener(changes);
}

function handleChromeChanges(changes: Record<string, StorageChange>, areaName: string): void {
  if (areaName !== 'local') return;
  const core = filterCore(changes);
  if (Object.keys(core).length === 0) return;
  updateMirror(core);
  for (const listener of listeners) listener(core);
}

function ensureSubscription(): void {
  if (subscribed) return;
  subscribed = true;
  if (chromeStorageAvailable()) {
    chrome.storage.onChanged.addListener(handleChromeChanges);
  } else if (typeof window !== 'undefined') {
    window.addEventListener('glassdesk:storage', ((event: CustomEvent<StorageChanges>) => {
      const core = filterCore(event.detail ?? {});
      if (Object.keys(core).length === 0) return;
      for (const listener of listeners) listener(core);
    }) as EventListener);
  }
}

function readMirrorObject(): RawStorage {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as RawStorage)
      : {};
  } catch {
    return {};
  }
}

function updateMirror(items: RawStorage, removed: string[] = []): void {
  if (!chromeStorageAvailable() || typeof localStorage === 'undefined') return;
  try {
    const next = readMirrorObject();
    for (const [key, value] of Object.entries(items)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    for (const key of removed) delete next[key];
    let serialized = JSON.stringify(next);
    if (serialized.length > MIRROR_LIMIT) {
      delete next[STORAGE_KEYS.bookmarkCache];
      serialized = JSON.stringify(next);
    }
    if (serialized.length <= MIRROR_LIMIT) localStorage.setItem(MIRROR_KEY, serialized);
  } catch {
    // The mirror is only a warm-start optimization; never fail a write for it.
  }
}

/**
 * A synchronous best-effort snapshot for the first paint. chrome.storage is
 * asynchronous, so the page paints from this mirror and hydrates right after.
 */
export function readStartupMirror(): RawStorage {
  if (!chromeStorageAvailable()) return readLocalRaw();
  const mirror = readMirrorObject();
  const result: RawStorage = {};
  for (const key of CORE_KEYS) {
    if (key in mirror) result[key] = mirror[key];
  }
  return result;
}

export function refreshStartupMirror(raw: RawStorage): void {
  if (!chromeStorageAvailable()) return;
  const core: RawStorage = {};
  for (const key of CORE_KEYS) {
    if (key in raw) core[key] = raw[key];
  }
  updateMirror(core);
}

const queues = new Map<string, Promise<void>>();
const recentWrites = new Map<string, number>();

function markLocalWrites(keys: string[]): void {
  const now = Date.now();
  for (const key of keys) recentWrites.set(key, now);
}

export function wasRecentlyWrittenByThisTab(keys: string[], windowMs = 1500): boolean {
  if (keys.length === 0) return false;
  const now = Date.now();
  return keys.every((key) => now - (recentWrites.get(key) ?? 0) < windowMs);
}

function enqueue(key: string, task: () => Promise<void>): Promise<void> {
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  queues.set(key, run);
  void run.finally(() => {
    if (queues.get(key) === run) queues.delete(key);
  }).catch(() => undefined);
  return run;
}

async function readRaw(): Promise<RawStorage> {
  return backend.getAll();
}

async function readKeys(keys: string[]): Promise<RawStorage> {
  return backend.get(keys);
}

async function writeItems(items: RawStorage): Promise<void> {
  markLocalWrites(Object.keys(items));
  await backend.set(items);
  updateMirror(items);
}

/**
 * Read-modify-write a single storage key. Mutations are serialized per key and
 * always start from the latest stored value so two tabs cannot blindly
 * overwrite each other's whole configuration.
 */
function mutateKey<T>(key: string, mutator: (current: T | undefined) => T | undefined): Promise<void> {
  return enqueue(key, async () => {
    const raw = await backend.get([key]);
    const next = mutator(raw[key] as T | undefined);
    if (next === undefined) return;
    markLocalWrites([key]);
    await backend.set({ [key]: next });
    updateMirror({ [key]: next });
  });
}

async function removeKeys(keys: string[]): Promise<void> {
  await backend.remove(keys);
  updateMirror({}, keys);
}

async function backupRaw(raw: RawStorage, reason: string): Promise<void> {
  await writeItems({ [STORAGE_KEYS.backup]: createMigrationBackup(raw, reason) });
}

async function resetAll(): Promise<void> {
  await removeKeys([...CORE_KEYS, STORAGE_KEYS.faviconRefresh, STORAGE_KEYS.backup]);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(MIRROR_KEY);
    } catch {
      // No-op.
    }
  }
}

function subscribe(listener: ChangeListener): () => void {
  ensureSubscription();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function bytesInUse(): Promise<number> {
  try {
    return await backend.bytesInUse();
  } catch {
    return 0;
  }
}

export const storageService = {
  readRaw,
  readKeys,
  writeItems,
  mutateKey,
  removeKeys,
  backupRaw,
  resetAll,
  subscribe,
  bytesInUse,
  isExtensionStorage: chromeStorageAvailable(),
};
