import { useState, useRef, useEffect, useMemo } from 'react';
import { FontSizeControl, ThemeSwitch } from './UiControls.jsx';

const SEARCH_SCOPES = [
  { id: 'queue',    label: 'Queue'    },
  { id: 'projects', label: 'Projects' },
  { id: 'prompts',  label: 'Prompts'  },
];

export default function AppHeader({
  queue,
  projects,
  theme,
  onThemeToggle,
  onFontScaleChange,
  fontScaleIdx,
  maxFontIdx,
  railOpen,
  onRailToggle,
  onAddPrompt,
  onNavigate,
  license,
}) {
  const [query, setQuery]           = useState('');
  const [scope, setScope]             = useState('queue');
  const [scopeOpen, setScopeOpen]       = useState(false);
  const [resultsOpen, setResultsOpen]   = useState(false);
  const searchRef = useRef(null);

  const scopeLabel = SEARCH_SCOPES.find(s => s.id === scope)?.label ?? 'Queue';

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    if (scope === 'projects') {
      return projects
        .filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
        .slice(0, 8)
        .map(p => ({
          id: p.id,
          title: p.name,
          sub: p.description || 'Project',
          tab: 'projects',
        }));
    }

    const pool = queue.filter(item => {
      if (scope === 'prompts') {
        return (item.prompt || '').toLowerCase().includes(q) || (item.label || '').toLowerCase().includes(q);
      }
      return (
        (item.prompt || '').toLowerCase().includes(q) ||
        (item.label || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q) ||
        (item.used_provider || '').toLowerCase().includes(q)
      );
    });

    return pool.slice(0, 8).map(item => ({
      id: item.id,
      title: item.label || item.prompt?.slice(0, 60) || 'Queue item',
      sub: `${item.status}${item.used_provider ? ` · ${item.used_provider}` : ''}`,
      tab: 'queue',
    }));
  }, [query, scope, queue, projects]);

  useEffect(() => {
    function onDocClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setResultsOpen(false);
        setScopeOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pickResult(r) {
    onNavigate?.(r.tab, r.id);
    setQuery('');
    setResultsOpen(false);
  }

  const planLabel = license?.plan
    ? license.plan.charAt(0).toUpperCase() + license.plan.slice(1)
    : 'Free';

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-mark">Q</div>
        <span className="brand-name">AIQ Load Manager</span>
      </div>

      <div className="header-search-wrap" ref={searchRef}>
        <div className="header-search">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder={'Search ' + scopeLabel.toLowerCase() + '…'}
            value={query}
            onChange={e => { setQuery(e.target.value); setResultsOpen(true); }}
            onFocus={() => setResultsOpen(true)}
          />
          <button
            type="button"
            className="search-scope-btn"
            onClick={() => { setScopeOpen(o => !o); setResultsOpen(false); }}
            aria-expanded={scopeOpen}
          >
            {scopeLabel}
            <span className="search-scope-caret">▾</span>
          </button>
        </div>

        {scopeOpen && (
          <div className="search-scope-menu">
            {SEARCH_SCOPES.map(s => (
              <button
                key={s.id}
                type="button"
                className={'search-scope-option' + (scope === s.id ? ' active' : '')}
                onClick={() => { setScope(s.id); setScopeOpen(false); }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {resultsOpen && query.trim() && (
          <div className="search-results">
            {results.length === 0 ? (
              <div className="search-result-empty">No matches in {scopeLabel.toLowerCase()}.</div>
            ) : (
              results.map(r => (
                <button key={r.id} type="button" className="search-result-item" onClick={() => pickResult(r)}>
                  <span className="search-result-title">{r.title}</span>
                  <span className="search-result-sub">{r.sub}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="header-actions">
        <FontSizeControl
          scaleIdx={fontScaleIdx}
          maxIdx={maxFontIdx}
          onChange={onFontScaleChange}
        />

        <ThemeSwitch theme={theme} onToggle={onThemeToggle} />

        <button
          type="button"
          className="icon-btn rail-toggle"
          onClick={onRailToggle}
          title={railOpen ? 'Hide side panel' : 'Show side panel'}
        >
          {railOpen ? 'Hide panel' : 'Panel'}
        </button>

        <button type="button" className="btn-add-prompt" onClick={onAddPrompt}>+ Add prompt</button>

        <div className="user-chip" title="License tier">
          <div className="user-avatar" />
          <div className="user-meta">
            <span className="user-name">Local</span>
            <span className="user-role">{planLabel} plan</span>
          </div>
        </div>
      </div>
    </header>
  );
}
