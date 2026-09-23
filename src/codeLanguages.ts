export const CODE_LANGUAGE_STORAGE_KEY = 'blyrics-docs:code-lang';

export const CODE_LANGUAGES = {
  curl: { label: 'cURL', prism: 'bash' },
  javascript: { label: 'JavaScript', prism: 'javascript' },
  typescript: { label: 'TypeScript', prism: 'typescript' },
  python: { label: 'Python', prism: 'python' },
  go: { label: 'Go', prism: 'go' },
  swift: { label: 'Swift', prism: 'swift' },
  kotlin: { label: 'Kotlin', prism: 'kotlin' },
} as const;

export type CodeLanguage = keyof typeof CODE_LANGUAGES;
