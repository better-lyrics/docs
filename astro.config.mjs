import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://lyrics-api-docs.boidu.dev',
  integrations: [react()],
  output: 'static',
  build: {
    assets: '_assets',
  },
});
