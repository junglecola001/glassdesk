import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { faviconCandidates } from '../../src/services/browser-api';
import {
  collectFaviconOrigins,
  faviconRefreshStore,
  hydrateFaviconRefresh,
  refreshFaviconSources,
} from '../../src/services/favicon-refresh';

function createChromeMock() {
  return {
    runtime: {
      id: 'test-extension',
      getURL: (path: string) => `chrome-extension://test-extension${path}`,
    },
  };
}

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

function installChromeMock() {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    writable: true,
    value: createChromeMock(),
  });
}

function installLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  });
}

beforeEach(() => {
  installChromeMock();
  hydrateFaviconRefresh(undefined);
});

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
  delete (globalThis as { localStorage?: unknown }).localStorage;
  hydrateFaviconRefresh(undefined);
});

describe('faviconCandidates', () => {
  it('prefers the bundled icon and enables host fallback in the local cache', () => {
    const candidates = faviconCandidates('https://www.github.com/features', 64);
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({
      src: '/favicons/github.com.png',
      local: true,
      inspect: false,
    });
    expect(candidates[1]?.src).toContain(
      `pageUrl=${encodeURIComponent('https://www.github.com/features')}`,
    );
    expect(candidates[1]?.src).toContain('fallbackToHost=1');
    expect(candidates[2]?.src).toContain(
      `pageUrl=${encodeURIComponent('https://www.github.com/')}`,
    );
    expect(candidates[1]?.inspect).toBe(true);
  });

  it('adds a site icon and a public service after a refresh', async () => {
    installLocalStorage();
    await refreshFaviconSources(['https://unknown.example/some/page']);

    const candidates = faviconCandidates('https://unknown.example/some/page', 64);
    expect(candidates.some((candidate) => candidate.src.startsWith('https://unknown.example/favicon.ico?glassdesk='))).toBe(true);
    expect(candidates.some((candidate) => candidate.src.includes('google.com/s2/favicons'))).toBe(true);
    expect(candidates.filter((candidate) => candidate.inspect)).toHaveLength(2);
  });

  it('uses the public service directly outside an extension page', () => {
    delete (globalThis as { chrome?: unknown }).chrome;
    const candidates = faviconCandidates('https://example.com', 32);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.src).toContain('google.com/s2/favicons');
    expect(candidates[0]?.src).toContain('sz=32');
  });

  it('ignores non-http bookmarks', () => {
    expect(faviconCandidates('chrome://settings')).toEqual([]);
    expect(faviconCandidates('not a url')).toEqual([]);
  });
});

describe('favicon refresh origins', () => {
  it('keeps public origins and skips LAN, IP and duplicate entries', () => {
    expect(
      collectFaviconOrigins([
        'https://a.example/x',
        'https://a.example/y',
        'http://b.example',
        'ftp://c.example',
        'http://localhost:3000',
        'http://127.0.0.1',
        'http://192.168.1.3',
        'http://nas',
        'https://a.example:8443/z',
      ]),
    ).toEqual(['http://b.example', 'https://a.example', 'https://a.example:8443']);
  });

  it('sanitizes persisted refresh state', () => {
    hydrateFaviconRefresh({
      epoch: 12.9,
      updatedAt: 5,
      origins: ['https://a.example', 'http://localhost', 'not a url', 'https://a.example', 7],
    });
    expect(faviconRefreshStore.getState().state).toEqual({
      epoch: 12,
      origins: ['https://a.example'],
      updatedAt: 5,
    });
  });

  it('persists refreshed origins and bumps the epoch', async () => {
    installLocalStorage();
    const count = await refreshFaviconSources([
      'https://a.example/x',
      'https://a.example/y',
      'http://localhost:3000',
    ]);
    expect(count).toBe(1);
    const state = faviconRefreshStore.getState().state;
    expect(state.origins).toEqual(['https://a.example']);
    expect(state.epoch).toBeGreaterThan(0);
  });
});
