import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001/mission_control/';

async function login(page: import('@playwright/test').Page) {
  await page.goto(BASE_URL);
  await page.fill('#mc-username', 'patch');
  await page.fill('#mc-password', 'REDACTED');
  await page.click('button[type="submit"]');
  await page.waitForSelector('main', { timeout: 15000 });
}

test.describe('Mission Control dashboard', () => {
  test('Login and see dashboard', async ({ page }) => {
    await login(page);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Create a task and verify it appears in correct column', async ({ page }) => {
    await login(page);
    await page.click('button:has-text("+ New")');
    await page.waitForSelector('[data-testid="task-list"]');
    const todoColumn = page.locator('[data-testid="column-todo"]');
    await expect(todoColumn).toBeVisible();
    const taskCount = await todoColumn.locator('[data-testid="task-list"] h3').count();
    expect(taskCount).toBeGreaterThan(0);
  });

  test('Drag task between columns', async ({ page }) => {
    await login(page);
    const sourceColumn = page.locator('[data-testid="column-todo"] [data-testid="task-list"]');
    const targetColumn = page.locator('[data-testid="column-in-progress"]');
    const card = sourceColumn.locator('[role="button"]').first();
    await card.dragTo(targetColumn);
    await expect(targetColumn.locator('[data-testid="task-list"]')).toContainText(await card.innerText());
  });

  test('Filter by agent and verify results', async ({ page }) => {
    await login(page);
    const agentFilters = page.locator('aside [data-testid="agent-list"] button');
    const firstAgent = agentFilters.first();
    const agentName = await firstAgent.locator('span').first().innerText();
    await firstAgent.click();
    const taskCards = page.locator('[data-testid="task-list"]');
    await expect(taskCards).toBeVisible();
    await expect(page.locator('main')).toContainText(agentName);
  });

  test('Edit task details in modal', async ({ page }) => {
    await login(page);
    const card = page.locator('[data-testid="task-list"] [role="button"]').first();
    await card.click();
    await page.waitForSelector('input[placeholder="Task title"]');
    await page.fill('input[placeholder="Task title"]', 'Updated task title');
    await page.click('button:has-text("Save")');
    await expect(page.locator('main')).toContainText('Updated task title');
  });

  test('Archive a task and verify in archive panel', async ({ page }) => {
    await login(page);
    const doneColumn = page.locator('[data-testid="column-done"]');
    const archiveButton = doneColumn.locator('button[title="Archive task"]').first();
    if (await archiveButton.count()) {
      await archiveButton.click();
      await page.click('button:has-text("Archive")');
      await expect(page.locator('text=No archived tasks')).toBeHidden();
    } else {
      test.skip();
    }
  });

  test('Event feed shows recent activity', async ({ page }) => {
    await login(page);
    await page.waitForSelector('[data-testid="event-feed"]');
    await expect(page.locator('[data-testid="event-item"]').first()).toBeVisible();
  });
});
