import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://localhost:3001/mission_control/',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
  },
  reporter: [['list']],
});
