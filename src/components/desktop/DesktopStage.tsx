import { useEffect, useRef, useState } from 'react';
import { useNow } from '../../hooks/use-now';
import { formatClock, formatMenuDate } from '../../utils/date';
import { useMediaQuery } from '../../hooks/use-media-query';
import {
  setActiveDesktop,
  useActiveDesktop,
  useActiveWidgets,
  useWorkspace,
  workspaceStore,
} from '../../stores/desktop-store';
import { BookmarkGrid } from '../bookmark-grid/BookmarkGrid';
import { ClockWidget } from '../widgets/clock/ClockWidget';
import { WidgetLayer } from './WidgetLayer';
import { DesktopTabs } from './DesktopTabs';

export function DesktopStage() {
  const compact = useMediaQuery('(max-width: 1040px)');
  const now = useNow(30_000);
  const desktop = useActiveDesktop();
  const widgets = useActiveWidgets();
  const workspace = useWorkspace();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1320 : Math.min(1320, window.innerWidth),
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }));
  const previousIdRef = useRef<string | null>(desktop?.id ?? null);
  const previousIndexRef = useRef<number>(-1);

  const index = desktop ? workspace.desktopOrder.indexOf(desktop.id) : -1;
  if (previousIndexRef.current < 0 && index >= 0) previousIndexRef.current = index;
  const entering =
    desktop && previousIdRef.current && previousIdRef.current !== desktop.id
      ? index >= previousIndexRef.current
        ? 'right'
        : 'left'
      : null;

  useEffect(() => {
    if (!desktop) return;
    previousIdRef.current = desktop.id;
    previousIndexRef.current = index;
  }, [desktop, index]);

  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
  }, [desktop?.id]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let accumulated = 0;
    let cooldownUntil = 0;
    let resetTimer: number | undefined;

    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], .widget, .island-shell, .dock, .modal, .context-menu',
        )
      ) {
        return;
      }
      if (Math.abs(event.deltaX) < 4 || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.05) {
        return;
      }
      event.preventDefault();
      const now = performance.now();
      if (now < cooldownUntil) {
        accumulated = 0;
        return;
      }
      accumulated += event.deltaX;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        accumulated = 0;
      }, 240);
      if (Math.abs(accumulated) < 36) return;
      const state = workspaceStore.getState();
      if (state.desktopOrder.length < 2) return;
      const currentIndex = state.desktopOrder.indexOf(state.activeDesktopId);
      if (currentIndex < 0) return;
      const direction = accumulated > 0 ? 1 : -1;
      const nextIndex =
        (currentIndex + direction + state.desktopOrder.length) % state.desktopOrder.length;
      const nextId = state.desktopOrder[nextIndex];
      if (nextId) {
        setActiveDesktop(nextId);
        cooldownUntil = now + 420;
        accumulated = 0;
      }
    };

    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      stage.removeEventListener('wheel', handleWheel);
      window.clearTimeout(resetTimer);
    };
  }, []);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const measure = () => {
      const next = {
        width: element.offsetWidth,
        height: Math.max(element.offsetHeight, element.scrollHeight),
      };
      setCanvasSize((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [desktop?.id, compact]);

  if (!desktop) return null;

  const clockWidget = widgets.find((widget) => widget.type === 'clock');
  const widgetBottom = widgets.reduce(
    (max, widget) => Math.max(max, widget.y + widget.height),
    0,
  );
  const panelMinHeight =
    !compact && widgetBottom > 0
      ? `max(calc(100dvh - 240px), ${Math.round(widgetBottom + 96)}px)`
      : undefined;

  return (
    <div className="desktop-stage" ref={stageRef}>
      <div className={`desk-canvas${compact ? ' desk-canvas--compact' : ''}`} ref={canvasRef}>
        <div
          className="desk-panel"
          key={desktop.id}
          data-enter={entering ?? undefined}
          style={{ minHeight: panelMinHeight }}
        >
          {compact ? (
            <div className="desk-compact-head">
              {clockWidget ? (
                <ClockWidget
                  widget={clockWidget}
                  compact
                  canvasWidth={canvasSize.width}
                  canvasHeight={canvasSize.height}
                />
              ) : (
                <div className="compact-clock">
                  <strong>{formatClock(now)}</strong>
                  <span>{formatMenuDate(now)}</span>
                </div>
              )}
              <DesktopTabs />
            </div>
          ) : null}
          <BookmarkGrid />
          <WidgetLayer
            compact={compact}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
          />
        </div>
      </div>
    </div>
  );
}
