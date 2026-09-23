import { useState, useCallback, useEffect, useRef } from 'react';
import Timeline from './Timeline';
import CodeExamples from './CodeExamples';
import LyricsPreview from './LyricsPreview';
import BraccatoExample from './BraccatoExample';
import SegmentedControl from './SegmentedControl';
import { TextMorph } from 'torph/react';
import { API_BASE, PROVIDER_ENDPOINTS, type Provider } from '../api';


interface ApiResponse {
  ttml?: string;
  lyrics?: string;
  score?: number;
  error?: string;
  message?: string;
  provider?: string;
}

interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: ApiResponse;
  time: number;
}

type OutputTab = 'preview' | 'timeline' | 'response' | 'code';

type BodyView = 'raw' | 'parsed' | 'content';

interface Query {
  song: string;
  artist: string;
  album: string;
  duration: string;
  provider: Provider;
}

const PROVIDERS = [
  { id: 'ttml', label: 'TTML', desc: 'Syllable-level' },
  { id: 'qq', label: 'QQ', desc: 'Word-level' },
  { id: 'kugou', label: 'Kugou', desc: 'Line-level' },
] as const;

const PRESETS: Query[] = [
  { song: 'SICKO MODE', artist: 'Travis Scott', album: 'ASTROWORLD', duration: '313', provider: 'ttml' },
  { song: 'APT.', artist: 'ROSÉ, Bruno Mars', album: 'APT.', duration: '170', provider: 'ttml' },
  { song: 'Fair Trade', artist: 'Drake', album: 'Certified Lover Boy', duration: '291', provider: 'ttml' },
];

function buildApiUrl(query: Query): string {
  const params = new URLSearchParams();
  if (query.song) params.set('s', query.song);
  if (query.artist) params.set('a', query.artist);
  if (query.album) params.set('al', query.album);
  if (query.duration) params.set('d', query.duration);
  return `${API_BASE}${PROVIDER_ENDPOINTS[query.provider]}?${params.toString()}`;
}

function getInitialQuery(): Query {
  const params = new URLSearchParams(window.location.search);
  const providerParam = params.get('provider');
  return {
    song: params.get('s') || params.get('song') || '',
    artist: params.get('a') || params.get('artist') || '',
    album: params.get('al') || params.get('album') || '',
    duration: params.get('d') || params.get('duration') || '',
    provider: providerParam === 'kugou' || providerParam === 'qq' ? providerParam : 'ttml',
  };
}

function useCopied(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };
  return [copied, copy];
}

export default function Playground() {
  const [query, setQuery] = useState<Query>(getInitialQuery);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [viewMode, setViewMode] = useState<BodyView>('raw');
  const [tab, setTab] = useState<OutputTab>('preview');
  const [copied, copy] = useCopied();
  const codeRef = useRef<HTMLElement>(null);

  const { song, artist, album, duration, provider } = query;
  const update = (patch: Partial<Query>) => setQuery((q) => ({ ...q, ...patch }));
  const hasQuery = Boolean(song || artist);
  const apiUrl = buildApiUrl(query);

  useEffect(() => {
    const params = new URLSearchParams();
    if (song) params.set('s', song);
    if (artist) params.set('a', artist);
    if (album) params.set('al', album);
    if (duration) params.set('d', duration);
    if (provider !== 'ttml') params.set('provider', provider);

    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [song, artist, album, duration, provider]);

  useEffect(() => {
    if (codeRef.current && window.Prism) {
      window.Prism.highlightElement(codeRef.current);
    }
  }, [response, viewMode, tab]);

  const runFetch = useCallback(async (target: Query) => {
    if (!target.song && !target.artist) return;

    setLoading(true);
    const startTime = performance.now();

    try {
      const res = await fetch(buildApiUrl(target));
      const endTime = performance.now();

      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('x-') || key.toLowerCase() === 'content-type') {
          headers[key] = value;
        }
      });

      const body = await res.json();

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers,
        body,
        time: Math.round(endTime - startTime),
      });
      setTab(body.ttml || body.lyrics ? 'preview' : 'response');
    } catch (err) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: { error: err instanceof Error ? err.message : 'Unknown error' },
        time: Math.round(performance.now() - startTime),
      });
      setTab('response');
    } finally {
      setLoading(false);
    }
  }, []);

  const applyPreset = (preset: Query) => {
    setQuery(preset);
    runFetch(preset);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'var(--success)';
    if (status >= 400 && status < 500) return 'var(--warning)';
    return 'var(--error)';
  };

  const formatBody = (body: ApiResponse, view: BodyView) => {
    if (view === 'raw') {
      return JSON.stringify(body, null, 2);
    }

    // Parsed view - try to parse TTML into readable format
    const content = body.ttml || body.lyrics;
    if (!content) {
      return JSON.stringify(body, null, 2);
    }

    try {
      if (body.ttml) {
        // Parse TTML - extract lines and words with agent and background info
        const parser = new DOMParser();
        const doc = parser.parseFromString(body.ttml, 'text/xml');
        const lines: Array<{
          begin: string;
          end: string;
          text: string;
          agent?: string;
          words: Array<{ begin: string; end: string; text: string; isBackground?: boolean }>;
        }> = [];

        doc.querySelectorAll('p').forEach((p) => {
          const agent = p.getAttribute('ttm:agent') || undefined;
          const words: Array<{ begin: string; end: string; text: string; isBackground?: boolean }> = [];

          // Get all timed spans
          p.querySelectorAll('span[begin]').forEach((span) => {
            // Check if inside a background vocal span
            let isBackground = false;
            let parent = span.parentElement;
            while (parent && parent !== p) {
              if (parent.getAttribute('ttm:role') === 'x-bg') {
                isBackground = true;
                break;
              }
              parent = parent.parentElement;
            }

            words.push({
              begin: span.getAttribute('begin') || '',
              end: span.getAttribute('end') || '',
              text: span.textContent || '',
              ...(isBackground ? { isBackground: true } : {}),
            });
          });

          lines.push({
            begin: p.getAttribute('begin') || '',
            end: p.getAttribute('end') || '',
            text: p.textContent || '',
            ...(agent ? { agent } : {}),
            words,
          });
        });

        return JSON.stringify({ lines, score: body.score }, null, 2);
      }

      return content;
    } catch {
      return JSON.stringify(body, null, 2);
    }
  };

  const lyricsContent = response?.body.ttml || response?.body.lyrics;
  const outputTabs: { id: OutputTab; label: string }[] = [
    ...(lyricsContent ? [{ id: 'preview' as const, label: 'Preview' }] : []),
    ...(response?.body.ttml ? [{ id: 'timeline' as const, label: 'Timeline' }] : []),
    { id: 'response', label: 'Response' },
    { id: 'code', label: 'Code' },
  ];
  const activeTab = outputTabs.some((t) => t.id === tab) ? tab : 'response';

  const bodyViews: { id: BodyView; label: string }[] = [
    { id: 'raw', label: 'JSON' },
    ...(response?.body.ttml ? [{ id: 'parsed' as const, label: 'Parsed' }] : []),
    ...(lyricsContent ? [{ id: 'content' as const, label: 'Lyrics' }] : []),
  ];
  const activeBodyView = bodyViews.some((v) => v.id === viewMode) ? viewMode : 'raw';
  const lyricsExtension = response?.body.ttml ? 'ttml' : response?.body.provider === 'qq' ? 'qrc' : 'lrc';
  const bodyText = response ? (activeBodyView === 'content' && lyricsContent ? lyricsContent : formatBody(response.body, activeBodyView)) : '';
  const bodyLanguage = activeBodyView === 'content' ? (lyricsExtension === 'lrc' ? 'none' : 'markup') : 'json';

  const downloadBody = () => {
    const extension = activeBodyView === 'content' ? lyricsExtension : 'json';
    const name = [song, artist].filter(Boolean).join(' - ') || 'lyrics';
    const url = URL.createObjectURL(new Blob([bodyText], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.replace(/[\\/:*?"<>|]/g, '')}${activeBodyView === 'parsed' ? '.parsed' : ''}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="playground">
      <div className="presets">
        <span className="presets-label">Try a preset</span>
        <div className="presets-list">
          {PRESETS.map((preset) => (
            <button
              key={preset.song}
              type="button"
              className="preset"
              onClick={() => applyPreset(preset)}
              disabled={loading}
            >
              {preset.song}
              <span className="preset-artist">{preset.artist}</span>
            </button>
          ))}
        </div>
      </div>

      <form
        className="playground-inputs"
        onSubmit={(e) => {
          e.preventDefault();
          runFetch(query);
        }}
      >
        <div className="input-row">
          <div className="input-group">
            <label htmlFor="song">Song</label>
            <input id="song" type="text" value={song} onChange={(e) => update({ song: e.target.value })} placeholder="E85" />
          </div>
          <div className="input-group">
            <label htmlFor="artist">Artist</label>
            <input id="artist" type="text" value={artist} onChange={(e) => update({ artist: e.target.value })} placeholder="Don Toliver" />
          </div>
        </div>

        <div className="input-row">
          <div className="input-group">
            <label htmlFor="album">Album</label>
            <input id="album" type="text" value={album} onChange={(e) => update({ album: e.target.value })} placeholder="OCTANE" />
          </div>
          <div className="input-group">
            <label htmlFor="duration">Duration in seconds</label>
            <input id="duration" type="number" value={duration} onChange={(e) => update({ duration: e.target.value })} placeholder="154" />
          </div>
        </div>

        <div className="provider-row">
          <span className="provider-label">Provider</span>
          <div className="provider-tabs">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`provider-tab ${provider === p.id ? 'active' : ''}`}
                onClick={() => update({ provider: p.id })}
              >
                <span className="provider-tab-label">{p.label}</span>
                <span className="provider-tab-desc">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="fetch-btn" disabled={loading || !hasQuery}>
          <TextMorph>{loading ? 'Fetching...' : 'Fetch lyrics'}</TextMorph>
        </button>
      </form>

      {hasQuery && (
        <div className="request-bar">
          <span className="request-method">GET</span>
          <code className="request-url">{apiUrl}</code>
          {response && (
            <span className="request-meta">
              <TextMorph style={{ color: getStatusColor(response.status) }}>{String(response.status || 'Error')}</TextMorph>
              <TextMorph>{`${response.time}ms`}</TextMorph>
            </span>
          )}
          <span className="request-actions">
            <button type="button" onClick={() => copy('url', apiUrl)}>
              <TextMorph>{copied === 'url' ? 'Copied' : 'Copy URL'}</TextMorph>
            </button>
            <button type="button" onClick={() => copy('share', window.location.href)}>
              <TextMorph>{copied === 'share' ? 'Link copied' : 'Share'}</TextMorph>
            </button>
          </span>
        </div>
      )}

      {response?.status === 401 && (
        <div className="callout" role="note">
          <div className="callout-body">
            <p>
              <strong>These lyrics are not cached yet.</strong> Fresh fetches need an API key, and keys are not
              being issued right now. See <a href="/docs/authentication#loading-uncached-songs">Loading uncached songs</a> for
              a workaround.
            </p>
          </div>
        </div>
      )}

      {response && (
        <div className="output">
          <div className="output-tabs">
            <SegmentedControl variant="underline" ariaLabel="Output" options={outputTabs} value={activeTab} onChange={setTab} />
          </div>

          {activeTab === 'preview' && lyricsContent && (
            <>
              <LyricsPreview content={lyricsContent} durationS={Number(duration) || undefined} />
              <BraccatoExample song={song} artist={artist} album={album} duration={duration} />
            </>
          )}

          {activeTab === 'timeline' && response.body.ttml && (
            <div className="output-embed">
              <Timeline ttml={response.body.ttml} />
            </div>
          )}

          {activeTab === 'response' && (
            <div className="response-content">
              <div className="response-headers">
                <h4>Headers</h4>
                <div className="headers-list">
                  {Object.entries(response.headers).map(([key, value]) => (
                    <div key={key} className="header-item">
                      <span className="header-key">{key}</span>
                      <span className="header-value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="response-body">
                <div className="body-header">
                  <SegmentedControl ariaLabel="Body view" options={bodyViews} value={activeBodyView} onChange={setViewMode} />
                  <span className="body-actions">
                    <button type="button" onClick={() => copy('body', bodyText)}>
                      <TextMorph>{copied === 'body' ? 'Copied' : 'Copy'}</TextMorph>
                    </button>
                    <button type="button" onClick={downloadBody}>
                      Download
                    </button>
                  </span>
                </div>
                <div className="body-content">
                  <pre key={activeBodyView} className={activeBodyView === 'content' ? 'wrap' : undefined}>
                    <code ref={codeRef} className={`language-${bodyLanguage}`}>{bodyText}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="output-embed">
              <CodeExamples song={song} artist={artist} album={album} duration={duration} provider={provider} />
            </div>
          )}
        </div>
      )}

      <style>{`
        .playground {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          overflow: clip;
        }

        .playground-inputs {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }

        @media (max-width: 640px) {
          .input-row {
            grid-template-columns: 1fr;
          }
        }

        .input-group {
          display: flex;
          flex-direction: column;
        }

        .provider-row {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .provider-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .provider-tabs {
          display: flex;
          gap: var(--space-2);
        }

        .provider-tab {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: var(--space-2) var(--space-3);
          background-color: var(--surface-panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: border-color var(--transition-fast), background-color var(--transition-fast);
          min-width: 100px;
        }

        .provider-tab:hover {
          border-color: var(--border-hover);
        }

        .provider-tab.active {
          border-color: var(--border-hover);
          background-color: var(--bg-tertiary);
        }

        .provider-tab-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .provider-tab-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .provider-tab.active .provider-tab-desc {
          color: var(--text-secondary);
        }

        .fetch-btn {
          align-self: flex-start;
          padding: var(--space-2) var(--space-4);
          background-color: var(--text-primary);
          color: var(--bg-primary);
          border: none;
          border-radius: var(--radius-lg);
          font-family: var(--font-sans);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity var(--transition-fast);
        }

        .fetch-btn:hover:not(:disabled) {
          opacity: 0.85;
        }

        .fetch-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .presets {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .presets-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .presets-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .preset {
          display: inline-flex;
          align-items: baseline;
          gap: var(--space-2);
          padding: 0.25rem var(--space-3);
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--text-primary);
          background-color: var(--surface-panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: border-color var(--transition-fast), background-color var(--transition-fast);
        }

        .preset:hover:not(:disabled) {
          border-color: var(--border-hover);
          background-color: var(--bg-tertiary);
        }

        .preset:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .preset-artist {
          font-weight: 400;
          color: var(--text-muted);
        }

        .request-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-2) var(--space-3);
          padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
          background-color: var(--surface-code);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
        }

        .request-method {
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .request-url {
          flex: 1 1 16rem;
          min-width: 0;
          padding: 0;
          background: none;
          font-size: 0.75rem;
          color: var(--text-secondary);
          overflow-x: auto;
          white-space: nowrap;
          scrollbar-width: none;
        }

        .request-meta {
          display: flex;
          gap: var(--space-3);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .request-actions {
          display: flex;
          gap: var(--space-1);
        }

        .request-actions button {
          padding: var(--space-1) var(--space-2);
          font-size: 0.75rem;
          font-weight: 500;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-muted);
          cursor: pointer;
          transition: color var(--transition-fast), background-color var(--transition-fast);
        }

        .request-actions button:hover {
          color: var(--text-primary);
          background-color: var(--bg-tertiary);
        }

        .output {
          background-color: var(--surface-code);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          overflow: clip;
        }

        .output-tabs {
          padding: 0 var(--space-4);
          border-bottom: 1px solid var(--border-subtle);
        }

        .output-embed > * {
          margin: 0;
          border: none;
          border-radius: 0;
          background: none;
        }

        .response-content {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .response-content {
            grid-template-columns: 1fr;
          }
        }

        .response-headers {
          padding: var(--space-4);
          border-right: 1px solid var(--border-subtle);
        }

        @media (max-width: 768px) {
          .response-headers {
            border-right: none;
            border-bottom: 1px solid var(--border-subtle);
          }
        }

        .response-headers h4,
        .response-body h4 {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
          margin: 0 0 var(--space-3);
        }

        .headers-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .header-item {
          display: flex;
          flex-direction: column;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          word-break: break-all;
        }

        .header-key {
          color: var(--text-muted);
        }

        .header-value {
          color: var(--text-secondary);
        }

        .response-body {
          padding: var(--space-4);
          min-width: 0;
          overflow: hidden;
        }

        .body-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }

        .body-actions {
          display: flex;
          gap: 2px;
        }

        .body-actions button {
          display: inline-flex;
          padding: var(--space-1) var(--space-2);
          font-size: 0.75rem;
          font-weight: 500;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-muted);
          cursor: pointer;
          transition: color var(--transition-fast), background-color var(--transition-fast);
        }

        .body-actions button:hover {
          color: var(--text-primary);
          background-color: var(--bg-tertiary);
        }

        .body-content {
          background-color: var(--bg-primary);
          border-radius: var(--radius-lg);
          max-height: 400px;
          overflow: auto;
        }

        .body-content pre.wrap code {
          white-space: pre-wrap;
          word-break: break-all;
        }

        .body-content pre {
          margin: 0;
          padding: var(--space-4);
          background: none;
          border: none;
          border-radius: 0;
        }

        .body-content code {
          white-space: pre;
          display: block;
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  );
}
