import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001/mission_control/';

test.describe('Viewport and real-time', () => {
  test('All columns fit viewport height', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const viewportHeight = page.viewportSize()!.height;
    const leftSidebar = await page.locator('aside').first().boundingBox();
    const mainBoard = await page.locator('section').boundingBox();
    const rightFeed = await page.locator('aside').last().boundingBox();

    if (leftSidebar) expect(leftSidebar.height).toBeLessThanOrEqual(viewportHeight);
    if (mainBoard) expect(mainBoard.height).toBeLessThanOrEqual(viewportHeight);
    if (rightFeed) expect(rightFeed.height).toBeLessThanOrEqual(viewportHeight);
  });

  test('Agent list is scrollable', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="agent-list"]', { timeout: 10000 });

    const agentList = page.locator('[data-testid="agent-list"]');
    const overflowY = await agentList.evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(overflowY).toBe('auto');

    await agentList.evaluate((el) => { el.scrollTop = 100; });
    const scrollTop = await agentList.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThanOrEqual(0);
  });

  test('Status legend is visible', async ({ page }) => {
    await page.goto(BASE_URL);
    const legend = page.locator('[data-testid="status-legend"]');
    await expect(legend).toBeVisible();
  });

  test('New events animate in', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="event-item"]', { timeout: 10000 });
    const firstEvent = page.locator('[data-testid="event-item"]').first();
    await expect(firstEvent).toHaveClass(/animate-in/);
  });
});
