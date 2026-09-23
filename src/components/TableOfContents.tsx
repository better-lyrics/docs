import { useState, useEffect, useRef } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const isClickScrolling = useRef(false);
  const clickedId = useRef<string>('');
  const railRef = useRef<HTMLDivElement>(null);
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

    // Track active heading based on scroll position (center of viewport)
    const updateActiveHeading = () => {
      // Skip if we're in click-scroll mode
      if (isClickScrolling.current) return;

      const headingElements = Array.from(headings);
      if (headingElements.length === 0) return;

      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const viewportCenter = scrollY + viewportHeight / 2;

      // Check if we're at the bottom of the page
      const isAtBottom = viewportHeight + scrollY >= document.documentElement.scrollHeight - 50;

      if (isAtBottom) {
        // If at bottom, highlight the last heading
        setActiveId(headingElements[headingElements.length - 1].id);
        return;
      }

      // Check if we're at the top of the page
      const isAtTop = scrollY < 100;
      if (isAtTop && headingElements.length > 0) {
        setActiveId(headingElements[0].id);
        return;
      }

      // Find the heading whose section contains the viewport center
      // A section spans from one heading to the next
      let activeHeading = headingElements[0];
      for (let i = 0; i < headingElements.length; i++) {
        const heading = headingElements[i];
        const headingTop = heading.getBoundingClientRect().top + scrollY;
        const nextHeading = headingElements[i + 1];
        const nextHeadingTop = nextHeading
          ? nextHeading.getBoundingClientRect().top + scrollY
          : document.documentElement.scrollHeight;

        // Check if viewport center is within this section
        if (viewportCenter >= headingTop && viewportCenter < nextHeadingTop) {
          activeHeading = heading;
          break;
        }
      }

      setActiveId(activeHeading.id);
    };

    // Initial update
    updateActiveHeading();

    // Throttled scroll handler
    let ticking = false;
    const onScroll = () => {
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
    const link = railRef.current?.querySelector<HTMLElement>('.toc-link.active');
    if (!link) return;
    setIndicator((prev) => ({ top: link.offsetTop, height: link.offsetHeight, animate: prev !== null }));
  }, [activeId, items]);

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

      // Re-enable scroll tracking after animation completes
      setTimeout(() => {
        isClickScrolling.current = false;
      }, 1000);
    }
  };

  if (items.length === 0) return null;

  return (
    <nav className="toc">
      <h4 className="toc-title">On this page</h4>
      <div className="toc-rail" ref={railRef}>
        {indicator && (
          <span
            className={`toc-indicator ${indicator.animate ? 'animate' : ''}`}
            style={{ transform: `translateY(${indicator.top}px)`, height: indicator.height }}
            aria-hidden="true"
          />
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
          padding-right: var(--space-4);
        }

        .toc-title {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
          margin: 0 0 var(--space-2);
        }

        .toc-rail {
          position: relative;
        }

        .toc-indicator {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 1;
          width: 2px;
          border-radius: var(--radius-full);
          background-color: var(--accent);
          pointer-events: none;
        }

        .toc-indicator.animate {
          transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1), height 300ms cubic-bezier(0.22, 1, 0.36, 1);
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
          padding-left: var(--space-6);
        }

        .toc-link {
          display: block;
          padding: 0.125rem var(--space-3);
          font-size: 0.8125rem;
          color: var(--text-muted);
          border-left: 1px solid var(--border);
          transition: color var(--transition-fast);
          line-height: 1.4;
        }

        .toc-link:hover {
          color: var(--text-secondary);
        }

        .toc-link.active {
          color: var(--text-primary);
        }

        /* Scrollbar */
        .toc::-webkit-scrollbar {
          width: 4px;
        }

        .toc::-webkit-scrollbar-thumb {
          background: var(--border-hover);
          border-radius: var(--radius-full);
        }
      `}</style>
    </nav>
  );
}
