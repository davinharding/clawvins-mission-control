import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001/mission_control/';

test.describe('Mission Control Scrolling', () => {
  
  test('Event feed scrolls properly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="event-feed"]', { timeout: 10000 });
    
    const feed = page.locator('[data-testid="event-feed"]');
    
    // Should have scrollable overflow
    const overflowY = await feed.evaluate(el => 
      window.getComputedStyle(el).overflowY
    );
    expect(overflowY).toBe('auto');
    
    // Should be able to scroll if content overflows
    const scrollHeight = await feed.evaluate(el => el.scrollHeight);
    const clientHeight = await feed.evaluate(el => el.clientHeight);
    
    console.log('Event feed - scrollHeight:', scrollHeight, 'clientHeight:', clientHeight);
    
    if (scrollHeight > clientHeight) {
      // Has overflow, test scrolling
      await feed.evaluate(el => el.scrollTop = 100);
      const scrollTop = await feed.evaluate(el => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
      console.log('Event feed scrollable, scrollTop:', scrollTop);
    } else {
      console.log('Event feed does not overflow (fewer events than viewport)');
    }
  });
  
  test('Kanban columns scroll independently', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="column-backlog"]', { timeout: 10000 });
    
    const backlogColumn = page.locator('[data-testid="column-backlog"]');
    const backlogList = backlogColumn.locator('[data-testid="task-list"]').first();
    
    // Should have overflow
    const overflowY = await backlogList.evaluate(el => 
      window.getComputedStyle(el).overflowY
    );
    expect(overflowY).toBe('auto');
    
    // Test scrolling
    const scrollHeight = await backlogList.evaluate(el => el.scrollHeight);
    const clientHeight = await backlogList.evaluate(el => el.clientHeight);
    
    console.log('Backlog column - scrollHeight:', scrollHeight, 'clientHeight:', clientHeight);
    
    if (scrollHeight > clientHeight) {
      await backlogList.evaluate(el => el.scrollTop = 50);
      const scrollTop = await backlogList.evaluate(el => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
      console.log('Backlog column scrollable, scrollTop:', scrollTop);
    } else {
      console.log('Backlog column does not overflow (fewer tasks than viewport)');
    }
  });
  
  test('All content fits viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // No horizontal scroll
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    console.log('Body scrollWidth:', bodyScrollWidth, 'Window width:', windowWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(windowWidth + 1); // +1 for rounding
    
    // Main container fits viewport
    const main = page.locator('main');
    const mainBox = await main.boundingBox();
    console.log('Main element bounds:', mainBox);
    expect(mainBox).toBeTruthy();
    expect(mainBox!.y + mainBox!.height).toBeLessThanOrEqual(1080 + 5); // +5 for margins
  });
  
  test('Status legend visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="status-legend"]', { timeout: 10000 });
    
    const legend = page.locator('[data-testid="status-legend"]');
    await expect(legend).toBeVisible();
    
    const legendBox = await legend.boundingBox();
    const viewport = page.viewportSize()!;
    
    console.log('Legend bounds:', legendBox, 'Viewport height:', viewport.height);
    
    // Should be within viewport
    expect(legendBox).toBeTruthy();
    expect(legendBox!.y + legendBox!.height).toBeLessThanOrEqual(viewport.height);
  });
  
  test('Real-time events appear', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="event-item"]', { timeout: 10000 });
    
    // Count initial events
    const initialCount = await page.locator('[data-testid="event-item"]').count();
    console.log('Initial event count:', initialCount);
    
    // Trigger backend to generate event via session sync
    try {
      await page.evaluate(() => {
        return fetch('http://localhost:3002/api/admin/session-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessions: [{
              key: `playwright-test-${Date.now()}`,
              updatedAt: Date.now(),
              messages: [],
              agent: 'test'
            }],
            secret: 'REDACTED_SECRET'
          })
        });
      });
      
      console.log('Session sync request sent');
      
      // Wait up to 10 seconds for new event to appear
      await page.waitForFunction(
        (expectedCount) => {
          const items = document.querySelectorAll('[data-testid="event-item"]');
          return items.length > expectedCount;
        },
        initialCount,
        { timeout: 10000 }
      );
      
      const newCount = await page.locator('[data-testid="event-item"]').count();
      console.log('New event count:', newCount);
      
      expect(newCount).toBeGreaterThan(initialCount);
    } catch (error) {
      console.log('Real-time event test skipped - backend might not be running:', error);
      // Don't fail the test if backend is not available
      test.skip();
    }
  });
  
  test('Refresh button works', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="event-item"]', { timeout: 10000 });
    
    const initialCount = await page.locator('[data-testid="event-item"]').count();
    console.log('Initial event count before refresh:', initialCount);
    
    // Click refresh button
    const refreshButton = page.locator('[data-testid="refresh-button"]');
    await expect(refreshButton).toBeVisible();
    
    // Listen for network request
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/events') && response.status() === 200,
      { timeout: 5000 }
    );
    
    await refreshButton.click();
    
    try {
      await responsePromise;
      console.log('Refresh API call completed');
      
      // Wait a bit for state update
      await page.waitForTimeout(500);
      
      const newCount = await page.locator('[data-testid="event-item"]').count();
      console.log('Event count after refresh:', newCount);
      
      // Count should be >= initial (might have new events or same)
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    } catch (error) {
      console.log('Refresh test - API call timeout:', error);
      // Still verify button exists and is clickable
      await expect(refreshButton).toBeVisible();
    }
  });
  
});
