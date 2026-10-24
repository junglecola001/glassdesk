import type { BookmarkMeta } from '../../types/bookmark';
import type { Desktop } from '../../types/desktop';
import type { SearchEngineId } from '../../types/settings';
import { isLikelyUrl, toNavigableUrl } from '../../utils/url';

export interface SearchEngine {
  id: SearchEngineId;
  name: string;
  hint: string;
  urlTemplate: string;
}

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'bing',
    name: 'Bing',
    hint: '默认',
    urlTemplate: 'https://www.bing.com/search?q=%s',
  },
  {
    id: 'google',
    name: 'Google',
    hint: '',
    urlTemplate: 'https://www.google.com/search?q=%s',
  },
  {
    id: 'baidu',
    name: '百度',
    hint: '',
    urlTemplate: 'https://www.baidu.com/s?wd=%s',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    hint: '隐私',
    urlTemplate: 'https://duckduckgo.com/?q=%s',
  },
];

export function getSearchEngine(id: SearchEngineId): SearchEngine {
  return SEARCH_ENGINES.find((engine) => engine.id === id) ?? SEARCH_ENGINES[0]!;
}

export function buildSearchUrl(engineId: SearchEngineId, query: string): string {
  const encoded = encodeURIComponent(query.trim()).replace(/%20/g, '+');
  return getSearchEngine(engineId).urlTemplate.replace('%s', encoded);
}

export interface QueryResolution {
  kind: 'url' | 'search';
  url: string;
}

export function resolveQuery(engineId: SearchEngineId, raw: string): QueryResolution {
  const value = raw.trim();
  if (isLikelyUrl(value)) {
    return { kind: 'url', url: toNavigableUrl(value) };
  }
  return { kind: 'search', url: buildSearchUrl(engineId, value) };
}

export interface BookmarkSearchHit {
  meta: BookmarkMeta;
  score: number;
}

function scoreMeta(meta: BookmarkMeta, query: string, tokens: string[]): number {
  const title = meta.title.toLowerCase();
  const url = meta.url.toLowerCase();
  const path = meta.path.join(' ').toLowerCase();
  const haystack = `${title} ${url} ${path}`;
  if (!tokens.every((token) => haystack.includes(token))) return 0;

  let score = 0;
  if (title === query) score += 1000;
  if (title.startsWith(query)) score += 260;
  for (const token of tokens) {
    if (title.startsWith(token)) score += 120;
    if (title.includes(token)) score += 84;
    if (url.includes(token)) score += 38;
    if (path.includes(token)) score += 24;
  }
  score -= Math.min(title.length, 90) * 0.35;
  return score;
}

export function searchBookmarks(
  query: string,
  bookmarks: Iterable<BookmarkMeta>,
  limit = 7,
): BookmarkSearchHit[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const hits: BookmarkSearchHit[] = [];
  for (const meta of bookmarks) {
    const score = scoreMeta(meta, normalized, tokens);
    if (score > 0) hits.push({ meta, score });
  }
  hits.sort((a, b) => b.score - a.score || a.meta.title.localeCompare(b.meta.title, 'zh-CN'));
  return hits.slice(0, limit);
}

export function searchDesktops(query: string, desktops: Desktop[], limit = 4): Desktop[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return desktops
    .filter((desktop) => desktop.name.toLowerCase().includes(normalized))
    .slice(0, limit);
}
