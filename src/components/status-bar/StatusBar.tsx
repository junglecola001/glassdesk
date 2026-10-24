import { AppleLogo, GearSix, Moon, Sun } from '@phosphor-icons/react';
import { useNow } from '../../hooks/use-now';
import { useActiveDesktop } from '../../stores/desktop-store';
import { setSettingsOpen, setWidgetMenuOpen } from '../../stores/ui-store';
import { formatClock, formatMenuDate } from '../../utils/date';
import { DynamicIsland } from '../dynamic-island/DynamicIsland';

export function StatusBar() {
  const now = useNow(20_000);
  const desktop = useActiveDesktop();
  const daytime = now.getHours() >= 6 && now.getHours() < 18;

  return (
    <header className="status-bar">
      <div className="status-left">
        <button
          type="button"
          className="brand status-menu-button"
          aria-label="关于 GlassDesk"
          title="关于 GlassDesk"
          onClick={() => setSettingsOpen(true, 'about')}
        >
          <AppleLogo size={15} weight="fill" aria-hidden />
        </button>
        {desktop ? (
          <button
            type="button"
            className="status-desktop status-menu-button"
            title="桌面与书签"
            onClick={() => setSettingsOpen(true, 'desktops')}
          >
            {desktop.name}
          </button>
        ) : null}
        <nav className="status-menu" aria-label="菜单">
          <button type="button" onClick={() => setSettingsOpen(true, 'desktops')}>
            书签
          </button>
          <button type="button" onClick={() => setWidgetMenuOpen(true)}>
            小组件
          </button>
          <button type="button" onClick={() => setSettingsOpen(true, 'appearance')}>
            外观
          </button>
        </nav>
      </div>

      <div className="status-center">
        <DynamicIsland />
      </div>

      <div className="status-right">
        <span className="status-weather" aria-hidden="true">
          {daytime ? <Sun size={14} weight="fill" /> : <Moon size={14} weight="fill" />}
        </span>
        <span className="status-date">{formatMenuDate(now)}</span>
        <span className="status-time">{formatClock(now)}</span>
        <button
          type="button"
          className="icon-button status-settings"
          aria-label="打开设置"
          onClick={() => setSettingsOpen(true, 'appearance')}
          title="设置"
        >
          <GearSix size={15} />
        </button>
      </div>
    </header>
  );
}
