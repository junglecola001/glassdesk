import type { WidgetInstance, WidgetType } from '../../types/widget';
import { createId } from '../../utils/id';

export const CANVAS_MAX_WIDTH = 3840;
export const CANVAS_PADDING = 20;
export const RAIL_WIDTH = 300;
export const COMPACT_BREAKPOINT = 1040;

const DEFAULT_SIZES: Record<WidgetType, { width: number; height: number }> = {
  clock: { width: 300, height: 170 },
  note: { width: 300, height: 280 },
  countdown: { width: 300, height: 252 },
  pomodoro: { width: 300, height: 252 },
  search: { width: 300, height: 132 },
};

export interface ViewportSize {
  width: number;
  height: number;
}

export function canvasWidthFor(viewportWidth: number): number {
  return Math.min(CANVAS_MAX_WIDTH, Math.max(320, viewportWidth));
}

export function isCompactViewport(width: number): boolean {
  return width < COMPACT_BREAKPOINT;
}

interface WidgetBase {
  id: string;
  desktopId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  visible: boolean;
}

function baseWidget(
  type: WidgetType,
  desktopId: string,
  x: number,
  y: number,
  zIndex: number,
): WidgetBase {
  const size = DEFAULT_SIZES[type];
  return {
    id: createId('widget'),
    desktopId,
    x,
    y,
    width: size.width,
    height: size.height,
    zIndex,
    visible: true,
  };
}

export function createWidget(
  type: WidgetType,
  desktopId: string,
  _viewport: ViewportSize,
  existing: WidgetInstance[],
): WidgetInstance | null {
  if (type === 'clock' && existing.some((widget) => widget.type === 'clock')) return null;
  const zIndex = nextZIndex(existing);
  const x = CANVAS_PADDING;
  const bottom = existing.reduce(
    (max, widget) => Math.max(max, widget.y + widget.height),
    0,
  );
  const y = existing.length > 0 ? bottom + 14 : 16;

  if (type === 'clock') {
    return { ...baseWidget(type, desktopId, x, y, zIndex), type: 'clock', settings: { showGreeting: true } };
  }
  if (type === 'note') {
    return { ...baseWidget(type, desktopId, x, y, zIndex), type: 'note', settings: { noteId: null } };
  }
  if (type === 'countdown') {
    return {
      ...baseWidget(type, desktopId, x, y, zIndex),
      type: 'countdown',
      settings: { countdownId: null },
    };
  }
  if (type === 'pomodoro') {
    return { ...baseWidget(type, desktopId, x, y, zIndex), type: 'pomodoro', settings: {} };
  }
  return { ...baseWidget(type, desktopId, x, y, zIndex), type: 'search', settings: {} };
}

export function createDefaultWidgetsForDesktop(
  desktopId: string,
  _viewport: ViewportSize,
  options: { includePomodoro?: boolean } = {},
): WidgetInstance[] {
  const widgets: WidgetInstance[] = [
    {
      ...baseWidget('note', desktopId, CANVAS_PADDING, 16, 1),
      type: 'note',
      settings: { noteId: null },
    },
    {
      ...baseWidget('countdown', desktopId, CANVAS_PADDING, 310, 2),
      type: 'countdown',
      settings: { countdownId: null },
    },
  ];
  if (options.includePomodoro) {
    widgets.push({
      ...baseWidget('pomodoro', desktopId, CANVAS_PADDING, 576, 3),
      type: 'pomodoro',
      settings: {},
    });
  }
  return widgets;
}

export function nextZIndex(widgets: WidgetInstance[]): number {
  return widgets.reduce((max, widget) => Math.max(max, widget.zIndex), 0) + 1;
}

export function clampWidgetPosition(
  x: number,
  y: number,
  width: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  const maxX = Math.max(8, canvasWidth - width - 8);
  const maxY = Math.max(8, canvasHeight - 80);
  return {
    x: Math.min(maxX, Math.max(8, Math.round(x))),
    y: Math.min(maxY, Math.max(8, Math.round(y))),
  };
}

export function widgetLabel(type: WidgetType): string {
  switch (type) {
    case 'clock':
      return '时钟';
    case 'note':
      return '便签';
    case 'countdown':
      return '倒计时';
    case 'pomodoro':
      return '番茄钟';
    case 'search':
      return '快速搜索';
  }
}
