import type { BookmarkNode } from '../types/bookmark';
import { normalizeChromeTree } from '../features/bookmarks/tree';
import { DEMO_BOOKMARK_TREE } from './demo-data';

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
