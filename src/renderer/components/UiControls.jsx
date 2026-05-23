import { useState, useRef, useEffect } from 'react';

/** Common typography / font-size icon (Aa) */
function FontSizeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <text x="2" y="17" fontSize="14" fontWeight="700" fontFamily="Georgia, serif">A</text>
      <text x="14" y="17" fontSize="11" fontWeight="600" fontFamily="Georgia, serif">a</text>
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
    <label className="theme-switch" title="Dark/Light mode">
      <span className="theme-switch-label">Dark/Light mode</span>
      <input
        type="checkbox"
        checked={isLight}
        onChange={onToggle}
        aria-label="Toggle dark or light mode"
      />
      <span className="theme-switch-track" aria-hidden>
        <span className="theme-switch-thumb" />
      </span>
    </label>
  );
}
