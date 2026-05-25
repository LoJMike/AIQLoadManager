import { useState, useRef, useEffect } from 'react';

/** Common typography / font-size icon (Aa) */
function FontSizeIcon() {
  return (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <text x="2" y="17" fontSize="14" fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif">A</text>
      <text x="14" y="17" fontSize="11" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">a</text>
    </svg>
  );
}

const SCALE_LABELS = ['Smaller', 'Small', 'Default', 'Large', 'Largest'];

export function FontSizeControl({ scaleIdx, maxIdx, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="font-size-control" ref={ref}>
      <button
        type="button"
        className="icon-btn font-size-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label="Text size"
        aria-expanded={open}
        title={'Text size: ' + (SCALE_LABELS[scaleIdx] || 'Default')}
      >
        <FontSizeIcon />
      </button>
      {open && (
        <div className="font-size-menu">
          <button
            type="button"
            className="font-size-step"
            disabled={scaleIdx <= 0}
            onClick={() => onChange(-1)}
            aria-label="Decrease text size"
          >
            A−
          </button>
          <span className="font-size-label">{SCALE_LABELS[scaleIdx]}</span>
          <button
            type="button"
            className="font-size-step"
            disabled={scaleIdx >= maxIdx}
            onClick={() => onChange(1)}
            aria-label="Increase text size"
          >
            A+
          </button>
        </div>
      )}
    </div>
  );
}

export function ThemeSwitch({ theme, onToggle }) {
  const isLight = theme === 'light';
  return (
    <label
      className="theme-switch"
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <input
        type="checkbox"
        checked={isLight}
        onChange={onToggle}
        aria-label="Toggle dark or light mode"
      />
      <span className="theme-switch-track" aria-hidden>
        <span className="theme-switch-thumb">
          {/* Sun — visible in light mode */}
          <svg className="ts-icon ts-sun" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <circle cx="7" cy="7" r="2.2" fill="currentColor" stroke="none" />
            <line x1="7" y1="0.5" x2="7" y2="2.6" />
            <line x1="7" y1="11.4" x2="7" y2="13.5" />
            <line x1="0.5" y1="7" x2="2.6" y2="7" />
            <line x1="11.4" y1="7" x2="13.5" y2="7" />
            <line x1="2.5" y1="2.5" x2="3.9" y2="3.9" />
            <line x1="10.1" y1="10.1" x2="11.5" y2="11.5" />
            <line x1="11.5" y1="2.5" x2="10.1" y2="3.9" />
            <line x1="3.9" y1="10.1" x2="2.5" y2="11.5" />
          </svg>
          {/* Moon — visible in dark mode */}
          <svg className="ts-icon ts-moon" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
            <path d="M11.8 9.8A5.8 5.8 0 0 1 5 2.2a5.4 5.4 0 1 0 6.8 7.6z" />
          </svg>
        </span>
      </span>
    </label>
  );
}
