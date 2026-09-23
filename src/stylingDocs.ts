import { createMarkdownProcessor } from '@astrojs/markdown-remark';

const REPO = 'better-lyrics/better-lyrics';

export type StylingDoc = 'STYLING.md' | 'STYLING-SKILL.md';

export function stylingDocSourceUrl(file: StylingDoc): string {
  return `https://github.com/${REPO}/blob/master/${file}`;
}

const processor = createMarkdownProcessor({ syntaxHighlight: false });

export async function renderStylingDoc(file: StylingDoc): Promise<string> {
  const url = `https://raw.githubusercontent.com/${REPO}/master/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Styling docs: ${url} returned ${res.status}`);
  const markdown = (await res.text())
    .replace(/^# .*\n/, '')
    .replace(/^## Table of Contents\n[\s\S]*?(?=^## )/m, '');
  const { code } = await (await processor).render(markdown);
  return code;
}
