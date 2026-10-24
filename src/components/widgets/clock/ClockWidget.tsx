import { Clock } from '@phosphor-icons/react';
import type { WidgetInstance } from '../../../types/widget';
import { useNow } from '../../../hooks/use-now';
import { formatClock, formatDate, greetingForHour } from '../../../utils/date';
import { WidgetFrame } from '../common/WidgetFrame';

interface ClockWidgetProps {
  widget: WidgetInstance;
  compact: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export function ClockWidget({ widget, compact, canvasWidth, canvasHeight }: ClockWidgetProps) {
  const now = useNow(10_000);

  return (
    <WidgetFrame
      widget={widget}
      title="时钟"
      icon={<Clock size={13} />}
      compact={compact}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
    >
      <div className="clock-widget">
        <div className="clock-time">{formatClock(now)}</div>
        <div className="clock-meta">
          <span className="clock-date">{formatDate(now)}</span>
          <span className="clock-sep" aria-hidden="true" />
          <span className="clock-greeting">{greetingForHour(now.getHours())}</span>
        </div>
      </div>
    </WidgetFrame>
  );
}
