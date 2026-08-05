import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      threshold: {
        global: {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/generated/**',
        'src/i18n/**',
        '**/*.d.ts',
      ],
    },
  },
});
