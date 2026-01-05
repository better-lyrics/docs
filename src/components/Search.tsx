import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface SearchResult {
  id: string;
  url: string;
  title: string;
  excerpt: string;
}

interface PagefindResult {
  id: string;
  url: string;
  meta: { title: string };
  excerpt: string;
}

interface Pagefind {
  search: (query: string) => Promise<{
    results: { id: string; data: () => Promise<PagefindResult> }[];
  }>;
}

export default function Search() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [pagefind, setPagefind] = useState<Pagefind | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load Pagefind on mount - use Function constructor to avoid Vite's static analysis
  useEffect(() => {
    const loadPagefind = async () => {
      try {
        // Dynamic import that Vite won't try to bundle
        const importPagefind = new Function(
          'return import("/pagefind/pagefind.js")'
        );
        const pf = await importPagefind();
        setPagefind(pf);
      } catch {
        console.warn("Pagefind not available. Run npm run build first.");
      }
    };
    loadPagefind();
  }, []);

  // Global cmd+k listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input and lock body scroll when modal opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Search when query changes
  useEffect(() => {
    if (!pagefind || !query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    const doSearch = async () => {
      try {
        const search = await pagefind.search(query);
        const resultData = await Promise.all(
          search.results.slice(0, 8).map(async (r) => {
            const data = await r.data();
            return {
              id: r.id,
              url: data.url,
              title: data.meta.title || "Untitled",
              excerpt: data.excerpt,
            };
          })
        );
        setResults(resultData);
        setSelectedIndex(0);
        setHasSearched(true);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
        setHasSearched(true);
      }
      setIsLoading(false);
    };

    const debounce = setTimeout(doSearch, 150);
    return () => clearTimeout(debounce);
  }, [query, pagefind]);

  // Keyboard navigation in modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        window.location.href = results[selectedIndex].url;
      }
    },
    [results, selectedIndex]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.children[
        selectedIndex
      ] as HTMLElement;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const close = () => {
    setIsOpen(false);
    setQuery("");
  };

  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <>
      {/* Search Trigger */}
      <button className="search-trigger" onClick={() => setIsOpen(true)}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M11 11L14 14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span>Search docs...</span>
        <kbd
          style={{
            marginRight: "-0.25rem",
          }}
        >
          {isMac ? "⌘" : "Ctrl"}
        </kbd>
        <kbd>K</kbd>
      </button>

      {/* Search Modal */}
      {isOpen &&
        createPortal(
          <div className="search-modal-backdrop" onClick={close}>
            <div
              className="search-modal"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
            >
              <div className="search-input-wrapper">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M11 11L14 14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search documentation..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="search-input"
                />
                <kbd onClick={close}>esc</kbd>
              </div>

              {query.trim() && (
                <div className="search-results" ref={resultsRef}>
                  {isLoading ? (
                    <div className="search-loading">Searching...</div>
                  ) : results.length > 0 ? (
                    results.map((result, index) => (
                      <a
                        key={result.id}
                        href={result.url}
                        className={`search-result ${
                          index === selectedIndex ? "selected" : ""
                        }`}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <span className="search-result-title">
                          {result.title}
                        </span>
                        <span
                          className="search-result-excerpt"
                          dangerouslySetInnerHTML={{ __html: result.excerpt }}
                        />
                      </a>
                    ))
                  ) : hasSearched ? (
                    <div className="search-empty">
                      No results found for "{query}"
                    </div>
                  ) : null}
                </div>
              )}

              {!query.trim() && (
                <div className="search-hints">
                  <div className="search-hint">
                    <kbd>↑</kbd>
                    <kbd>↓</kbd> to navigate
                  </div>
                  <div className="search-hint">
                    <kbd>↵</kbd> to select
                  </div>
                  <div className="search-hint">
                    <kbd>esc</kbd> to close
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      <style>{`
        .search-trigger {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: var(--space-2) var(--space-3);
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .search-trigger:hover {
          border-color: var(--border-hover);
          color: var(--text-secondary);
        }

        .search-trigger span {
          flex: 1;
          text-align: left;
        }

        .search-trigger kbd {
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          padding: var(--space-1) var(--space-2);
          background-color: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
        }

        .search-modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 15vh;
          z-index: 1000;
          animation: fadeIn 0.15s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .search-modal {
          width: 100%;
          max-width: 560px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: slideIn 0.15s ease-out;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: scale(0.98) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .search-input-wrapper {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: 0 var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .search-input-wrapper svg {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 1rem;
					padding: var(--space-4) 0;
          color: var(--text-primary);
        }

        .search-input::placeholder {
          color: var(--text-muted);
        }

        .search-input-wrapper kbd {
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          padding: var(--space-1) var(--space-2);
          background-color: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .search-input-wrapper kbd:hover {
          color: var(--text-secondary);
        }

        .search-results {
          max-height: 400px;
          overflow-y: auto;
        }

        .search-result {
          display: block;
          padding: var(--space-3) var(--space-4);
          text-decoration: none;
          border-left: 2px solid transparent;
          transition: all var(--transition-fast);
        }

        .search-result:hover,
        .search-result.selected {
          background-color: var(--bg-primary);
          border-left-color: var(--accent);
        }

        .search-result-title {
          display: block;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: var(--space-1);
        }

        .search-result-excerpt {
          display: block;
          font-size: 0.8125rem;
          color: var(--text-muted);
          line-height: 1.5;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .search-result-excerpt mark {
          background-color: rgba(242, 12, 50, 0.2);
          color: var(--accent);
        }

        .search-loading,
        .search-empty {
          padding: var(--space-6) var(--space-4);
          text-align: center;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .search-hints {
          display: flex;
          gap: var(--space-4);
          padding: var(--space-3) var(--space-4);
          justify-content: center;
        }

        .search-hint {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .search-hint kbd {
          font-family: var(--font-mono);
          font-size: 0.625rem;
          padding: 2px 6px;
          background-color: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
        }
      `}</style>
    </>
  );
}
