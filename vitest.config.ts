import { defineConfig } from 'vitest/config';

//Lean unit-test config for the pure lib functions (src/lib). These modules import
//only TYPES from the React/Astro layer, so esbuild erases those imports and the fast
//node environment is all we need — no jsdom, no Astro plugin, no component runtime.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
  },
});
