import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowClockwise,
  ArrowRight,
  ArrowSquareOut,
  Copy,
  FolderOpen,
  PushPin,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import type { DragEvent, MouseEvent } from 'react';
import type { BookmarkView } from '../../stores/desktop-store';
import {
  moveBookmarkToDesktop,
  removeBookmarkFromDesktop,
  reimportBookmarks,
  reorderBookmarks,
  togglePinBookmark,
  useActiveDesktop,
  useDesktopBookmarkViews,
  useWorkspace,
  workspaceStore,
} from '../../stores/desktop-store';
import { useStore } from '../../stores/create-store';
import { useSettings } from '../../stores/settings-store';
import { setSettingsOpen, pushToast } from '../../stores/ui-store';
import { reorderIds } from '../../features/bookmarks/tree';
import { openUrl } from '../../services/browser-api';
import { prettyUrl } from '../../utils/url';
import { BookmarkTile } from './BookmarkTile';

const DRAG_TYPE = 'application/x-glassdesk-bookmark';

interface DragPayload {
  bookmarkId: string;
  desktopId: string;
}

interface ContextState {
  view: BookmarkView;
  x: number;
  y: number;
}

export function BookmarkGrid() {
  const desktop = useActiveDesktop();
  const views = useDesktopBookmarkViews();
  const settings = useSettings();
  const workspace = useWorkspace();
  const hasPermission = useStore(workspaceStore, (state) => state.hasBookmarkPermission);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const dragRef = useRef<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const [context, setContext] = useState<ContextState | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setDropTarget(null);
    setDragPayload(null);
    dragRef.current = null;
    setContext(null);
  }, [desktop?.id]);

  if (!desktop) return null;

  const missingCount = views.filter((view) => view.missing).length;
  const availableCount = views.length - missingCount;
  const pinned = new Set(settings.dockPinnedBookmarkIds);

  function handleDragStart(view: BookmarkView, event: DragEvent<HTMLElement>) {
    if (!desktop) return;
    const payload: DragPayload = { bookmarkId: view.id, desktopId: desktop.id };
    dragRef.current = payload;
    setDragPayload(payload);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', view.url || view.title);
  }

  function handleDragEnd() {
    dragRef.current = null;
    setDragPayload(null);
    setDropTarget(null);
  }

  function handleDragOver(view: BookmarkView, event: DragEvent<HTMLElement>) {
    if (!dragRef.current || !desktop) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientX > rect.left + rect.width / 2;
    setDropTarget({ id: view.id, after });
  }

  function handleDrop(view: BookmarkView, event: DragEvent<HTMLElement>) {
    if (!desktop) return;
    event.preventDefault();
    event.stopPropagation();
    const payload = dragRef.current;
    handleDragEnd();
    if (!payload) return;
    if (payload.desktopId !== desktop.id) {
      moveBookmarkToDesktop(payload.bookmarkId, payload.desktopId, desktop.id);
      return;
    }
    if (payload.bookmarkId === view.id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientX > rect.left + rect.width / 2;
    reorderBookmarks(desktop.id, reorderIds(desktop.bookmarkIds, payload.bookmarkId, view.id, after));
  }

  function handleGridDrop(event: DragEvent<HTMLDivElement>) {
    if (!desktop) return;
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    const payload = dragRef.current;
    handleDragEnd();
    if (!payload) return;
    if (payload.desktopId !== desktop.id) {
      moveBookmarkToDesktop(payload.bookmarkId, payload.desktopId, desktop.id);
      return;
    }
    const next = desktop.bookmarkIds.filter((id) => id !== payload.bookmarkId);
    next.push(payload.bookmarkId);
    reorderBookmarks(desktop.id, next);
  }

  function openContext(view: BookmarkView, event: MouseEvent<HTMLElement> | { x: number; y: number }) {
    const point = 'clientX' in event ? { x: event.clientX, y: event.clientY } : event;
    setContext({ view, x: point.x, y: point.y });
  }

  async function refresh() {
    setRefreshing(true);
    await reimportBookmarks();
    setRefreshing(false);
  }

  const others = workspace.desktops.filter((item) => item.id !== desktop.id);

  return (
    <section className="bookmarks-section" aria-label={`${desktop.name}的书签`}>
      <header className="bookmarks-head">
        <div>
          <h2 className="bookmarks-title">
            <img
              className="bookmarks-title__folder"
              src="/icons/mac/folder.png"
              alt=""
              width={20}
              height={20}
              draggable={false}
            />
            {desktop.name}
          </h2>
          <div className="bookmarks-meta">
            <span>{availableCount} 个书签</span>
            {missingCount > 0 ? (
              <span className="bookmarks-meta__warning">
                <WarningCircle size={12} weight="fill" />
                {missingCount} 个已失效
              </span>
            ) : null}
            {desktop.missingSource ? (
              <span className="bookmarks-meta__warning">来源文件夹不可用</span>
            ) : null}
          </div>
        </div>
        <div className="bookmarks-actions">
          {desktop.sourceFolderId ? (
            <button
              type="button"
              className="btn btn--glass btn--small"
              aria-label="重新导入书签"
              title="重新导入书签"
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              <ArrowClockwise size={13} className={refreshing ? 'spin' : undefined} />
              重新导入
            </button>
          ) : null}
        </div>
      </header>

      {!hasPermission && !workspace.isDemo ? (
        <div className="notice notice--warning">
          <WarningCircle size={15} weight="fill" />
          <span>
            无法读取浏览器书签，当前显示的是上次保存的布局。请在扩展管理页确认 GlassDesk
            拥有书签权限，然后重新打开新标签页。
          </span>
        </div>
      ) : null}

      {views.length > 0 ? (
        <div
          className="bookmark-grid"
          data-dragging={dragPayload ? 'true' : undefined}
          onDragOver={(event) => {
            if (dragRef.current) event.preventDefault();
          }}
          onDrop={handleGridDrop}
        >
          {views.map((view) => (
            <BookmarkTile
              key={view.id}
              view={view}
              desktopId={desktop.id}
              pinned={pinned.has(view.id)}
              dragging={dragPayload?.bookmarkId === view.id}
              dropPosition={
                dropTarget?.id === view.id ? (dropTarget.after ? 'after' : 'before') : null
              }
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onContextMenu={openContext}
            />
          ))}
        </div>
      ) : (
        <EmptyBookmarks
          hasPermission={hasPermission}
          isDemo={workspace.isDemo}
          missingSource={desktop.missingSource === true}
          fromFolder={desktop.sourceFolderId !== null}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
        />
      )}

      {context ? (
        <BookmarkContextMenu
          context={context}
          currentDesktopId={desktop.id}
          others={others}
          pinned={pinned.has(context.view.id)}
          onClose={() => setContext(null)}
        />
      ) : null}
    </section>
  );
}

interface EmptyBookmarksProps {
  hasPermission: boolean;
  isDemo: boolean;
  missingSource: boolean;
  fromFolder: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

function EmptyBookmarks({
  hasPermission,
  isDemo,
  missingSource,
  fromFolder,
  refreshing,
  onRefresh,
}: EmptyBookmarksProps) {
  let title = '这个桌面还是空的';
  let text = '可以把其他桌面的书签拖到下方的桌面指示点，或在设置里从书签文件夹创建一个桌面。';
  if (!hasPermission && !isDemo) {
    title = '需要书签权限';
    text = '授予书签权限后，文件夹会自动变成可以左右切换的桌面。你也可以先使用便签、倒计时和搜索。';
  } else if (missingSource) {
    title = '来源文件夹已不存在';
    text = '浏览器里的原始文件夹被删除或移动了。布局仍然保留，重新导入可以从当前书签中恢复。';
  } else if (fromFolder) {
    title = '这个文件夹还没有书签';
    text = '在浏览器书签管理器里添加书签后，回到这里点击重新导入。';
  }

  return (
    <div className="bookmark-empty">
      <div>
        <div className="bookmark-empty__title">{title}</div>
        <p className="bookmark-empty__text">{text}</p>
      </div>
      <div className="bookmark-empty__actions">
        {fromFolder || missingSource ? (
          <button
            type="button"
            className="btn btn--glass btn--small"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <ArrowClockwise size={13} />
            {refreshing ? '导入中…' : '重新导入书签'}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={() => setSettingsOpen(true, 'desktops')}
        >
          管理桌面
        </button>
      </div>
    </div>
  );
}

interface BookmarkContextMenuProps {
  context: ContextState;
  currentDesktopId: string;
  others: Array<{ id: string; name: string }>;
  pinned: boolean;
  onClose: () => void;
}

function BookmarkContextMenu({
  context,
  currentDesktopId,
  others,
  pinned,
  onClose,
}: BookmarkContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const { view } = context;

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }, 0);
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
    };
    const handleScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      closeRef.current();
    };
    const handleResize = () => closeRef.current();
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const x = Math.max(10, Math.min(context.x, window.innerWidth - 248));
  const y = Math.max(10, Math.min(context.y, window.innerHeight - 300));

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu glass glass--strong"
      style={{ left: x, top: y, maxHeight: Math.max(180, window.innerHeight - y - 16) }}
      role="menu"
      aria-label={view.title}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="context-menu__path">
        {view.missing ? '书签已失效' : prettyUrl(view.url)}
      </div>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={view.missing}
        onClick={() => {
          onClose();
          openUrl(view.url);
        }}
      >
        <ArrowRight size={14} />
        打开
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={view.missing}
        onClick={() => {
          onClose();
          openUrl(view.url, true);
        }}
      >
        <ArrowSquareOut size={14} />
        在新标签页打开
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={view.missing}
        onClick={() => {
          togglePinBookmark(view.id);
          onClose();
        }}
      >
        <PushPin size={14} weight={pinned ? 'fill' : 'regular'} />
        {pinned ? '取消固定到 Dock' : '固定到 Dock'}
      </button>

      {others.length > 0 ? (
        <>
          <div className="context-menu__sep" />
          <div className="context-menu__label">移动到</div>
          <div className="context-menu__scroll scroll-area">
            {others.map((desktop) => (
              <button
                key={desktop.id}
                type="button"
                className="context-menu__item"
                role="menuitem"
                onClick={() => {
                  moveBookmarkToDesktop(view.id, currentDesktopId, desktop.id);
                  onClose();
                }}
              >
                <FolderOpen size={14} />
                {desktop.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="context-menu__sep" />
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={() => {
          removeBookmarkFromDesktop(currentDesktopId, view.id);
          onClose();
        }}
      >
        <Trash size={14} />
        从桌面移除
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={!view.url}
        onClick={() => {
          void navigator.clipboard
            .writeText(view.url)
            .then(() => pushToast('链接已复制。', 'success'))
            .catch(() => pushToast('复制失败，请检查剪贴板权限。', 'error'));
          onClose();
        }}
      >
        <Copy size={14} />
        复制链接
      </button>
    </div>,
    document.body,
  );
}
