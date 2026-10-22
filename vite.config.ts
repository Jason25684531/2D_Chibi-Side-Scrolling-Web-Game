import { defineConfig } from 'vitest/config';
export default defineConfig({
  server: { port: 5175, strictPort: true },
  build:{rollupOptions:{input:{game:'index.html',prototype:'prototype.html'}}},
  test: { include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'] }
});
