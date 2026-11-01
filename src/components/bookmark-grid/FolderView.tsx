import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from '@phosphor-icons/react';
import { folderTitle, resolveFolderItems } from '../../features/bookmarks/folders';
import { findNodeById, findNodePath } from '../../features/bookmarks/tree';
import { useWorkspace } from '../../stores/desktop-store';
import { BookmarkTile } from './BookmarkTile';
import { FolderTile } from './FolderTile';

interface FolderViewProps {
  /** Folder ids from the first opened folder down to the current nested folder. */
  stack: string[];
  onPush: (folderId: string) => void;
  onPop: () => void;
  onClose: () => void;
}

export function FolderView({ stack, onPush, onPop, onClose }: FolderViewProps) {
  const workspace = useWorkspace();
  const panelRef = useRef<HTMLDivElement>(null);
  const folderId = stack[stack.length - 1] ?? '';
  const items = useMemo(
    () => resolveFolderItems(workspace.bookmarkTree, folderId),
    [workspace.bookmarkTree, folderId],
  );
  const folderNode = findNodeById(workspace.bookmarkTree, folderId);
  const path = findNodePath(workspace.bookmarkTree, folderId) ?? [];
  const title = folderNode ? folderTitle(folderNode) : '文件夹';
  const ancestors = path[path.length - 1] === title ? path.slice(0, -1) : path;
  const breadcrumb = ancestors.join(' / ');
  const bookmarkCount = items.reduce(
    (total, item) => total + (item.kind === 'folder' ? item.count ?? 0 : 1),
    0,
  );
  const columns = Math.min(Math.max(items.length, 1), 6);

  useEffect(() => {
    panelRef.current?.focus();
  }, [folderId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (stack.length > 1) onPop();
      else onClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [stack.length, onPop, onClose]);

  return createPortal(
    <div
      className="folder-view-scrim"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="folder-view"
        role="dialog"
        aria-modal="true"
        aria-label={`${title}文件夹`}
        tabIndex={-1}
        style={{ '--folder-columns': columns } as CSSProperties}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="folder-view__bar">
          <div className="folder-view__nav">
            {stack.length > 1 ? (
              <button
                type="button"
                className="folder-view__button folder-view__back"
                aria-label="返回上级文件夹"
                title="返回上级文件夹"
                onClick={onPop}
              >
                <ArrowLeft size={15} weight="bold" />
              </button>
            ) : (
              <img
                className="folder-view__icon"
                src="/icons/mac/folder.png"
                alt=""
                width={26}
                height={26}
                draggable={false}
              />
            )}
            <div className="folder-view__heading">
              <span className="folder-view__title">{title}</span>
              {breadcrumb ? <span className="folder-view__path">{breadcrumb}</span> : null}
            </div>
          </div>
          <span className="folder-view__meta">{bookmarkCount} 个书签</span>
          <button
            type="button"
            className="folder-view__button"
            aria-label="关闭文件夹"
            title="关闭文件夹"
            onClick={onClose}
          >
            <X size={15} weight="bold" />
          </button>
        </header>

        {items.length > 0 ? (
          <div className="folder-view__grid scroll-area">
            {items.map((item) =>
              item.kind === 'folder' ? (
                <FolderTile
                  key={item.id}
                  view={item}
                  onOpen={onPush}
                />
              ) : (
                <BookmarkTile key={item.id} view={item} />
              ),
            )}
          </div>
        ) : (
          <div className="folder-view__empty">
            <p>这个文件夹里还没有书签。</p>
            <span>在浏览器书签管理器中添加后，回到这里重新导入。</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
