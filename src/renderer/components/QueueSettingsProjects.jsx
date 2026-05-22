// ─── QueuePanel ──────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

const STATUS_COLORS = {
  pending:    'var(--text3)',
  processing: 'var(--accent)',
  complete:   'var(--success)',
  error:      'var(--danger)',
  cancelled:  'var(--text3)',
};

export function QueuePanel({ queue, providers, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const api = window.aiQueue;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="panel-title">Prompt Queue</div>
          <div className="panel-sub">{counts.pending} pending · {counts.complete} complete · {counts.error} errors</div>
        </div>
        <button className="secondary" onClick={clearDone}>Clear completed</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['all','pending','complete','error'].map(s => (
          <button
            key={s}
            className={filter === s ? 'primary' : 'secondary'}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setFilter(s)}
          >
            {s} <span style={{ opacity: 0.7 }}>({counts[s]})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 0', fontSize: 13 }}>
          {filter === 'all' ? 'Queue is empty — add prompts in the Add tab.' : `No ${filter} items.`}
        </div>
      )}

      {visible.map(item => (
        <div
          key={item.id}
          className={`queue-item ${item.status}`}
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
              {item.used_provider && <span>via {item.used_provider}</span>}
              {item.routing_mode  && item.routing_mode !== 'auto' && <span>{item.routing_mode}</span>}

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

            {/* Expanded response */}
            {expanded === item.id && item.response && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 6, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                {item.response}
              </div>
            )}

            {item.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)', background: 'rgba(248,113,113,0.07)', padding: '6px 10px', borderRadius: 5 }}>
                {item.error}
              </div>
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
    names: ['ollama', 'lmstudio'],
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
    baseURL:      'http://localhost:11434',
    quickstart:   'Run in your terminal:  ollama pull llama3.2',
    localNote:    'Models are detected automatically when Ollama is running. Pull any model from ollama.com/library and it will appear here on next use.',
    limits: [
      { label: 'Cost per request', value: '$0.00',         note: 'All computation runs on your hardware' },
      { label: 'Rate limit',       value: 'None',          note: 'Bounded only by your GPU / CPU speed' },
      { label: 'Internet required',value: 'No',            note: 'Fully offline after model download' },
      { label: 'Privacy',          value: 'Total',         note: 'Prompts never leave your machine' },
    ],
  },
  lmstudio: {
    installLabel: 'Download LM Studio',
    installLink:  'https://lmstudio.ai',
    docsLink:     'https://lmstudio.ai/docs',
    baseURL:      'http://localhost:1234',
    quickstart:   'In LM Studio: load a model, then open the Developer tab and start the Local Server.',
    localNote:    'Models are detected automatically from the running LM Studio server. Load a model in LM Studio\'s model browser to get started.',
    limits: [
      { label: 'Cost per request', value: '$0.00',         note: 'All computation runs on your hardware' },
      { label: 'Rate limit',       value: 'None',          note: 'Bounded only by your GPU / CPU speed' },
      { label: 'Internet required',value: 'No',            note: 'Fully offline after model download' },
      { label: 'Privacy',          value: 'Total',         note: 'Prompts never leave your machine' },
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

function ProviderSettingsCard({ provider, onSaveKey, onRemoveKey, onSaveBudget, keyValue, setKeyValue, budgetValue, setBudgetValue, savedBudget, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [showKey,  setShowKey]  = useState(false);
  const guide    = PROVIDER_GUIDE[provider.name] || {};
  const api      = window.aiQueue;
  const isLocal  = !!provider.local;  // Ollama, LM Studio — no API key needed

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
                <div className="sc-help">
                  {provider.name === 'ollama'
                    ? 'Download and install Ollama, then pull a model to get started.'
                    : 'Download and install LM Studio, load a model, then start the Local Server in the Developer tab.'}
                </div>
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
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
                  Server URL: <code style={{ color: 'var(--accent)' }}>{guide.baseURL}</code>
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

      <style>{`
        .settings-card {
          background: var(--bg1);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          margin-bottom: 10px;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .sc-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          cursor: pointer;
          user-select: none;
        }
        .sc-header:hover { background: var(--bg2); }
        .sc-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .sc-title { display: flex; align-items: center; gap: 8px; flex: 1; flex-wrap: wrap; }
        .sc-name { font-size: 14px; font-weight: 600; color: var(--text1); }
        .sc-links { display: flex; gap: 4px; margin-left: auto; }
        .sc-body { padding: 0 18px 18px; border-top: 1px solid var(--border); }
        .tag-local {
          background: rgba(168,85,247,0.12);
          color: #a855f7;
          border: 1px solid rgba(168,85,247,0.25);
        }
        .sc-notice {
          margin: 14px 0 0;
          padding: 8px 12px;
          background: rgba(124,106,247,0.08);
          border: 1px solid rgba(124,106,247,0.2);
          border-radius: 6px;
          font-size: 12px;
          color: var(--text2);
          line-height: 1.5;
        }
        .sc-notice-local {
          background: rgba(168,85,247,0.07);
          border-color: rgba(168,85,247,0.20);
        }
        .sc-quickstart {
          margin-top: 10px;
          padding: 8px 12px;
          background: var(--bg2);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sc-quickstart code {
          font-family: var(--mono, monospace);
          font-size: 12px;
          color: var(--accent);
          letter-spacing: 0.01em;
        }
        .sc-section { margin-top: 18px; }
        .sc-section-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 6px;
        }
        .sc-help { font-size: 12px; color: var(--text3); line-height: 1.5; }
        .sc-budget-tip {
          font-size: 12px;
          color: var(--warning);
          background: rgba(251,191,36,0.07);
          border-radius: 5px;
          padding: 7px 10px;
          margin-top: 8px;
          line-height: 1.5;
        }
        .sc-limits-grid { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
        .sc-limit-row {
          display: grid;
          grid-template-columns: 140px 110px 1fr;
          gap: 8px;
          align-items: center;
          font-size: 12px;
          padding: 5px 10px;
          background: var(--bg2);
          border-radius: 5px;
        }
        .sc-limit-label { color: var(--text3); }
        .sc-limit-value { color: var(--text1); font-weight: 600; }
        .sc-limit-note  { color: var(--text3); font-size: 11px; }
        .sc-models-grid { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
        .sc-model-row {
          display: grid;
          grid-template-columns: 160px 80px 1fr auto;
          gap: 8px;
          align-items: center;
          font-size: 12px;
          padding: 5px 10px;
          background: var(--bg2);
          border-radius: 5px;
        }
        .sc-model-name  { color: var(--text1); font-weight: 500; }
        .sc-model-tier  { color: var(--text3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
        .sc-model-price { color: var(--text2); font-size: 11px; }
        /* Tier section headers */
        .tier-section { margin-bottom: 28px; }
        .tier-section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0 12px;
          margin-bottom: 8px;
          border-bottom: 1px solid var(--border);
        }
        .tier-section-icon { font-size: 15px; flex-shrink: 0; }
        .tier-section-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text1);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .tier-section-sub { font-size: 11px; color: var(--text3); margin-left: 4px; }
      `}</style>
    </div>
  );
}

export function SettingsPanel({ providers, onRefresh, showToast }) {
  const [keys,          setKeys]          = useState({});
  const [budgets,       setBudgets]       = useState({});
  const [savedBudgets,  setSavedBudgets]  = useState({}); // what's actually stored
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
        // Don't overwrite anything the user is already typing
        for (const k of Object.keys(prev)) {
          if (prev[k] !== undefined) merged[k] = prev[k];
        }
        return merged;
      });
      setSavedBudgets(b);
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
        <div style={{ marginBottom: 24, padding: '12px 16px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.22)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--accent)' }}>Getting started:</strong> Want zero cost right now?
          Install <strong style={{ color: 'var(--text1)' }}>Ollama</strong> or <strong style={{ color: 'var(--text1)' }}>LM Studio</strong> below — no API key, no account needed.
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

      <form onSubmit={add} className="card" style={{ marginBottom: 20 }}>
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
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <button type="submit" className="primary">Create project</button>
      </form>

      {projects.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: 13 }}>
          No projects yet. Create one above to organise your prompts.
        </div>
      )}

      <div className="grid-2">
        {projects.map(p => (
          <div key={p.id} className="card" style={{ borderLeft: `3px solid ${p.color}`, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
              <button className="ghost" style={{ color: 'var(--danger)' }} onClick={() => del(p.id)}>✕</button>
            </div>
            {p.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{p.description}</div>}
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Created {new Date(p.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
