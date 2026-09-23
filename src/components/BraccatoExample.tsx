import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TextMorph } from 'torph/react';

interface BraccatoExampleProps {
  song: string;
  artist: string;
  album?: string;
  duration?: string;
  title?: ReactNode;
  docsHref?: string;
  docsLabel?: string;
  children?: ReactNode;
}

const INSTALL = 'npm i @braccato/core @braccato/provider-blyrics';

const PROVIDERS = [
  {
    key: 'ttml',
    displayName: 'TTML',
    syncType: 'syllable',
    factory: 'createBLyricsProvider',
  },
  {
    key: 'qq',
    displayName: 'QQ',
    syncType: 'word',
    factory: 'createPortatoProvider',
  },
  {
    key: 'kugou',
    displayName: 'Kugou',
    syncType: 'line',
    factory: 'createLegatoProvider',
  },
];

function buildSteps(song: string, artist: string, album?: string, duration?: string) {
  const fields = [
    `song: ${JSON.stringify(song)}`,
    `artist: ${JSON.stringify(artist)}`,
    ...(album ? [`album: ${JSON.stringify(album)}`] : []),
    ...(Number(duration) > 0 ? [`duration: ${Number(duration)}`] : []),
    'signal: new AbortController().signal',
  ];

  return [
    {
      title: 'Import',
      hint: 'element, styles, providers',
      code: `import "@braccato/core/element";
import "@braccato/core/styles/variables.css";
import "@braccato/core/styles/lyrics.css";
import "@braccato/core/styles/instrumental.css";
import {
  ProviderChain,
${PROVIDERS.map((p) => `  ${p.factory},`).join('\n')}
} from "@braccato/provider-blyrics";`,
    },
    {
      title: 'Build the chain',
      hint: 'first match wins',
      code: `const chain = new ProviderChain();
${PROVIDERS.map(
  (p) => `chain.register({
  key: "${p.key}",
  displayName: "${p.displayName}",
  syncType: "${p.syncType}",
  fetch: ${p.factory}(),
});`,
).join('\n')}`,
    },
    {
      title: 'Fetch and render',
      hint: 'hand the result to the element',
      code: `const result = await chain.fetchLyrics({
${fields.map((field) => `  ${field},`).join('\n')}
});

// <audio id="player" src="song.mp3"></audio>
// <braccato-lyrics source="#player"></braccato-lyrics>
if (result) {
  document.querySelector("braccato-lyrics").lyrics = result.lyrics;
}`,
    },
  ];
}

export default function BraccatoExample({
  song,
  artist,
  album,
  duration,
  title = (
    <>
      Powered by <a href="/braccato">Braccato</a>
    </>
  ),
  docsHref = '/braccato',
  docsLabel = 'Read the docs',
  children,
}: BraccatoExampleProps) {
  const codeRefs = useRef<(HTMLElement | null)[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const steps = useMemo(() => buildSteps(song, artist, album, duration), [song, artist, album, duration]);
  const allCode = `// ${INSTALL}\n${steps.map((step) => step.code).join('\n\n')}`;

  useEffect(() => {
    codeRefs.current.forEach((el) => {
      if (el && window.Prism) window.Prism.highlightElement(el);
    });
  }, [steps]);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <section className="bx">
      <div className="bx-grid">
        <div className="bx-side">
          <div className="bx-side-inner">
            <div>
              <h4 className="bx-title">{title}</h4>
              <div className="bx-description">
                {children ?? (
                  <p>
                    The player above is <code>&lt;braccato-lyrics&gt;</code>. Here is the whole setup for your own app,{' '}
                    <a href="/braccato/provider">provider fallback</a> included.
                  </p>
                )}
              </div>
            </div>
            <div className="bx-install">
              <span>{INSTALL}</span>
              <button type="button" className="bx-ghost" onClick={() => copy('install', INSTALL)}>
                <TextMorph>{copied === 'install' ? 'Copied' : 'Copy'}</TextMorph>
              </button>
            </div>
            <div className="bx-actions">
              <a className="bx-docs" href={docsHref}>
                {docsLabel}
              </a>
              <button type="button" className="bx-ghost bx-secondary" onClick={() => copy('all', allCode)}>
                <TextMorph>{copied === 'all' ? 'Copied all code' : 'Copy all code'}</TextMorph>
              </button>
            </div>
          </div>
        </div>

        <ol className="bx-steps">
          {steps.map((step, i) => (
            <li key={step.title}>
              <div className="bx-step-head">
                <h5>{step.title}</h5>
                <span className="bx-hint">{step.hint}</span>
                <button type="button" className="bx-ghost" onClick={() => copy(step.title, step.code)}>
                  <TextMorph>{copied === step.title ? 'Copied' : 'Copy'}</TextMorph>
                </button>
              </div>
              <pre>
                <code
                  ref={(el) => {
                    codeRefs.current[i] = el;
                  }}
                  className="language-javascript"
                >
                  {step.code}
                </code>
              </pre>
            </li>
          ))}
        </ol>
      </div>

      <style>{`
        .bx {
          container-type: inline-size;
          border-top: 1px solid var(--border-subtle);
        }

        .bx-grid {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
        }

        .bx-side {
          position: relative;
          padding: var(--space-10) var(--space-6) var(--space-6);
          border-right: 1px solid var(--border-subtle);
          overflow: clip;
        }

        .bx-side::before {
          content: '';
          position: absolute;
          top: 0;
          left: 30%;
          width: 40rem;
          height: 30rem;
          transform: translate(-50%, -50%);
          background: radial-gradient(closest-side, rgba(255, 255, 255, 0.1), transparent);
          pointer-events: none;
        }

        .bx-side-inner {
          position: sticky;
          top: calc(var(--header-height) + var(--space-6));
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .bx .bx-title {
          margin: 0 0 var(--space-2);
          font-size: 1.5rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--text-primary);
        }

        .bx-title a {
          color: inherit;
          text-decoration: none;
        }

        .bx-description p {
          margin: 0;
          font-size: 0.9375rem;
          line-height: 1.6;
          color: var(--text-muted);
        }

        .bx-description code {
          white-space: nowrap;
        }

        .bx-install {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--code-text);
          background-color: var(--bg-primary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
        }

        .bx-install > span {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bx-install > span::before {
          content: '$ ';
          color: var(--text-muted);
        }

        .bx-ghost {
          display: inline-flex;
          flex-shrink: 0;
          padding: var(--space-1) var(--space-2);
          font-family: var(--font-sans);
          font-size: 0.75rem;
          font-weight: 500;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-muted);
          cursor: pointer;
          white-space: nowrap;
          transition: color var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast);
        }

        .bx-ghost:hover {
          color: var(--text-primary);
          background-color: var(--bg-tertiary);
        }

        .bx-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-2);
        }

        .bx-actions > * {
          line-height: 1.25rem;
        }

        .bx-docs {
          padding: var(--space-2) var(--space-3);
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--bg-primary);
          background-color: var(--text-primary);
          border: 1px solid var(--text-primary);
          border-radius: var(--radius-md);
          text-decoration: none;
          transition: opacity var(--transition-fast);
        }

        .bx-docs:hover {
          color: var(--bg-primary);
          opacity: 0.88;
        }

        .bx-ghost.bx-secondary {
          padding: var(--space-2) var(--space-3);
          font-size: 0.8125rem;
          color: var(--text-secondary);
          border: 1px solid var(--border);
        }

        .bx-ghost.bx-secondary:hover {
          border-color: var(--border-hover);
        }

        .bx-steps {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          min-width: 0;
          margin: 0;
          padding: var(--space-5) var(--space-4) var(--space-4);
          list-style: none;
          counter-reset: bx-step;
        }

        .bx-steps li {
          display: grid;
          grid-template-columns: 1.5rem minmax(0, 1fr);
          column-gap: var(--space-3);
          row-gap: var(--space-2);
          margin: 0;
          counter-increment: bx-step;
        }

        .bx-steps li::before {
          content: counter(bx-step);
          display: grid;
          place-items: center;
          width: 1.5rem;
          height: 1.5rem;
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          font-weight: 500;
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .bx-step-head {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-height: 1.5rem;
        }

        .bx .bx-step-head h5 {
          margin: 0;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .bx-hint {
          flex: 1;
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        .bx-steps pre {
          grid-column: 2;
          margin: 0;
          padding: 0;
          background-color: var(--bg-primary);
          border: none;
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .bx-steps pre code {
          display: block;
          padding: var(--space-4);
          overflow-x: auto;
          font-family: var(--font-mono);
          white-space: pre;
        }

        @container (max-width: 40rem) {
          .bx-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .bx-side {
            padding-top: var(--space-8);
            border-right: none;
            border-bottom: 1px solid var(--border-subtle);
          }
        }
      `}</style>
    </section>
  );
}
