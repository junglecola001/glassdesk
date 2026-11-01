import type { BookmarkItemView, BookmarkNode } from '../../types/bookmark';
import {
  collectBookmarkIdsInFolder,
  displayTitle,
  findNodeById,
  findNodePath,
} from './tree';

export function folderTitle(node: BookmarkNode): string {
  return node.title.trim() || '未命名文件夹';
}

function folderView(node: BookmarkNode, roots: BookmarkNode[], path: string[]): BookmarkItemView {
  const title = folderTitle(node);
  return {
    id: node.id,
    kind: 'folder',
    title,
    url: '',
    path: [...path, title],
    missing: false,
    count: collectBookmarkIdsInFolder(roots, node.id).length,
  };
}

/**
 * Resolves a folder into the items shown by the Launchpad-style folder view.
 * The returned items are the folder's direct children, so nested folders stay
 * folders instead of being flattened.
 */
export function resolveFolderItems(roots: BookmarkNode[], folderId: string): BookmarkItemView[] {
  const folder = findNodeById(roots, folderId);
  if (!folder || folder.url) return [];
  const path = findNodePath(roots, folderId) ?? [folderTitle(folder)];
  return (folder.children ?? []).map((child) => {
    if (child.url) {
      return {
        id: child.id,
        kind: 'bookmark',
        title: displayTitle(child),
        url: child.url,
        path,
        missing: false,
      };
    }
    return folderView(child, roots, path);
  });
}

/** Resolves a folder id into a desktop tile, or null when it is not a folder. */
export function resolveFolderItem(
  roots: BookmarkNode[],
  folderId: string,
): BookmarkItemView | null {
  const folder = findNodeById(roots, folderId);
  if (!folder || folder.url) return null;
  const path = findNodePath(roots, folderId) ?? [folderTitle(folder)];
  return folderView(folder, roots, path.slice(0, -1));
}

/** Number of real bookmarks a list of desktop entries contains, folders included. */
export function countBookmarksInItems(roots: BookmarkNode[], ids: string[]): number {
  const bookmarkIds = new Set<string>();
  const folderCounts = new Map<string, number>();
  const walk = (nodes: BookmarkNode[]): number => {
    let total = 0;
    for (const node of nodes) {
      if (node.url) {
        bookmarkIds.add(node.id);
        total += 1;
        continue;
      }
      const inside = walk(node.children ?? []);
      folderCounts.set(node.id, inside);
      total += inside;
    }
    return total;
  };
  walk(roots);

  let total = 0;
  for (const id of ids) {
    const folderCount = folderCounts.get(id);
    if (folderCount !== undefined) total += folderCount;
    else if (bookmarkIds.has(id)) total += 1;
  }
  return total;
}
