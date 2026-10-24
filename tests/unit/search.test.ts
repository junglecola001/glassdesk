import { describe, expect, it } from 'vitest';
import type { BookmarkMeta } from '../../src/types/bookmark';
import {
  SEARCH_ENGINES,
  buildSearchUrl,
  resolveQuery,
  searchBookmarks,
  searchDesktops,
} from '../../src/features/search/search';

const bookmarks: BookmarkMeta[] = [
  {
    id: '1',
    title: 'Linear',
    url: 'https://linear.app',
    parentId: 'work',
    path: ['书签栏', '工作'],
  },
  {
    id: '2',
    title: 'Linear Docs',
    url: 'https://linear.app/docs',
    parentId: 'work',
    path: ['书签栏', '工作'],
  },
  {
    id: '3',
    title: 'Figma',
    url: 'https://www.figma.com',
    parentId: 'design',
    path: ['书签栏', '设计'],
  },
  {
    id: '4',
    title: '少数派',
    url: 'https://sspai.com',
    parentId: 'read',
    path: ['书签栏', '阅读'],
  },
];

const desktops = [
  { id: 'd1', name: '工作' },
  { id: 'd2', name: '设计' },
  { id: 'd3', name: '阅读' },
] as Parameters<typeof searchDesktops>[1];

describe('search', () => {
  it('builds encoded search URLs', () => {
    expect(buildSearchUrl('bing', '玻璃 桌面')).toBe(
      'https://www.bing.com/search?q=%E7%8E%BB%E7%92%83+%E6%A1%8C%E9%9D%A2',
    );
    expect(buildSearchUrl('duckduckgo', 'linear app')).toContain('q=linear+app');
    expect(SEARCH_ENGINES.map((engine) => engine.id)).toContain('baidu');
  });

  it('distinguishes URLs from search queries', () => {
    expect(resolveQuery('bing', 'linear.app')).toEqual({
      kind: 'url',
      url: 'https://linear.app',
    });
    expect(resolveQuery('google', 'linear app')).toEqual({
      kind: 'search',
      url: 'https://www.google.com/search?q=linear+app',
    });
    expect(resolveQuery('bing', 'http://localhost:3000')).toEqual({
      kind: 'url',
      url: 'http://localhost:3000',
    });
  });

  it('ranks exact and title matches above URL-only matches', () => {
    const hits = searchBookmarks('linear', bookmarks, 5);
    expect(hits.map((hit) => hit.meta.id)).toEqual(['1', '2']);

    const figma = searchBookmarks('figma.com', bookmarks, 5);
    expect(figma[0]?.meta.id).toBe('3');
  });

  it('supports Chinese titles and multi-token queries', () => {
    expect(searchBookmarks('少数派', bookmarks)[0]?.meta.id).toBe('4');
    expect(searchBookmarks('linear docs', bookmarks)[0]?.meta.id).toBe('2');
    expect(searchBookmarks('no-such-thing', bookmarks)).toEqual([]);
    expect(searchBookmarks('', bookmarks)).toEqual([]);
  });

  it('finds desktops by name', () => {
    expect(searchDesktops('设', desktops).map((desktop) => desktop.id)).toEqual(['d2']);
    expect(searchDesktops('nope', desktops)).toEqual([]);
  });
});
