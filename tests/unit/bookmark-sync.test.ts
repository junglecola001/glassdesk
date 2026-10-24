import { describe, expect, it } from 'vitest';
import type { BookmarkNode } from '../../src/types/bookmark';
import type { Desktop } from '../../src/types/desktop';
import { syncDesktopsWithTree } from '../../src/features/bookmarks/sync';

const tree: BookmarkNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: 'bar',
        title: '书签栏',
        children: [
          {
            id: 'work',
            title: '工作',
            children: [
              { id: 'a', title: 'A', url: 'https://a.example', parentId: 'work' },
              { id: 'b', title: 'B', url: 'https://b.example', parentId: 'work' },
            ],
          },
        ],
      },
    ],
  },
];

function desktop(overrides: Partial<Desktop> = {}): Desktop {
  return {
    id: 'desk-1',
    name: '工作',
    sourceFolderId: 'work',
    bookmarkIds: ['b'],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('bookmark sync', () => {
  it('appends new bookmarks while keeping custom order', () => {
    const result = syncDesktopsWithTree([desktop()], tree, 100, {});
    expect(result.changed).toBe(true);
    expect(result.desktops[0]?.bookmarkIds).toEqual(['b', 'a']);
    expect(result.cache.a?.title).toBe('A');
    expect(result.cache.b?.url).toBe('https://b.example');
  });

  it('is idempotent', () => {
    const first = syncDesktopsWithTree([desktop()], tree, 100, {});
    const second = syncDesktopsWithTree(first.desktops, tree, 200, first.cache);
    expect(second.changed).toBe(false);
    expect(second.desktops[0]?.bookmarkIds).toEqual(['b', 'a']);
  });

  it('keeps previous cache entries for disappeared bookmarks', () => {
    const previous = {
      gone: {
        id: 'gone',
        title: 'Gone',
        url: 'https://gone.example',
        parentId: 'work',
        path: ['书签栏', '工作'],
        cachedAt: 1,
      },
    };
    const result = syncDesktopsWithTree([desktop({ bookmarkIds: ['b', 'gone'] })], tree, 100, previous);
    expect(result.cache.gone?.title).toBe('Gone');
    expect(result.desktops[0]?.bookmarkIds).toContain('gone');
  });

  it('marks a missing source folder without discarding the layout', () => {
    const result = syncDesktopsWithTree([desktop({ sourceFolderId: 'deleted' })], tree, 100, {});
    expect(result.changed).toBe(true);
    expect(result.desktops[0]?.missingSource).toBe(true);
    expect(result.desktops[0]?.bookmarkIds).toEqual(['b']);
  });

  it('leaves custom desktops untouched', () => {
    const custom = desktop({ sourceFolderId: null, bookmarkIds: ['x'] });
    const result = syncDesktopsWithTree([custom], tree, 100, {});
    expect(result.changed).toBe(false);
    expect(result.desktops[0]).toBe(custom);
  });
});
