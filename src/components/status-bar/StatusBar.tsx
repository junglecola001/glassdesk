import { GearSix } from '@phosphor-icons/react';
import { useNow } from '../../hooks/use-now';
import { useActiveDesktop } from '../../stores/desktop-store';
import { setSettingsOpen } from '../../stores/ui-store';
import { formatClock, formatDate } from '../../utils/date';
import { DynamicIsland } from '../dynamic-island/DynamicIsland';

export function StatusBar() {
  const now = useNow(20_000);
  const desktop = useActiveDesktop();

  return (
    <header className="status-bar">
      <div className="status-left">
        <div className="brand">
          <img className="brand__icon" src="/icons/icon-32.png" alt="" width={23} height={23} />
          <span className="brand__name">GlassDesk</span>
        </div>
        {desktop ? (
          <>
            <span className="status-divider" aria-hidden="true" />
            <span className="status-desktop">{desktop.name}</span>
          </>
        ) : null}
      </div>

      <div className="status-center">
        <DynamicIsland />
      </div>

      <div className="status-right">
        <span className="status-date">{formatDate(now)}</span>
        <span className="status-time">{formatClock(now)}</span>
        <button
          type="button"
          className="icon-button status-settings"
          aria-label="打开设置"
          onClick={() => setSettingsOpen(true, 'appearance')}
          title="设置"
        >
          <GearSix size={16} />
        </button>
      </div>
    </header>
  );
}
