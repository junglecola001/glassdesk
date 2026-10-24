import type { BookmarkNode } from '../types/bookmark';
import { normalizeChromeTree } from '../features/bookmarks/tree';
import { DEMO_BOOKMARK_TREE } from './demo-data';
import { localFavicon } from '../utils/site-icons';

export function isExtensionEnvironment(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime !== 'undefined' &&
    typeof chrome.runtime.id === 'string' &&
    typeof chrome.bookmarks !== 'undefined' &&
    typeof chrome.storage !== 'undefined'
  );
}

export function hasBookmarkAccess(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime !== 'undefined' &&
    typeof chrome.runtime.id === 'string' &&
    typeof chrome.bookmarks !== 'undefined'
  );
}

function cloneDemoTree(): BookmarkNode[] {
  return structuredClone(DEMO_BOOKMARK_TREE);
}

function isExtensionPage(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime !== 'undefined' &&
    typeof chrome.runtime.id === 'string'
  );
}

export async function readBookmarkTree(): Promise<BookmarkNode[]> {
  if (hasBookmarkAccess()) {
    const tree = await chrome.bookmarks.getTree();
    return normalizeChromeTree(tree);
  }
  if (isExtensionPage()) {
    throw new Error('BOOKMARK_PERMISSION_REQUIRED');
  }
  return cloneDemoTree();
}

export interface BookmarkChangeListener {
  (): void;
}

export function subscribeBookmarkChanges(listener: BookmarkChangeListener): () => void {
  if (!hasBookmarkAccess()) return () => undefined;
  const bookmarks = chrome.bookmarks;
  const created = () => listener();
  const removed = () => listener();
  const changed = () => listener();
  const moved = () => listener();
  const reordered = () => listener();
  const importEnded = () => listener();

  bookmarks.onCreated.addListener(created);
  bookmarks.onRemoved.addListener(removed);
  bookmarks.onChanged.addListener(changed);
  bookmarks.onMoved.addListener(moved);
  bookmarks.onChildrenReordered.addListener(reordered);
  bookmarks.onImportEnded.addListener(importEnded);

  return () => {
    bookmarks.onCreated.removeListener(created);
    bookmarks.onRemoved.removeListener(removed);
    bookmarks.onChanged.removeListener(changed);
    bookmarks.onMoved.removeListener(moved);
    bookmarks.onChildrenReordered.removeListener(reordered);
    bookmarks.onImportEnded.removeListener(importEnded);
  };
}

export function openUrl(url: string, newTab = false): void {
  if (newTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  window.location.assign(url);
}

/**
 * Extension builds read favicons from Chrome's local cache, so the new tab
 * still works offline. The Vite preview has no cached favicons, so it falls
 * back to a public service to keep the demo recognizable.
 */
export function faviconUrl(url: string | null | undefined, size = 64): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const local = localFavicon(parsed.hostname);
  if (local) return local;
  if (isExtensionPage()) {
    return chrome.runtime.getURL(
      `/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`,
    );
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=${size}`;
}
