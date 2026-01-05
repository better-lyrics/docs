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

    // Track active heading based on scroll position
    const updateActiveHeading = () => {
      // Skip if we're in click-scroll mode
      if (isClickScrolling.current) return;

      const headingElements = Array.from(headings);
      const scrollY = window.scrollY;
      const headerOffset = 100;

      // Check if we're at the bottom of the page
      const isAtBottom = window.innerHeight + scrollY >= document.documentElement.scrollHeight - 50;

      if (isAtBottom && headingElements.length > 0) {
        // If at bottom, highlight the last heading
        setActiveId(headingElements[headingElements.length - 1].id);
        return;
      }

      // Find the heading that's currently at or above the scroll position
      let currentHeading = headingElements[0];
      for (const heading of headingElements) {
        const rect = heading.getBoundingClientRect();
        const absoluteTop = rect.top + scrollY;
        if (absoluteTop <= scrollY + headerOffset) {
          currentHeading = heading;
        } else {
          break;
        }
      }

      if (currentHeading) {
        setActiveId(currentHeading.id);
      }
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
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 var(--space-3);
        }

        .toc-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .toc-item {
          margin: 0;
        }

        .toc-item.level-3 {
          padding-left: var(--space-4);
        }

        .toc-link {
          display: block;
          padding: var(--space-1) var(--space-2);
          font-size: 0.8125rem;
          color: var(--text-muted);
          text-decoration: none;
          border-left: 2px solid transparent;
          transition: all var(--transition-fast);
          line-height: 1.4;
        }

        .toc-link:hover {
          color: var(--text-secondary);
        }

        .toc-link.active {
          color: var(--text-primary);
          border-left-color: var(--accent);
        }

        /* Scrollbar */
        .toc::-webkit-scrollbar {
          width: 4px;
        }

        .toc::-webkit-scrollbar-thumb {
          background: var(--bg-tertiary);
          border-radius: var(--radius-full);
        }
      `}</style>
    </nav>
  );
}
