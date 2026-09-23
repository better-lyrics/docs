import '@braccato/core/element';
import '@braccato/core/styles/variables.css';
import '@braccato/core/styles/lyrics.css';
import '@braccato/core/styles/instrumental.css';
import type { BraccatoLyricsElement, LineClickDetail } from '@braccato/core/element';
import { detectParser, type Lyric } from '@braccato/parsers';
import { useEffect, useMemo, useRef, useState } from 'react';
import braccatoTheme from './braccato-theme.css?raw';
import Morph from './Morph';
import { TextMorph } from 'torph/react';

interface LyricsPreviewProps {
  content: string;
  durationS?: number;
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function endOf(lyrics: Lyric[]): number {
  const last = lyrics[lyrics.length - 1];
  return last ? (last.startTimeMs + last.durationMs) / 1000 : 0;
}

export default function LyricsPreview({ content, durationS }: LyricsPreviewProps) {
  const elementRef = useRef<BraccatoLyricsElement>(null);
  const scrubberRef = useRef<HTMLInputElement>(null);
  const clock = useRef({ timeS: 0, playing: false, startedAt: 0, startedFromS: 0 });
  const [timeS, setTimeS] = useState(0);
  const [playing, setPlaying] = useState(false);

  const lyrics = useMemo(() => {
    try {
      return detectParser(content).parse(content, durationS ? durationS * 1000 : undefined);
    } catch {
      return null;
    }
  }, [content, durationS]);

  const totalS = durationS || (lyrics ? endOf(lyrics) : 0);

  const seek = (toS: number) => {
    const c = clock.current;
    c.timeS = Math.min(Math.max(0, toS), totalS);
    c.startedAt = performance.now();
    c.startedFromS = c.timeS;
    setTimeS(c.timeS);
  };

  const togglePlaying = () => {
    const c = clock.current;
    if (!c.playing && c.timeS >= totalS) seek(0);
    c.playing = !c.playing;
    c.startedAt = performance.now();
    c.startedFromS = c.timeS;
    setPlaying(c.playing);
  };

  useEffect(() => {
    const el = elementRef.current;
    if (el) el.theme = braccatoTheme;
  }, []);

  useEffect(() => {
    const el = elementRef.current;
    if (el && lyrics) el.lyrics = lyrics;
    clock.current = { timeS: 0, playing: false, startedAt: 0, startedFromS: 0 };
    setTimeS(0);
    setPlaying(false);
  }, [lyrics]);

  useEffect(() => {
    let frameId: number;
    let lastShownS = -1;
    const tick = () => {
      const c = clock.current;
      if (c.playing) {
        c.timeS = c.startedFromS + (performance.now() - c.startedAt) / 1000;
        if (c.timeS >= totalS) {
          c.timeS = totalS;
          c.playing = false;
          setPlaying(false);
        }
      }
      const el = elementRef.current;
      if (el) {
        el.currentTime = c.timeS;
        el.playing = c.playing;
      }
      const scrubber = scrubberRef.current;
      if (scrubber && totalS > 0) {
        scrubber.value = String(c.timeS);
        scrubber.style.setProperty('--progress', `${(c.timeS / totalS) * 100}%`);
      }
      if (Math.floor(c.timeS) !== lastShownS) {
        lastShownS = Math.floor(c.timeS);
        setTimeS(c.timeS);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [totalS]);

  const seekRef = useRef(seek);
  seekRef.current = seek;

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const onLineClick = (e: Event) => {
      const detail = (e as CustomEvent<LineClickDetail>).detail;
      if (detail?.timeS != null) seekRef.current(detail.timeS);
    };
    const noteUserScroll = () => el.renderer?.noteUserScroll();
    el.addEventListener('braccato:line-click', onLineClick);
    el.addEventListener('scroll', noteUserScroll, { passive: true });
    return () => {
      el.removeEventListener('braccato:line-click', onLineClick);
      el.removeEventListener('scroll', noteUserScroll);
    };
  }, []);

  if (!lyrics) {
    return <p className="preview-empty">These lyrics could not be parsed.</p>;
  }

  return (
    <div className="preview">
      <braccato-lyrics ref={elementRef} />

      <div className="preview-transport">
        <button
          type="button"
          className="preview-play"
          onClick={togglePlaying}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <Morph
            state={playing ? 'playing' : 'paused'}
            states={{
              paused: (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
                </svg>
              ),
              playing: (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ),
            }}
          />
        </button>
        <TextMorph className="preview-time">{formatTime(timeS)}</TextMorph>
        <input
          ref={scrubberRef}
          type="range"
          className="preview-scrubber"
          min={0}
          max={totalS}
          step={0.1}
          defaultValue={0}
          onInput={(e) => seek(Number(e.currentTarget.value))}
          aria-label="Seek"
          aria-valuetext={`${formatTime(timeS)} of ${formatTime(totalS)}`}
        />
        <span className="preview-time">{formatTime(totalS)}</span>
      </div>

      <style>{`
        :root {
          --blyrics-text-color: var(--text-primary);
          --blyrics-inactive-opacity: 0.2;
          --blyrics-font-size: 1.75rem;
        }

        .preview {
          display: flex;
          flex-direction: column;
        }

        .preview braccato-lyrics {
          display: block;
          height: 480px;
          padding: 0 var(--space-6);
          overflow-x: hidden;
          overflow-y: auto;
          scrollbar-width: none;
        }

        .preview braccato-lyrics::-webkit-scrollbar {
          display: none;
        }

        .preview braccato-lyrics .blyrics-container {
          padding-top: 2rem;
        }

        .preview-transport {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-top: 1px solid var(--border-subtle);
        }

        .preview-play {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          flex-shrink: 0;
          border: none;
          border-radius: var(--radius-full);
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
          cursor: pointer;
          transition: background-color var(--transition-fast);
        }

        .preview-play:hover {
          background-color: rgba(255, 255, 255, 0.12);
        }

        .preview-play svg {
          width: 0.75rem;
          height: 0.75rem;
        }

        .preview-time {
          min-width: 2.25rem;
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }

        .preview-time:last-child {
          text-align: right;
        }

        .preview-scrubber {
          --progress: 0%;
          flex: 1;
          height: 1rem;
          padding: 0;
          border: none;
          border-radius: 0;
          background: none;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
        }

        .preview-scrubber:focus {
          border: none;
        }

        .preview-scrubber::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: var(--radius-full);
          background: linear-gradient(to right, var(--text-primary) var(--progress), var(--border-hover) var(--progress));
        }

        .preview-scrubber::-moz-range-track {
          height: 3px;
          border-radius: var(--radius-full);
          background: linear-gradient(to right, var(--text-primary) var(--progress), var(--border-hover) var(--progress));
        }

        .preview-scrubber::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 0.625rem;
          height: 0.625rem;
          margin-top: calc((3px - 0.625rem) / 2);
          border-radius: var(--radius-full);
          background-color: var(--text-primary);
          transform: scale(0);
          transition: transform var(--transition-fast);
        }

        .preview-scrubber::-moz-range-thumb {
          width: 0.625rem;
          height: 0.625rem;
          border: none;
          border-radius: var(--radius-full);
          background-color: var(--text-primary);
          transform: scale(0);
          transition: transform var(--transition-fast);
        }

        .preview-scrubber:hover::-webkit-slider-thumb,
        .preview-scrubber:focus-visible::-webkit-slider-thumb,
        .preview-scrubber:active::-webkit-slider-thumb {
          transform: scale(1);
        }

        .preview-scrubber:hover::-moz-range-thumb,
        .preview-scrubber:focus-visible::-moz-range-thumb,
        .preview-scrubber:active::-moz-range-thumb {
          transform: scale(1);
        }

        .preview-empty {
          padding: var(--space-6) var(--space-4);
          margin: 0;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
