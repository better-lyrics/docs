import type { APIRoute } from 'astro';
import { navSections } from '../nav';
import { markdownPath } from '../markdownPath';

export const GET: APIRoute = ({ site }) => {
  const sections = navSections
    .map((section) => {
      const links = section.links
        .map((link) => `- [${link.label}](${new URL(markdownPath(link.href), site)})${link.description ? `: ${link.description}` : ''}`)
        .join('\n');
      return `## ${section.title}\n\n${links}`;
    })
    .join('\n\n');

  const body = `# Better Lyrics API

> Free API for syllable-synced song lyrics. Base URL: https://api.betterlyrics.org. Main endpoint: GET /getLyrics?s={song}&a={artist}&al={album}&d={durationSeconds}, which returns TTML. Always send all four parameters: the cache key includes album and duration. Alternative providers: /qq/getLyrics (QRC) and /kugou/getLyrics (LRC). Cached songs need no API key.

Braccato (@braccato/parsers, @braccato/core) parses every provider response into one shape and renders it. Every page below links to its Markdown version. Page URLs also return Markdown when the request sends \`Accept: text/markdown\`. The whole site as one file: ${new URL('/llms-full.txt', site)}

${sections}
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
