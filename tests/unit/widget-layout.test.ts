import { describe, expect, it } from 'vitest';
import {
  CANVAS_PADDING,
  clampWidgetPosition,
  createDefaultWidgetsForDesktop,
  createWidget,
  isCompactViewport,
} from '../../src/features/layout/widget-layout';

const viewport = { width: 1440, height: 900 };

describe('widget layout', () => {
  it('creates a clock only when one does not exist', () => {
    const first = createWidget('clock', 'd1', viewport, []);
    expect(first?.type).toBe('clock');
    expect(first?.x).toBe(CANVAS_PADDING);
    const second = createWidget('clock', 'd1', viewport, first ? [first] : []);
    expect(second).toBeNull();
  });

  it('places new rail widgets below existing ones', () => {
    const defaults = createDefaultWidgetsForDesktop('d1', viewport);
    const widget = createWidget('pomodoro', 'd1', viewport, defaults);
    expect(widget).not.toBeNull();
    const lowest = Math.max(...defaults.filter((item) => item.type !== 'clock').map((item) => item.y + item.height));
    expect(widget?.y).toBeGreaterThanOrEqual(lowest + 14);
    expect(widget?.x).toBeGreaterThan(800);
  });

  it('clamps positions to the canvas', () => {
    expect(clampWidgetPosition(-30, -20, 300, 1200, 800)).toEqual({ x: 8, y: 8 });
    expect(clampWidgetPosition(9999, 9999, 300, 1200, 800)).toEqual({ x: 892, y: 720 });
    expect(clampWidgetPosition(100, 200, 300, 1200, 800)).toEqual({ x: 100, y: 200 });
  });

  it('detects compact viewports', () => {
    expect(isCompactViewport(900)).toBe(true);
    expect(isCompactViewport(1040)).toBe(false);
  });

  it('creates default clock, note and countdown widgets', () => {
    const widgets = createDefaultWidgetsForDesktop('d1', viewport);
    expect(widgets.map((widget) => widget.type)).toEqual(['clock', 'note', 'countdown']);
    expect(new Set(widgets.map((widget) => widget.id)).size).toBe(3);
  });
});
