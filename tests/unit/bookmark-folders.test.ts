import { describe, expect, it } from 'vitest';
import type { BookmarkNode } from '../../src/types/bookmark';
import {
  countBookmarksInItems,
  resolveFolderItem,
  resolveFolderItems,
} from '../../src/features/bookmarks/folders';

const tree: BookmarkNode[] = [
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
              { id: 'a', title: 'Linear', url: 'https://linear.app' },
              {
                id: 'docs',
                title: '文档',
                children: [
                  { id: 'b', title: 'Docs', url: 'https://linear.app/docs' },
                  {
                    id: 'ext',
                    title: '扩展',
                    children: [
                      { id: 'c', title: 'Chrome', url: 'https://developer.chrome.com' },
                    ],
                  },
                ],
              },
              { id: 'empty', title: '空文件夹', children: [] },
            ],
          },
        ],
      },
    ],
  },
];

describe('folder items', () => {
  it('resolves a folder into direct bookmarks and folder icons', () => {
    const items = resolveFolderItems(tree, 'work');
    expect(items.map((item) => [item.id, item.kind])).toEqual([
      ['a', 'bookmark'],
      ['docs', 'folder'],
      ['empty', 'folder'],
    ]);
    expect(items[0]?.path).toEqual(['书签栏', '工作']);
    expect(items[1]?.count).toBe(2);
    expect(items[2]?.count).toBe(0);
  });

  it('resolves nested folders recursively', () => {
    expect(resolveFolderItems(tree, 'docs').map((item) => item.id)).toEqual(['b', 'ext']);
    expect(resolveFolderItems(tree, 'ext')).toMatchObject([
      { id: 'c', kind: 'bookmark', url: 'https://developer.chrome.com' },
    ]);
    expect(resolveFolderItems(tree, 'missing')).toEqual([]);
  });

  it('resolves a folder tile with its path and bookmark count', () => {
    expect(resolveFolderItem(tree, 'docs')).toMatchObject({
      id: 'docs',
      kind: 'folder',
      title: '文档',
      count: 2,
      path: ['书签栏', '工作', '文档'],
    });
    expect(resolveFolderItem(tree, 'a')).toBeNull();
  });

  it('counts bookmarks through nested folders', () => {
    expect(countBookmarksInItems(tree, ['a', 'docs'])).toBe(3);
    expect(countBookmarksInItems(tree, ['missing'])).toBe(0);
  });
});
