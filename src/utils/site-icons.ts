const LOCAL_FAVICONS: Record<string, string> = {
  'linear.app': 'linear.app.png',
  'notion.so': 'notion.so.png',
  'github.com': 'github.com.png',
  'slack.com': 'slack.com.png',
  'vercel.com': 'vercel.com.png',
  'sentry.io': 'sentry.io.png',
  'feishu.cn': 'feishu.cn.png',
  'developer.chrome.com': 'developer.chrome.com.png',
  'chrome.com': 'chrome.com.png',
  'figma.com': 'figma.com.png',
  'dribbble.com': 'dribbble.com.png',
  'are.na': 'are.na.png',
  'mobbin.com': 'mobbin.com.png',
  'fontsinuse.com': 'fontsinuse.com.png',
  'coolors.co': 'coolors.co.png',
  'unsplash.com': 'unsplash.com.png',
  'typewolf.com': 'typewolf.com.png',
  'sspai.com': 'sspai.com.png',
  'themarginalian.org': 'themarginalian.org.png',
  'news.ycombinator.com': 'news.ycombinator.com.png',
  'readwise.io': 'readwise.io.png',
  'okjike.com': 'okjike.com.png',
  'aeon.co': 'aeon.co.png',
  'raycast.com': 'raycast.com.png',
  'excalidraw.com': 'excalidraw.com.png',
  'squoosh.app': 'squoosh.app.png',
  'tinypng.com': 'tinypng.com.png',
  'jsoncrack.com': 'jsoncrack.com.png',
  'regex101.com': 'regex101.com.png',
  'caniuse.com': 'caniuse.com.png',
  'google.com': 'google.com.png',
};

export function localFavicon(hostname: string | null | undefined): string | null {
  if (!hostname) return null;
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  for (const [key, file] of Object.entries(LOCAL_FAVICONS)) {
    if (host === key || host.endsWith(`.${key}`)) return `/favicons/${file}`;
  }
  return null;
}
