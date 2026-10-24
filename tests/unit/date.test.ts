import { describe, expect, it } from 'vitest';
import {
  countdownParts,
  formatCountdownShort,
  formatDuration,
  greetingForHour,
} from '../../src/utils/date';

describe('date helpers', () => {
  it('breaks a duration into countdown parts', () => {
    expect(countdownParts(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
    expect(countdownParts(1000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
      expired: false,
    });
    const parts = countdownParts(
      2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000,
    );
    expect(parts).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, expired: false });
  });

  it('formats short countdown labels', () => {
    expect(formatCountdownShort(0)).toBe('已到期');
    expect(formatCountdownShort(2 * 86_400_000)).toBe('2 天');
    expect(formatCountdownShort(3 * 3_600_000)).toBe('3 小时');
    expect(formatCountdownShort(5 * 60_000)).toBe('5 分钟');
    expect(formatCountdownShort(30_000)).toBe('不到 1 分钟');
  });

  it('formats timer durations', () => {
    expect(formatDuration(25 * 60_000)).toBe('25:00');
    expect(formatDuration(61_000)).toBe('01:01');
    expect(formatDuration(3_661_000)).toBe('1:01:01');
    expect(formatDuration(-1)).toBe('00:00');
  });

  it('greets by hour', () => {
    expect(greetingForHour(6)).toBe('早上好');
    expect(greetingForHour(10)).toBe('上午好');
    expect(greetingForHour(13)).toBe('中午好');
    expect(greetingForHour(16)).toBe('下午好');
    expect(greetingForHour(20)).toBe('晚上好');
    expect(greetingForHour(2)).toBe('夜深了');
  });
});
