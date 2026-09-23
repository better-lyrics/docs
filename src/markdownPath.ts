export function markdownPath(pagePath: string): string {
  const path = pagePath.replace(/\/$/, '');
  return path ? `${path}.md` : '/index.md';
}
