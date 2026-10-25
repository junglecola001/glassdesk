import { expect, test } from '@playwright/test';
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const runExtensionTests = process.env.GLASSDESK_EXT === '1';

test.describe('MV3 extension', () => {
  test.skip(!runExtensionTests, 'Run with GLASSDESK_EXT=1 after `npm run build`.');

  test('onboards from folders, follows bookmark changes, overrides new tab', async () => {
    test.setTimeout(90_000);
    const userDataDir = mkdtempSync(join(tmpdir(), 'glassdesk-e2e-ext-'));
    const extensionPath = resolve(process.cwd(), 'dist');
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: (process.env.PLAYWRIGHT_CHANNEL ?? 'msedge') as 'msedge',
      headless: true,
      viewport: { width: 1440, height: 900 },
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
      ],
    });

    try {
      let [worker] = context.serviceWorkers();
      if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
      const extensionId = new URL(worker.url()).host;
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      await page.goto(`chrome-extension://${extensionId}/newtab.html`);
      await expect(page.locator('.onboarding')).toBeVisible();

      const folderIds = await page.evaluate(async () => {
        const tree = await chrome.bookmarks.getTree();
        const bar = tree[0]?.children?.find((child) => child.id === '1') ?? tree[0]?.children?.[0];
        if (!bar) throw new Error('No bookmark bar');
        const work = await chrome.bookmarks.create({ parentId: bar.id, title: '工作' });
        const design = await chrome.bookmarks.create({ parentId: bar.id, title: '设计' });
        await chrome.bookmarks.create({
          parentId: work.id,
          title: 'Linear',
          url: 'https://linear.app',
        });
        await chrome.bookmarks.create({
          parentId: work.id,
          title: 'Notion',
          url: 'https://www.notion.so',
        });
        await chrome.bookmarks.create({
          parentId: design.id,
          title: 'Figma',
          url: 'https://www.figma.com',
        });
        await chrome.bookmarks.create({
          parentId: design.id,
          title: 'Missing Site',
          url: 'https://glassdesk-missing.invalid/',
        });
        return { work: work.id, design: design.id };
      });

      await page.reload();
      await expect(page.locator('.onboarding .folder-option')).toHaveCount(2);
      await page.locator('.onboarding__actions .btn--primary').click();
      await expect(page.locator('.bookmarks-title')).toHaveText('工作');
      await expect(page.locator('.bookmark')).toHaveCount(2);
      await expect(page.locator('.desktop-dot')).toHaveCount(2);

      await page.locator('.desktop-dot').nth(1).click();
      await expect(page.locator('.bookmarks-title')).toHaveText('设计');
      const missingTile = page.locator('.bookmark').filter({ hasText: 'Missing Site' });
      await expect(missingTile.locator('.bookmark-icon')).toContainText('M');
      await page.waitForTimeout(2_500);
      await expect(missingTile.locator('.bookmark-favicon.is-ready')).toHaveCount(0);
      await page.locator('.desktop-dot').nth(0).click();
      await expect(page.locator('.bookmarks-title')).toHaveText('工作');

      await page.evaluate(async (workId) => {
        await chrome.bookmarks.create({
          parentId: workId,
          title: 'Figma Community',
          url: 'https://www.figma.com/community',
        });
      }, folderIds.work);
      await expect(page.locator('.bookmark-label').filter({ hasText: 'Figma Community' })).toBeVisible({
        timeout: 8_000,
      });

      const storageKeys = await page.evaluate(async () => Object.keys(await chrome.storage.local.get(null)));
      expect(storageKeys).toEqual(
        expect.arrayContaining([
          'settings',
          'desktop-layout',
          'bookmark-layout',
          'widgets-layout',
          'notes',
          'countdowns',
          'pomodoro',
          'bookmark-cache',
          'storage-schema-version',
        ]),
      );

      const newTabPage = await context.newPage();
      await newTabPage.goto('chrome://newtab/');
      await expect(newTabPage).toHaveURL(new RegExp(`chrome-extension://${extensionId}/newtab.html`));
      await expect(newTabPage).toHaveTitle('GlassDesk');

      expect(errors).toEqual([]);
    } finally {
      await context.close();
      rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
