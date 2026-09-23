export interface NavLink {
  href: string;
  label: string;
  description?: string;
}

export const headerLinks = [
  { href: '/', label: 'Docs', match: (path: string) => path === '/' || path.startsWith('/docs') },
  { href: '/braccato', label: 'Braccato', match: (path: string) => path.startsWith('/braccato') },
  { href: '/unison', label: 'Unison', match: (path: string) => path === '/unison' },
  { href: '/theming', label: 'Theming', match: (path: string) => path.startsWith('/theming') },
  { href: '/playground', label: 'Playground', match: (path: string) => path === '/playground' },
  { href: '/reference/get-lyrics', label: 'Reference', match: (path: string) => path.startsWith('/reference') },
];

export interface NavSection {
  title: string;
  links: NavLink[];
  paged?: boolean;
}

const conceptsLinks: NavLink[] = [
  { href: '/', label: 'Introduction', description: 'Fetch syllable-synced lyrics for any song with the free Better Lyrics API. Base URL, first request, parameters and response.' },
  { href: '/docs/authentication', label: 'Authentication', description: 'How the cache-first authentication model works, when an API key is needed, and how to load uncached songs.' },
  { href: '/docs/rate-limiting', label: 'Rate limiting', description: 'The two-tier rate limits of the Better Lyrics API, what happens when you exceed them, and the headers that report them.' },
  { href: '/docs/caching', label: 'Caching', description: 'How the Better Lyrics API caches lyrics, how song, artist, album and duration shape the cache key, and how to force a fresh lookup.' },
  { href: '/docs/providers', label: 'Providers', description: 'Compare the TTML, QQ and Kugou lyrics providers: endpoints, sync level, response format and when to use each.' },
  { href: '/docs/response-format', label: 'Response format', description: 'The TTML response format: lines, syllable timing, multiple vocalists, background vocals, transliterations and how to parse them.' },
  { href: '/docs/qrc-format', label: 'QRC format', description: 'The QRC format returned by the QQ provider: XML envelope, line and word timing, credit lines and how to parse it.' },
  { href: '/docs/error-handling', label: 'Error handling', description: 'Status codes and error bodies returned by the Better Lyrics API, and how to handle each one in your client.' },
  { href: '/docs/best-practices', label: 'Best practices', description: 'Recommendations for caching, request parameters, parsing and rendering when you build on the Better Lyrics API.' },
  { href: '/changelog', label: 'Changelog', description: 'Notable changes to the Better Lyrics API and the Braccato packages.' },
];

const referenceLinks: NavLink[] = [
  { href: '/reference/get-lyrics', label: 'GET /getLyrics', description: 'Reference for GET /getLyrics: query parameters, headers, provider endpoints and response examples.' },
  { href: '/reference/revalidate', label: 'GET /revalidate', description: 'Reference for GET /revalidate: refresh cached lyrics for a song with an API key.' },
  { href: '/reference/health', label: 'GET /health', description: 'Reference for GET /health: check that the Better Lyrics API is up and serving requests.' },
  { href: '/reference/cache-endpoints', label: 'Cache endpoints', description: 'Reference for the admin cache endpoints: lookup, keys, debug and clear, plus the removed backup endpoints.' },
  { href: '/reference/openapi', label: 'OpenAPI spec', description: 'The OpenAPI 3.1 document for the Better Lyrics API, and every endpoint it describes.' },
];

export const navSections: NavSection[] = [
  { title: 'Concepts', links: conceptsLinks },
  {
    title: 'Braccato',
    links: [
      { href: '/braccato', label: 'Overview', description: 'Braccato is the Better Lyrics rendering engine and lyric parsers as npm packages. Install it and render lyrics from the API.' },
      { href: '/braccato/parsers', label: 'Parsers', description: 'Parse TTML, LRC and QRC responses from every Better Lyrics API provider into one shape with @braccato/parsers.' },
      { href: '/braccato/renderer', label: 'Renderer', description: 'Render synced lyrics with the <braccato-lyrics> custom element from @braccato/core: properties, events, scrolling and theming.' },
      { href: '/braccato/provider', label: 'Provider', description: 'Fetch lyrics from several providers with fallback using @braccato/provider-blyrics.' },
    ],
  },
  {
    title: 'Unison',
    links: [
      { href: '/unison', label: 'Fetching lyrics', description: 'Read community-synced lyrics from Unison by video id, song and artist, or search, and translate them. No key needed.' },
    ],
  },
  {
    title: 'Theming',
    links: [
      { href: '/theming', label: 'Styling guide', description: 'Style Better Lyrics with custom CSS: variables, lyric lines and words, animations, fullscreen, instrumental breaks and more.' },
      { href: '/theming/agents', label: 'Guide for agents', description: 'A compact Better Lyrics theming reference for AI agents: CSS variables, DOM structure, selectors and theme patterns.' },
    ],
  },
  { title: 'Playground', links: [{ href: '/playground', label: 'Sandbox', description: 'Try the Better Lyrics API in your browser and preview the lyrics in the Braccato engine.' }], paged: false },
  { title: 'Reference', links: referenceLinks },
];

export function pageNeighbors(path: string): { prev?: NavLink; next?: NavLink } {
  const pages = navSections.filter((section) => section.paged !== false).flatMap((section) => section.links);
  const index = pages.findIndex((link) => link.href === path);
  if (index === -1) return {};
  return { prev: pages[index - 1], next: pages[index + 1] };
}

export function findNavLink(path: string): NavLink | undefined {
  return navSections.flatMap((section) => section.links).find((link) => link.href === path);
}

export function currentPathOf(url: URL): string {
  return url.pathname.replace(/\/$/, '') || '/';
}
