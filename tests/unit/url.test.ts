import { describe, expect, it } from 'vitest';
import { hostnameOf, isLikelyUrl, prettyUrl, siteHue, siteLetter, toNavigableUrl } from '../../src/utils/url';

describe('url helpers', () => {
  it('recognises URLs and search queries', () => {
    expect(isLikelyUrl('https://linear.app')).toBe(true);
    expect(isLikelyUrl('linear.app/docs')).toBe(true);
    expect(isLikelyUrl('localhost:5173')).toBe(true);
    expect(isLikelyUrl('127.0.0.1:8080/path')).toBe(true);
    expect(isLikelyUrl('hello world')).toBe(false);
    expect(isLikelyUrl('笔记')).toBe(false);
    expect(isLikelyUrl('')).toBe(false);
  });

  it('adds a scheme only when needed', () => {
    expect(toNavigableUrl('linear.app')).toBe('https://linear.app');
    expect(toNavigableUrl('https://linear.app')).toBe('https://linear.app');
    expect(toNavigableUrl('mailto:hi@example.com')).toBe('mailto:hi@example.com');
  });

  it('extracts hostnames and pretty URLs', () => {
    expect(hostnameOf('https://www.notion.so/workspace')).toBe('notion.so');
    expect(prettyUrl('https://www.notion.so/workspace')).toBe('notion.so');
    expect(hostnameOf('not a url')).toBe('');
  });

  it('generates deterministic site marks', () => {
    expect(siteLetter('Linear', 'https://linear.app')).toBe('L');
    expect(siteLetter('', 'https://www.figma.com')).toBe('F');
    expect(siteLetter('少数派', 'https://sspai.com')).toBe('少');
    expect(siteHue('https://linear.app', 'Linear')).toBe(siteHue('https://linear.app', 'Linear'));
    expect(siteHue('https://linear.app', 'Linear')).toBeGreaterThanOrEqual(0);
    expect(siteHue('https://linear.app', 'Linear')).toBeLessThan(360);
  });
});
