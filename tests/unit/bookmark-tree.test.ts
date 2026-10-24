import { describe, expect, it } from 'vitest';
import type { BookmarkNode } from '../../src/types/bookmark';
import {
  collectBookmarkIdsInFolder,
  indexBookmarks,
  listFolderCandidates,
  mergeBookmarkIds,
  remapBookmarkIdsByUrl,
  reorderIds,
} from '../../src/features/bookmarks/tree';

function tree(): BookmarkNode[] {
  return [
    {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: '书签栏',
          children: [
            {
              id: 'work',
              title: '工作',
              children: [
                { id: 'b1', title: 'Linear', url: 'https://linear.app', parentId: 'work' },
                {
                  id: 'nested',
                  title: '文档',
                  children: [
                    { id: 'b2', title: 'Docs', url: 'https://linear.app/docs', parentId: 'nested' },
                  ],
                },
              ],
            },
            {
              id: 'design',
              title: '设计',
              children: [
                { id: 'b3', title: 'Figma', url: 'https://figma.com', parentId: 'design' },
              ],
            },
            { id: 'loose', title: 'Example', url: 'https://example.com', parentId: '1' },
          ],
        },
        { id: '2', title: '其他书签', children: [] },
      ],
    },
  ];
}

describe('bookmark tree helpers', () => {
  it('indexes bookmarks with clean folder paths', () => {
    const index = indexBookmarks(tree());
    expect(index.size).toBe(4);
    expect(index.get('b1')?.title).toBe('Linear');
    expect(index.get('b1')?.path).toEqual(['书签栏', '工作']);
    expect(index.get('b2')?.path).toEqual(['书签栏', '工作', '文档']);
    expect(index.get('loose')?.path).toEqual(['书签栏']);
  });

  it('collects descendant bookmarks in folder order', () => {
    expect(collectBookmarkIdsInFolder(tree(), 'work')).toEqual(['b1', 'b2']);
    expect(collectBookmarkIdsInFolder(tree(), 'design')).toEqual(['b3']);
    expect(collectBookmarkIdsInFolder(tree(), 'missing')).toEqual([]);
  });

  it('lists folder candidates with counts and depth', () => {
    const folders = listFolderCandidates(tree());
    const work = folders.find((folder) => folder.id === 'work');
    expect(work).toMatchObject({ title: '工作', depth: 2, count: 2 });
    expect(work?.path).toEqual(['书签', '书签栏', '工作']);
    const design = folders.find((folder) => folder.id === 'design');
    expect(design?.count).toBe(1);
    expect(folders.some((folder) => folder.id === 'nested' && folder.count === 1)).toBe(true);
  });

  it('merges new bookmarks while preserving order and missing entries', () => {
    const first = mergeBookmarkIds(['b3', 'b1'], ['b1', 'b2', 'b3', 'b4']);
    expect(first.ids).toEqual(['b3', 'b1', 'b2', 'b4']);
    expect(first.added).toEqual(['b2', 'b4']);
    expect(first.removed).toEqual([]);

    const withMissing = mergeBookmarkIds(['gone', 'b1'], ['b1', 'b2']);
    expect(withMissing.ids).toEqual(['gone', 'b1', 'b2']);
    expect(withMissing.removed).toEqual(['gone']);

    const repeated = mergeBookmarkIds(first.ids, ['b1', 'b2', 'b3', 'b4']);
    expect(repeated.added).toEqual([]);
    expect(repeated.ids).toEqual(['b3', 'b1', 'b2', 'b4']);
  });

  it('reorders an id before or after a target', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', 'c', false)).toEqual(['b', 'a', 'c']);
    expect(reorderIds(['a', 'b', 'c'], 'a', 'c', true)).toEqual(['b', 'c', 'a']);
    expect(reorderIds(['a', 'b', 'c'], 'a', 'missing', true)).toEqual(['a', 'b', 'c']);
  });

  it('remaps bookmark ids by URL for backup import', () => {
    const oldCache = {
      old1: { url: 'https://linear.app' },
      old2: { url: 'https://figma.com' },
      old3: { url: 'https://deleted.example' },
    };
    const live = indexBookmarks(tree());
    const remapped = remapBookmarkIdsByUrl(['old1', 'old2', 'old3'], oldCache, live);
    expect(remapped[0]).toBe('b1');
    expect(remapped[1]).toBe('b3');
    expect(remapped).toHaveLength(2);
  });
});
