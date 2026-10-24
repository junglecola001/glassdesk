import { useState } from 'react';
import type { DragEvent } from 'react';
import { useStore } from '../../stores/create-store';
import {
  moveBookmarkToDesktop,
  setActiveDesktop,
  workspaceStore,
} from '../../stores/desktop-store';
import { useSettings } from '../../stores/settings-store';
import { useMediaQuery } from '../../hooks/use-media-query';

interface DragPayload {
  bookmarkId: string;
  desktopId: string;
}

export function DesktopDots() {
  const desktops = useStore(workspaceStore, (state) => state.desktops);
  const order = useStore(workspaceStore, (state) => state.desktopOrder);
  const activeDesktopId = useStore(workspaceStore, (state) => state.activeDesktopId);
  const settings = useSettings();
  const compact = useMediaQuery('(max-width: 1040px)');
  const [dropDesktopId, setDropDesktopId] = useState<string | null>(null);

  if (compact || !settings.showDesktopDots || order.length < 2) return null;

  const ordered = order
    .map((id) => desktops.find((desktop) => desktop.id === id))
    .filter((desktop): desktop is NonNullable<typeof desktop> => Boolean(desktop));

  function handleDragOver(desktopId: string, event: DragEvent<HTMLButtonElement>) {
    if (!event.dataTransfer.types.includes('application/x-glassdesk-bookmark')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropDesktopId(desktopId);
  }

  function handleDrop(desktopId: string, event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDropDesktopId(null);
    const raw = event.dataTransfer.getData('application/x-glassdesk-bookmark');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      if (!payload.bookmarkId || !payload.desktopId) return;
      moveBookmarkToDesktop(payload.bookmarkId, payload.desktopId, desktopId);
    } catch {
      // Ignore malformed drag data from other apps.
    }
  }

  return (
    <div className="desktop-dots-wrap">
      <nav className="desktop-dots" aria-label="切换桌面">
        {ordered.map((desktop) => (
          <button
            key={desktop.id}
            type="button"
            className="desktop-dot"
            data-active={desktop.id === activeDesktopId}
            data-drop={dropDesktopId === desktop.id}
            aria-label={`切换到${desktop.name}`}
            aria-current={desktop.id === activeDesktopId ? 'page' : undefined}
            onClick={() => setActiveDesktop(desktop.id)}
            onDragOver={(event) => handleDragOver(desktop.id, event)}
            onDragLeave={() => setDropDesktopId((current) => (current === desktop.id ? null : current))}
            onDrop={(event) => handleDrop(desktop.id, event)}
          >
            <span className="desktop-dot__tip">{desktop.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
