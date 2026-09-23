import { markdownPath } from './markdownPath';

interface Env {
  ASSETS: { fetch(request: Request | URL): Promise<Response> };
}

function quality(accept: string, type: string): number {
  const entry = accept
    .split(',')
    .map((part) => part.trim().split(';'))
    .find(([mediaType]) => mediaType.trim() === type);
  if (!entry) return 0;
  const q = entry.slice(1).find((param) => param.trim().startsWith('q='));
  return q ? Number(q.trim().slice(2)) : 1;
}

function prefersMarkdown(request: Request): boolean {
  const accept = request.headers.get('Accept') ?? '';
  const markdown = quality(accept, 'text/markdown');
  return markdown > 0 && markdown >= quality(accept, 'text/html');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (prefersMarkdown(request)) {
      const markdown = await env.ASSETS.fetch(new URL(markdownPath(url.pathname), url));
      if (markdown.ok) {
        return new Response(markdown.body, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept' },
        });
      }
    }

    const response = await env.ASSETS.fetch(request);
    const withVary = new Response(response.body, response);
    withVary.headers.append('Vary', 'Accept');
    return withVary;
  },
};
