import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  CheckCircle,
  Hourglass,
  PencilSimple,
  Plus,
} from '@phosphor-icons/react';
import type { CountdownData, WidgetInstance } from '../../../types/widget';
import { useNow } from '../../../hooks/use-now';
import { useConfirmAction } from '../../../hooks/use-confirm-action';
import {
  addCountdown,
  deleteCountdown,
  updateCountdown,
  updateWidget,
  useCountdowns,
} from '../../../stores/desktop-store';
import { countdownParts, pad2 } from '../../../utils/date';
import { pushToast } from '../../../stores/ui-store';
import { useStore } from '../../../stores/create-store';
import { workspaceStore } from '../../../stores/desktop-store';
import { WidgetFrame } from '../common/WidgetFrame';

function toLocalInput(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
}

function formatTarget(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(timestamp);
}

function defaultTarget(): number {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(20, 0, 0, 0);
  return date.getTime();
}

interface CountdownWidgetProps {
  widget: WidgetInstance;
  compact: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export function CountdownWidget({ widget, compact, canvasWidth, canvasHeight }: CountdownWidgetProps) {
  const countdowns = useCountdowns();
  const activeCountdown =
    countdowns.find(
      (countdown) =>
        countdown.id === (widget.type === 'countdown' ? widget.settings.countdownId : null),
    ) ??
    countdowns.find((countdown) => !countdown.completed) ??
    countdowns[0] ??
    null;
  const now = useNow(activeCountdown && !activeCountdown.completed ? 1000 : 30_000);
  const hydrated = useStore(workspaceStore, (state) => state.hydrated);
  const completedRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<'new' | string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formTarget, setFormTarget] = useState(toLocalInput(defaultTarget()));
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!hydrated || !activeCountdown || activeCountdown.completed) return;
    if (now.getTime() < activeCountdown.targetTime) return;
    if (completedRef.current === activeCountdown.id) return;
    completedRef.current = activeCountdown.id;
    updateCountdown(activeCountdown.id, { completed: true });
    pushToast(`「${activeCountdown.title}」已到期。`, 'info');
  }, [activeCountdown, now, hydrated]);

  function startAdd() {
    setEditingId('new');
    setFormTitle('');
    setFormTarget(toLocalInput(defaultTarget()));
    setFormError('');
  }

  function startEdit(countdown: CountdownData) {
    setEditingId(countdown.id);
    setFormTitle(countdown.title);
    setFormTarget(toLocalInput(countdown.targetTime));
    setFormError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setFormError('');
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = new Date(formTarget).getTime();
    if (!Number.isFinite(target)) {
      setFormError('请选择日期和时间。');
      return;
    }
    if (target <= Date.now()) {
      setFormError('请选择一个未来时间。');
      return;
    }
    const title = formTitle.trim() || '新倒计时';
    if (editingId === 'new') {
      const id = addCountdown(title, target);
      updateWidget(widget.id, (current) =>
        current.type === 'countdown' ? { ...current, settings: { countdownId: id } } : current,
      );
    } else if (editingId) {
      updateCountdown(editingId, { title, targetTime: target, completed: false });
    }
    setEditingId(null);
    setFormError('');
  }

  const deletion = useConfirmAction(() => {
    if (typeof editingId === 'string') {
      deleteCountdown(editingId);
      setEditingId(null);
    }
  });

  const remaining = activeCountdown
    ? Math.max(0, activeCountdown.targetTime - now.getTime())
    : 0;
  const parts = countdownParts(remaining);
  const expired = Boolean(activeCountdown) && remaining <= 0;
  const total = activeCountdown
    ? Math.max(1, activeCountdown.targetTime - activeCountdown.createdAt)
    : 1;
  const progress = activeCountdown
    ? activeCountdown.completed
      ? 100
      : Math.max(0, Math.min(100, ((now.getTime() - activeCountdown.createdAt) / total) * 100))
    : 0;

  return (
    <WidgetFrame
      widget={widget}
      title="倒计时"
      icon={<Hourglass size={13} />}
      compact={compact}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
    >
      {editingId ? (
        <form className="countdown-form" onSubmit={save}>
          <input
            className="input"
            value={formTitle}
            placeholder="倒计时的名字"
            aria-label="倒计时标题"
            maxLength={80}
            onChange={(event) => setFormTitle(event.target.value)}
          />
          <input
            className="input"
            type="datetime-local"
            value={formTarget}
            min={toLocalInput(Date.now())}
            aria-label="目标时间"
            onChange={(event) => setFormTarget(event.target.value)}
          />
          {formError ? <span className="countdown-error">{formError}</span> : null}
          <div className="countdown-form__actions">
            <button type="submit" className="btn btn--primary btn--small">
              保存
            </button>
            <button type="button" className="btn btn--glass btn--small" onClick={cancelEdit}>
              取消
            </button>
            {editingId !== 'new' ? (
              <button
                type="button"
                className="btn btn--danger btn--small"
                data-armed={deletion.armed}
                onClick={deletion.trigger}
              >
                {deletion.armed ? '确认删除' : '删除'}
              </button>
            ) : null}
          </div>
        </form>
      ) : activeCountdown ? (
        <div className="countdown-widget">
          <div className="countdown-top">
            {countdowns.length > 1 ? (
              <select
                className="countdown-switcher"
                value={activeCountdown.id}
                aria-label="选择倒计时"
                onChange={(event) =>
                  updateWidget(widget.id, (current) =>
                    current.type === 'countdown'
                      ? { ...current, settings: { countdownId: event.target.value } }
                      : current,
                  )
                }
              >
                {countdowns.map((countdown) => (
                  <option key={countdown.id} value={countdown.id}>
                    {countdown.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="countdown-title">{activeCountdown.title}</span>
            )}
            <button
              type="button"
              className="countdown-icon-button"
              aria-label="新建倒计时"
              title="新建倒计时"
              onClick={startAdd}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className="countdown-icon-button"
              aria-label="编辑倒计时"
              title="编辑倒计时"
              onClick={() => startEdit(activeCountdown)}
            >
              <PencilSimple size={13} />
            </button>
          </div>

          {activeCountdown.completed ? (
            <div className="countdown-complete">
              <CheckCircle size={20} weight="fill" />
              <span>已完成</span>
            </div>
          ) : (
            <div className="countdown-main">
              <span className="countdown-days">{parts.days}</span>
              <span className="countdown-days-label">天</span>
              <span
                className={`countdown-clock${expired ? ' countdown-clock--expired' : ''}`}
              >
                {expired
                  ? '已到期'
                  : `${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`}
              </span>
            </div>
          )}

          <div className="countdown-target">目标 {formatTarget(activeCountdown.targetTime)}</div>
          <div className="countdown-progress" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="countdown-footer">
            <span className="countdown-footer__text">
              {activeCountdown.completed
                ? '这件事已经完成'
                : expired
                  ? '时间到了，可以标记完成'
                  : `已走过 ${Math.round(progress)}%`}
            </span>
            {expired && !activeCountdown.completed ? (
              <button
                type="button"
                className="btn btn--glass btn--small"
                onClick={() => updateCountdown(activeCountdown.id, { completed: true })}
              >
                标记完成
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="countdown-empty">
          <strong>还没有倒计时</strong>
          <span>用绝对时间记录一个值得期待的日子。</span>
          <button type="button" className="btn btn--glass btn--small" onClick={startAdd}>
            <Plus size={13} />
            添加倒计时
          </button>
        </div>
      )}
    </WidgetFrame>
  );
}
