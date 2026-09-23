import { useState, useEffect, useRef } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface Row {
  top: number;
  height: number;
  x: number;
}

const LEVEL_2_X = 8.5;
const LEVEL_3_X = 18.5;
const STEP_REACH = 11;

function railPath(rows: Row[]): string {
  return rows
    .map((row, i) => {
      const prev = rows[i - 1];
      const next = rows[i + 1];
      const end = next && next.x !== row.x ? next.top - STEP_REACH : row.top + row.height;
      if (!prev) return `M${row.x} ${row.top}V${end}`;
      if (prev.x === row.x) return `V${end}`;
      return `C${prev.x} ${row.top} ${row.x} ${row.top} ${row.x} ${row.top + STEP_REACH}V${end}`;
    })
    .join('');
}

export default function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const isClickScrolling = useRef(false);
  const clickedId = useRef<string>('');
  const clickScrollIdle = useRef<ReturnType<typeof setTimeout>>();
  const railRef = useRef<HTMLDivElement>(null);
  const tocRef = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [indicator, setIndicator] = useState<{ top: number; height: number; animate: boolean } | null>(null);

  useEffect(() => {
    // Find all h2 and h3 elements in the article
    const article = document.querySelector('.article');
    if (!article) return;

    const headings = article.querySelectorAll('h2, h3');
    const tocItems: TocItem[] = [];

    headings.forEach((heading) => {
      // Generate ID from heading text if not present
      let id = heading.id;
      if (!id) {
        id = heading.textContent
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || '';
        heading.id = id;
      }

      tocItems.push({
        id,
        text: heading.textContent || '',
        level: heading.tagName === 'H2' ? 2 : 3,
      });
    });

    setItems(tocItems);

    const updateActiveHeading = () => {
      // Skip if we're in click-scroll mode
      if (isClickScrolling.current) return;

      const headingElements = Array.from(headings);
      if (headingElements.length === 0) return;

      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;

      if (viewportHeight + scrollY >= document.documentElement.scrollHeight - 50) {
        setActiveId(headingElements[headingElements.length - 1].id);
        return;
      }

      const readingLine = parseFloat(getComputedStyle(headingElements[0]).scrollMarginTop) + 16;
      const activeHeading =
        headingElements.findLast((heading) => heading.getBoundingClientRect().top <= readingLine) ?? headingElements[0];

      setActiveId(activeHeading.id);
    };

    // Initial update
    updateActiveHeading();

    // Throttled scroll handler
    let ticking = false;
    const onScroll = () => {
      if (isClickScrolling.current) {
        endClickScrollWhenIdle();
        return;
      }
      if (!ticking) {
        requestAnimationFrame(() => {
          updateActiveHeading();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () =>
      setRows(
        Array.from(rail.querySelectorAll<HTMLElement>('.toc-item'), (item, i) => ({
          top: item.offsetTop,
          height: item.offsetHeight,
          x: items[i]?.level === 3 ? LEVEL_3_X : LEVEL_2_X,
        })),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const row = railRef.current?.querySelector<HTMLElement>('.toc-item:has(.toc-link.active)');
    if (!row) return;
    setIndicator((prev) => ({ top: row.offsetTop, height: row.offsetHeight, animate: prev !== null }));

    const toc = tocRef.current;
    if (!toc) return;
    const rowTop = row.getBoundingClientRect().top - toc.getBoundingClientRect().top;
    if (rowTop < 0 || rowTop + row.offsetHeight > toc.clientHeight) {
      toc.scrollBy({ top: rowTop - toc.clientHeight / 2, behavior: 'smooth' });
    }
  }, [activeId, rows]);

  const endClickScrollWhenIdle = () => {
    clearTimeout(clickScrollIdle.current);
    clickScrollIdle.current = setTimeout(() => {
      isClickScrolling.current = false;
    }, 150);
  };

  const handleClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      // Set click-scroll mode to ignore scroll events
      isClickScrolling.current = true;
      clickedId.current = id;
      setActiveId(id);

      element.scrollIntoView({ behavior: 'smooth' });
      window.history.pushState({}, '', `#${id}`);

      endClickScrollWhenIdle();
    }
  };

  if (items.length === 0) return null;

  const path = railPath(rows);
  const railHeight = rows.length > 0 ? rows[rows.length - 1].top + rows[rows.length - 1].height : 0;

  return (
    <nav className="toc" ref={tocRef}>
      <h4 className="toc-title">On this page</h4>
      <div className="toc-rail" ref={railRef}>
        {rows.length > 0 && (
          <svg className="toc-line" width={LEVEL_3_X + 1} height={railHeight} aria-hidden="true">
            <path d={path} />
          </svg>
        )}
        {rows.length > 0 && indicator && (
          <svg
            className={`toc-line toc-indicator ${indicator.animate ? 'animate' : ''}`}
            width={LEVEL_3_X + 1}
            height={railHeight}
            style={{ clipPath: `inset(${indicator.top}px -2px ${railHeight - indicator.top - indicator.height}px -2px)` }}
            aria-hidden="true"
          >
            <path d={path} />
          </svg>
        )}
        <ul className="toc-list">
          {items.map((item) => (
            <li key={item.id} className={`toc-item level-${item.level}`}>
              <a
                href={`#${item.id}`}
                className={`toc-link ${activeId === item.id ? 'active' : ''}`}
                onClick={(e) => handleClick(e, item.id)}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <style>{`
        .toc {
          position: sticky;
          top: calc(var(--header-height) + var(--space-8));
          max-height: calc(100vh - var(--header-height) - var(--space-16));
          overflow-y: auto;
          scrollbar-width: none;
          padding-right: var(--space-4);
        }

        .toc::-webkit-scrollbar {
          display: none;
        }

        .toc-title {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
          margin: 0 0 var(--space-2);
          opacity: 0.5;
        }

        .toc-rail {
          position: relative;
        }

        .toc-line {
          position: absolute;
          top: 0;
          left: 0;
          overflow: visible;
          pointer-events: none;
          fill: none;
          stroke: var(--border);
          stroke-width: 1;
        }

        .toc-indicator {
          z-index: 1;
          stroke: var(--accent);
          stroke-width: 2;
        }

        .toc-indicator.animate {
          transition: clip-path 300ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        @media (prefers-reduced-motion: reduce) {
          .toc-indicator.animate {
            transition: none;
          }
        }

        .toc-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
        }

        .toc-item {
          margin: 0;
        }

        .toc-item.level-3 .toc-link {
          padding-left: var(--space-8);
        }

        .toc-link {
          display: block;
          padding: 0.125rem var(--space-3) 0.125rem var(--space-5);
          font-size: 0.8125rem;
          color: var(--text-muted);
          transition: color var(--transition-fast);
          line-height: 1.4;
        }

        .toc-link:hover {
          color: var(--text-secondary);
        }

        .toc-link.active {
          color: var(--text-primary);
        }
      `}</style>
    </nav>
  );
}
