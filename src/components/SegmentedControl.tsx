import { useLayoutEffect, useRef, useState } from 'react';

interface SegmentedControlProps<T extends string> {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  variant?: 'pill' | 'underline';
}

export default function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, variant = 'pill' }: SegmentedControlProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number; animate: boolean } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const active = rootRef.current?.querySelector<HTMLElement>(`[data-segment="${value}"]`);
      if (!active) return;
      setIndicator((prev) => ({ left: active.offsetLeft, width: active.offsetWidth, animate: prev !== null }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [value, options.length]);

  return (
    <div className={`segmented ${variant}`} role="tablist" aria-label={ariaLabel} ref={rootRef}>
      {indicator && (
        <span
          className={`segmented-indicator ${indicator.animate ? 'animate' : ''}`}
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
          aria-hidden="true"
        />
      )}
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          data-segment={option.id}
          aria-selected={option.id === value}
          className={option.id === value ? 'active' : ''}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}

      <style>{`
        .segmented {
          position: relative;
          display: inline-flex;
          gap: 2px;
        }

        .segmented-indicator {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          border-radius: var(--radius-md);
          background-color: var(--bg-tertiary);
          pointer-events: none;
        }

        .segmented-indicator.animate {
          transition: transform 260ms cubic-bezier(0.2, 0, 0, 1), width 260ms cubic-bezier(0.2, 0, 0, 1);
        }

        @media (prefers-reduced-motion: reduce) {
          .segmented-indicator.animate {
            transition: none;
          }
        }

        .segmented button {
          position: relative;
          padding: var(--space-1) var(--space-3);
          font-size: 0.75rem;
          font-weight: 500;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-muted);
          cursor: pointer;
          transition: color var(--transition-fast);
        }

        .segmented button:hover {
          color: var(--text-secondary);
        }

        .segmented button.active {
          color: var(--text-primary);
        }

        .segmented.underline {
          gap: var(--space-4);
        }

        .segmented.underline .segmented-indicator {
          top: auto;
          height: 2px;
          border-radius: var(--radius-full);
          background-color: var(--text-primary);
        }

        .segmented.underline button {
          padding: var(--space-2) 0;
          border-radius: 0;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
