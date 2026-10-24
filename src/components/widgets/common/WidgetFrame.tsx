import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { DotsSixVertical, X } from '@phosphor-icons/react';
import type { WidgetInstance } from '../../../types/widget';
import {
  bringWidgetToFront,
  moveWidget,
  removeWidget,
} from '../../../stores/desktop-store';
import { clampWidgetPosition } from '../../../features/layout/widget-layout';
import { REVEAL_WIDGET_EVENT } from '../../../utils/events';

interface WidgetFrameProps {
  widget: WidgetInstance;
  title: string;
  icon: ReactNode;
  variant?: 'glass' | 'bare';
  className?: string;
  dataAttributes?: Record<string, string>;
  compact: boolean;
  canvasWidth: number;
  canvasHeight: number;
  children: ReactNode;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

export function WidgetFrame({
  widget,
  title,
  icon,
  variant = 'glass',
  className = '',
  dataAttributes,
  compact,
  canvasWidth,
  canvasHeight,
  children,
}: WidgetFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const handleReveal = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string }>).detail;
      if (!detail || detail.type !== widget.type) return;
      const reduceMotion =
        document.documentElement.dataset.motion === 'reduced' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      frameRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1100);
      window.setTimeout(() => {
        const focusable = frameRef.current?.querySelector<HTMLElement>(
          'textarea, input, [contenteditable="true"]',
        );
        focusable?.focus();
      }, 300);
    };
    window.addEventListener(REVEAL_WIDGET_EVENT, handleReveal);
    return () => window.removeEventListener(REVEAL_WIDGET_EVENT, handleReveal);
  }, [widget.type]);

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (compact || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
    };
    setOffset({ x: 0, y: 0 });
  }

  function updateDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.dx = event.clientX - drag.startX;
    drag.dy = event.clientY - drag.startY;
    setOffset({ x: drag.dx, y: drag.dy });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setOffset(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (Math.abs(drag.dx) < 3 && Math.abs(drag.dy) < 3) return;
    const next = clampWidgetPosition(
      widget.x + drag.dx,
      widget.y + drag.dy,
      widget.width,
      canvasWidth,
      canvasHeight,
    );
    moveWidget(widget.id, next.x, next.y);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (compact) return;
    const step = event.shiftKey ? 32 : 8;
    const deltas: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = clampWidgetPosition(
      widget.x + delta.x,
      widget.y + delta.y,
      widget.width,
      canvasWidth,
      canvasHeight,
    );
    moveWidget(widget.id, next.x, next.y);
  }

  const style: CSSProperties = compact
    ? {}
    : {
        left: Math.min(widget.x, Math.max(8, canvasWidth - widget.width - 8)),
        top: Math.max(0, widget.y),
        width: widget.width,
        zIndex: widget.zIndex,
        ...(variant === 'glass' ? { height: widget.height } : {}),
        ...(offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : {}),
      };

  return (
    <div
      ref={frameRef}
      className={[
        'widget',
        variant === 'glass' ? 'widget--glass glass' : 'widget--bare',
        offset ? 'widget--dragging' : '',
        flash ? 'widget--flash' : '',
        compact ? 'widget--flow' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-widget-id={widget.id}
      data-widget-type={widget.type}
      {...dataAttributes}
      onClick={() => bringWidgetToFront(widget.id)}
    >
      <div
        className="widget__header"
        role="button"
        tabIndex={compact ? -1 : 0}
        aria-label={`移动${title}小组件，方向键可微调位置`}
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
        {variant === 'bare' ? (
          <span className="widget__grip" aria-hidden="true">
            <DotsSixVertical size={14} />
          </span>
        ) : (
          <span className="widget__title">
            {icon}
            {title}
          </span>
        )}
        <span className="widget__spacer" />
        <button
          type="button"
          className="widget__action"
          aria-label={`移除${title}小组件`}
          title="移除小组件"
          onClick={(event) => {
            event.stopPropagation();
            removeWidget(widget.id);
          }}
        >
          <X size={13} />
        </button>
      </div>
      <div className="widget__body">{children}</div>
    </div>
  );
}
