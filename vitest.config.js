import { defineConfig } from 'vitest/config';

// Mirrors esbuild's `--loader:.md=text` (see the js:build script) so modules
// that import docs/*.md get the file contents as a string under test too.
const markdownAsText = {
  name: 'markdown-as-text',
  transform(code, id) {
    if (!id.endsWith('.md')) return null;
    return { code: `export default ${JSON.stringify(code)};`, map: null };
  },
};

export default defineConfig({
  plugins: [markdownAsText],
  test: {
    environment: 'node',
    globals: true,
    environmentMatchGlobs: [
      ['tests/renderer/**', 'jsdom'],
    ],
    setupFiles: ['tests/renderer/setup.js'],
  },
});
