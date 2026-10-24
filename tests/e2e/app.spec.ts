import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.bookmarks-title')).toBeVisible();
});

test('desktop switching and search island work', async ({ page }) => {
  await expect(page.locator('.status-desktop')).toHaveText('工作');
  await expect(page.locator('.bookmark')).toHaveCount(9);

  await page.locator('.desktop-dot').nth(1).click();
  await expect(page.locator('.status-desktop')).toHaveText('设计');
  await expect(page.locator('.bookmarks-title')).toHaveText('设计');
  await expect(page.locator('.bookmark')).toHaveCount(8);

  await page.mouse.move(700, 700);
  await page.mouse.wheel(-120, 0);
  await expect(page.locator('.status-desktop')).toHaveText('工作');

  await page.locator('.island__input').click();
  const shell = page.locator('.island-shell');
  await expect(shell).toHaveAttribute('data-open', 'true');
  await page.locator('.island__input').fill('fig');
  await expect(page.locator('.island-row__title').first()).toHaveText('Figma');

  await page.keyboard.press('Escape');
  await expect(shell).toHaveAttribute('data-open', 'false');
});

test('notes autosave and survive a reload', async ({ page }) => {
  const body = page.locator('.note-body');
  await body.click();
  await body.fill('今天的重点：完成 Liquid Glass 的细节。');
  await expect(page.locator('.note-status')).toHaveText('已保存');

  await page.reload();
  await expect(page.locator('.note-body')).toHaveValue('今天的重点：完成 Liquid Glass 的细节。');
  await expect(page.locator('.note-title')).toHaveValue('本周聚焦');
});

test('bookmark drag reorder and context menu work', async ({ page }) => {
  const labels = page.locator('.bookmark-label');
  await expect(labels.nth(0)).toHaveText('Linear');
  await expect(labels.nth(2)).toHaveText('GitHub');

  const linear = page.locator('.bookmark').filter({ hasText: 'Linear' }).first();
  const github = page.locator('.bookmark').filter({ hasText: 'GitHub' });
  await linear.dragTo(github);
  await expect(labels.nth(1)).toHaveText('Linear');

  await page.locator('.bookmark').filter({ hasText: 'Notion' }).click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await expect(page.locator('.context-menu__item').filter({ hasText: '固定到 Dock' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.context-menu')).toHaveCount(0);
});

test('countdown creation and pomodoro completion persist', async ({ page }) => {
  await page.locator('.countdown-icon-button[aria-label="新建倒计时"]').click();
  await page.locator('.countdown-form .input').first().fill('春节');
  await page.locator('.countdown-form input[type=datetime-local]').fill('2030-02-10T09:00');
  await page.locator('.countdown-form button[type=submit]').click();
  await expect(page.locator('.countdown-switcher option:checked')).toHaveText('春节');
  await expect(page.locator('.countdown-switcher option')).toHaveCount(3);

  await page.locator('.dock-item[aria-label="番茄钟"]').click();
  const pomodoro = page.locator('[data-widget-type=pomodoro]');
  await expect(pomodoro).toBeVisible();
  await expect(page.locator('.pomodoro-time')).toHaveText('25:00');

  await page.evaluate(() => {
    const key = 'glassdesk:storage:pomodoro';
    const state = JSON.parse(localStorage.getItem(key) ?? 'null') as Record<string, unknown>;
    localStorage.setItem(
      key,
      JSON.stringify({
        ...state,
        phase: 'focus',
        running: true,
        endsAt: Date.now() - 1000,
        remainingMs: 1000,
        completedFocus: 0,
      }),
    );
  });
  await page.reload();

  await expect(page.locator('.pomodoro-rounds')).toHaveText('完成 1 轮');
  await expect(page.locator('.pomodoro-time')).toHaveText('05:00');
  await expect(page.locator('.countdown-switcher option:checked')).toHaveText('春节');
});

test('settings persist, backup exports, nested dialogs close independently', async ({ page }) => {
  await page.locator('.status-settings').click();
  await page.locator('.settings-nav__item').filter({ hasText: '外观' }).click();
  const glassHigh = page.locator('.settings-row').filter({ hasText: '玻璃强度' }).getByRole('button', { name: '高' });
  await glassHigh.click();
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'high');

  await page.locator('.switch[aria-label="自动隐藏 Dock"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-dock-autohide', 'true');

  await page.locator('.settings-nav__item').filter({ hasText: '数据与备份' }).click();
  await page.locator('.settings-row').filter({ hasText: '重置所有数据' }).getByRole('button', { name: '重置' }).click();
  await expect(page.locator('.modal--confirm')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal--confirm')).toHaveCount(0);
  await expect(page.locator('.settings-sheet')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.settings-row').filter({ hasText: '导出备份' }).getByRole('button', { name: /导出 JSON/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^glassdesk-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import('node:fs/promises');
  const backup = JSON.parse(await fs.readFile(path!, 'utf8')) as {
    app: string;
    desktopLayout: { desktops: unknown[] };
  };
  expect(backup.app).toBe('GlassDesk');
  expect(backup.desktopLayout.desktops).toHaveLength(4);

  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'high');
  await expect(page.locator('html')).toHaveAttribute('data-dock-autohide', 'true');
});

test('compact layout uses tabs instead of floating dots', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.reload();
  await expect(page.locator('.desktop-tabs')).toBeVisible();
  await expect(page.locator('.desktop-dot')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(overflow).toBeLessThanOrEqual(900);

  await page.locator('.desktop-tab').filter({ hasText: '设计' }).click();
  await expect(page.locator('.bookmarks-title')).toHaveText('设计');
});
