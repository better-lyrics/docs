import type { APIRoute } from 'astro';
import { navSections } from '../nav';

export const GET: APIRoute = ({ site }) => {
  const urls = navSections
    .flatMap((section) => section.links)
    .map((link) => `  <url><loc>${new URL(link.href, site)}</loc></url>`)
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
};
