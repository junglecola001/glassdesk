import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ArrowRight,
  DownloadSimple,
  Hourglass,
  Keyboard,
  MagnifyingGlass,
  Monitor,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import type { BookmarkMeta } from '../../types/bookmark';
import type { Desktop } from '../../types/desktop';
import {
  SEARCH_ENGINES,
  getSearchEngine,
  resolveQuery,
  searchBookmarks,
  searchDesktops,
} from '../../features/search/search';
import { openUrl } from '../../services/browser-api';
import { useStore } from '../../stores/create-store';
import {
  setActiveDesktop,
  useCountdowns,
  workspaceStore,
} from '../../stores/desktop-store';
import { useSettings, patchSettings } from '../../stores/settings-store';
import {
  setSearchOpen,
  setSettingsOpen,
  uiStore,
  type SettingsSection,
} from '../../stores/ui-store';
import { formatCountdownShort } from '../../utils/date';
import { modifierLabel } from '../../utils/events';
import { isLikelyUrl, prettyUrl, siteHue, siteLetter } from '../../utils/url';
import { useNow } from '../../hooks/use-now';

type IslandRow =
  | { kind: 'bookmark'; meta: BookmarkMeta }
  | { kind: 'desktop'; desktop: Desktop }
  | { kind: 'query' };

const QUICK_ACTIONS: Array<{
  section: SettingsSection;
  label: string;
  hint: string;
  icon: typeof Monitor;
}> = [
  { section: 'desktops', label: '桌面与书签', hint: '同步、排序', icon: Monitor },
  { section: 'appearance', label: '外观', hint: '壁纸、玻璃', icon: Sparkle },
  { section: 'data', label: '备份数据', hint: '导出与恢复', icon: DownloadSimple },
  { section: 'search', label: '快捷键', hint: '快速上手', icon: Keyboard },
];

export function DynamicIsland() {
  const open = useStore(uiStore, (state) => state.searchOpen);
  const settings = useSettings();
  const desktops = useStore(workspaceStore, (state) => state.desktops);
  const activeDesktopId = useStore(workspaceStore, (state) => state.activeDesktopId);
  const bookmarks = useStore(workspaceStore, (state) => {
    if (state.lastSyncedAt > 0) return Array.from(state.liveBookmarks.values());
    return Object.values(state.bookmarkCache).map((entry) => ({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      parentId: entry.parentId,
      path: entry.path,
    }));
  });
  const countdowns = useCountdowns();
  const now = useNow(60_000);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const engine = getSearchEngine(settings.searchEngine);
  const trimmedQuery = query.trim();
  const nextCountdown = useMemo(() => {
    return countdowns
      .filter((countdown) => !countdown.completed && countdown.targetTime > now.getTime())
      .sort((a, b) => a.targetTime - b.targetTime)[0];
  }, [countdowns, now]);

  const bookmarkHits = useMemo(
    () => (trimmedQuery ? searchBookmarks(trimmedQuery, bookmarks, 7) : []),
    [trimmedQuery, bookmarks],
  );
  const desktopHits = useMemo(
    () => (trimmedQuery ? searchDesktops(trimmedQuery, desktops, 2) : []),
    [trimmedQuery, desktops],
  );
  const rows = useMemo<IslandRow[]>(() => {
    if (!trimmedQuery) return [];
    const result: IslandRow[] = [];
    for (const desktop of desktopHits) result.push({ kind: 'desktop', desktop });
    for (const hit of bookmarkHits) result.push({ kind: 'bookmark', meta: hit.meta });
    result.push({ kind: 'query' });
    return result;
  }, [trimmedQuery, desktopHits, bookmarkHits]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 30);
    const handlePointerDown = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) closeIsland();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !trimmedQuery) return;
    rowRefs.current[selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected, open, trimmedQuery]);

  function closeIsland() {
    setSearchOpen(false);
    setQuery('');
    setSelected(0);
    inputRef.current?.blur();
  }

  function openIsland() {
    setSearchOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }

  function selectDesktop(desktop: Desktop) {
    setActiveDesktop(desktop.id);
    closeIsland();
  }

  function executeRow(row: IslandRow | undefined, newTab: boolean) {
    if (!row) return;
    if (row.kind === 'desktop') {
      selectDesktop(row.desktop);
      return;
    }
    if (row.kind === 'bookmark') {
      openUrl(row.meta.url, newTab);
      closeIsland();
      return;
    }
    if (!trimmedQuery) return;
    const resolution = resolveQuery(settings.searchEngine, trimmedQuery);
    openUrl(resolution.url, newTab);
    closeIsland();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && rows.length > 0) {
      event.preventDefault();
      setSelected((current) => (current + 1) % rows.length);
      return;
    }
    if (event.key === 'ArrowUp' && rows.length > 0) {
      event.preventDefault();
      setSelected((current) => (current - 1 + rows.length) % rows.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      executeRow(rows[selected], event.metaKey || event.ctrlKey);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeIsland();
    }
  }

  const queryPreview = trimmedQuery
    ? isLikelyUrl(trimmedQuery)
      ? `打开 ${trimmedQuery}`
      : `用 ${engine.name} 搜索“${trimmedQuery}”`
    : '';
  const queryHint = trimmedQuery
    ? isLikelyUrl(trimmedQuery)
      ? '网址'
      : engine.name
    : `${bookmarks.length} 个书签`;

  return (
    <div
      ref={shellRef}
      className="island-shell glass"
      data-open={open}
      onPointerDown={() => {
        if (!open) openIsland();
      }}
    >
      <div className="island-bar">
        <MagnifyingGlass size={16} className="island__search-icon" aria-hidden />
        <input
          ref={inputRef}
          className="island__input"
          type="text"
          value={query}
          placeholder={open ? '搜索书签、桌面，或输入网址' : '搜索书签或输入网址'}
          aria-label="搜索书签、桌面或输入网址"
          role="combobox"
          aria-expanded={open}
          aria-controls="island-results"
          aria-autocomplete="list"
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={openIsland}
          onKeyDown={handleKeyDown}
        />
        <div className="island__side">
          {open ? (
            <>
              <span className="island__esc">
                <span className="kbd">Esc</span>
              </span>
              <button
                type="button"
                className="icon-button icon-button--quiet island__close"
                aria-label="关闭搜索"
                onClick={(event) => {
                  event.stopPropagation();
                  closeIsland();
                }}
              >
                <X size={14} />
              </button>
            </>
          ) : nextCountdown ? (
            <span className="island__chip" title={nextCountdown.title}>
              <Hourglass size={11} weight="bold" aria-hidden />
              {formatCountdownShort(nextCountdown.targetTime - now.getTime())}
            </span>
          ) : (
            <span className="kbd">{modifierLabel()} K</span>
          )}
        </div>
      </div>

      <div className="island-panel" aria-hidden={!open} inert={!open}>
        <div className="island-panel__inner">
          {trimmedQuery ? (
            <>
              <div className="island-results scroll-area" id="island-results" role="listbox">
                {desktopHits.length > 0 ? <div className="island-label">桌面</div> : null}
                {rows.map((row, index) => {
                  if (row.kind === 'desktop') {
                    const position = index;
                    return (
                      <button
                        key={`desktop-${row.desktop.id}`}
                        ref={(element) => {
                          rowRefs.current[position] = element;
                        }}
                        type="button"
                        role="option"
                        aria-selected={selected === position}
                        className="island-row"
                        data-active={selected === position}
                        onMouseEnter={() => setSelected(position)}
                        onClick={() => executeRow(row, false)}
                      >
                        <span className="island-row__icon">
                          <Monitor size={15} />
                        </span>
                        <span className="island-row__text">
                          <span className="island-row__title">{row.desktop.name}</span>
                          <span className="island-row__meta">
                            {row.desktop.bookmarkIds.length} 个书签
                            {row.desktop.id === activeDesktopId ? ' · 当前桌面' : ''}
                          </span>
                        </span>
                        <span className="island-row__side">
                          {selected === position ? <span className="kbd">↵</span> : null}
                        </span>
                      </button>
                    );
                  }
                  if (row.kind === 'bookmark') {
                    const position = index;
                    const hue = siteHue(row.meta.url, row.meta.title);
                    return (
                      <button
                        key={`bookmark-${row.meta.id}`}
                        ref={(element) => {
                          rowRefs.current[position] = element;
                        }}
                        type="button"
                        role="option"
                        aria-selected={selected === position}
                        className="island-row"
                        data-active={selected === position}
                        onMouseEnter={() => setSelected(position)}
                        onClick={() => executeRow(row, false)}
                      >
                        <span className="island-row__icon island-row__icon--site" style={{ '--tile-hue': hue } as CSSProperties}>
                          {siteLetter(row.meta.title, row.meta.url)}
                        </span>
                        <span className="island-row__text">
                          <span className="island-row__title">{row.meta.title}</span>
                          <span className="island-row__meta">
                            {prettyUrl(row.meta.url)}
                            {row.meta.path.length > 0 ? ` · ${row.meta.path[row.meta.path.length - 1]}` : ''}
                          </span>
                        </span>
                        <span className="island-row__side">
                          {selected === position ? <span className="kbd">↵</span> : null}
                        </span>
                      </button>
                    );
                  }
                  const position = index;
                  return (
                    <button
                      key="query"
                      ref={(element) => {
                        rowRefs.current[position] = element;
                      }}
                      type="button"
                      role="option"
                      aria-selected={selected === position}
                      className="island-row"
                      data-active={selected === position}
                      onMouseEnter={() => setSelected(position)}
                      onClick={() => executeRow(row, false)}
                    >
                      <span className="island-row__icon">
                        <ArrowRight size={15} />
                      </span>
                      <span className="island-row__text">
                        <span className="island-row__title">{queryPreview}</span>
                        <span className="island-row__meta">在同一个标签页打开</span>
                      </span>
                      <span className="island-row__side">
                        {selected === position ? <span className="kbd">↵</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="island-footer">
                <div className="island-engines" role="group" aria-label="搜索引擎">
                  {SEARCH_ENGINES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="island-engine"
                      data-active={settings.searchEngine === option.id}
                      onClick={() => {
                        patchSettings({ searchEngine: option.id });
                        inputRef.current?.focus();
                      }}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
                <span className="island-footer__hint">
                  <span className="kbd">↑</span>
                  <span className="kbd">↓</span>
                  选择
                  <span className="kbd">↵</span>
                  打开
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="island-quick">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.section}
                      type="button"
                      className="island-quick__item"
                      onClick={() => {
                        closeIsland();
                        setSettingsOpen(true, action.section);
                      }}
                    >
                      <span className="island-quick__icon">
                        <Icon size={16} />
                      </span>
                      <span className="island-quick__text">
                        <span className="island-quick__title">{action.label}</span>
                        <span className="island-quick__hint">{action.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {desktops.length > 0 ? (
                <>
                  <div className="island-label">切换桌面</div>
                  <div className="island-results">
                    {desktops.slice(0, 4).map((desktop) => (
                      <button
                        key={desktop.id}
                        type="button"
                        className="island-row"
                        onClick={() => selectDesktop(desktop)}
                      >
                        <span className="island-row__icon">
                          <Monitor size={15} />
                        </span>
                        <span className="island-row__text">
                          <span className="island-row__title">{desktop.name}</span>
                          <span className="island-row__meta">
                            {desktop.bookmarkIds.length} 个书签
                          </span>
                        </span>
                        <span className="island-row__side">
                          {desktop.id === activeDesktopId ? '当前' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <div className="island-footer">
                <span className="island-footer__hint">
                  {queryHint} · 输入以搜索全部桌面
                </span>
                <span className="island-footer__hint">
                  <span className="kbd">{modifierLabel()} K</span>
                  随时打开
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
