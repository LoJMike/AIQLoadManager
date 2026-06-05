import { useState, useMemo } from 'react';

// ─── ResultsPanel ─────────────────────────────────────────────────────────────
//
// Dedicated view for completed prompt responses. Shows the full response text
// for every finished queue item without needing to expand rows in the Queue tab.
//
// Receives the full queue array from App and filters client-side — no extra
// IPC call needed.
// ─────────────────────────────────────────────────────────────────────────────

const TAG_DISPLAY = {
  chat:      { emoji: '💬', color: '#6366f1' },
  research:  { emoji: '🔬', color: '#8b5cf6' },
  code:      { emoji: '💻', color: '#06b6d4' },
  web:       { emoji: '🌐', color: '#10b981' },
  writing:   { emoji: '✍️',  color: '#f59e0b' },
  analysis:  { emoji: '📊', color: '#3b82f6' },
  image:     { emoji: '🖼️',  color: '#ec4899' },
  translate: { emoji: '🌍', color: '#14b8a6' },
  urgent:    { emoji: '⚡', color: '#ef4444' },
};

/**
 * Format a timestamp as a readable relative or absolute string.
 * @param {number|string} ts  - Unix ms or ISO string
 * @returns {string}
 */
function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000)   return 'just now';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Copy text to clipboard and return a promise.
 * @param {string} text
 */
function copyText(text) {
  return navigator.clipboard.writeText(text).catch(() => {});
}

// ─── Single result card ───────────────────────────────────────────────────────

/**
 * Renders one completed result card.
 *
 * @param {{ item: object, providers: object[], onRemove: function }} props
 */
function ResultCard({ item, providers, onRemove }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isCompare = !!item.compare_providers;
  const providerMeta = providers.find(p => p.name === item.used_provider);

  /** Parse compare results JSON safely */
  const compareResults = useMemo(() => {
    if (!isCompare || !item.response) return [];
    try { return JSON.parse(item.response); } catch { return []; }
  }, [isCompare, item.response]);

  const responseText = isCompare ? null : (item.response || '');
  const isLong = responseText && responseText.length > 600;

  function handleCopy() {
    const text = isCompare
      ? compareResults.map(r => `[${r.provider}]\n${r.response || r.error || ''}`).join('\n\n---\n\n')
      : responseText;
    copyText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // Parse tags
  const tags = useMemo(() => {
    try { return JSON.parse(item.tags || '[]'); } catch { return []; }
  }, [item.tags]);

  return (
    <div className="result-card">
      {/* ── Card header ── */}
      <div className="result-card-header">
        <div className="result-card-meta">
          {providerMeta && (
            <span
              className="result-provider-dot"
              style={{ background: providerMeta.color }}
              title={providerMeta.displayName}
            />
          )}
          <span className="result-provider-name">
            {providerMeta?.displayName ?? item.used_provider ?? '—'}
          </span>
          {item.used_model && (
            <span className="result-model">{item.used_model}</span>
          )}
          {item.cost_usd > 0 && (
            <span className="result-cost">${item.cost_usd.toFixed(6)}</span>
          )}
          {isCompare && (
            <span className="result-compare-badge">⚖ Compare</span>
          )}
          {tags.map(t => {
            const d = TAG_DISPLAY[t];
            return d ? (
              <span
                key={t}
                className="result-tag"
                style={{
                  color: d.color,
                  background: `color-mix(in srgb, ${d.color} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${d.color} 30%, transparent)`,
                }}
              >
                {d.emoji} {t}
              </span>
            ) : null;
          })}
          {item.project_name && (
            <span className="result-project">📁 {item.project_name}</span>
          )}
        </div>
        <div className="result-card-actions">
          <span className="result-time">{fmtTime(item.completed_at || item.created_at)}</span>
          <button
            className="ghost result-copy-btn"
            onClick={handleCopy}
            title="Copy response"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button
            className="ghost"
            onClick={() => onRemove(item.id)}
            title="Remove"
            style={{ color: 'var(--text3)', fontSize: 12 }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Prompt ── */}
      <div className="result-prompt">
        {(item.label || item.prompt || '').slice(0, 200)}
        {(item.label || item.prompt || '').length > 200 ? '…' : ''}
      </div>

      {/* ── Response — normal item ── */}
      {!isCompare && responseText && (
        <div className={`result-response ${expanded || !isLong ? 'expanded' : 'collapsed'}`}>
          {responseText}
        </div>
      )}
      {!isCompare && isLong && (
        <button
          className="ghost result-expand-btn"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}

      {/* ── Response — compare item ── */}
      {isCompare && compareResults.length > 0 && (
        <div className="compare-results-scroll">
          <div
            className="compare-results-row"
            style={{ minWidth: `${compareResults.length * 280}px` }}
          >
            {compareResults.map((r, i) => {
              const pm = providers.find(p => p.name === r.provider);
              return (
                <div key={i} className={`compare-result-col ${r.error ? 'err' : 'ok'}`}>
                  <div className="compare-col-header">
                    <div className="compare-col-provider">
                      <span
                        className="cpc-dot"
                        style={{ background: pm?.color || 'var(--text3)' }}
                      />
                      <span>{pm?.displayName || r.provider}</span>
                    </div>
                    {r.response && (
                      <button
                        className="ghost"
                        style={{ fontSize: 10, padding: '2px 6px' }}
                        onClick={() => copyText(r.response)}
                        title="Copy"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                  {r.model && <div className="compare-col-model">{r.model}</div>}
                  {r.error ? (
                    <div className="qi-error" style={{ marginTop: 0 }}>✗ {r.error}</div>
                  ) : (
                    <div className="compare-col-body">{r.response}</div>
                  )}
                  {r.usage && (
                    <div className="compare-col-tokens">
                      {r.usage.inputTokens ?? '?'}↑ · {r.usage.outputTokens ?? '?'}↓ tokens
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ResultsPanel ─────────────────────────────────────────────────────────────

/**
 * Main Results panel — displays all completed queue items as readable cards.
 *
 * @param {{ queue: object[], providers: object[], onRefresh: function }} props
 */
export function ResultsPanel({ queue, providers, onRefresh }) {
  const api = window.aiQueue;

  const [filterProject,  setFilterProject]  = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [search,         setSearch]         = useState('');

  // ── Derive completed items ────────────────────────────────────────────────
  const completed = useMemo(() =>
    (queue || [])
      .filter(i => i.status === 'complete')
      .sort((a, b) => {
        const ta = a.completed_at || a.created_at || 0;
        const tb = b.completed_at || b.created_at || 0;
        return tb - ta; // newest first
      }),
    [queue]
  );

  // ── Unique filter options ─────────────────────────────────────────────────
  const projectOptions = useMemo(() =>
    [...new Set(completed.filter(i => i.project_name).map(i => i.project_name))],
    [completed]
  );
  const providerOptions = useMemo(() =>
    [...new Set(completed.filter(i => i.used_provider).map(i => i.used_provider))],
    [completed]
  );

  // ── Apply filters ─────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return completed.filter(i => {
      if (filterProject  !== 'all' && i.project_name  !== filterProject)  return false;
      if (filterProvider !== 'all' && i.used_provider !== filterProvider)  return false;
      if (q && !i.prompt?.toLowerCase().includes(q) &&
               !i.label?.toLowerCase().includes(q)  &&
               !i.response?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [completed, filterProject, filterProvider, search]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleRemove(id) {
    await api.removeFromQueue(id);
    onRefresh();
  }

  async function handleClearAll() {
    await api.clearCompleted();
    onRefresh();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="panel-header-row">
        <div>
          <div className="panel-title">Results</div>
          <div className="panel-sub">
            {completed.length === 0
              ? 'Completed responses will appear here'
              : `${visible.length} of ${completed.length} response${completed.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        {completed.length > 0 && (
          <button
            className="secondary"
            style={{ fontSize: 12 }}
            onClick={handleClearAll}
            title="Remove all completed items"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Filter bar ── */}
      {completed.length > 0 && (
        <div className="results-filter-bar">
          <input
            className="results-search"
            type="search"
            placeholder="Search prompts and responses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {projectOptions.length > 0 && (
            <select
              className="results-select"
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
            >
              <option value="all">All projects</option>
              {projectOptions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          {providerOptions.length > 1 && (
            <select
              className="results-select"
              value={filterProvider}
              onChange={e => setFilterProvider(e.target.value)}
            >
              <option value="all">All providers</option>
              {providerOptions.map(p => {
                const meta = providers.find(pr => pr.name === p);
                return (
                  <option key={p} value={p}>{meta?.displayName ?? p}</option>
                );
              })}
            </select>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {completed.length === 0 && (
        <div className="results-empty">
          <div className="results-empty-icon">📥</div>
          <div className="results-empty-title">No results yet</div>
          <div className="results-empty-sub">
            Queue a prompt in the <strong>Add</strong> tab — responses will appear here when complete.
          </div>
        </div>
      )}

      {/* ── No match ── */}
      {completed.length > 0 && visible.length === 0 && (
        <div className="results-empty">
          <div className="results-empty-title">No results match your filters</div>
          <div className="results-empty-sub">
            <button className="ghost" onClick={() => { setSearch(''); setFilterProject('all'); setFilterProvider('all'); }}>
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* ── Result cards ── */}
      <div className="results-list">
        {visible.map(item => (
          <ResultCard
            key={item.id}
            item={item}
            providers={providers}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  );
}
