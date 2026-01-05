import { useState, useCallback, useEffect, useRef } from 'react';
import Timeline from './Timeline';
import CodeExamples from './CodeExamples';

declare global {
  interface Window {
    Prism?: {
      highlightElement: (el: Element) => void;
    };
  }
}

const API_BASE = 'https://lyrics-api.boidu.dev';

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

type Provider = 'ttml' | 'kugou' | 'legacy';

const PROVIDER_ENDPOINTS: Record<Provider, string> = {
  ttml: '/getLyrics',
  kugou: '/kugou/getLyrics',
  legacy: '/legacy/getLyrics',
};

function getInitialParams() {
  if (typeof window === 'undefined') return { song: '', artist: '', album: '', duration: '', provider: 'ttml' as Provider };
  const params = new URLSearchParams(window.location.search);
  const providerParam = params.get('provider');
  return {
    song: params.get('s') || params.get('song') || '',
    artist: params.get('a') || params.get('artist') || '',
    album: params.get('al') || params.get('album') || '',
    duration: params.get('d') || params.get('duration') || '',
    provider: (providerParam === 'kugou' || providerParam === 'legacy' ? providerParam : 'ttml') as Provider,
  };
}

export default function Playground() {
  const initial = getInitialParams();
  const [song, setSong] = useState(initial.song);
  const [artist, setArtist] = useState(initial.artist);
  const [album, setAlbum] = useState(initial.album);
  const [duration, setDuration] = useState(initial.duration);
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [viewMode, setViewMode] = useState<'raw' | 'parsed'>('raw');
  const codeRef = useRef<HTMLElement>(null);

  // Update URL when state changes
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

  // Highlight code when response or viewMode changes
  useEffect(() => {
    if (codeRef.current && window.Prism) {
      window.Prism.highlightElement(codeRef.current);
    }
  }, [response, viewMode]);

  const fetchLyrics = useCallback(async () => {
    if (!song && !artist) return;

    setLoading(true);
    const startTime = performance.now();

    const params = new URLSearchParams();
    if (song) params.set('s', song);
    if (artist) params.set('a', artist);
    if (album) params.set('al', album);
    if (duration) params.set('d', duration);

    const endpoint = PROVIDER_ENDPOINTS[provider];
    const url = `${API_BASE}${endpoint}?${params.toString()}`;

    try {
      const res = await fetch(url);
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
    } catch (err) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: { error: err instanceof Error ? err.message : 'Unknown error' },
        time: Math.round(performance.now() - startTime),
      });
    } finally {
      setLoading(false);
    }
  }, [song, artist, album, duration, provider]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'var(--success)';
    if (status >= 400 && status < 500) return 'var(--warning)';
    return 'var(--error)';
  };

  const formatBody = (body: ApiResponse) => {
    if (viewMode === 'raw') {
      return JSON.stringify(body, null, 2);
    }

    // Parsed view - try to parse TTML into readable format
    const content = body.ttml || body.lyrics;
    if (!content) {
      return JSON.stringify(body, null, 2);
    }

    try {
      if (body.ttml) {
        // Parse TTML - extract lines and words
        const parser = new DOMParser();
        const doc = parser.parseFromString(body.ttml, 'text/xml');
        const lines: Array<{ begin: string; end: string; text: string; words: Array<{ begin: string; end: string; text: string }> }> = [];

        doc.querySelectorAll('p').forEach((p) => {
          const words: Array<{ begin: string; end: string; text: string }> = [];
          p.querySelectorAll('span').forEach((span) => {
            words.push({
              begin: span.getAttribute('begin') || '',
              end: span.getAttribute('end') || '',
              text: span.textContent || '',
            });
          });
          lines.push({
            begin: p.getAttribute('begin') || '',
            end: p.getAttribute('end') || '',
            text: p.textContent || '',
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

  return (
    <div className="playground">
      <div className="playground-inputs">
        <div className="input-row">
          <div className="input-group">
            <label htmlFor="song">Song</label>
            <input
              id="song"
              type="text"
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder="Shape of You"
            />
          </div>
          <div className="input-group">
            <label htmlFor="artist">Artist</label>
            <input
              id="artist"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Ed Sheeran"
            />
          </div>
        </div>

        <div className="input-row">
          <div className="input-group">
            <label htmlFor="album">Album (optional)</label>
            <input
              id="album"
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="÷ (Divide)"
            />
          </div>
          <div className="input-group">
            <label htmlFor="duration">Duration in seconds (optional)</label>
            <input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="234"
            />
          </div>
        </div>

        <div className="provider-row">
          <span className="provider-label">Provider</span>
          <div className="provider-tabs">
            {([
              { id: 'ttml', label: 'TTML', desc: 'Syllable-level' },
              { id: 'kugou', label: 'Kugou', desc: 'Line-level' },
              { id: 'legacy', label: 'Legacy', desc: 'Fallback' },
            ] as const).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`provider-tab ${provider === p.id ? 'active' : ''}`}
                onClick={() => setProvider(p.id)}
              >
                <span className="provider-tab-label">{p.label}</span>
                <span className="provider-tab-desc">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          className="fetch-btn"
          onClick={fetchLyrics}
          disabled={loading || (!song && !artist)}
        >
          {loading ? 'Fetching...' : 'Fetch lyrics'}
        </button>
      </div>

      {response && (
        <div className="playground-response">
          <div className="response-header">
            <span className="response-title">Response</span>
            <div className="response-meta">
              <span
                className="status-badge"
                style={{ color: getStatusColor(response.status) }}
              >
                {response.status} {response.statusText}
              </span>
              <span className="response-time">{response.time}ms</span>
            </div>
          </div>

          <div className="response-content">
            <div className="response-headers">
              <h4>Headers</h4>
              <div className="headers-list">
                {Object.entries(response.headers).map(([key, value]) => (
                  <div key={key} className="header-item">
                    <span className="header-key">{key}:</span>
                    <span className="header-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="response-body">
              <div className="body-header">
                <h4>Body</h4>
                {(response.body.ttml || response.body.lyrics) && (
                  <div className="view-toggle">
                    <button
                      className={viewMode === 'raw' ? 'active' : ''}
                      onClick={() => setViewMode('raw')}
                    >
                      Raw
                    </button>
                    <button
                      className={viewMode === 'parsed' ? 'active' : ''}
                      onClick={() => setViewMode('parsed')}
                    >
                      Parsed
                    </button>
                  </div>
                )}
              </div>
              <div className="body-content">
                <pre><code ref={codeRef} className="language-json">{formatBody(response.body)}</code></pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {response?.body.ttml && (
        <Timeline ttml={response.body.ttml} />
      )}

      {(song || artist) && (
        <CodeExamples
          song={song}
          artist={artist}
          album={album}
          duration={duration}
          provider={provider}
        />
      )}

      <style>{`
        .playground {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          overflow: hidden;
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
          gap: var(--space-2);
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
          padding: var(--space-3) var(--space-4);
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          min-width: 100px;
        }

        .provider-tab:hover {
          border-color: var(--border-hover);
          background-color: var(--bg-tertiary);
        }

        .provider-tab.active {
          border-color: var(--accent-border);
          background-color: var(--accent-subtle);
        }

        .provider-tab-label {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .provider-tab-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .provider-tab.active .provider-tab-label {
          color: var(--accent);
        }

        .provider-tab.active .provider-tab-desc {
          color: var(--text-secondary);
        }

        .fetch-btn {
          align-self: flex-start;
          padding: var(--space-3) var(--space-6);
          background-color: var(--accent);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          font-size: 0.9375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .fetch-btn:hover:not(:disabled) {
          background-color: var(--accent-hover);
        }

        .fetch-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .playground-response {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
        }

        .response-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          border-bottom: 1px solid var(--border);
          background-color: var(--bg-tertiary);
        }

        .response-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .response-meta {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .status-badge {
          font-weight: 600;
          font-size: 0.875rem;
        }

        .response-time {
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        .response-content {
          display: grid;
          grid-template-columns: 240px minmax(0, 1fr);
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .response-content {
            grid-template-columns: 1fr;
          }
        }

        .response-headers {
          padding: var(--space-4);
          border-right: 1px solid var(--border);
          background-color: var(--bg-primary);
        }

        @media (max-width: 768px) {
          .response-headers {
            border-right: none;
            border-bottom: 1px solid var(--border);
          }
        }

        .response-headers h4,
        .response-body h4 {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 var(--space-3);
        }

        .headers-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .header-item {
          font-size: 0.8125rem;
          word-break: break-all;
        }

        .header-key {
          color: var(--text-muted);
        }

        .header-value {
          color: var(--text-secondary);
          margin-left: var(--space-1);
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
          margin-bottom: var(--space-3);
        }

        .body-header h4 {
          margin: 0;
        }

        .view-toggle {
          display: flex;
          gap: var(--space-1);
        }

        .view-toggle button {
          padding: var(--space-1) var(--space-3);
          font-size: 0.75rem;
          font-weight: 500;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .view-toggle button:hover {
          border-color: var(--border-hover);
          color: var(--text-secondary);
        }

        .view-toggle button.active {
          background-color: var(--bg-tertiary);
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        .body-content {
          background-color: var(--bg-primary);
          border-radius: var(--radius-md);
          font-size: 0.8125rem;
          max-height: 400px;
          overflow: auto;
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
