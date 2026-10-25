import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import {
  faviconCandidates,
  type FaviconCandidate,
} from '../services/browser-api';
import { faviconRefreshStore } from '../services/favicon-refresh';
import { useStore } from '../stores/create-store';

interface FaviconState {
  src: string | null;
  loaded: boolean;
  failed: boolean;
  onLoad: (event: SyntheticEvent<HTMLImageElement>) => void;
  onError: () => void;
}

type Inspection =
  | { kind: 'ok'; hash: string; opaque: number }
  | { kind: 'blank' }
  | { kind: 'unreadable' };

const RETRY_DELAYS = [1000, 3000, 8000];
const FOCUS_RETRY_COOLDOWN = 1500;
const MIN_ICON_SIZE = 8;
const SAMPLE_SIZE = 16;
const MIN_OPAQUE_PIXELS = 4;

const defaultHashCache = new Map<string, Promise<string | null>>();

function isExtensionRuntime(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime !== 'undefined' &&
    typeof chrome.runtime.id === 'string' &&
    typeof chrome.runtime.getURL === 'function'
  );
}

function inspectImage(img: HTMLImageElement): Inspection {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { kind: 'unreadable' };
  try {
    context.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    context.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    let hash = 2166136261;
    let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 8) opaque++;
      hash ^= pixels[index];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 1];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 2];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 3];
      hash = Math.imul(hash, 16777619);
    }
    if (opaque < MIN_OPAQUE_PIXELS) return { kind: 'blank' };
    return { kind: 'ok', hash: (hash >>> 0).toString(36), opaque };
  } catch {
    // A cross-origin image taints the canvas; treat it as usable rather than
    // dropping a perfectly good remote favicon.
    return { kind: 'unreadable' };
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function defaultHashKey(size: number): string {
  const dark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return `${size}:${dark ? 'dark' : 'light'}`;
}

/**
 * Chromium answers `_favicon` with a default globe when nothing is cached.
 * Probe two guaranteed-missing hosts with different initial letters; only
 * treat the result as a fingerprint when both probes agree, which avoids
 * rejecting a generic placeholder while still ignoring per-host monograms.
 */
function getDefaultFaviconHash(size: number): Promise<string | null> {
  if (!isExtensionRuntime()) return Promise.resolve(null);
  const key = defaultHashKey(size);
  const cached = defaultHashCache.get(key);
  if (cached) return cached;
  const probe = (host: string) =>
    chrome.runtime.getURL(
      `/_favicon/?pageUrl=${encodeURIComponent(`https://${host}/`)}&size=${size}&fallbackToHost=1&_gd=default`,
    );
  const promise = (async () => {
    try {
      const [first, second] = await Promise.all([
        loadImage(probe('glassdesk-alpha.invalid')),
        loadImage(probe('zeta-glassdesk.invalid')),
      ]);
      if (!first || !second) return null;
      const a = inspectImage(first);
      const b = inspectImage(second);
      if (a.kind !== 'ok' || b.kind !== 'ok') return null;
      return a.hash === b.hash ? a.hash : null;
    } catch {
      return null;
    }
  })();
  defaultHashCache.set(key, promise);
  return promise;
}

async function isUsableFavicon(
  img: HTMLImageElement,
  candidate: FaviconCandidate,
  size: number,
): Promise<boolean> {
  if (img.naturalWidth < MIN_ICON_SIZE || img.naturalHeight < MIN_ICON_SIZE) {
    return false;
  }
  if (!candidate.inspect) return true;
  const inspection = inspectImage(img);
  if (inspection.kind === 'blank') return false;
  if (inspection.kind === 'unreadable') return true;
  const fallbackHash = await getDefaultFaviconHash(size);
  return !fallbackHash || inspection.hash !== fallbackHash;
}

function decorateCandidate(candidate: FaviconCandidate, attempt: number): FaviconCandidate {
  if (!candidate.retryable || attempt === 0) return candidate;
  const separator = candidate.src.includes('?') ? '&' : '?';
  return { ...candidate, src: `${candidate.src}${separator}_gdr=${attempt}` };
}

export function useFavicon(url: string | null | undefined, size = 64): FaviconState {
  const faviconVersion = useStore(faviconRefreshStore, (state) => state.version);
  const candidates = useMemo(
    () => faviconCandidates(url, size),
    // Re-read the favicon registry after a bookmark re-import bumps its version.
    [url, size, faviconVersion],
  );
  const candidateKey = useMemo(
    () => candidates.map((candidate) => candidate.src).join('\n'),
    [candidates],
  );

  const [cursor, setCursor] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const mountedRef = useRef(false);
  const loadJobRef = useRef(0);
  const cursorRef = useRef(0);
  const lastAttemptRef = useRef(0);
  const loadedSrcRef = useRef<string | null>(null);
  const loadedRef = useRef(false);

  const decorated = useMemo(
    () => candidates.map((candidate) => decorateCandidate(candidate, attempt)),
    [candidates, attempt],
  );
  const current = decorated[cursor] ?? null;
  const src = current?.src ?? null;
  const currentSrcRef = useRef<string | null>(null);
  currentSrcRef.current = src;
  cursorRef.current = cursor;
  loadedSrcRef.current = loadedSrc;
  loadedRef.current = Boolean(src && loadedSrc === src);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const preserved = loadedSrcRef.current;
    const index = preserved
      ? candidates.findIndex((candidate) => candidate.src === preserved)
      : -1;
    if (index >= 0) {
      cursorRef.current = index;
      setCursor(index);
    } else {
      cursorRef.current = 0;
      setCursor(0);
      setLoadedSrc(null);
    }
    setRetryCount(0);
    setExhausted(false);
  }, [candidateKey]);

  useEffect(() => {
    if (candidates.length === 0) setExhausted(true);
  }, [candidates.length]);

  useEffect(() => {
    lastAttemptRef.current = Date.now();
  }, [attempt]);

  const advance = useCallback(() => {
    loadJobRef.current += 1;
    setLoadedSrc(null);
    const next = cursorRef.current + 1;
    if (next < decorated.length) {
      cursorRef.current = next;
      setCursor(next);
      return;
    }
    setExhausted(true);
  }, [decorated.length]);

  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const candidate = current;
      const expected = candidate?.src ?? null;
      if (!candidate || !expected) return;
      const img = event.currentTarget;
      const job = ++loadJobRef.current;
      void (async () => {
        let usable = true;
        try {
          usable = await isUsableFavicon(img, candidate, size);
        } catch {
          // Inspection is best-effort; never hide an otherwise loaded icon.
          usable = true;
        }
        if (
          !mountedRef.current ||
          job !== loadJobRef.current ||
          currentSrcRef.current !== expected
        ) {
          return;
        }
        if (usable) {
          setLoadedSrc(expected);
          return;
        }
        advance();
      })();
    },
    [advance, current, size],
  );

  const handleError = useCallback(() => {
    advance();
  }, [advance]);

  useEffect(() => {
    if (!exhausted || decorated.length === 0) return;
    if (retryCount >= RETRY_DELAYS.length) return;
    const delay = RETRY_DELAYS[retryCount] ?? 0;
    const timer = window.setTimeout(() => {
      setRetryCount((count) => count + 1);
      setAttempt((value) => value + 1);
      cursorRef.current = 0;
      setCursor(0);
      setLoadedSrc(null);
      setExhausted(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [decorated.length, exhausted, retryCount]);

  useEffect(() => {
    const retryNow = () => {
      if (loadedRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (Date.now() - lastAttemptRef.current < FOCUS_RETRY_COOLDOWN) return;
      // Background tabs throttle timers; a site visited in another tab should
      // be picked up as soon as this page becomes visible again.
      lastAttemptRef.current = Date.now();
      setRetryCount(0);
      setAttempt((value) => value + 1);
      cursorRef.current = 0;
      setCursor(0);
      setLoadedSrc(null);
      setExhausted(false);
    };
    document.addEventListener('visibilitychange', retryNow);
    window.addEventListener('focus', retryNow);
    return () => {
      document.removeEventListener('visibilitychange', retryNow);
      window.removeEventListener('focus', retryNow);
    };
  }, []);

  const loaded = Boolean(src && loadedSrc === src);

  return {
    src,
    loaded,
    failed: exhausted || candidates.length === 0,
    onLoad: handleLoad,
    onError: handleError,
  };
}
