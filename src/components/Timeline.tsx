import { useState, useMemo, useRef, useCallback } from "react";

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
  v1: "#f20c32", // red (primary)
  v2: "#3b82f6", // blue
  v3: "#10b981", // emerald
  v4: "#f59e0b", // amber
  v5: "#8b5cf6", // violet
  v6: "#ec4899", // pink
  v7: "#06b6d4", // cyan
  v8: "#84cc16", // lime
  v9: "#f97316", // orange
  v10: "#6366f1", // indigo
  v11: "#14b8a6", // teal
  v12: "#a855f7", // purple
  v13: "#eab308", // yellow
  v14: "#0ea5e9", // sky
  v15: "#22c55e", // green
  v1000: "#d946ef", // fuchsia (multiple speakers together)
};

const DEFAULT_SPEAKER_COLOR = "#71717a"; // zinc-500

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
  const [expanded, setExpanded] = useState(true);
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
    <div className="timeline-container">
      <div className={`timeline-header ${!expanded ? "collapsed" : ""}`}>
        <span className="timeline-title">Timeline</span>
        <div className="timeline-controls">
          {expanded && zoom > 1 && (
            <span className="zoom-indicator">{zoom.toFixed(1)}x</span>
          )}
          {expanded && (
            <div className="zoom-buttons">
              <button
                className="zoom-btn"
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                title="Zoom out"
              >
                −
              </button>
              <button
                className="zoom-btn"
                onClick={handleResetZoom}
                disabled={zoom === 1}
                title="Reset zoom"
              >
                ⟲
              </button>
              <button
                className="zoom-btn"
                onClick={handleZoomIn}
                disabled={zoom >= 20}
                title="Zoom in"
              >
                +
              </button>
            </div>
          )}
          <button
            className="collapse-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {expanded && (
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

            {zoom > 1 && (
              <div className="zoom-hint">Scroll to zoom • Drag to pan</div>
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
                    <span className="timing-badge">
                      {formatTime(line.begin)} - {formatTime(line.end)}
                    </span>
                    {line.agent && (
                      <span
                        className="speaker-badge"
                        style={{ backgroundColor: speakerColor }}
                      >
                        {line.agent.toUpperCase()}
                      </span>
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
      )}

      <style>{`
        .timeline-container {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          margin-top: var(--space-6);
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          border-bottom: 1px solid var(--border);
          background-color: var(--bg-tertiary);
        }

        .timeline-header.collapsed {
          border-bottom: none;
        }

        .timeline-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .timeline-controls {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .zoom-indicator {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .zoom-buttons {
          display: flex;
          gap: var(--space-1);
        }

        .zoom-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 500;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .zoom-btn:hover:not(:disabled) {
          border-color: var(--border-hover);
          color: var(--text-secondary);
        }

        .zoom-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .collapse-btn {
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

        .collapse-btn:hover {
          border-color: var(--border-hover);
          color: var(--text-secondary);
        }

        .timeline-content {
          padding: var(--space-4);
        }

        .timeline-track {
          position: relative;
          height: 80px;
          background-color: var(--bg-primary);
          border-radius: var(--radius-md);
          cursor: crosshair;
          margin-bottom: var(--space-4);
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
          position: absolute;
          bottom: 4px;
          right: 8px;
          font-size: 0.625rem;
          color: var(--text-muted);
          opacity: 0.6;
          pointer-events: none;
        }

        .time-markers {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 20px;
          border-bottom: 1px solid var(--border);
          pointer-events: none;
        }

        .time-marker {
          position: absolute;
          top: 0;
          height: 100%;
          border-left: 1px solid var(--border);
        }

        .time-marker:first-child {
          border-left: none;
        }

        .marker-label {
          position: absolute;
          top: 2px;
          left: 4px;
          font-size: 0.625rem;
          color: var(--text-muted);
          white-space: nowrap;
          user-select: none;
          pointer-events: none;
        }

        .timeline-bars {
          position: absolute;
          top: 24px;
          left: 0;
          right: 0;
          bottom: 4px;
        }

        .timeline-bar {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          height: 24px;
          background-color: color-mix(in srgb, var(--speaker-color) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--speaker-color) 50%, transparent);
          border-radius: 2px;
          cursor: pointer;
          min-width: 2px;
        }

        .timeline-bar.background-vocals {
          height: 12px;
        }

        .timeline-bar:hover {
          background-color: color-mix(in srgb, var(--speaker-color) 30%, transparent);
          border-color: var(--speaker-color);
          z-index: 1;
        }

        .timeline-track:not(.dragging) .timeline-bar {
          transition: background-color var(--transition-fast), border-color var(--transition-fast);
        }

        .timeline-bar.selected {
          background-color: var(--speaker-color);
          border-color: var(--speaker-color);
        }

        .scrubber {
          position: absolute;
          top: 20px;
          bottom: 0;
          width: 2px;
          background-color: var(--text-primary);
          pointer-events: none;
        }

        .scrubber::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -4px;
          width: 10px;
          height: 10px;
          background-color: var(--text-primary);
          border-radius: 50%;
        }

        .lines-list {
          max-height: 300px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .line-item {
          padding: var(--space-3);
          background-color: var(--bg-primary);
          border: 1px solid var(--border);
          border-left: 1px solid var(--speaker-color);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .line-item:hover {
          border-color: var(--border-hover);
          border-left-color: var(--speaker-color);
        }

        .line-item.selected {
          border-color: var(--speaker-color);
          border-left-color: var(--speaker-color);
          background-color: color-mix(in srgb, var(--speaker-color) 8%, var(--bg-primary));
        }


        .line-timing {
          margin-bottom: var(--space-1);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .timing-badge {
          font-size: 0.6875rem;
          font-family: var(--font-mono);
          color: var(--text-muted);
          background-color: var(--bg-secondary);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
        }

        .speaker-badge {
          font-size: 0.625rem;
          font-weight: 600;
          color: white;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        .line-text {
          font-size: 0.9375rem;
          color: var(--text-primary);
          line-height: 1.4;
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .lead-text {
          color: var(--text-primary);
        }

        .bg-text {
          font-style: italic;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .transliteration-text {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin-top: var(--space-1);
        }

        .word-breakdown {
          margin-top: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .word-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .word-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-1) var(--space-2);
          background-color: var(--bg-secondary);
          border-radius: var(--radius-sm);
        }

        .word-item.background-word .word-text {
          font-style: italic;
          color: var(--text-secondary);
        }

        .transliteration-row {
          border-top: 1px dashed var(--border);
          padding-top: var(--space-2);
        }

        .word-item.transliteration-word .word-text {
          color: var(--text-muted);
        }

        .word-text {
          font-size: 0.8125rem;
          color: var(--text-primary);
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
