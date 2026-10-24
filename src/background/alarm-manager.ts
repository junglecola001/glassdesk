import type { CountdownData } from '../types/widget';

export const COUNTDOWN_ALARM = 'glassdesk-countdown-reminder';

/**
 * System notifications are intentionally not part of the v1 permission set.
 * This module is the seam for enabling countdown reminders later: once the
 * manifest adds "alarms" and "notifications", the service worker can call
 * syncCountdownAlarm without touching any other code.
 */
export function systemRemindersAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.alarms !== 'undefined' &&
    typeof chrome.notifications !== 'undefined'
  );
}

export function selectNextCountdown(
  countdowns: CountdownData[],
  now = Date.now(),
): CountdownData | null {
  let next: CountdownData | null = null;
  for (const countdown of countdowns) {
    if (countdown.completed) continue;
    if (countdown.targetTime <= now) continue;
    if (!next || countdown.targetTime < next.targetTime) next = countdown;
  }
  return next;
}

export function countdownAlarmOptions(
  countdowns: CountdownData[],
  now = Date.now(),
): { when: number } | null {
  const next = selectNextCountdown(countdowns, now);
  return next ? { when: next.targetTime } : null;
}

export async function syncCountdownAlarm(
  countdowns: CountdownData[],
  now = Date.now(),
): Promise<void> {
  if (!systemRemindersAvailable()) return;
  await chrome.alarms.clear(COUNTDOWN_ALARM);
  const options = countdownAlarmOptions(countdowns, now);
  if (options) chrome.alarms.create(COUNTDOWN_ALARM, options);
}

export async function notifyForAlarm(
  alarmName: string,
  countdowns: CountdownData[],
  now = Date.now(),
): Promise<string | null> {
  if (alarmName !== COUNTDOWN_ALARM || !systemRemindersAvailable()) return null;
  const due = countdowns.find(
    (countdown) => !countdown.completed && Math.abs(countdown.targetTime - now) < 60_000,
  );
  if (!due) return null;
  await chrome.notifications.create(`glassdesk-${due.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: '倒计时到期',
    message: due.title,
    priority: 1,
  });
  return due.id;
}
