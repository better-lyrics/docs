import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { markdownPages } from './src/integrations/markdownPages';

export default defineConfig({
  site: 'https://docs.betterlyrics.org',
  integrations: [react(), markdownPages()],
  output: 'static',
  redirects: {
    '/docs/introduction': '/',
  },
  build: {
    assets: '_assets',
  },
});
