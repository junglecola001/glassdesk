import type { BookmarkMeta, BookmarkNode, FolderCandidate } from '../../types/bookmark';
import { hostnameOf, siteLetter } from '../../utils/url';

export function normalizeChromeTree(nodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkNode[] {
  return nodes.map((node) => ({
    id: node.id,
    ...(node.parentId ? { parentId: node.parentId } : {}),
    title: node.title ?? '',
    ...(node.url ? { url: node.url } : {}),
    ...(node.dateAdded ? { dateAdded: node.dateAdded } : {}),
    ...(node.children ? { children: normalizeChromeTree(node.children) } : {}),
  }));
}

export function displayTitle(node: BookmarkNode): string {
  const title = node.title.trim();
  if (title) return title;
  return node.url ? hostnameOf(node.url) || siteLetter('', node.url) : '未命名';
}

export function indexBookmarks(roots: BookmarkNode[]): Map<string, BookmarkMeta> {
  const index = new Map<string, BookmarkMeta>();
  const walk = (nodes: BookmarkNode[], folderPath: string[]) => {
    for (const node of nodes) {
      if (node.url) {
        index.set(node.id, {
          id: node.id,
          title: displayTitle(node),
          url: node.url,
          parentId: node.parentId ?? '',
          path: folderPath,
          ...(node.dateAdded ? { dateAdded: node.dateAdded } : {}),
        });
      }
      if (node.children?.length) {
        const folderName = node.title.trim();
        walk(node.children, folderName ? [...folderPath, folderName] : folderPath);
      }
    }
  };
  walk(roots, []);
  return index;
}

export function findNodeById(roots: BookmarkNode[], id: string): BookmarkNode | null {
  const stack = [...roots];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.id === id) return node;
    if (node.children?.length) stack.push(...node.children);
  }
  return null;
}

export function collectBookmarkIdsInFolder(roots: BookmarkNode[], folderId: string): string[] {
  const folder = findNodeById(roots, folderId);
  if (!folder) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (node: BookmarkNode) => {
    if (node.url) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        ids.push(node.id);
      }
      return;
    }
    node.children?.forEach(visit);
  };
  visit(folder);
  return ids;
}

export function listFolderCandidates(roots: BookmarkNode[], maxDepth = 5): FolderCandidate[] {
  const candidates: FolderCandidate[] = [];
  const walk = (node: BookmarkNode, path: string[], depth: number) => {
    if (depth > maxDepth) return;
    if (node.url) return;
    const nextPath = [...path, node.title || '未命名文件夹'];
    const count = collectBookmarkIdsInFolder([node], node.id).length;
    if (count > 0) {
      candidates.push({
        id: node.id,
        title: node.title || '未命名文件夹',
        path: nextPath,
        depth,
        count,
      });
    }
    node.children?.forEach((child) => walk(child, nextPath, depth + 1));
  };
  for (const root of roots) {
    root.children?.forEach((child) => walk(child, [root.title || '书签'], 1));
  }
  return candidates;
}

export function collectAllRootBookmarkIds(roots: BookmarkNode[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (node: BookmarkNode) => {
    if (node.url) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        ids.push(node.id);
      }
      return;
    }
    node.children?.forEach(visit);
  };
  roots.forEach(visit);
  return ids;
}

export interface MergeResult {
  ids: string[];
  added: string[];
  removed: string[];
}

/**
 * Keeps the user's existing order, appends newly discovered bookmarks in tree
 * order, and never silently drops entries that disappeared upstream. Repeated
 * calls are idempotent.
 */
export function mergeBookmarkIds(existing: string[], live: string[]): MergeResult {
  const liveSet = new Set(live);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of existing) {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  const added: string[] = [];
  for (const id of live) {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
      added.push(id);
    }
  }
  const removed = existing.filter((id) => !liveSet.has(id));
  return { ids, added, removed };
}

export function reorderIds(ids: string[], draggedId: string, targetId: string, after: boolean): string[] {
  if (draggedId === targetId) return ids;
  const without = ids.filter((id) => id !== draggedId);
  const targetIndex = without.indexOf(targetId);
  if (targetIndex < 0) return ids;
  const insertAt = targetIndex + (after ? 1 : 0);
  const next = [...without];
  next.splice(insertAt, 0, draggedId);
  return next;
}

export function removeBookmarkId(ids: string[], bookmarkId: string): string[] {
  return ids.filter((id) => id !== bookmarkId);
}

export function countBookmarksByDesktop(desktopBookmarkIds: string[], liveIds: Set<string>): number {
  return desktopBookmarkIds.filter((id) => liveIds.has(id)).length;
}

export function remapBookmarkIdsByUrl(
  oldIds: string[],
  oldCache: Record<string, { url: string }>,
  liveIndex: Map<string, BookmarkMeta>,
): string[] {
  const liveIds = new Set(liveIndex.keys());
  const byUrl = new Map<string, string>();
  for (const meta of liveIndex.values()) {
    if (!byUrl.has(meta.url)) byUrl.set(meta.url, meta.id);
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const oldId of oldIds) {
    let nextId: string | undefined;
    if (liveIds.has(oldId)) nextId = oldId;
    else {
      const cached = oldCache[oldId];
      if (cached) nextId = byUrl.get(cached.url);
    }
    if (nextId && !seen.has(nextId)) {
      seen.add(nextId);
      result.push(nextId);
    }
  }
  return result;
}
