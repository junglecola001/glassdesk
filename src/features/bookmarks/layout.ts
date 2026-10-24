import type { BookmarkLayout } from '../../types/bookmark';
import type { Desktop } from '../../types/desktop';

export function deriveBookmarkLayout(desktops: Desktop[]): BookmarkLayout[] {
  const seen = new Set<string>();
  const result: BookmarkLayout[] = [];
  for (const desktop of desktops) {
    desktop.bookmarkIds.forEach((bookmarkId, order) => {
      if (seen.has(bookmarkId)) return;
      seen.add(bookmarkId);
      result.push({ bookmarkId, desktopId: desktop.id, order });
    });
  }
  return result;
}
