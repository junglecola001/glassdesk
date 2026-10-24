import { useActiveWidgets } from '../../stores/desktop-store';
import { ClockWidget } from '../widgets/clock/ClockWidget';
import { CountdownWidget } from '../widgets/countdown/CountdownWidget';
import { NotesWidget } from '../widgets/notes/NotesWidget';
import { PomodoroWidget } from '../widgets/pomodoro/PomodoroWidget';
import { SearchWidget } from '../widgets/search/SearchWidget';

interface WidgetLayerProps {
  compact: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export function WidgetLayer({ compact, canvasWidth, canvasHeight }: WidgetLayerProps) {
  const widgets = useActiveWidgets();
  const ordered = [...widgets].sort((a, b) => a.zIndex - b.zIndex);
  const visible = compact ? ordered.filter((widget) => widget.type !== 'clock') : ordered;

  if (visible.length === 0) return null;

  return (
    <div className={`widget-layer${compact ? ' widget-layer--flow' : ''}`}>
      {visible.map((widget) => {
        switch (widget.type) {
          case 'clock':
            return (
              <ClockWidget
                key={widget.id}
                widget={widget}
                compact={compact}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            );
          case 'note':
            return (
              <NotesWidget
                key={widget.id}
                widget={widget}
                compact={compact}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            );
          case 'countdown':
            return (
              <CountdownWidget
                key={widget.id}
                widget={widget}
                compact={compact}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            );
          case 'pomodoro':
            return (
              <PomodoroWidget
                key={widget.id}
                widget={widget}
                compact={compact}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            );
          case 'search':
            return (
              <SearchWidget
                key={widget.id}
                widget={widget}
                compact={compact}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            );
        }
      })}
    </div>
  );
}
