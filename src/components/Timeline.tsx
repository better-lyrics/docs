import { useState, useMemo, useRef, useCallback } from "react";
import { TextMorph } from "torph/react";

interface ParsedWord {
  begin: number;
  end: number;
  text: string;
  isBackground?: boolean;
}

interface ParsedLine {
  begin: number;
  end: number;
  text: string;
  leadText: string;
  bgText: string;
  words: ParsedWord[];
  agent?: string;
  key?: string;
  transliteration?: {
    text: string;
    words: ParsedWord[];
  };
}

interface TimelineProps {
  ttml: string;
}

const SPEAKER_COLORS: Record<string, string> = {
  v1: "oklch(0.86 0.01 280)",
  v2: "oklch(0.74 0.11 250)",
  v3: "oklch(0.76 0.11 160)",
  v4: "oklch(0.8 0.1 80)",
  v5: "oklch(0.72 0.12 300)",
  v6: "oklch(0.74 0.11 350)",
  v7: "oklch(0.78 0.09 200)",
  v8: "oklch(0.8 0.1 125)",
  v1000: "oklch(0.74 0.1 320)",
  v2000: "oklch(0.8 0.07 65)",
};

const DEFAULT_SPEAKER_COLOR = "oklch(0.65 0.02 280)";

function getSpeakerColor(agent?: string): string {
  if (!agent) return SPEAKER_COLORS.v1;
  return SPEAKER_COLORS[agent] || DEFAULT_SPEAKER_COLOR;
}

function hasOnlyBackgroundVocals(line: ParsedLine): boolean {
  return line.words.length > 0 && line.words.every((w) => w.isBackground);
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;

  const parts = timeStr.split(":");
  let seconds = 0;

  if (parts.length === 3) {
    seconds =
      parseInt(parts[0]) * 3600 +
      parseInt(parts[1]) * 60 +
      parseFloat(parts[2]);
  } else if (parts.length === 2) {
    seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    seconds = parseFloat(parts[0]);
  }

  return Math.round(seconds * 1000);
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 1000);

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}

function parseTTML(ttml: string): ParsedLine[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ttml, "text/xml");
    const lines: ParsedLine[] = [];

    // Parse transliterations from metadata
    const transliterationMap = new Map<
      string,
      { text: string; words: ParsedWord[] }
    >();
    doc.querySelectorAll("transliteration text").forEach((textEl) => {
      const forKey = textEl.getAttribute("for");
      if (!forKey) return;

      const words: ParsedWord[] = [];
      textEl.querySelectorAll("span[begin]").forEach((span) => {
        words.push({
          begin: parseTime(span.getAttribute("begin") || ""),
          end: parseTime(span.getAttribute("end") || ""),
          text: span.textContent || "",
        });
      });

      transliterationMap.set(forKey, {
        text: textEl.textContent || "",
        words,
      });
    });

    doc.querySelectorAll("p").forEach((p) => {
      const agent = p.getAttribute("ttm:agent") || undefined;
      const key = p.getAttribute("itunes:key") || undefined;
      const words: ParsedWord[] = [];

      // Get background text from x-bg spans and lead text excluding them
      let bgText = "";
      let leadText = "";

      function collectText(element: Element, inBackground = false) {
        element.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (inBackground) {
              bgText += node.textContent || "";
            } else {
              leadText += node.textContent || "";
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const isBackground =
              inBackground || el.getAttribute("ttm:role") === "x-bg";
            collectText(el, isBackground);
          }
        });
      }
      collectText(p);
      leadText = leadText.trim();
      bgText = bgText.trim();

      // Get all spans with timing (the actual word spans)
      p.querySelectorAll("span[begin]").forEach((span) => {
        // Check if this span or any ancestor has ttm:role="x-bg"
        let isBackground = false;
        let parent = span.parentElement;
        while (parent && parent !== p) {
          if (parent.getAttribute("ttm:role") === "x-bg") {
            isBackground = true;
            break;
          }
          parent = parent.parentElement;
        }

        words.push({
          begin: parseTime(span.getAttribute("begin") || ""),
          end: parseTime(span.getAttribute("end") || ""),
          text: span.textContent || "",
          isBackground: isBackground || undefined,
        });
      });

      // Get transliteration if available
      const transliteration = key ? transliterationMap.get(key) : undefined;

      lines.push({
        begin: parseTime(p.getAttribute("begin") || ""),
        end: parseTime(p.getAttribute("end") || ""),
        text: p.textContent || "",
        leadText,
        bgText,
        words,
        agent,
        key,
        transliteration,
      });
    });

    return lines;
  } catch {
    return [];
  }
}

export default function Timeline({ ttml }: TimelineProps) {
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, offset: 0 });
  const didDragRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const lines = useMemo(() => parseTTML(ttml), [ttml]);
  const agents = useMemo(
    () =>
      [...new Set(lines.flatMap((line) => (line.agent ? [line.agent] : [])))].sort(
        (a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')),
      ),
    [lines],
  );

  const totalDuration = useMemo(() => {
    if (lines.length === 0) return 0;
    return Math.max(...lines.map((l) => l.end));
  }, [lines]);

  const visibleDuration = totalDuration / zoom;
  const maxPanOffset = Math.max(0, totalDuration - visibleDuration);

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    // Adjust interval based on zoom level
    let interval = 60000; // 1 minute default
    if (zoom >= 4) interval = 10000; // 10s when zoomed in a lot
    else if (zoom >= 2) interval = 30000; // 30s when moderately zoomed
    else if (totalDuration <= 180000) interval = 30000;

    const startTime = Math.floor(panOffset / interval) * interval;
    const endTime = panOffset + visibleDuration;

    for (let i = startTime; i <= endTime + interval; i += interval) {
      if (i >= 0 && i <= totalDuration) {
        markers.push(i);
      }
    }
    return markers;
  }, [totalDuration, zoom, panOffset, visibleDuration]);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        !timelineRef.current ||
        totalDuration === 0 ||
        isDragging ||
        didDragRef.current
      )
        return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const time = panOffset + percentage * visibleDuration;
      const clampedTime = Math.max(0, Math.min(totalDuration, time));

      setScrubPosition(clampedTime);

      // Find the line that contains this time, or the nearest one
      const lineIndex = lines.findIndex(
        (line) => clampedTime >= line.begin && clampedTime <= line.end
      );

      if (lineIndex !== -1) {
        setSelectedLine(lineIndex);
        const lineElement = lineRefs.current.get(lineIndex);
        if (lineElement) {
          lineElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    },
    [totalDuration, lines, panOffset, visibleDuration, isDragging]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      e.preventDefault();

      const rect = timelineRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mousePercentage = mouseX / rect.width;
      const mouseTime = panOffset + mousePercentage * visibleDuration;

      // Zoom in/out
      const zoomDelta = e.deltaY > 0 ? 0.8 : 1.25;
      const newZoom = Math.max(1, Math.min(20, zoom * zoomDelta));

      // Adjust pan to keep mouse position stable
      const newVisibleDuration = totalDuration / newZoom;
      const newPanOffset = Math.max(
        0,
        Math.min(
          totalDuration - newVisibleDuration,
          mouseTime - mousePercentage * newVisibleDuration
        )
      );

      setZoom(newZoom);
      setPanOffset(newPanOffset);
    },
    [zoom, panOffset, visibleDuration, totalDuration]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (zoom <= 1) return;
      e.preventDefault();
      setIsDragging(true);
      didDragRef.current = false;
      dragStartRef.current = { x: e.clientX, offset: panOffset };
    },
    [zoom, panOffset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging || !timelineRef.current) return;

      // Mark that actual dragging occurred
      const deltaX = Math.abs(e.clientX - dragStartRef.current.x);
      if (deltaX > 3) {
        didDragRef.current = true;
      }

      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      const rect = timelineRef.current.getBoundingClientRect();
      const deltaTime =
        ((e.clientX - dragStartRef.current.x) / rect.width) * visibleDuration;
      const newOffset = Math.max(
        0,
        Math.min(maxPanOffset, dragStartRef.current.offset - deltaTime)
      );

      // Use RAF for smooth state updates
      rafRef.current = requestAnimationFrame(() => {
        setPanOffset(newOffset);
      });
    },
    [isDragging, visibleDuration, maxPanOffset]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setIsDragging(false);
    // Reset didDrag after a short delay to allow click event to check it
    setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setIsDragging(false);
    didDragRef.current = false;
  }, [isDragging]);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(20, zoom * 1.5);
    const newVisibleDuration = totalDuration / newZoom;
    const centerTime = panOffset + visibleDuration / 2;
    const newPanOffset = Math.max(
      0,
      Math.min(
        totalDuration - newVisibleDuration,
        centerTime - newVisibleDuration / 2
      )
    );
    setZoom(newZoom);
    setPanOffset(newPanOffset);
  }, [zoom, panOffset, visibleDuration, totalDuration]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(1, zoom / 1.5);
    const newVisibleDuration = totalDuration / newZoom;
    const centerTime = panOffset + visibleDuration / 2;
    const newPanOffset = Math.max(
      0,
      Math.min(
        totalDuration - newVisibleDuration,
        centerTime - newVisibleDuration / 2
      )
    );
    setZoom(newZoom);
    setPanOffset(newPanOffset);
  }, [zoom, panOffset, visibleDuration, totalDuration]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPanOffset(0);
  }, []);

  // Helper to convert time to position percentage in current view
  const timeToPosition = useCallback(
    (time: number) => ((time - panOffset) / visibleDuration) * 100,
    [panOffset, visibleDuration]
  );

  const handleLineClick = useCallback(
    (index: number, line: ParsedLine, shouldScroll = true) => {
      setSelectedLine(index);
      setScrubPosition(line.begin);

      if (shouldScroll) {
        const lineElement = lineRefs.current.get(index);
        if (lineElement) {
          lineElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    },
    []
  );

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="timeline">
      <div className="timeline-toolbar">
        <div className="timeline-legend">
          {agents.map((agent) => (
            <span key={agent} className="speaker-pill" style={{ '--speaker-color': getSpeakerColor(agent) } as React.CSSProperties}>
              {agent}
            </span>
          ))}
        </div>
        <div className="zoom-controls">
          <TextMorph className="zoom-hint">{zoom > 1 ? 'Scroll to zoom, drag to pan' : 'Scroll to zoom'}</TextMorph>
          <TextMorph className="zoom-indicator">{`${zoom.toFixed(1)}x`}</TextMorph>
          <button className="zoom-btn" onClick={handleZoomOut} disabled={zoom <= 1} aria-label="Zoom out">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          <button className="zoom-btn" onClick={handleResetZoom} disabled={zoom === 1} aria-label="Reset zoom">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
          </button>
          <button className="zoom-btn" onClick={handleZoomIn} disabled={zoom >= 20} aria-label="Zoom in">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          </button>
        </div>
      </div>

        <div className="timeline-content">
          <div
            className={`timeline-track ${zoom > 1 ? "zoomable" : ""} ${
              isDragging ? "dragging" : ""
            }`}
            ref={timelineRef}
            onClick={handleTimelineClick}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <div className="time-markers">
              {timeMarkers.map((time) => {
                const pos = timeToPosition(time);
                return (
                  <div
                    key={time}
                    className="time-marker"
                    style={{ left: `${pos}%` }}
                  >
                    <span className="marker-label">
                      {Math.floor(time / 60000)}:
                      {String(Math.floor((time % 60000) / 1000)).padStart(
                        2,
                        "0"
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="timeline-bars">
              {lines.map((line, index) => {
                const leftPos = timeToPosition(line.begin);
                const rightPos = timeToPosition(line.end);
                const width = rightPos - leftPos;
                const speakerColor = getSpeakerColor(line.agent);
                const isBackgroundLine = hasOnlyBackgroundVocals(line);

                return (
                  <div
                    key={index}
                    className={`timeline-bar ${
                      selectedLine === index ? "selected" : ""
                    } ${isBackgroundLine ? "background-vocals" : ""}`}
                    style={
                      {
                        left: `${leftPos}%`,
                        width: `${Math.max(0.5, width)}%`,
                        "--speaker-color": speakerColor,
                      } as React.CSSProperties
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (didDragRef.current) return;
                      handleLineClick(index, line);
                    }}
                    title={line.text.trim()}
                  />
                );
              })}
            </div>

            {scrubPosition !== null && (
              <div
                className="scrubber"
                style={{ left: `${timeToPosition(scrubPosition)}%` }}
              />
            )}

          </div>

          <div className="lines-list">
            {lines.map((line, index) => {
              const speakerColor = getSpeakerColor(line.agent);
              const isBackgroundLine = hasOnlyBackgroundVocals(line);

              return (
                <div
                  key={index}
                  ref={(el) => {
                    if (el) lineRefs.current.set(index, el);
                  }}
                  className={`line-item ${
                    selectedLine === index ? "selected" : ""
                  } ${isBackgroundLine ? "background-vocals" : ""}`}
                  style={
                    { "--speaker-color": speakerColor } as React.CSSProperties
                  }
                  onClick={() => handleLineClick(index, line, false)}
                >
                  <div className="line-timing">
                    <span className="line-time">{formatTime(line.begin)}</span>
                    {line.agent && (
                      <span className="speaker-pill">{line.agent}</span>
                    )}
                  </div>
                  <div className="line-text">
                    {line.bgText ? (
                      <>
                        {line.leadText && (
                          <span className="lead-text">{line.leadText}</span>
                        )}
                        <span className="bg-text">{line.bgText}</span>
                      </>
                    ) : (
                      line.text.trim() || "[instrumental]"
                    )}
                  </div>
                  {line.transliteration && (
                    <div className="transliteration-text">
                      {line.transliteration.text}
                    </div>
                  )}
                  {selectedLine === index && line.words.length > 0 && (
                    <div className="word-breakdown">
                      <div className="word-row">
                        {line.words
                          .filter((w) => !w.isBackground)
                          .map((word, wIndex) => (
                            <span key={wIndex} className="word-item">
                              <span className="word-text">{word.text}</span>
                              <span className="word-time">
                                {formatTime(word.begin)}
                              </span>
                            </span>
                          ))}
                      </div>
                      {line.words.some((w) => w.isBackground) && (
                        <div className="word-row background-row">
                          {line.words
                            .filter((w) => w.isBackground)
                            .map((word, wIndex) => (
                              <span
                                key={wIndex}
                                className="word-item background-word"
                              >
                                <span className="word-text">{word.text}</span>
                                <span className="word-time">
                                  {formatTime(word.begin)}
                                </span>
                              </span>
                            ))}
                        </div>
                      )}
                      {line.transliteration &&
                        line.transliteration.words.length > 0 && (
                          <div className="word-row transliteration-row">
                            {line.transliteration.words.map((word, wIndex) => (
                              <span
                                key={wIndex}
                                className="word-item transliteration-word"
                              >
                                <span className="word-text">{word.text}</span>
                                <span className="word-time">
                                  {formatTime(word.begin)}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      <style>{`
        .timeline {
          display: flex;
          flex-direction: column;
        }

        .timeline-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
        }

        .timeline-legend {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .speaker-pill {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          padding: 0.0625rem 0.4375rem;
          font-family: var(--font-mono);
          font-size: 0.625rem;
          font-weight: 500;
          line-height: 1.4;
          color: var(--speaker-color);
          background-color: color-mix(in srgb, var(--speaker-color) 14%, transparent);
          border: 1px solid color-mix(in srgb, var(--speaker-color) 28%, transparent);
          border-radius: var(--radius-full);
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .zoom-indicator {
          margin-right: var(--space-2);
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          color: var(--text-muted);
        }

        .zoom-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          padding: 0;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: color var(--transition-fast), background-color var(--transition-fast), opacity var(--transition-fast);
        }

        .zoom-btn svg {
          width: 0.875rem;
          height: 0.875rem;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .zoom-btn:hover:not(:disabled) {
          color: var(--text-primary);
          background-color: var(--bg-tertiary);
        }

        .zoom-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }

        .timeline-content {
          padding: 0 var(--space-4) var(--space-4);
        }

        .timeline-track {
          position: relative;
          height: 72px;
          background-color: var(--surface-panel);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          cursor: crosshair;
          margin-bottom: var(--space-3);
          overflow: hidden;
          user-select: none;
        }

        .timeline-track.zoomable {
          cursor: grab;
        }

        .timeline-track.dragging {
          cursor: grabbing;
        }

        .zoom-hint {
          margin-right: var(--space-3);
          font-size: 0.6875rem;
          color: var(--text-muted);
        }

        .time-markers {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .time-marker {
          position: absolute;
          top: 0;
          bottom: 0;
          border-left: 1px solid var(--border-subtle);
        }

        .time-marker:first-child {
          border-left: none;
        }

        .marker-label {
          position: absolute;
          top: 4px;
          left: 6px;
          font-family: var(--font-mono);
          font-size: 0.625rem;
          color: var(--text-muted);
          white-space: nowrap;
          user-select: none;
        }

        .timeline-bars {
          position: absolute;
          top: 24px;
          left: 0;
          right: 0;
          bottom: 8px;
        }

        .timeline-bar {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          height: 20px;
          background-color: color-mix(in srgb, var(--speaker-color) 35%, transparent);
          border-radius: 3px;
          cursor: pointer;
          min-width: 2px;
        }

        .timeline-bar.background-vocals {
          height: 8px;
          background-color: color-mix(in srgb, var(--speaker-color) 25%, transparent);
        }

        .timeline-bar:hover {
          background-color: color-mix(in srgb, var(--speaker-color) 65%, transparent);
          z-index: 1;
        }

        .timeline-track:not(.dragging) .timeline-bar {
          transition: background-color var(--transition-fast);
        }

        .timeline-bar.selected {
          background-color: var(--speaker-color);
        }

        .scrubber {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background-color: var(--text-primary);
          pointer-events: none;
        }

        .lines-list {
          max-height: 420px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          margin: 0 calc(-1 * var(--space-2));
        }

        .line-item {
          display: grid;
          grid-template-columns: 5.5rem minmax(0, 1fr);
          column-gap: var(--space-3);
          padding: var(--space-2);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background-color var(--transition-fast);
        }

        .line-item > :not(.line-timing) {
          grid-column: 2;
        }

        .line-item:hover {
          background-color: var(--surface-panel);
        }

        .line-item.selected {
          background-color: var(--bg-tertiary);
        }

        .line-timing {
          grid-row: 1 / span 4;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding-top: 0.125rem;
        }

        .line-time {
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }

        .line-text {
          font-size: 0.875rem;
          color: var(--text-primary);
          line-height: 1.5;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .lead-text {
          color: var(--text-primary);
        }

        .bg-text {
          font-style: italic;
          color: var(--text-secondary);
          font-size: 0.8125rem;
        }

        .line-item.background-vocals .line-text {
          font-style: italic;
          color: var(--text-secondary);
        }

        .transliteration-text {
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        .word-breakdown {
          margin-top: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .word-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }

        .word-item {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.125rem;
          padding: 0.25rem var(--space-2);
          background-color: var(--surface-panel);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
        }

        .word-item.background-word .word-text {
          font-style: italic;
          color: var(--text-secondary);
        }

        .word-item.transliteration-word .word-text {
          color: var(--text-muted);
        }

        .word-text {
          font-size: 0.8125rem;
          color: var(--text-primary);
          white-space: pre;
        }

        .word-time {
          font-size: 0.625rem;
          font-family: var(--font-mono);
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
