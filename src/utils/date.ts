const clockFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const secondsFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

const menuDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

export function formatClock(date: Date, withSeconds = false): string {
  return (withSeconds ? secondsFormatter : clockFormatter).format(date);
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatMenuDate(date: Date): string {
  const parts = menuDateFormatter.formatToParts(date);
  const monthDay = parts
    .filter((part) => part.type === 'month' || part.type === 'day' || part.type === 'literal')
    .map((part) => part.value)
    .join('');
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  return `${monthDay} ${weekday}`.trim();
}

export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 9) return '早上好';
  if (hour >= 9 && hour < 12) return '上午好';
  if (hour >= 12 && hour < 14) return '中午好';
  if (hour >= 14 && hour < 18) return '下午好';
  if (hour >= 18 && hour < 23) return '晚上好';
  return '夜深了';
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const delta = now - timestamp;
  if (delta < 45_000) return '刚刚';
  if (delta < 3_600_000) return `${Math.max(1, Math.round(delta / 60_000))} 分钟前`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} 小时前`;
  if (delta < 172_800_000) return '昨天';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(timestamp);
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export function countdownParts(remainingMs: number): CountdownParts {
  const remaining = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    expired: remaining <= 0,
  };
}

export function formatCountdownShort(remainingMs: number): string {
  const parts = countdownParts(remainingMs);
  if (parts.expired) return '已到期';
  if (parts.days > 0) return `${parts.days} 天`;
  if (parts.hours > 0) return `${parts.hours} 小时`;
  if (parts.minutes > 0) return `${parts.minutes} 分钟`;
  return '不到 1 分钟';
}

export function formatDuration(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
