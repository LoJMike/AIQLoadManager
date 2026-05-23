// ─── QueuePanel ──────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

const STATUS_COLORS = {
  pending:    'var(--text3)',
  processing: 'var(--accent)',
  complete:   'var(--success)',
  error:      'var(--danger)',
  cancelled:  'var(--text3)',
};

export function QueuePanel({ queue, providers, onRefresh, highlightId }) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const api = window.aiQueue;

  useEffect(() => {
    if (highlightId) {
      setExpanded(highlightId);
      const el = document.getElementById('queue-item-' + highlightId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId]);

  const counts = {
    all:     queue.length,
    pending: queue.filter(i => i.status === 'pending').length,
    complete:queue.filter(i => i.status === 'complete').length,
    error:   queue.filter(i => i.status === 'error').length,
  };

  const visible = filter === 'all' ? queue : queue.filter(i => i.status === filter);

  async function remove(id)  { await api.removeFromQueue(id); onRefresh(); }
  async function retry(id)   { await api.retryItem(id); onRefresh(); }
  async function clearDone() { await api.clearCompleted(); onRefresh(); }
  async function reorder(id, dir) { await api.reorderQueue(id, dir); onRefresh(); }

  return (
    <div>
      <div className="panel-header-row">
        <div>
          <div className="panel-title">Prompt Queue</div>
          <div className="panel-sub">{counts.pending} pending · {counts.complete} complete · {counts.error} errors</div>
        </div>
        <button className="secondary" onClick={clearDone}>Clear completed</button>
      </div>

      <div className="segmented-tabs">
        {['all','pending','complete','error'].map(s => (
          <button
            key={s}
            className={filter === s ? 'active' : ''}
            onClick={() => setFilter(s)}
          >
            {s} <span className="tab-count">({counts[s]})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="empty-state">
          {filter === 'all' ? 'Queue is empty — add prompts in the Add tab.' : `No ${filter} items.`}
        </div>
      )}

      {visible.map(item => (
        <div
          key={item.id}
          id={'queue-item-' + item.id}
          className={'queue-item ' + item.status + (highlightId === item.id ? ' highlighted' : '')}
        >
          <div>
            <div className="qi-prompt">
              {item.label
                ? <><strong style={{ color: 'var(--accent)' }}>{item.label}</strong> — {item.prompt.slice(0, 120)}</>
                : item.prompt.slice(0, 140)
              }
              {item.prompt.length > 140 && '…'}
            </div>
            <div className="qi-meta">
              <span style={{ color: STATUS_COLORS[item.status], fontWeight: 600 }}>{item.status}</span>
              {item.compare_providers && (
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>⚖ Compare</span>
              )}
              {item.used_provider && item.used_provider !== 'compare' && <span>via {item.used_provider}</span>}
              {item.routing_mode && item.routing_mode !== 'auto' && item.routing_mode !== 'compare' && <span>{item.routing_mode}</span>}

              {/* Tag badges — parse JSON array stored in DB */}
              {(() => {
                let tags = [];
                try { tags = JSON.parse(item.tags || '[]'); } catch (_) {}
                if (!tags.length) return null;
                const TAG_META = {
                  chat: { emoji: '💬', color: '#6366f1' }, research: { emoji: '🔬', color: '#3b82f6' },
                  code: { emoji: '💻', color: '#10b981' }, web_search: { emoji: '🌐', color: '#0ea5e9' },
                  writing: { emoji: '✍️', color: '#8b5cf6' }, analysis: { emoji: '📊', color: '#f59e0b' },
                  image: { emoji: '🖼️', color: '#ec4899' }, translate: { emoji: '🌍', color: '#14b8a6' },
                  urgent: { emoji: '⚡', color: '#f97316' },
                };
                return tags.map(t => {
                  const m = TAG_META[t] || { emoji: '🏷️', color: 'var(--text3)' };
                  return (
                    <span key={t} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                      background: `color-mix(in srgb, ${m.color} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${m.color} 35%, transparent)`,
                      color: m.color,
                    }}>
                      {m.emoji} {t.replace('_', ' ')}
                    </span>
                  );
                });
              })()}

              {item.project_name  && <span>📁 {item.project_name}</span>}
              {item.scheduled_for && <span>🕐 {new Date(item.scheduled_for).toLocaleString()}</span>}
              {item.cost_usd > 0  && <span>${item.cost_usd.toFixed(6)}</span>}
              {item.priority > 0  && <span style={{ color: 'var(--warning)' }}>↑ pri {item.priority}</span>}
              <span style={{ marginLeft: 'auto', color: 'var(--text3)' }}>
                {new Date(item.created_at).toLocaleTimeString()}
              </span>
            </div>

            {/* Expanded response — compare items get side-by-side columns */}
            {expanded === item.id && item.response && (() => {
              const isCompare = !!item.compare_providers;
              if (!isCompare) {
                return (
                  <div className="qi-response">{item.response}</div>
                );
              }
              let results = [];
              try { results = JSON.parse(item.response); } catch (_) {}
              return (
                <div className="compare-results-scroll">
                  <div className="compare-results-row" style={{ minWidth: `${results.length * 280}px` }}>
                    {results.map((r, i) => (
                      <div key={i} className={`compare-result-col ${r.error ? 'err' : 'ok'}`}>
                        <div className="compare-col-header">
                          <div className="compare-col-provider">
                            <span className="cpc-dot" style={{
                              background: providers.find(p => p.name === r.provider)?.color || 'var(--text3)',
                            }} />
                            <span>
                              {providers.find(p => p.name === r.provider)?.displayName || r.provider}
                            </span>
                          </div>
                          {r.response && (
                            <button className="ghost" style={{ fontSize: 10, padding: '2px 6px' }}
                              onClick={() => navigator.clipboard.writeText(r.response)}
                              title="Copy response">Copy</button>
                          )}
                        </div>
                        {r.model && (
                          <div className="compare-col-model">{r.model}</div>
                        )}
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
                    ))}
                  </div>
                </div>
              );
            })()}

            {item.error && (
              <div className="qi-error">{item.error}</div>
            )}
          </div>

          <div className="qi-actions">
            {item.response && (
              <button className="ghost" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                {expanded === item.id ? '▲' : '▼'}
              </button>
            )}
            {item.status === 'pending' && (
              <>
                <button className="ghost" onClick={() => reorder(item.id, 'up')} title="Higher priority">↑</button>
                <button className="ghost" onClick={() => reorder(item.id, 'down')} title="Lower priority">↓</button>
              </>
            )}
            {(item.status === 'error' || item.status === 'cancelled') && (
              <button className="ghost" onClick={() => retry(item.id)} style={{ color: 'var(--warning)' }}>↺</button>
            )}
            {item.status !== 'processing' && (
              <button className="ghost" onClick={() => remove(item.id)} style={{ color: 'var(--danger)' }}>✕</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

// Tier groupings — controls the section headers in the settings panel
const PROVIDER_TIER_GROUPS = [
  {
    key:   'local',
    label: 'Local AI',
    sub:   'Runs entirely on your machine — no API key, no internet, zero cost per request',
    color: '#a855f7',
    icon:  '🖥️',
    names: ['ollama', 'lmstudio', 'jan', 'localai', 'llamacpp'],
  },
  {
    key:   'free-cloud',
    label: 'Free Cloud Tier',
    sub:   'Permanent free tiers — no credit card required to get started',
    color: '#22c55e',
    icon:  '★',
    names: ['gemini', 'groq', 'mistral'],
  },
  {
    key:   'paid-cloud',
    label: 'Paid & Trial Cloud',
    sub:   'Pay-as-you-go APIs — trial credits provided on signup',
    color: '#f97316',
    icon:  '💳',
    names: ['anthropic', 'openai', 'deepseek', 'grok'],
  },
];

// Per-provider setup guide: where to get key, what limits mean, links
const PROVIDER_GUIDE = {
  // ── Local providers (no API key required) ──────────────────────────────────
  ollama: {
    installLabel: 'Download Ollama',
    installLink:  'https://ollama.com',
    docsLink:     'https://ollama.com/library',
    setupText:    'Download and install Ollama, then pull a model to get started.',
    quickstart:   'Run in your terminal:  ollama pull llama3.2',
    localNote:    'Models are detected automatically when Ollama is running. Pull any model from ollama.com/library and it will appear here on next use.',
    limits: [
      { label: 'Cost per request', value: '$0.00',  note: 'All computation runs on your hardware' },
      { label: 'Rate limit',       value: 'None',   note: 'Bounded only by your GPU / CPU speed'  },
      { label: 'Internet required',value: 'No',     note: 'Fully offline after model download'    },
      { label: 'Privacy',          value: 'Total',  note: 'Prompts never leave your machine'      },
    ],
  },
  lmstudio: {
    installLabel: 'Download LM Studio',
    installLink:  'https://lmstudio.ai',
    docsLink:     'https://lmstudio.ai/docs',
    setupText:    'Download and install LM Studio, load a model, then open the Developer tab and start the Local Server.',
    quickstart:   'In LM Studio: load a model → Developer tab → Start Server.',
    localNote:    'Models are detected automatically from the running LM Studio server. Load a model in LM Studio\'s model browser to get started.',
    limits: [
      { label: 'Cost per request', value: '$0.00',  note: 'All computation runs on your hardware' },
      { label: 'Rate limit',       value: 'None',   note: 'Bounded only by your GPU / CPU speed'  },
      { label: 'Internet required',value: 'No',     note: 'Fully offline after model download'    },
      { label: 'Privacy',          value: 'Total',  note: 'Prompts never leave your machine'      },
    ],
  },
  jan: {
    installLabel: 'Download Jan.ai',
    installLink:  'https://jan.ai',
    docsLink:     'https://jan.ai/docs',
    setupText:    'Download and install Jan.ai, download a model from the Hub, then go to Settings → Local API Server → Start.',
    quickstart:   'Jan app → Settings → Local API Server → Start Server.',
    localNote:    'Models are detected automatically from the running Jan.ai server. Download models from Jan\'s Hub to add them to your library.',
    limits: [
      { label: 'Cost per request', value: '$0.00',  note: 'All computation runs on your hardware' },
      { label: 'Rate limit',       value: 'None',   note: 'Bounded only by your GPU / CPU speed'  },
      { label: 'Internet required',value: 'No',     note: 'Fully offline after model download'    },
      { label: 'Privacy',          value: 'Total',  note: 'Prompts never leave your machine'      },
    ],
  },
  localai: {
    installLabel: 'LocalAI Setup Guide',
    installLink:  'https://localai.io/basics/getting_started/',
    docsLink:     'https://localai.io/models/',
    setupText:    'Install LocalAI (Docker or binary), add model files to its models/ directory, then start the server. It exposes an OpenAI-compatible API automatically.',
    quickstart:   'docker run -p 8080:8080 localai/localai:latest',
    localNote:    'Models are detected automatically from the running LocalAI server. Model IDs match the filenames in your models/ directory. Multiple models can run simultaneously.',
    limits: [
      { label: 'Cost per request', value: '$0.00',  note: 'All computation runs on your hardware' },
      { label: 'Rate limit',       value: 'None',   note: 'Bounded only by your GPU / CPU speed'  },
      { label: 'Internet required',value: 'No',     note: 'Fully offline after model download'    },
      { label: 'Privacy',          value: 'Total',  note: 'Prompts never leave your machine'      },
    ],
  },
  llamacpp: {
    installLabel: 'llama.cpp Releases',
    installLink:  'https://github.com/ggerganov/llama.cpp/releases',
    docsLink:     'https://github.com/ggerganov/llama.cpp/blob/master/examples/server/README.md',
    setupText:    'Download a llama.cpp release binary (or build from source), then launch llama-server with your .gguf model file. One model loads at a time — restart the server to change models.',
    quickstart:   'llama-server -m model.gguf --port 8181 --ctx-size 4096',
    localNote:    'llama.cpp loads one model at a time. The active model is detected automatically. To switch models, stop the server and restart it with a different .gguf file.',
    limits: [
      { label: 'Cost per request', value: '$0.00',  note: 'All computation runs on your hardware'   },
      { label: 'Rate limit',       value: 'None',   note: 'Bounded only by your GPU / CPU speed'    },
      { label: 'Active models',    value: '1 at a time', note: 'Restart server to swap models'      },
      { label: 'Privacy',          value: 'Total',  note: 'Prompts never leave your machine'        },
    ],
  },

  // ── Free cloud tier ────────────────────────────────────────────────────────
  anthropic: {
    keyLabel:    'API Key (starts with sk-ant-...)',
    keyHelp:     'Create at: console.anthropic.com → API Keys',
    keyLink:     'https://console.anthropic.com/settings/keys',
    limitsLink:  'https://docs.anthropic.com/en/api/rate-limits',
    freeTier:    'Trial credits on signup. No permanent free tier.',
    budgetTip:   'Recommended: set $10–$20/mo to start. Haiku model is cheapest at $1/M tokens.',
    limits: [
      { label: 'Requests / min',   value: '50 RPM',        note: 'Tier 1 (new accounts)' },
      { label: 'Tokens / min',     value: '100K TPM',      note: 'Input + output combined' },
      { label: 'Requests / day',   value: 'No daily cap',  note: 'Rate-limited by RPM/TPM' },
      { label: 'Cost tracking',    value: 'Per token',     note: 'See model card for exact pricing' },
    ],
  },
  openai: {
    keyLabel:    'API Key (starts with sk-...)',
    keyHelp:     'Create at: platform.openai.com → API Keys',
    keyLink:     'https://platform.openai.com/api-keys',
    limitsLink:  'https://platform.openai.com/account/limits',
    freeTier:    '$5 trial credit on signup (expires in 3 months).',
    budgetTip:   'Set a hard limit at platform.openai.com → Billing → Limits. Also set one here.',
    limits: [
      { label: 'Requests / min',   value: '500 RPM',       note: 'Tier 1. Rises with spend history.' },
      { label: 'Tokens / min',     value: '200K TPM',      note: 'Tier 1 for GPT-4o' },
      { label: 'Requests / day',   value: 'No daily cap',  note: 'Rate-limited by RPM/TPM' },
      { label: 'Cost tracking',    value: 'Per token',     note: 'GPT-4o-mini is cheapest: $0.15/M in' },
    ],
  },
  gemini: {
    keyLabel:    'API Key',
    keyHelp:     'Create at: aistudio.google.com → Get API Key',
    keyLink:     'https://aistudio.google.com/app/apikey',
    limitsLink:  'https://ai.google.dev/gemini-api/docs/rate-limits',
    freeTier:    'Permanent free tier: 15 requests/min, 1,500/day on Flash models.',
    budgetTip:   'Free tier is very generous. Leave blank — rate limits automatically keep you within the free tier. Only set a budget if using Gemini Pro models.',
    limits: [
      { label: 'Requests / min',   value: '15 RPM',        note: 'Free tier (Flash models)' },
      { label: 'Requests / day',   value: '1,500 RPD',     note: 'Free tier hard cap — resets midnight PT' },
      { label: 'Tokens / min',     value: '1M TPM',        note: 'Free tier — very generous' },
      { label: 'Cost tracking',    value: 'Per token',     note: 'Flash: $0.10/M in · Pro: $1.25/M in' },
    ],
  },
  groq: {
    keyLabel:    'API Key (starts with gsk_...)',
    keyHelp:     'Create at: console.groq.com → API Keys',
    keyLink:     'https://console.groq.com/keys',
    limitsLink:  'https://console.groq.com/docs/rate-limits',
    freeTier:    'Permanent free tier: 30 req/min, 14,400 req/day. No credit card needed.',
    budgetTip:   'Free tier covers most use cases. Leave blank — rate limits automatically keep you within the free tier. Set 0 only if you want to completely prevent any Groq charges.',
    limits: [
      { label: 'Requests / min',   value: '30 RPM',        note: 'Free tier hard cap' },
      { label: 'Requests / day',   value: '14,400 RPD',    note: 'Free tier — resets midnight UTC' },
      { label: 'Tokens / min',     value: '6,000 TPM',     note: 'Free tier (Llama 8B: 30K TPM)' },
      { label: 'Cost tracking',    value: 'Per token',     note: 'Llama 8B: $0.05/M in — ultra cheap' },
    ],
  },
  deepseek: {
    keyLabel:    'API Key (starts with sk-...)',
    keyHelp:     'Create at: platform.deepseek.com → API Keys',
    keyLink:     'https://platform.deepseek.com/api_keys',
    limitsLink:  'https://platform.deepseek.com/docs/rate-limits',
    freeTier:    '5M free tokens on signup (valid 30 days). Pay-as-you-go after.',
    budgetTip:   'Very cheap: $0.14/M input tokens. A $5 budget lasts a long time.',
    limits: [
      { label: 'Requests / min',   value: '60 RPM',        note: 'Default tier' },
      { label: 'Tokens / min',     value: '100K TPM',      note: 'Default tier' },
      { label: 'Requests / day',   value: 'No daily cap',  note: 'Rate-limited by RPM/TPM' },
      { label: 'Cost tracking',    value: 'Per token',     note: 'V3: $0.14/M in · R1: $0.55/M in' },
    ],
  },
  mistral: {
    keyLabel:    'API Key',
    keyHelp:     'Create at: console.mistral.ai → API Keys',
    keyLink:     'https://console.mistral.ai/api-keys',
    limitsLink:  'https://docs.mistral.ai/deployment/rate-limits',
    freeTier:    'Experiment tier: 1 billion tokens/month free at 2 req/min.',
    budgetTip:   'Free Experiment tier: 1B tokens/month at no cost. Leave blank — rate limits automatically keep you within the free tier.',
    limits: [
      { label: 'Requests / min',   value: '2 RPM',         note: 'Free Experiment tier — very slow' },
      { label: 'Monthly tokens',   value: '1B tokens',     note: 'Free tier monthly cap' },
      { label: 'Requests / day',   value: 'No daily cap',  note: 'Rate-limited by RPM' },
      { label: 'Cost tracking',    value: 'Per token',     note: 'Small: $0.10/M in · Large: $2/M in' },
    ],
  },
  grok: {
    keyLabel:    'API Key (starts with xai-...)',
    keyHelp:     'Create at: console.x.ai → API Keys',
    keyLink:     'https://console.x.ai',
    limitsLink:  'https://docs.x.ai/docs/rate-limits',
    freeTier:    '$25 credit on signup + up to $150/mo via X data-sharing program.',
    budgetTip:   'Use the $25 signup credit first. Set budget to $25 to stay within the free credit.',
    limits: [
      { label: 'Requests / min',   value: '60 RPM',        note: 'Default tier' },
      { label: 'Tokens / min',     value: '500K TPM',      note: 'Default tier' },
      { label: 'Requests / day',   value: 'No daily cap',  note: 'Rate-limited by RPM/TPM' },
      { label: 'Cost tracking',    value: 'Per token',     note: 'Grok-4.1-fast: $0.20/M in' },
    ],
  },
};

function ProviderSettingsCard({ provider, onSaveKey, onRemoveKey, onSaveBudget, onSavePort, keyValue, setKeyValue, budgetValue, setBudgetValue, savedBudget, showToast }) {
  const [expanded,  setExpanded]  = useState(false);
  const [showKey,   setShowKey]   = useState(false);
  const [portValue, setPortValue] = useState('');
  const guide    = PROVIDER_GUIDE[provider.name] || {};
  const api      = window.aiQueue;
  const isLocal  = !!provider.local;  // local providers — no API key needed

  // true when budget is explicitly set to $0 (hard spend block)
  const isSpendBlocked = !isLocal && savedBudget === 0;

  // ── Tag label for header badge ─────────────────────────────────────────────
  const tierTag = isLocal
    ? { label: '🖥 local · free',   cls: 'tag-local'   }
    : ['gemini','groq','mistral'].includes(provider.name)
      ? { label: '★ free tier',     cls: 'tag-accent'  }
      : guide.freeTier
        ? { label: 'trial credits', cls: 'tag-accent'  }
        : null;

  return (
    <div className="settings-card" style={{ borderColor: provider.configured ? `${provider.color}40` : undefined }}>

      {/* ── Header ── */}
      <div className="sc-header" onClick={() => setExpanded(e => !e)}>
        <div className="sc-dot" style={{ background: isLocal ? '#a855f7' : provider.configured ? provider.color : '#3a3a3d' }} />
        <div className="sc-title">
          <span className="sc-name">{provider.displayName}</span>
          <span className={`tag ${isLocal ? 'tag-success' : provider.configured ? 'tag-success' : 'tag-muted'}`}>
            {isLocal ? '✓ always ready' : provider.configured ? '✓ configured' : 'not set up'}
          </span>
          {tierTag && (
            <span className={`tag ${tierTag.cls}`} style={{ fontSize: 10 }}>{tierTag.label}</span>
          )}
          {isSpendBlocked && (
            <span className="tag" style={{ fontSize: 10, background: 'rgba(248,113,113,0.12)', color: 'var(--danger)', border: '1px solid rgba(248,113,113,0.25)' }}>
              ⛔ spend blocked
            </span>
          )}
        </div>
        <div className="sc-links">
          {isLocal ? (
            <button className="ghost" style={{ fontSize: 11 }}
              onClick={e => { e.stopPropagation(); api.openExternal(guide.installLink); }}>
              {guide.installLabel} ↗
            </button>
          ) : (
            <>
              <button className="ghost" style={{ fontSize: 11 }}
                onClick={e => { e.stopPropagation(); api.openExternal(guide.keyLink); }}>
                Get API Key ↗
              </button>
              <button className="ghost" style={{ fontSize: 11 }}
                onClick={e => { e.stopPropagation(); api.openExternal(guide.limitsLink); }}>
                View Limits ↗
              </button>
            </>
          )}
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 16, marginLeft: 8 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="sc-body">

          {isLocal ? (
            /* ════════════════════════════════════════════
               LOCAL PROVIDER BODY
               ════════════════════════════════════════════ */
            <>
              {/* Zero-cost notice */}
              <div className="sc-notice sc-notice-local">
                <span style={{ marginRight: 6 }}>🖥️</span>
                <strong>No API key required.</strong> This provider runs on your own hardware.
                Every request costs $0.00 and your prompts never leave your machine.
              </div>

              {/* Setup instructions */}
              <div className="sc-section">
                <div className="sc-section-title">Setup</div>
                <div className="sc-help">{guide.setupText}</div>
                <div className="sc-quickstart">
                  <span style={{ color: 'var(--text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick start</span>
                  <code>{guide.quickstart}</code>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="primary" style={{ fontSize: 12 }}
                    onClick={() => api.openExternal(guide.installLink)}>
                    {guide.installLabel} ↗
                  </button>
                  <button className="secondary" style={{ fontSize: 12 }}
                    onClick={() => api.openExternal(guide.docsLink)}>
                    Browse Models ↗
                  </button>
                </div>
              </div>

              {/* Port configuration */}
              <div className="sc-section">
                <div className="sc-section-title">Server Port</div>
                <div className="sc-help">
                  The port your local server listens on.
                  {provider.currentPort !== provider.defaultPort && (
                    <span style={{ color: 'var(--accent)', marginLeft: 4 }}>
                      (custom — default is {provider.defaultPort})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <code style={{ color: 'var(--text3)', fontSize: 13, flexShrink: 0 }}>localhost:</code>
                  <input
                    type="number" min={1} max={65535} step={1}
                    placeholder={String(provider.currentPort || provider.defaultPort)}
                    value={portValue}
                    onChange={e => setPortValue(e.target.value)}
                    style={{ maxWidth: 110 }}
                  />
                  <button
                    className="primary"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={() => { onSavePort(provider.name, portValue); setPortValue(''); }}
                    disabled={!portValue || parseInt(portValue, 10) === provider.currentPort}
                  >Save</button>
                  {provider.currentPort !== provider.defaultPort && (
                    <button
                      className="secondary"
                      style={{ fontSize: 11, flexShrink: 0 }}
                      onClick={() => { setPortValue(''); onSavePort(provider.name, provider.defaultPort); }}
                    >Reset to {provider.defaultPort}</button>
                  )}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
                  Active URL: <code style={{ color: 'var(--accent)' }}>http://localhost:{provider.currentPort || provider.defaultPort}</code>
                </div>
              </div>

              {/* Limits (hardware-bound) */}
              <div className="sc-section">
                <div className="sc-section-title">Limits & Cost</div>
                <div className="sc-limits-grid">
                  {(guide.limits || []).map(l => (
                    <div key={l.label} className="sc-limit-row">
                      <span className="sc-limit-label">{l.label}</span>
                      <span className="sc-limit-value" style={{ color: '#22c55e' }}>{l.value}</span>
                      <span className="sc-limit-note">{l.note}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Models (dynamic) */}
              <div className="sc-section">
                <div className="sc-section-title">Available Models</div>
                <div className="sc-help" style={{ marginBottom: 8 }}>{guide.localNote}</div>
                <div className="sc-models-grid">
                  {(provider.models || []).map(m => (
                    <div key={m.id} className="sc-model-row">
                      <span className="sc-model-name">{m.name}</span>
                      <span className="sc-model-tier">{m.tier}</span>
                      <span className="sc-model-price" style={{ color: '#22c55e' }}>$0.00 / request</span>
                      <span className="tag tag-accent" style={{ fontSize: 10 }}>free</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* ════════════════════════════════════════════
               CLOUD PROVIDER BODY
               ════════════════════════════════════════════ */
            <>
              {/* Free tier notice */}
              {guide.freeTier && (
                <div className="sc-notice">
                  <span style={{ color: 'var(--accent)', marginRight: 6 }}>ℹ</span>
                  {guide.freeTier}
                </div>
              )}

              {/* API Key */}
              <div className="sc-section">
                <div className="sc-section-title">API Key</div>
                <div className="sc-help">{guide.keyHelp}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={showKey ? 'text' : 'password'}
                      placeholder={provider.configured ? '●●●●●●●● (paste to replace)' : `Paste ${guide.keyLabel || 'API key'}…`}
                      value={keyValue}
                      onChange={e => setKeyValue(e.target.value)}
                      style={{ paddingRight: 36 }}
                    />
                    <button
                      className="ghost"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 13, padding: '2px 4px' }}
                      onClick={() => setShowKey(s => !s)}
                      title={showKey ? 'Hide' : 'Show'}
                    >{showKey ? '🙈' : '👁'}</button>
                  </div>
                  <button
                    className="primary"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={() => onSaveKey(provider.name)}
                    disabled={!keyValue.trim()}
                  >Save Key</button>
                  {provider.configured && (
                    <button
                      className="secondary"
                      style={{ whiteSpace: 'nowrap', flexShrink: 0, color: 'var(--danger)' }}
                      onClick={() => onRemoveKey(provider.name)}
                    >Remove</button>
                  )}
                </div>
              </div>

              {/* Rate limits */}
              <div className="sc-section">
                <div className="sc-section-title">Rate Limits Reference</div>
                <div className="sc-help">These are the limits the queue respects automatically. No action needed — for your reference only.</div>
                <div className="sc-limits-grid">
                  {(guide.limits || []).map(l => (
                    <div key={l.label} className="sc-limit-row">
                      <span className="sc-limit-label">{l.label}</span>
                      <span className="sc-limit-value">{l.value}</span>
                      <span className="sc-limit-note">{l.note}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="ghost"
                  style={{ fontSize: 11, marginTop: 6, color: 'var(--text3)' }}
                  onClick={() => api.openExternal(guide.limitsLink)}
                >
                  Check your actual limits at {provider.name} console ↗
                </button>
              </div>

              {/* Monthly budget */}
              <div className="sc-section">
                <div className="sc-section-title">Monthly Spend Budget</div>
                <div className="sc-help">
                  The queue tracks your estimated spend based on tokens used.
                  You can set a monthly cap, block spending entirely, or leave it uncapped.
                </div>
                <div style={{ marginTop: 8, marginBottom: 2, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>0</span> = block all spending (no requests sent to this provider)
                  &nbsp;·&nbsp;
                  <span style={{ fontWeight: 600 }}>blank</span> = no limit
                  &nbsp;·&nbsp;
                  <span style={{ fontWeight: 600 }}>positive number</span> = monthly cap
                </div>
                <div className="sc-budget-tip">💡 {guide.budgetTip}</div>
                {isSpendBlocked && (
                  <div style={{ marginTop: 8, padding: '7px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, fontSize: 12, color: 'var(--danger)' }}>
                    ⛔ Spending is currently blocked on this provider. No requests will be sent until you change the budget.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <span style={{ color: 'var(--text3)', fontSize: 14, flexShrink: 0 }}>$</span>
                  <input
                    type="number" min={0} step={1}
                    placeholder="blank = no limit  ·  0 = block"
                    value={budgetValue ?? ''}
                    onChange={e => setBudgetValue(e.target.value)}
                    style={{ maxWidth: 200 }}
                  />
                  <span style={{ color: 'var(--text3)', fontSize: 12, flexShrink: 0 }}>USD / month</span>
                  <button
                    className="primary"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={() => onSaveBudget(provider.name)}
                  >Set Budget</button>
                </div>
              </div>

              {/* Models & pricing */}
              <div className="sc-section">
                <div className="sc-section-title">Available Models & Pricing</div>
                <div className="sc-models-grid">
                  {(provider.models || []).map(m => (
                    <div key={m.id} className="sc-model-row">
                      <span className="sc-model-name">{m.name}</span>
                      <span className="sc-model-tier">{m.tier}</span>
                      <span className="sc-model-price">${m.inputCost}/M in · ${m.outputCost}/M out</span>
                      {m.free && <span className="tag tag-accent" style={{ fontSize: 10 }}>free tier</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      )}

    </div>
  );
}

export function SettingsPanel({ providers, onRefresh, showToast }) {
  const [keys,          setKeys]          = useState({});
  const [budgets,       setBudgets]       = useState({});
  const [savedBudgets,  setSavedBudgets]  = useState({});
  // Web search state
  const [searchConfig,    setSearchConfig]    = useState({ backend: 'none', tavilyConfigured: false, searxngUrl: 'http://localhost:8888', configured: false });
  const [searchKeyInput,  setSearchKeyInput]  = useState('');
  const [showSearchKey,   setShowSearchKey]   = useState(false);
  const [searxngUrlInput, setSearxngUrlInput] = useState('');

  const api = window.aiQueue;

  // Load saved budgets once on mount so inputs reflect current state
  useEffect(() => {
    api.getBudgets().then(b => {
      const asStrings = {};
      for (const [k, v] of Object.entries(b)) {
        asStrings[k] = v === null ? '' : String(v);
      }
      setBudgets(prev => {
        const merged = { ...asStrings };
        for (const k of Object.keys(prev)) {
          if (prev[k] !== undefined) merged[k] = prev[k];
        }
        return merged;
      });
      setSavedBudgets(b);
    }).catch(() => {});

    // Load web search config
    api.getSearchConfig?.().then(cfg => {
      if (cfg) setSearchConfig(cfg);
    }).catch(() => {});
  }, []);

  async function onSaveKey(providerName) {
    const key = keys[providerName];
    if (!key?.trim()) return;
    try {
      await api.setApiKey(providerName, key.trim());
      setKeys(k => ({ ...k, [providerName]: '' }));
      showToast(`✓ API key saved for ${providerName}`, 'success');
      onRefresh();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function onRemoveKey(providerName) {
    await api.removeApiKey(providerName);
    showToast(`Removed key for ${providerName}`, 'info');
    onRefresh();
  }

  async function onSetSearchBackend(backend) {
    try {
      await api.setSearchBackend(backend);
      setSearchConfig(c => ({ ...c, backend }));
      showToast(backend === 'none' ? 'Web search disabled' : `Web search backend set to ${backend}`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function onSaveSearchKey() {
    if (!searchKeyInput.trim()) return;
    try {
      await api.setSearchKey(searchKeyInput.trim());
      setSearchKeyInput('');
      setSearchConfig(c => ({ ...c, tavilyConfigured: true, configured: true }));
      showToast('✓ Tavily API key saved', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function onRemoveSearchKey() {
    await api.removeSearchKey();
    setSearchConfig(c => ({ ...c, tavilyConfigured: false, configured: false }));
    showToast('Tavily key removed', 'info');
  }

  async function onSaveSearxngUrl() {
    const url = searxngUrlInput.trim() || 'http://localhost:8888';
    try {
      await api.setSearxngUrl(url);
      setSearxngUrlInput('');
      setSearchConfig(c => ({ ...c, searxngUrl: url }));
      showToast(`✓ SearXNG URL saved: ${url}`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function onSavePort(providerName, port) {
    const p = parseInt(port, 10);
    if (!p || p < 1 || p > 65535) {
      showToast('Invalid port — must be a number between 1 and 65535', 'error');
      return;
    }
    try {
      await api.setLocalPort(providerName, p);
      showToast(`✓ Port for ${providerName} set to ${p}`, 'success');
      onRefresh();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function onSaveBudget(providerName) {
    const raw = budgets[providerName];
    // Blank / empty → null (no limit).  '0' → 0 (hard block).  positive → cap.
    const parsed  = (raw === '' || raw == null) ? null : parseFloat(raw);
    const sanitized = (parsed === null || isNaN(parsed)) ? null : parsed;

    await api.setBudget(providerName, sanitized);
    setSavedBudgets(prev => ({ ...prev, [providerName]: sanitized }));

    if (sanitized === null) {
      showToast(`No spend limit set for ${providerName}`, 'info');
    } else if (sanitized === 0) {
      showToast(`⛔ Spending blocked for ${providerName} — no requests will be sent`, 'success');
    } else {
      showToast(`Budget set to $${sanitized}/mo for ${providerName}`, 'success');
    }
  }

  // Cloud providers that still need configuration (local providers are always ready)
  const cloudConfigured = providers.filter(p => !p.local && p.configured).length;
  const cloudTotal      = providers.filter(p => !p.local).length;

  // Shared card renderer
  const renderCard = p => (
    <ProviderSettingsCard
      key={p.name}
      provider={p}
      onSaveKey={onSaveKey}
      onRemoveKey={onRemoveKey}
      onSaveBudget={onSaveBudget}
      onSavePort={onSavePort}
      keyValue={keys[p.name] || ''}
      setKeyValue={v => setKeys(k => ({ ...k, [p.name]: v }))}
      budgetValue={budgets[p.name]}
      setBudgetValue={v => setBudgets(b => ({ ...b, [p.name]: v }))}
      savedBudget={savedBudgets[p.name]}
      showToast={showToast}
    />
  );

  return (
    <div>
      <div className="panel-title">Connectors</div>
      <div className="panel-sub">
        {cloudConfigured} of {cloudTotal} cloud providers configured · Local AI always available — click any provider to expand
      </div>

      {/* Quick-start tip for brand-new users */}
      {cloudConfigured === 0 && (
        <div className="tip-banner">
          <strong>Getting started:</strong> Want zero cost right now?
          Install <strong style={{ color: 'var(--text1)' }}>Ollama</strong>, <strong style={{ color: 'var(--text1)' }}>LM Studio</strong>, or <strong style={{ color: 'var(--text1)' }}>Jan.ai</strong> below — no API key, no account needed.
          Or grab a free cloud key from <strong style={{ color: 'var(--text1)' }}>Groq</strong> or <strong style={{ color: 'var(--text1)' }}>Gemini</strong> in under 2 minutes.
        </div>
      )}

      {/* Render providers in tier groups */}
      {PROVIDER_TIER_GROUPS.map(group => {
        const groupProviders = group.names
          .map(name => providers.find(p => p.name === name))
          .filter(Boolean);
        if (groupProviders.length === 0) return null;

        return (
          <div key={group.key} className="tier-section">
            <div className="tier-section-header">
              <span className="tier-section-icon">{group.icon}</span>
              <span className="tier-section-label" style={{ color: group.color }}>{group.label}</span>
              <span className="tier-section-sub">{group.sub}</span>
            </div>
            {groupProviders.map(renderCard)}
          </div>
        );
      })}

      {/* ── Web Search ─────────────────────────────────────────────────────── */}
      <div className="tier-section">
        <div className="tier-section-header">
          <span className="tier-section-icon">🌐</span>
          <span className="tier-section-label" style={{ color: '#0ea5e9' }}>Web Search</span>
          <span className="tier-section-sub">
            Real-time search context injected into prompts tagged 🌐 Web Search — works with any local or cloud model
          </span>
        </div>

        <div className="settings-card">
          <div className="sc-body" style={{ paddingTop: 12 }}>

            {/* Status notice */}
            <div className="sc-notice" style={{
              background: searchConfig.configured ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
              borderColor: searchConfig.configured ? 'rgba(34,197,94,0.25)' : undefined,
            }}>
              <span style={{ marginRight: 6 }}>{searchConfig.configured ? '✓' : 'ℹ'}</span>
              {searchConfig.configured
                ? `Web search active · backend: ${searchConfig.backend}`
                : 'Web search is disabled. Choose a backend below to enable it.'}
            </div>

            {/* Backend picker */}
            <div className="sc-section">
              <div className="sc-section-title">Search backend</div>
              <div className="sc-help">
                Tag a prompt with 🌐 Web Search and results are fetched before the prompt reaches the model —
                so any local LLM gets current information without needing tool-calling support.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {[
                  { id: 'none',    label: 'None (disabled)',  note: '' },
                  { id: 'tavily',  label: '☁ Tavily',         note: '1,000 free searches/mo · cloud API' },
                  { id: 'searxng', label: '🖥 SearXNG',        note: 'self-hosted · fully private' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={searchConfig.backend === opt.id ? 'primary' : 'secondary'}
                    style={{ fontSize: 12 }}
                    onClick={() => onSetSearchBackend(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tavily config */}
            {searchConfig.backend === 'tavily' && (
              <div className="sc-section">
                <div className="sc-section-title">Tavily API key</div>
                <div className="sc-help">
                  Free tier gives 1,000 searches/month — no credit card required.
                  Keys start with <code>tvly-</code>.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={showSearchKey ? 'text' : 'password'}
                      placeholder={searchConfig.tavilyConfigured ? '●●●●●●●● (paste to replace)' : 'tvly-xxxxxxxxxxxxxxxx'}
                      value={searchKeyInput}
                      onChange={e => setSearchKeyInput(e.target.value)}
                      style={{ paddingRight: 36 }}
                    />
                    <button
                      className="ghost"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 13, padding: '2px 4px' }}
                      onClick={() => setShowSearchKey(s => !s)}
                    >{showSearchKey ? '🙈' : '👁'}</button>
                  </div>
                  <button
                    className="primary"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={onSaveSearchKey}
                    disabled={!searchKeyInput.trim()}
                  >Save Key</button>
                  {searchConfig.tavilyConfigured && (
                    <button
                      className="secondary"
                      style={{ whiteSpace: 'nowrap', flexShrink: 0, color: 'var(--danger)' }}
                      onClick={onRemoveSearchKey}
                    >Remove</button>
                  )}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className="ghost" style={{ fontSize: 11 }}
                    onClick={() => api.openExternal('https://app.tavily.com')}>
                    Get free Tavily key ↗
                  </button>
                  <button className="ghost" style={{ fontSize: 11 }}
                    onClick={() => api.openExternal('https://docs.tavily.com')}>
                    Tavily docs ↗
                  </button>
                </div>
              </div>
            )}

            {/* SearXNG config */}
            {searchConfig.backend === 'searxng' && (
              <div className="sc-section">
                <div className="sc-section-title">SearXNG server URL</div>
                <div className="sc-help">
                  Run SearXNG locally with Docker. It aggregates results from Google, Bing, DuckDuckGo
                  and more — completely private, zero API cost.
                </div>
                <div className="sc-quickstart" style={{ marginTop: 8 }}>
                  <span style={{ color: 'var(--text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick start</span>
                  <code>docker run -p 8888:8080 -e SEARXNG_SEARCH_FORMATS="html,json" searxng/searxng</code>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={searchConfig.searxngUrl || 'http://localhost:8888'}
                    value={searxngUrlInput}
                    onChange={e => setSearxngUrlInput(e.target.value)}
                    style={{ flex: 1, maxWidth: 280 }}
                  />
                  <button
                    className="primary"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={onSaveSearxngUrl}
                  >Save URL</button>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
                  Active URL: <code style={{ color: 'var(--accent)' }}>{searchConfig.searxngUrl}</code>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className="ghost" style={{ fontSize: 11 }}
                    onClick={() => api.openExternal('https://docs.searxng.org')}>
                    SearXNG docs ↗
                  </button>
                  <button className="ghost" style={{ fontSize: 11 }}
                    onClick={() => api.openExternal('https://hub.docker.com/r/searxng/searxng')}>
                    Docker Hub ↗
                  </button>
                </div>
              </div>
            )}

            {/* How it works */}
            <div className="sc-section">
              <div className="sc-section-title">How it works</div>
              <div className="sc-limits-grid">
                <div className="sc-limit-row">
                  <span className="sc-limit-label">Trigger</span>
                  <span className="sc-limit-value" style={{ color: '#0ea5e9' }}>🌐 Web Search tag</span>
                  <span className="sc-limit-note">Add this tag to any prompt to activate search</span>
                </div>
                <div className="sc-limit-row">
                  <span className="sc-limit-label">Model support</span>
                  <span className="sc-limit-value" style={{ color: '#22c55e' }}>Any model</span>
                  <span className="sc-limit-note">No tool-calling required — results injected as context</span>
                </div>
                <div className="sc-limit-row">
                  <span className="sc-limit-label">Results</span>
                  <span className="sc-limit-value">Top 5</span>
                  <span className="sc-limit-note">Title, source URL, and excerpt per result</span>
                </div>
                <div className="sc-limit-row">
                  <span className="sc-limit-label">On search error</span>
                  <span className="sc-limit-value" style={{ color: '#f59e0b' }}>Graceful fallback</span>
                  <span className="sc-limit-note">Prompt still goes through without search context</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}

// ─── ProjectsPanel ────────────────────────────────────────────────────────────

export function ProjectsPanel({ projects, providers, onRefresh }) {
  const [name,  setName]  = useState('');
  const [desc,  setDesc]  = useState('');
  const [color, setColor] = useState('#6366f1');
  const api = window.aiQueue;

  const COLORS = ['#6366f1','#10a37f','#d97757','#f55036','#4285f4','#ff7000','#ec4899'];

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addProject({ name, description: desc, color });
    setName(''); setDesc('');
    onRefresh();
  }

  async function del(id) {
    await api.deleteProject(id);
    onRefresh();
  }

  return (
    <div>
      <div className="panel-title">Projects</div>
      <div className="panel-sub">Organise prompts into named projects. Each project keeps its conversation history.</div>

      <form onSubmit={add} className="card card-spaced">
        <div className="form-row form-row-3">
          <div className="form-group">
            <label>Project name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="My Project" required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label>Colour</label>
            <div className="color-swatch-row">
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <button type="submit" className="primary">Create project</button>
      </form>

      {projects.length === 0 && (
        <div className="empty-state">No projects yet. Create one above to organise your prompts.</div>
      )}

      <div className="grid-2">
        {projects.map(p => (
          <div key={p.id} className="card project-card" style={{ borderLeftColor: p.color }}>
            <div className="project-card-header">
              <span className="project-card-name">{p.name}</span>
              <button className="ghost" style={{ color: 'var(--danger)' }} onClick={() => del(p.id)}>✕</button>
            </div>
            {p.description && <div className="project-card-desc">{p.description}</div>}
            <div className="project-card-date">
              Created {new Date(p.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
