import { defineConfig } from 'vitest/config';

//Lean unit-test config for the pure modules: src/lib plus the creator's board model.
//These import only TYPES from the React/Astro layer, so esbuild erases those imports and
//the fast node environment is all we need — no jsdom, no Astro plugin, no component runtime.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'src/components/react/creator/**/*.test.ts', 'src/components/react/lab/**/*.test.ts'],
  },
});
