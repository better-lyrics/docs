import TurndownService from 'turndown';

function inlineText(node: Node): string {
  if (node.nodeName === 'CODE') return `\`${node.textContent ?? ''}\``;
  if (node.nodeType !== 1) return node.textContent ?? '';
  return Array.from(node.childNodes).map(inlineText).join('');
}

function cellText(cell: Element): string {
  return inlineText(cell).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

function tableToMarkdown(table: Element): string {
  const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
    Array.from(row.children)
      .filter((cell) => cell.nodeName === 'TH' || cell.nodeName === 'TD')
      .map(cellText),
  );
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  const [head, ...body] = rows;
  return `\n\n${[line(head), line(Array(width).fill('---')), ...body.map(line)].join('\n')}\n\n`;
}

export function articleToMarkdown(article: HTMLElement | string, url: string): string {
  const service = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  service.remove(['script', 'style', 'noscript', 'button']);
  service.addRule('absoluteLinks', {
    filter: (node) => node.nodeName === 'A' && node.hasAttribute('href'),
    replacement: (content, node) => {
      const href = new URL((node as HTMLElement).getAttribute('href') ?? '', url).href;
      return content.trim() ? `[${content}](${href})` : '';
    },
  });
  service.addRule('fencedWithLanguage', {
    filter: (node) => node.nodeName === 'PRE' && node.firstElementChild?.nodeName === 'CODE',
    replacement: (_content, node) => {
      const code = (node as HTMLElement).firstElementChild as HTMLElement;
      const language = /language-(\w+)/.exec(code.className)?.[1] ?? '';
      return `\n\n\`\`\`${language}\n${(code.textContent ?? '').replace(/\n$/, '')}\n\`\`\`\n\n`;
    },
  });
  service.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => tableToMarkdown(node as Element),
  });

  service.addRule('skip', {
    filter: (node) => node.hasAttribute('data-markdown-skip'),
    replacement: () => '',
  });

  return `${service.turndown(article)}\n\nSource: ${url}\n`;
}
