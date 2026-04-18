import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/app/api/**/*.contract.test.ts',
      'src/app/dashboard/**/*.test.ts',
      'src/lib/**/*.test.ts',
    ],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
