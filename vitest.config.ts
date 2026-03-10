import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, './src') }],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/__tests__/**/*.{test,spec}.{ts,tsx}',
      'server/__tests__/**/*.{test,spec}.{ts,tsx,js,mjs,cjs}',
    ],
    exclude: ['tests/**', 'dist/**', 'node_modules/**'],
    restoreMocks: true,
    clearMocks: true,
  },
});
