import { useState, useEffect, useCallback } from 'react';
import Search from './Search';

interface Props {
  currentPath: string;
}

const navLinks = [
  { href: '/docs/introduction', label: 'Docs', matchPrefix: '/docs' },
  { href: '/reference/get-lyrics', label: 'Reference', matchPrefix: '/reference' },
  { href: '/playground', label: 'Playground', matchPrefix: '/playground' },
];

export default function HeaderMobileNav({ currentPath }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const open = useCallback(() => {
    setIsVisible(true);
    setIsOpen(true);
    setIsClosing(false);
  }, []);

  const close = useCallback(() => {
    setIsClosing(true);
    setIsOpen(false);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
    }, 200);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else if (!isClosing) {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isClosing]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) close();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  const isActive = (link: typeof navLinks[0]) => {
    return currentPath.startsWith(link.matchPrefix);
  };

  return (
    <>
      <button
        className="header-mobile-trigger"
        onClick={open}
        aria-label="Open navigation menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {isVisible && (
        <div
          className={`header-mobile-backdrop ${isClosing ? 'closing' : ''}`}
          onClick={close}
        >
          <nav
            className={`header-mobile-nav ${isClosing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="header-mobile-header">
              <span className="header-mobile-title">Navigation</span>
              <button
                className="header-mobile-close"
                onClick={close}
                aria-label="Close navigation menu"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="header-mobile-content">
              <div className="header-mobile-search">
                <Search />
              </div>

              <ul className="header-mobile-list">
                {navLinks.map(link => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className={`header-mobile-item ${isActive(link) ? 'active' : ''}`}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>

              <div className="header-mobile-cta">
                <a
                  href="https://better-lyrics.boidu.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="header-mobile-extension"
                >
                  Get the extension
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 8L8 4M8 4H4.5M8 4V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            </div>
          </nav>
        </div>
      )}

      <style>{`
        .header-mobile-trigger {
          display: none;
          position: fixed;
          top: 0;
          right: var(--space-4);
          height: var(--header-height);
          align-items: center;
          justify-content: center;
          width: 40px;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          z-index: 101;
        }

        .header-mobile-trigger:hover {
          color: var(--text-primary);
        }

        @media (max-width: 1024px) {
          .header-mobile-trigger {
            display: flex;
          }
        }

        .header-mobile-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.8);
          z-index: 200;
          animation: headerBackdropFadeIn 0.2s ease-out forwards;
        }

        .header-mobile-backdrop.closing {
          animation: headerBackdropFadeOut 0.2s ease-out forwards;
        }

        @keyframes headerBackdropFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes headerBackdropFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        .header-mobile-nav {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(280px, 85vw);
          background-color: var(--bg-primary);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          animation: headerNavSlideIn 0.2s ease-out forwards;
        }

        .header-mobile-nav.closing {
          animation: headerNavSlideOut 0.2s ease-out forwards;
        }

        @keyframes headerNavSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        @keyframes headerNavSlideOut {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }

        .header-mobile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--border);
        }

        .header-mobile-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .header-mobile-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }

        .header-mobile-close:hover {
          color: var(--text-primary);
          background-color: var(--bg-secondary);
        }

        .header-mobile-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: var(--space-5);
          gap: var(--space-5);
        }

        .header-mobile-search {
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .header-mobile-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .header-mobile-item {
          display: block;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          font-size: 1rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-decoration: none;
          transition: all var(--transition-fast);
        }

        .header-mobile-item:hover {
          color: var(--text-primary);
          background-color: var(--bg-secondary);
        }

        .header-mobile-item.active {
          color: var(--text-primary);
          background-color: var(--bg-secondary);
        }

        .header-mobile-cta {
          margin-top: auto;
          padding-top: var(--space-6);
          border-top: 1px solid var(--border);
        }

        .header-mobile-extension {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--accent);
          text-decoration: none;
          border: 1px solid var(--accent-border);
          border-radius: var(--radius-lg);
          background-color: var(--accent-subtle);
          transition: all var(--transition-fast);
        }

        .header-mobile-extension:hover {
          background-color: var(--accent);
          border-color: var(--accent);
          color: white;
        }
      `}</style>
    </>
  );
}
