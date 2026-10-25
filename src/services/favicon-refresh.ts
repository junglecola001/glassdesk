import { createStore } from '../stores/create-store';
import { STORAGE_KEYS } from '../utils/storage-keys';
import { storageService } from './storage-service';

/**
 * Sites whose icons should be refreshed from the network. Only populated by an
 * explicit bookmark re-import; the normal new-tab path stays local-first.
 */
export interface FaviconRefreshState {
  epoch: number;
  origins: string[];
  updatedAt: number;
}

interface FaviconRefreshStore {
  state: FaviconRefreshState;
  version: number;
}

const EMPTY_STATE: FaviconRefreshState = {
  epoch: 0,
  origins: [],
  updatedAt: 0,
};

const MAX_ORIGINS = 2000;
const MAX_ORIGIN_LENGTH = 300;

export const faviconRefreshStore = createStore<FaviconRefreshStore>({
  state: EMPTY_STATE,
  version: 0,
});

let originSet = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return true;
  if (host.includes(':') || host.startsWith('[')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (!host.includes('.')) return true;
  return false;
}

function sanitizeOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_ORIGIN_LENGTH) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (isPrivateHostname(parsed.hostname)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Collects deduplicated public HTTP(S) origins from bookmark URLs. Localhost,
 * private network names and IP literals are skipped so a refresh never probes
 * the user's LAN.
 */
export function collectFaviconOrigins(urls: string[]): string[] {
  const origins = new Set<string>();
  for (const url of urls) {
    const origin = sanitizeOrigin(url);
    if (origin) origins.add(origin);
    if (origins.size >= MAX_ORIGINS) break;
  }
  return Array.from(origins).sort();
}

function sanitizeState(raw: unknown): FaviconRefreshState {
  if (!isRecord(raw)) return EMPTY_STATE;
  const epoch =
    typeof raw.epoch === 'number' && Number.isFinite(raw.epoch)
      ? Math.max(0, Math.floor(raw.epoch))
      : 0;
  const updatedAt =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? Math.max(0, Math.floor(raw.updatedAt))
      : 0;
  const origins: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.origins)) {
    for (const value of raw.origins) {
      const origin = sanitizeOrigin(value);
      if (!origin || seen.has(origin)) continue;
      seen.add(origin);
      origins.push(origin);
      if (origins.length >= MAX_ORIGINS) break;
    }
  }
  return { epoch, origins, updatedAt };
}

export function hydrateFaviconRefresh(raw: unknown): void {
  const state = sanitizeState(raw);
  originSet = new Set(state.origins);
  faviconRefreshStore.setState({
    state,
    version: faviconRefreshStore.getState().version + 1,
  });
}

export function hasRefreshedFavicon(origin: string): boolean {
  return originSet.has(origin);
}

export function faviconRefreshEpoch(): number {
  return faviconRefreshStore.getState().state.epoch;
}

/**
 * Persists the current set of bookmark origins and bumps the epoch. The epoch
 * is part of every remote URL, so re-importing bypasses stale HTTP-cached
 * favicons and re-checks the browser's local favicon database.
 */
export async function refreshFaviconSources(urls: string[]): Promise<number> {
  const origins = collectFaviconOrigins(urls);
  const previous = faviconRefreshStore.getState().state;
  const next: FaviconRefreshState = {
    epoch: Math.max(Date.now(), previous.epoch + 1),
    origins,
    updatedAt: Date.now(),
  };
  originSet = new Set(origins);
  faviconRefreshStore.setState({
    state: next,
    version: faviconRefreshStore.getState().version + 1,
  });
  try {
    await storageService.writeItems({ [STORAGE_KEYS.faviconRefresh]: next });
  } catch (error) {
    console.warn('[GlassDesk] Could not persist favicon refresh state', error);
  }
  return origins.length;
}
