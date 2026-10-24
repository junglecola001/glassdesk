import { useStore } from '../../stores/create-store';
import { setActiveDesktop, workspaceStore } from '../../stores/desktop-store';

export function DesktopTabs() {
  const desktops = useStore(workspaceStore, (state) => state.desktops);
  const order = useStore(workspaceStore, (state) => state.desktopOrder);
  const activeDesktopId = useStore(workspaceStore, (state) => state.activeDesktopId);

  if (order.length < 2) return null;

  const ordered = order
    .map((id) => desktops.find((desktop) => desktop.id === id))
    .filter((desktop): desktop is NonNullable<typeof desktop> => Boolean(desktop));

  return (
    <div className="desktop-tabs-wrap">
      <nav className="desktop-tabs" aria-label="切换桌面">
        {ordered.map((desktop) => (
          <button
            key={desktop.id}
            type="button"
            className="desktop-tab"
            data-active={desktop.id === activeDesktopId}
            aria-current={desktop.id === activeDesktopId ? 'page' : undefined}
            onClick={() => setActiveDesktop(desktop.id)}
          >
            {desktop.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
