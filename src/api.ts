export const API_BASE = 'https://api.betterlyrics.org';

export type Provider = 'ttml' | 'kugou' | 'qq';

export const PROVIDER_ENDPOINTS: Record<Provider, string> = {
  ttml: '/getLyrics',
  kugou: '/kugou/getLyrics',
  qq: '/qq/getLyrics',
};
