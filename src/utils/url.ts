const HUE_POOL = [214, 196, 168, 42, 16, 268, 332];

export function isLikelyUrl(input: string): boolean {
  const value = input.trim();
  if (!value || /\s/.test(value)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return true;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(value)) return true;
  return /^[^\s/]+\.[a-z]{2,}(?::\d+)?(\/|$)/i.test(value);
}

export function toNavigableUrl(input: string): string {
  const value = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return `https://${value}`;
}

export function hostnameOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function siteLetter(title: string, url: string): string {
  const cleaned = title.trim();
  if (cleaned) {
    const char = Array.from(cleaned)[0];
    if (char && /[\p{L}\p{N}]/u.test(char)) return char.toUpperCase();
  }
  const host = hostnameOf(url);
  const first = Array.from(host.replace(/^www\./, ''))[0];
  return (first ?? '·').toUpperCase();
}

export function siteHue(url: string, title = ''): number {
  const seed = `${hostnameOf(url)}|${title}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return HUE_POOL[hash % HUE_POOL.length] ?? 214;
}

export function prettyUrl(url: string): string {
  return hostnameOf(url) || url.replace(/^https?:\/\//, '');
}
