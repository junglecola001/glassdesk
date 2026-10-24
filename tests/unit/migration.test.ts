import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../../src/utils/constants';
import {
  createEmptySnapshot,
  createMigrationBackup,
  parsePersistedSnapshot,
  snapshotToRaw,
} from '../../src/utils/migration';
import { STORAGE_KEYS } from '../../src/utils/storage-keys';

describe('storage migration and validation', () => {
  it('creates defaults from empty storage', () => {
    const result = parsePersistedSnapshot({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needsWrite).toBe(true);
    expect(result.snapshot.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.snapshot.settings.glassIntensity).toBe('medium');
    expect(result.snapshot.desktopLayout.desktops).toEqual([]);
    expect(result.snapshot.notes).toEqual([]);
  });

  it('round-trips a snapshot without marking it dirty', () => {
    const snapshot = createEmptySnapshot();
    snapshot.settings.onboarded = true;
    snapshot.desktopLayout.desktops = [
      {
        id: 'd1',
        name: '工作',
        sourceFolderId: 'folder-1',
        wallpaper: 'mint',
        bookmarkIds: ['b1', 'b2'],
        createdAt: 10,
        updatedAt: 20,
      },
    ];
    snapshot.desktopLayout.desktopOrder = ['d1'];
    snapshot.desktopLayout.activeDesktopId = 'd1';
    snapshot.widgets = [
      {
        id: 'w1',
        desktopId: 'd1',
        type: 'clock',
        x: 10,
        y: 20,
        width: 400,
        height: 150,
        zIndex: 1,
        visible: true,
        settings: { showGreeting: true },
      },
    ];
    snapshot.notes = [
      { id: 'n1', title: '标题', content: '内容', color: 'mint', updatedAt: 30 },
    ];
    snapshot.countdowns = [
      { id: 'c1', title: '发布', targetTime: 999999999, completed: false, createdAt: 1 },
    ];
    snapshot.pomodoro.completedFocus = 4;
    snapshot.bookmarkCache = {
      b1: {
        id: 'b1',
        title: 'A',
        url: 'https://a.example',
        parentId: 'folder-1',
        path: ['书签栏', '工作'],
        cachedAt: 5,
      },
    };

    const result = parsePersistedSnapshot(snapshotToRaw(snapshot));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needsWrite).toBe(false);
    expect(result.issues).toEqual([]);
    expect(result.snapshot.desktopLayout.desktops[0]?.name).toBe('工作');
    expect(result.snapshot.desktopLayout.desktopOrder).toEqual(['d1']);
    expect(result.snapshot.widgets[0]?.type).toBe('clock');
    expect(result.snapshot.notes[0]?.color).toBe('mint');
    expect(result.snapshot.pomodoro.completedFocus).toBe(4);
    expect(result.snapshot.bookmarkCache.b1?.url).toBe('https://a.example');
  });

  it('refuses data from a newer schema', () => {
    const result = parsePersistedSnapshot({
      [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION + 5,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('future-version');
  });

  it('sanitises malformed values instead of throwing', () => {
    const raw = {
      [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION,
      [STORAGE_KEYS.settings]: {
        glassIntensity: 'ultra',
        bookmarkSyncMode: 'two-way',
        searchEngine: 'unknown',
        dockPinnedBookmarkIds: ['a', 'a', 42],
        showDesktopDots: 'yes',
      },
      [STORAGE_KEYS.desktopLayout]: {
        desktops: [
          { id: 'd1', name: ' 工作 ', bookmarkIds: ['a', 'a', 3], createdAt: 'bad' },
          { id: 'd1', name: '重复' },
          null,
        ],
        desktopOrder: ['d1', 'missing'],
        activeDesktopId: 'missing',
      },
      [STORAGE_KEYS.widgetsLayout]: [
        { id: 'w1', desktopId: 'd1', type: 'note', x: 'a', settings: { noteId: 9 } },
        { id: 'w2', desktopId: 'unknown', type: 'clock' },
        { id: 'w3', desktopId: 'd1', type: 'clock' },
        { id: 'w4', desktopId: 'd1', type: 'clock' },
      ],
      [STORAGE_KEYS.notes]: [
        { id: 'n1', title: 'A', content: 'x', color: 'neon', updatedAt: -4 },
        { id: 'n1', title: 'B' },
      ],
      [STORAGE_KEYS.countdowns]: [
        { id: 'c1', title: '过期', targetTime: 10, completed: 'yes' },
        { id: 'c2', targetTime: -1 },
      ],
      [STORAGE_KEYS.pomodoro]: {
        phase: 'party',
        running: true,
        endsAt: 'never',
        remainingMs: -10,
        settings: { focusMinutes: 0, breakMinutes: 999 },
      },
      [STORAGE_KEYS.bookmarkCache]: { bad: { id: 'x' }, good: { id: 'g', url: 'https://g' } },
    };

    const result = parsePersistedSnapshot(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.settings.glassIntensity).toBe('medium');
    expect(result.snapshot.settings.bookmarkSyncMode).toBe('follow');
    expect(result.snapshot.settings.dockPinnedBookmarkIds).toEqual(['a']);
    expect(result.snapshot.desktopLayout.desktops).toHaveLength(1);
    expect(result.snapshot.desktopLayout.desktops[0]?.bookmarkIds).toEqual(['a']);
    expect(result.snapshot.desktopLayout.activeDesktopId).toBe('d1');
    expect(result.snapshot.widgets).toHaveLength(2);
    expect(result.snapshot.widgets.filter((widget) => widget.type === 'clock')).toHaveLength(1);
    expect(result.snapshot.notes).toHaveLength(1);
    expect(result.snapshot.notes[0]?.color).toBe('paper');
    expect(result.snapshot.countdowns).toHaveLength(1);
    expect(result.snapshot.pomodoro.phase).toBe('focus');
    expect(result.snapshot.pomodoro.running).toBe(false);
    expect(result.snapshot.pomodoro.settings.focusMinutes).toBe(1);
    expect(result.snapshot.pomodoro.settings.breakMinutes).toBe(60);
    expect(result.snapshot.bookmarkCache.g?.url).toBe('https://g');
    expect(result.snapshot.bookmarkCache.bad).toBeUndefined();
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('migrates legacy data that only has a settings schema version', () => {
    const raw = {
      settings: {
        schemaVersion: 0,
        glassIntensity: 'high',
        onboarded: true,
      },
      [STORAGE_KEYS.desktopLayout]: {
        desktops: [
          {
            id: 'legacy',
            name: '旧桌面',
            sourceFolderId: null,
            bookmarkIds: [],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        desktopOrder: ['legacy'],
        activeDesktopId: 'legacy',
      },
    };
    const result = parsePersistedSnapshot(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needsWrite).toBe(true);
    expect(result.snapshot.settings.glassIntensity).toBe('high');
    expect(result.snapshot.desktopLayout.desktops[0]?.name).toBe('旧桌面');
  });

  it('wraps raw data in a migration backup', () => {
    const raw = { [STORAGE_KEYS.settings]: { glassIntensity: 'low' } };
    const backup = createMigrationBackup(raw, 'test');
    expect(backup.raw).toEqual(raw);
    expect(backup.reason).toBe('test');
    expect(typeof backup.createdAt).toBe('number');
  });
});
