import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const isTest = !!process.env.VITEST;

export default defineConfig({
  plugins: [svelte()],
  resolve: isTest ? { conditions: ['browser'] } : undefined,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    emptyOutDir: true,
  },
});
