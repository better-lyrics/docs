import type { AstroIntegration } from 'astro';
import { readFile, writeFile } from 'node:fs/promises';
import { articleToMarkdown } from '../pageMarkdown';
import { markdownPath } from '../markdownPath';
import { navSections } from '../nav';

const ARTICLE = /<article\b[^>]*\bclass="[^"]*\barticle\b[^"]*"[^>]*>[\s\S]*<\/article>/;

export function markdownPages(): AstroIntegration {
  let site = '';

  return {
    name: 'markdown-pages',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site ?? '';
      },
      'astro:build:done': async ({ dir }) => {
        const outFile = (path: string) => new URL(path.replace(/^\//, ''), dir);
        const pagePaths = navSections.flatMap((section) => section.links.map((link) => link.href));

        const pages = await Promise.all(
          pagePaths.map(async (pagePath) => {
            const htmlPath = pagePath === '/' ? '/index.html' : `${pagePath}/index.html`;
            const article = ARTICLE.exec(await readFile(outFile(htmlPath), 'utf8'))?.[0];
            if (!article) throw new Error(`markdown-pages: no article in ${htmlPath}`);
            const markdown = articleToMarkdown(article, new URL(pagePath, site).href);
            await writeFile(outFile(markdownPath(pagePath)), markdown);
            return markdown;
          }),
        );

        await writeFile(outFile('/llms-full.txt'), pages.join('\n---\n\n'));
      },
    },
  };
}
