import type { CSSProperties, DragEvent, KeyboardEvent, MouseEvent } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import type { BookmarkView } from '../../stores/desktop-store';
import { siteHue, siteLetter } from '../../utils/url';

interface BookmarkTileProps {
  view: BookmarkView;
  desktopId: string;
  pinned: boolean;
  dragging: boolean;
  dropPosition: 'before' | 'after' | null;
  onDragStart: (view: BookmarkView, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (view: BookmarkView, event: DragEvent<HTMLElement>) => void;
  onDrop: (view: BookmarkView, event: DragEvent<HTMLElement>) => void;
  onContextMenu: (view: BookmarkView, event: MouseEvent<HTMLElement> | { x: number; y: number }) => void;
}

export function BookmarkTile({
  view,
  desktopId,
  pinned,
  dragging,
  dropPosition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onContextMenu,
}: BookmarkTileProps) {
  const hue = siteHue(view.url, view.title);

  function openMenuFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    onContextMenu(view, { x: rect.left + rect.width / 2, y: rect.bottom });
  }

  const commonProps = {
    className: 'bookmark',
    'data-missing': view.missing ? 'true' : 'false',
    'data-dragging': dragging ? 'true' : 'false',
    'data-drop': dropPosition ?? undefined,
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => onDragStart(view, event),
    onDragEnd,
    onDragOver: (event: DragEvent<HTMLElement>) => onDragOver(view, event),
    onDrop: (event: DragEvent<HTMLElement>) => onDrop(view, event),
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      onContextMenu(view, event);
    },
    onKeyDown: openMenuFromKeyboard,
    title: view.missing ? `${view.title}（书签已失效）` : view.title,
    'aria-label': view.missing ? `${view.title}，书签已失效` : view.title,
  };

  const content = (
    <>
      <span className="bookmark-icon" style={{ '--tile-hue': hue } as CSSProperties}>
        {view.missing ? <WarningCircle size={20} weight="fill" /> : siteLetter(view.title, view.url)}
      </span>
      <span className="bookmark-label">{view.title}</span>
      {pinned ? <span className="bookmark-pin" aria-hidden="true" /> : null}
    </>
  );

  function openMissingMenu(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    onContextMenu(view, { x: rect.left + rect.width / 2, y: rect.bottom });
  }

  if (view.missing) {
    return (
      <div
        {...commonProps}
        role="button"
        tabIndex={0}
        data-desktop-id={desktopId}
        onClick={(event) => openMissingMenu(event.currentTarget)}
        onKeyDown={(event) => {
          openMenuFromKeyboard(event);
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openMissingMenu(event.currentTarget);
          }
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <a {...commonProps} href={view.url} data-desktop-id={desktopId}>
      {content}
    </a>
  );
}
