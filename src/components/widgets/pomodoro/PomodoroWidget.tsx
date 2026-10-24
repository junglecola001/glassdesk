import { useEffect, useRef } from 'react';
import {
  ArrowCounterClockwise,
  Pause,
  Play,
  Timer,
} from '@phosphor-icons/react';
import type { PomodoroPhase, WidgetInstance } from '../../../types/widget';
import { useNow } from '../../../hooks/use-now';
import { setPomodoro, usePomodoro, workspaceStore } from '../../../stores/desktop-store';
import { useStore } from '../../../stores/create-store';
import { pushToast } from '../../../stores/ui-store';
import { formatDuration } from '../../../utils/date';
import { WidgetFrame } from '../common/WidgetFrame';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface PomodoroWidgetProps {
  widget: WidgetInstance;
  compact: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export function PomodoroWidget({ widget, compact, canvasWidth, canvasHeight }: PomodoroWidgetProps) {
  const pomodoro = usePomodoro();
  const hydrated = useStore(workspaceStore, (state) => state.hydrated);
  const now = useNow(pomodoro.running ? 1000 : 30_000);
  const finishingRef = useRef<number | null>(null);

  function phaseMinutes(phase: PomodoroPhase): number {
    return (phase === 'focus' ? pomodoro.settings.focusMinutes : pomodoro.settings.breakMinutes) * 60_000;
  }

  const remaining = pomodoro.running && pomodoro.endsAt
    ? Math.max(0, pomodoro.endsAt - now.getTime())
    : Math.max(0, pomodoro.remainingMs);
  const total = phaseMinutes(pomodoro.phase);
  const progress = Math.max(0, Math.min(1, 1 - remaining / Math.max(1, total)));

  useEffect(() => {
    if (!hydrated || !pomodoro.running || !pomodoro.endsAt) return;
    if (now.getTime() < pomodoro.endsAt) return;
    if (finishingRef.current === pomodoro.endsAt) return;
    finishingRef.current = pomodoro.endsAt;
    const wasFocus = pomodoro.phase === 'focus';
    const nextPhase: PomodoroPhase = wasFocus ? 'break' : 'focus';
    setPomodoro({
      ...pomodoro,
      phase: nextPhase,
      running: false,
      endsAt: null,
      remainingMs: phaseMinutes(nextPhase),
      completedFocus: pomodoro.completedFocus + (wasFocus ? 1 : 0),
    });
    pushToast(wasFocus ? '专注完成，休息一下。' : '休息结束，准备下一轮。', 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, pomodoro, hydrated]);

  function toggleTimer() {
    if (pomodoro.running) {
      const nextRemaining = pomodoro.endsAt
        ? Math.max(0, pomodoro.endsAt - Date.now())
        : pomodoro.remainingMs;
      setPomodoro({
        ...pomodoro,
        running: false,
        endsAt: null,
        remainingMs: nextRemaining,
      });
      return;
    }
    const base = pomodoro.remainingMs > 0 ? pomodoro.remainingMs : phaseMinutes(pomodoro.phase);
    setPomodoro({
      ...pomodoro,
      running: true,
      endsAt: Date.now() + base,
      remainingMs: base,
    });
  }

  function resetTimer() {
    setPomodoro({
      ...pomodoro,
      running: false,
      endsAt: null,
      remainingMs: phaseMinutes(pomodoro.phase),
    });
  }

  function switchPhase(phase: PomodoroPhase) {
    if (phase === pomodoro.phase) return;
    setPomodoro({
      ...pomodoro,
      phase,
      running: false,
      endsAt: null,
      remainingMs: phaseMinutes(phase),
    });
  }

  return (
    <WidgetFrame
      widget={widget}
      title="番茄钟"
      icon={<Timer size={13} />}
      compact={compact}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
    >
      <div className="pomodoro-widget">
        <div className="pomodoro-top">
          <div className="pomodoro-modes" role="group" aria-label="番茄钟模式">
            <button
              type="button"
              className="pomodoro-mode"
              data-active={pomodoro.phase === 'focus'}
              onClick={() => switchPhase('focus')}
            >
              专注
            </button>
            <button
              type="button"
              className="pomodoro-mode"
              data-active={pomodoro.phase === 'break'}
              onClick={() => switchPhase('break')}
            >
              休息
            </button>
          </div>
          <span className="pomodoro-rounds">完成 {pomodoro.completedFocus} 轮</span>
        </div>

        <div className="pomodoro-ring" data-break={pomodoro.phase === 'break'}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="pomodoro-ring__track" cx="60" cy="60" r={RADIUS} />
            <circle
              className="pomodoro-ring__value"
              cx="60"
              cy="60"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          </svg>
          <div className="pomodoro-ring__center">
            <span className="pomodoro-time">{formatDuration(remaining)}</span>
            <span className="pomodoro-phase">
              {pomodoro.phase === 'focus' ? '专注' : '休息'}
              {pomodoro.running ? '中' : ''}
            </span>
          </div>
        </div>

        <div className="pomodoro-controls">
          <button
            type="button"
            className="pomodoro-play"
            aria-label={pomodoro.running ? '暂停番茄钟' : '开始番茄钟'}
            onClick={toggleTimer}
          >
            {pomodoro.running ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" />}
          </button>
          <button
            type="button"
            className="pomodoro-reset"
            aria-label="重置番茄钟"
            title="重置"
            onClick={resetTimer}
          >
            <ArrowCounterClockwise size={14} />
          </button>
        </div>
      </div>
    </WidgetFrame>
  );
}
