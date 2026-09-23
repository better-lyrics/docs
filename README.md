# Better Lyrics Docs

Documentation for the Better Lyrics API: free syllable-synced lyrics for any song.

<https://docs.betterlyrics.org>

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project structure

```
├── src/
│   ├── components/     # React/Astro components
│   ├── layouts/        # Page layouts
│   ├── pages/          # Route pages
│   └── styles/         # Global styles
├── public/             # Static assets
├── astro.config.mjs    # Astro configuration
└── package.json
```

## Tech stack

- [Astro](https://astro.build/): static site generator
- [React](https://react.dev/): interactive components
- Cloudflare Pages: hosting

## Related

- [Better Lyrics](https://better-lyrics.boidu.dev): browser extension for synced lyrics
- [Better Lyrics API](https://api.betterlyrics.org): the API this documentation covers
