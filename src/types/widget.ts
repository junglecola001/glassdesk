export type WidgetType = 'clock' | 'note' | 'countdown' | 'pomodoro' | 'search';

interface WidgetInstanceBase {
  id: string;
  desktopId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  visible: boolean;
}

export interface ClockWidgetSettings {
  showGreeting: boolean;
}

export interface NoteWidgetSettings {
  noteId: string | null;
}

export interface CountdownWidgetSettings {
  countdownId: string | null;
}

export type PomodoroWidgetSettings = Record<string, never>;
export type SearchWidgetSettings = Record<string, never>;

export type WidgetInstance =
  | (WidgetInstanceBase & { type: 'clock'; settings: ClockWidgetSettings })
  | (WidgetInstanceBase & { type: 'note'; settings: NoteWidgetSettings })
  | (WidgetInstanceBase & { type: 'countdown'; settings: CountdownWidgetSettings })
  | (WidgetInstanceBase & { type: 'pomodoro'; settings: PomodoroWidgetSettings })
  | (WidgetInstanceBase & { type: 'search'; settings: SearchWidgetSettings });

export type NoteColor = 'paper' | 'apricot' | 'mint' | 'lilac';

export interface NoteData {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  updatedAt: number;
}

export interface CountdownData {
  id: string;
  title: string;
  targetTime: number;
  completed: boolean;
  createdAt: number;
}

export interface PomodoroSettings {
  focusMinutes: number;
  breakMinutes: number;
}

export type PomodoroPhase = 'focus' | 'break';

/**
 * Running timers are stored as an absolute end timestamp. `remainingMs` is only
 * meaningful while paused, so a closed tab or sleeping machine cannot drift.
 */
export interface PomodoroState {
  phase: PomodoroPhase;
  running: boolean;
  endsAt: number | null;
  remainingMs: number;
  completedFocus: number;
  settings: PomodoroSettings;
}
