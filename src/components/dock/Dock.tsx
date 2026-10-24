import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  GearSix,
  Hourglass,
  MagnifyingGlass,
  NotePencil,
  Plus,
  Timer,
  type Icon,
} from '@phosphor-icons/react';
import type { BookmarkView } from '../../stores/desktop-store';
import type { WidgetInstance, WidgetType } from '../../types/widget';
import { openUrl } from '../../services/browser-api';
import { useStore } from '../../stores/create-store';
import {
  addWidget,
  useActiveDesktop,
  useActiveWidgets,
  useWorkspace,
} from '../../stores/desktop-store';
import { useSettings } from '../../stores/settings-store';
import {
  setSearchOpen,
  setSettingsOpen,
  setWidgetMenuOpen,
  uiStore,
} from '../../stores/ui-store';
import { revealWidget } from '../../utils/events';
import { siteHue, siteLetter } from '../../utils/url';

interface ToolItem {
  key: string;
  label: string;
  icon: Icon;
  className: string;
  optional?: boolean;
  onClick: () => void;
}

function BookmarkDockItem({ view }: { view: BookmarkView }) {
  const hue = siteHue(view.url, view.title);
  return (
    <button
      type="button"
      className="dock-item"
      aria-label={view.title}
      onClick={() => openUrl(view.url)}
    >
      <span
        className="dock-icon dock-icon--bookmark"
        style={{ '--tile-hue': hue } as CSSProperties}
      >
        {siteLetter(view.title, view.url)}
      </span>
      <span className="dock-tooltip">{view.title}</span>
    </button>
  );
}

export function Dock() {
  const settings = useSettings();
  const workspace = useWorkspace();
  const activeDesktop = useActiveDesktop();
  const activeWidgets = useActiveWidgets();
  const widgetMenuOpen = useStore(uiStore, (state) => state.widgetMenuOpen);

  const pinned = settings.dockPinnedBookmarkIds
    .map((id) => resolveView(id))
    .filter((view): view is BookmarkView => Boolean(view && !view.missing && view.url));

  function resolveView(id: string): BookmarkView | null {
    const live = workspace.liveBookmarks.get(id);
    if (live) return { ...live, missing: false };
    const cached = workspace.bookmarkCache[id];
    if (cached) return { ...cached, missing: true };
    return null;
  }

  const autoSuggestions =
    pinned.length === 0 && activeDesktop
      ? activeDesktop.bookmarkIds
          .map((id) => resolveView(id))
          .filter((view): view is BookmarkView => Boolean(view && !view.missing && view.url))
          .slice(0, 3)
      : [];

  function revealOrAdd(type: WidgetType) {
    const exists = activeWidgets.some((widget) => widget.type === type);
    if (!exists) addWidget(type);
    window.setTimeout(() => revealWidget(type), 280);
  }

  const tools: ToolItem[] = [
    {
      key: 'search',
      label: '搜索',
      icon: MagnifyingGlass,
      className: 'dock-icon--search',
      onClick: () => setSearchOpen(true),
    },
    {
      key: 'notes',
      label: '便签',
      icon: NotePencil,
      className: 'dock-icon--notes',
      onClick: () => revealOrAdd('note'),
    },
    {
      key: 'countdown',
      label: '倒计时',
      icon: Hourglass,
      className: 'dock-icon--countdown',
      optional: true,
      onClick: () => revealOrAdd('countdown'),
    },
    {
      key: 'pomodoro',
      label: '番茄钟',
      icon: Timer,
      className: 'dock-icon--pomodoro',
      optional: true,
      onClick: () => revealOrAdd('pomodoro'),
    },
  ];

  return (
    <>
      <div className="dock-hotzone" aria-hidden="true" />
      <div className="dock-zone">
        <nav className="dock glass glass--strong" aria-label="Dock">
          <div className="dock__group dock__tools">
            {tools.map((tool) => {
              const ToolIcon = tool.icon;
              return (
                <button
                  key={tool.key}
                  type="button"
                  className="dock-item"
                  data-optional={tool.optional ? 'true' : undefined}
                  aria-label={tool.label}
                  onClick={tool.onClick}
                >
                  <span className={`dock-icon ${tool.className}`}>
                    <ToolIcon size={21} weight="duotone" aria-hidden />
                  </span>
                  <span className="dock-tooltip">{tool.label}</span>
                </button>
              );
            })}
          </div>

          {(pinned.length > 0 || autoSuggestions.length > 0) && <div className="dock-divider" />}

          {pinned.length > 0 ? (
            <div className="dock__group dock__pinned" aria-label="固定的书签">
              {pinned.map((view) => (
                <BookmarkDockItem key={view.id} view={view} />
              ))}
            </div>
          ) : autoSuggestions.length > 0 ? (
            <div className="dock__group dock__pinned" aria-label="当前桌面的书签">
              {autoSuggestions.map((view) => (
                <BookmarkDockItem key={view.id} view={view} />
              ))}
            </div>
          ) : null}

          <div className="dock-divider" />

          <div className="dock__group">
            <button
              type="button"
              className="dock-item"
              aria-label="添加小组件"
              aria-expanded={widgetMenuOpen}
              data-widget-menu-trigger="true"
              onClick={() => setWidgetMenuOpen(!widgetMenuOpen)}
            >
              <span className="dock-icon dock-icon--add">
                <Plus size={21} weight="bold" aria-hidden />
              </span>
              <span className="dock-tooltip">添加小组件</span>
            </button>
            <button
              type="button"
              className="dock-item"
              aria-label="设置"
              onClick={() => setSettingsOpen(true, 'appearance')}
            >
              <span className="dock-icon dock-icon--settings">
                <GearSix size={21} weight="duotone" aria-hidden />
              </span>
              <span className="dock-tooltip">设置</span>
            </button>
          </div>
        </nav>
      </div>
      {widgetMenuOpen ? <WidgetPalette widgets={activeWidgets} /> : null}
    </>
  );
}

const WIDGET_OPTIONS: Array<{ type: WidgetType; title: string; hint: string; icon: Icon }> = [
  { type: 'clock', title: '时钟', hint: '时间、日期和问候', icon: Timer },
  { type: 'note', title: '便签', hint: '自动保存的多张便签', icon: NotePencil },
  { type: 'countdown', title: '倒计时', hint: '用绝对时间记录目标日期', icon: Hourglass },
  { type: 'pomodoro', title: '番茄钟', hint: '专注与休息交替', icon: Timer },
  { type: 'search', title: '快速搜索', hint: '桌面上的一行搜索框', icon: MagnifyingGlass },
];

function WidgetPalette({ widgets }: { widgets: WidgetInstance[] }) {
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.widget-palette') || target?.closest('[data-widget-menu-trigger]')) {
        return;
      }
      setWidgetMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWidgetMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={paletteRef} className="widget-palette glass glass--strong" role="menu">
      <div className="widget-palette__head">添加小组件</div>
      {WIDGET_OPTIONS.map((option) => {
        const Icon = option.icon;
        const disabled = option.type === 'clock' && widgets.some((widget) => widget.type === 'clock');
        return (
          <button
            key={option.type}
            type="button"
            className="widget-palette__item"
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              addWidget(option.type);
              setWidgetMenuOpen(false);
              window.setTimeout(() => revealWidget(option.type), 280);
            }}
          >
            <span className="widget-palette__icon">
              <Icon size={17} weight="duotone" aria-hidden />
            </span>
            <span className="widget-palette__text">
              <span className="widget-palette__title">{option.title}</span>
              <span className="widget-palette__hint">
                {disabled ? '这个桌面已经有了' : option.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
