import { useState, useEffect, useCallback } from 'react';
import Search from './Search';

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  currentPath: string;
  conceptsLinks: NavLink[];
  referenceLinks: NavLink[];
}

export default function MobileNav({ currentPath, conceptsLinks, referenceLinks }: Props) {
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
    }, 200); // Match animation duration
  }, []);

  // Lock body scroll when open
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

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) close();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  return (
    <>
      <button
        className="mobile-nav-trigger"
        onClick={open}
        aria-label="Open navigation menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {isVisible && (
        <div
          className={`mobile-nav-backdrop ${isClosing ? 'closing' : ''}`}
          onClick={close}
        >
          <nav
            className={`mobile-nav ${isClosing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-nav-header">
              <span className="mobile-nav-title">Navigation</span>
              <button
                className="mobile-nav-close"
                onClick={close}
                aria-label="Close navigation menu"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="mobile-nav-content">
              <div className="mobile-nav-search">
                <Search />
              </div>

              <div className="mobile-nav-section">
                <h4 className="mobile-nav-section-title">Concepts</h4>
                <ul className="mobile-nav-list">
                  {conceptsLinks.map(link => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className={`mobile-nav-item ${currentPath === link.href ? 'active' : ''}`}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mobile-nav-section">
                <h4 className="mobile-nav-section-title">Reference</h4>
                <ul className="mobile-nav-list">
                  {referenceLinks.map(link => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className={`mobile-nav-item ${currentPath === link.href ? 'active' : ''}`}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mobile-nav-section">
                <h4 className="mobile-nav-section-title">Quick links</h4>
                <ul className="mobile-nav-list">
                  <li>
                    <a href="/playground" className={`mobile-nav-item ${currentPath === '/playground' ? 'active' : ''}`}>
                      Playground
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://better-lyrics.boidu.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mobile-nav-item external"
                    >
                      Get the extension
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 8L8 4M8 4H4.5M8 4V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </div>
      )}

      <style>{`
        .mobile-nav-trigger {
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

        .mobile-nav-trigger:hover {
          color: var(--text-primary);
        }

        @media (max-width: 1024px) {
          .mobile-nav-trigger {
            display: flex;
          }
        }

        .mobile-nav-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.8);
          z-index: 200;
          animation: backdropFadeIn 0.2s ease-out forwards;
        }

        .mobile-nav-backdrop.closing {
          animation: backdropFadeOut 0.2s ease-out forwards;
        }

        @keyframes backdropFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes backdropFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        .mobile-nav {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(320px, 85vw);
          background-color: var(--bg-primary);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          animation: navSlideIn 0.2s ease-out forwards;
        }

        .mobile-nav.closing {
          animation: navSlideOut 0.2s ease-out forwards;
        }

        @keyframes navSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        @keyframes navSlideOut {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }

        .mobile-nav-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--border);
        }

        .mobile-nav-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .mobile-nav-close {
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

        .mobile-nav-close:hover {
          color: var(--text-primary);
          background-color: var(--bg-secondary);
        }

        .mobile-nav-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .mobile-nav-search {
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .mobile-nav-section-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-3);
        }

        .mobile-nav-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .mobile-nav-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          font-size: 0.9375rem;
          color: var(--text-secondary);
          text-decoration: none;
          transition: all var(--transition-fast);
        }

        .mobile-nav-item:hover {
          color: var(--text-primary);
          background-color: var(--bg-secondary);
        }

        .mobile-nav-item.active {
          color: var(--text-primary);
          background-color: var(--bg-secondary);
          font-weight: 500;
        }

        .mobile-nav-item.external {
          color: var(--accent);
        }

        .mobile-nav-item.external:hover {
          background-color: var(--accent-subtle);
        }
      `}</style>
    </>
  );
}
