import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://docs.better-lyrics.boidu.dev',
  integrations: [react()],
  output: 'static',
  build: {
    assets: '_assets',
  },
});
