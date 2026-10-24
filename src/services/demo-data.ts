import { createDefaultSettings, createDefaultPomodoro } from '../utils/defaults';
import { SCHEMA_VERSION } from '../utils/constants';
import { collectBookmarkIdsInFolder } from '../features/bookmarks/tree';
import { createDefaultWidgetsForDesktop } from '../features/layout/widget-layout';
import type { BookmarkNode } from '../types/bookmark';
import type { Desktop } from '../types/desktop';
import type {
  CountdownData,
  NoteData,
  PomodoroState,
  WidgetInstance,
} from '../types/widget';
import type { AppSettings, WallpaperId } from '../types/settings';

function bookmark(id: string, title: string, url: string): BookmarkNode {
  return { id, title, url, parentId: '' };
}

function folder(id: string, title: string, children: BookmarkNode[]): BookmarkNode {
  return { id, title, children };
}

export const DEMO_BOOKMARK_TREE: BookmarkNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '书签栏',
        children: [
          folder('demo-work', '工作', [
            bookmark('demo-linear', 'Linear', 'https://linear.app'),
            bookmark('demo-notion', 'Notion', 'https://www.notion.so'),
            bookmark('demo-github', 'GitHub', 'https://github.com'),
            bookmark('demo-slack', 'Slack', 'https://app.slack.com'),
            bookmark('demo-vercel', 'Vercel', 'https://vercel.com'),
            bookmark('demo-sentry', 'Sentry', 'https://sentry.io'),
            bookmark('demo-feishu', '飞书', 'https://www.feishu.cn'),
            bookmark('demo-linear-docs', 'Linear Docs', 'https://linear.app/docs'),
            bookmark('demo-chrome-docs', 'Chrome 扩展文档', 'https://developer.chrome.com/docs/extensions'),
          ]),
          folder('demo-design', '设计', [
            bookmark('demo-figma', 'Figma', 'https://www.figma.com'),
            bookmark('demo-dribbble', 'Dribbble', 'https://dribbble.com'),
            bookmark('demo-arena', 'Are.na', 'https://www.are.na'),
            bookmark('demo-mobbin', 'Mobbin', 'https://mobbin.com'),
            bookmark('demo-fonts', 'Fonts In Use', 'https://fontsinuse.com'),
            bookmark('demo-coolors', 'Coolors', 'https://coolors.co'),
            bookmark('demo-unsplash', 'Unsplash', 'https://unsplash.com'),
            bookmark('demo-typewolf', 'Typewolf', 'https://www.typewolf.com'),
          ]),
          folder('demo-read', '阅读', [
            bookmark('demo-sspai', '少数派', 'https://sspai.com'),
            bookmark('demo-marginalian', 'The Marginalian', 'https://www.themarginalian.org'),
            bookmark('demo-hn', 'Hacker News', 'https://news.ycombinator.com'),
            bookmark('demo-readwise', 'Readwise', 'https://readwise.io'),
            bookmark('demo-jike', '即刻', 'https://web.okjike.com'),
            bookmark('demo-aeon', 'Aeon', 'https://aeon.co'),
            bookmark('demo-zhubai', '竹白', 'https://zhubai.love'),
            bookmark('demo-sspai-matrix', '少数派 Matrix', 'https://sspai.com/matrix'),
          ]),
          folder('demo-tools', '工具', [
            bookmark('demo-raycast', 'Raycast', 'https://www.raycast.com'),
            bookmark('demo-excalidraw', 'Excalidraw', 'https://excalidraw.com'),
            bookmark('demo-squoosh', 'Squoosh', 'https://squoosh.app'),
            bookmark('demo-tinypng', 'TinyPNG', 'https://tinypng.com'),
            bookmark('demo-jsoncrack', 'JSON Crack', 'https://jsoncrack.com'),
            bookmark('demo-regex101', 'Regex101', 'https://regex101.com'),
            bookmark('demo-caniuse', 'Can I Use', 'https://caniuse.com'),
          ]),
        ],
      },
      {
        id: '2',
        title: '其他书签',
        children: [],
      },
    ],
  },
];

export interface DemoSeed {
  desktops: Desktop[];
  widgets: WidgetInstance[];
  notes: NoteData[];
  countdowns: CountdownData[];
  pomodoro: PomodoroState;
  settings: AppSettings;
}

interface DemoFolder {
  id: string;
  name: string;
  wallpaper: WallpaperId;
}

const DEMO_FOLDERS: DemoFolder[] = [
  { id: 'demo-work', name: '工作', wallpaper: 'dusk' },
  { id: 'demo-design', name: '设计', wallpaper: 'sunrise' },
  { id: 'demo-read', name: '阅读', wallpaper: 'mint' },
  { id: 'demo-tools', name: '工具', wallpaper: 'paper' },
];

export function createDemoSeed(
  now = Date.now(),
  viewport = { width: 1440, height: 900 },
): DemoSeed {
  const desktops: Desktop[] = DEMO_FOLDERS.map((folderInfo) => ({
    id: `desktop-${folderInfo.id}`,
    name: folderInfo.name,
    sourceFolderId: folderInfo.id,
    wallpaper: folderInfo.wallpaper,
    bookmarkIds: collectBookmarkIdsInFolder(DEMO_BOOKMARK_TREE, folderInfo.id),
    createdAt: now - 86_400_000,
    updatedAt: now - 60_000,
  }));

  const notes: NoteData[] = [
    {
      id: 'note-focus',
      title: '本周聚焦',
      content: '· 完成 GlassDesk 首版\n· 验证书签同步的边界场景\n· 把灵动岛的动效再收一点',
      color: 'paper',
      updatedAt: now - 120_000,
    },
    {
      id: 'note-idea',
      title: '灵感',
      content: '玻璃不是装饰，是让内容多一层光。\n给每个桌面留一张自己的壁纸。',
      color: 'apricot',
      updatedAt: now - 3_600_000,
    },
  ];

  const countdowns: CountdownData[] = [
    {
      id: 'countdown-release',
      title: 'GlassDesk v1.0 发布',
      targetTime: now + 12 * 86_400_000 + 4 * 3_600_000,
      completed: false,
      createdAt: now - 86_400_000,
    },
    {
      id: 'countdown-weekend',
      title: '周末出走',
      targetTime: now + 3 * 86_400_000 + 9 * 3_600_000,
      completed: false,
      createdAt: now - 7_200_000,
    },
  ];

  const widgets = desktops.flatMap((desktop, index) => {
    const list = createDefaultWidgetsForDesktop(desktop.id, viewport);
    return list.map((widget) => {
      if (widget.type === 'note') {
        return { ...widget, settings: { noteId: notes[index % notes.length]!.id } };
      }
      if (widget.type === 'countdown') {
        return { ...widget, settings: { countdownId: countdowns[index % countdowns.length]!.id } };
      }
      return widget;
    });
  });

  const settings = createDefaultSettings({
    onboarded: true,
    defaultWallpaper: 'dusk',
    dockPinnedBookmarkIds: [],
    schemaVersion: SCHEMA_VERSION,
  });

  return {
    desktops,
    widgets,
    notes,
    countdowns,
    pomodoro: createDefaultPomodoro(),
    settings,
  };
}
