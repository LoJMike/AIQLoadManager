// ─── QueuePanel ──────────────────────────────────────────────────────────────

import { useState } from 'react';

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
              {item.task_type     && <span>{item.task_type}</span>}
              {item.project_name  && <span>📁 {item.project_name}</span>}
              {item.scheduled_for && <span>🕐 {new Date(item.scheduled_for).toLocaleString()}</span>}
              {item.cost_usd > 0  && <span>${item.cost_usd.toFixed(6)}</span>}
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

// Per-provider setup guide: where to get key, what limits mean, links
const PROVIDER_GUIDE = {
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
    budgetTip:   'Free tier is very generous. Only set a budget if using Pro models.',
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
    budgetTip:   'Free tier covers most use cases. Leave budget at $0 unless exceeding free limits.',
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
    budgetTip:   'Free tier is generous for testing. The 2 RPM limit means it processes slowly.',
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

function ProviderSettingsCard({ provider, onSaveKey, onRemoveKey, onSaveBudget, keyValue, setKeyValue, budgetValue, setBudgetValue, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [showKey,  setShowKey]  = useState(false);
  const guide = PROVIDER_GUIDE[provider.name] || {};
  const api   = window.aiQueue;

  return (
    <div className="settings-card" style={{ borderColor: provider.configured ? `${provider.color}40` : undefined }}>

      {/* ── Header ── */}
      <div className="sc-header" onClick={() => setExpanded(e => !e)}>
        <div className="sc-dot" style={{ background: provider.configured ? provider.color : '#3a3a3d' }} />
        <div className="sc-title">
          <span className="sc-name">{provider.displayName}</span>
          <span className={`tag ${provider.configured ? 'tag-success' : 'tag-muted'}`}>
            {provider.configured ? '✓ configured' : 'not set up'}
          </span>
          {guide.freeTier && (
            <span className="tag tag-accent" style={{ fontSize: 10 }}>
              {provider.name === 'gemini' || provider.name === 'groq' || provider.name === 'mistral' ? '★ free tier' : 'trial credits'}
            </span>
          )}
        </div>
        <div className="sc-links">
          <button className="ghost" style={{ fontSize: 11 }}
            onClick={e => { e.stopPropagation(); api.openExternal(guide.keyLink); }}>
            Get API Key ↗
          </button>
          <button className="ghost" style={{ fontSize: 11 }}
            onClick={e => { e.stopPropagation(); api.openExternal(guide.limitsLink); }}>
            View Limits ↗
          </button>
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 16, marginLeft: 8 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="sc-body">

          {/* ── Free tier notice ── */}
          {guide.freeTier && (
            <div className="sc-notice">
              <span style={{ color: 'var(--accent)', marginRight: 6 }}>ℹ</span>
              {guide.freeTier}
            </div>
          )}

          {/* ── API Key ── */}
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

          {/* ── Rate limits reference ── */}
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

          {/* ── Monthly budget ── */}
          <div className="sc-section">
            <div className="sc-section-title">Monthly Spend Budget</div>
            <div className="sc-help">
              AIQLoadManager tracks your estimated spend based on tokens used.
              Set a soft cap here — the queue will pause this provider when the limit is reached.
              Set to <strong>0</strong> for no limit.
            </div>
            <div className="sc-budget-tip">💡 {guide.budgetTip}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--text3)', fontSize: 14, flexShrink: 0 }}>$</span>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="0  (no limit)"
                value={budgetValue ?? ''}
                onChange={e => setBudgetValue(e.target.value)}
                style={{ maxWidth: 140 }}
              />
              <span style={{ color: 'var(--text3)', fontSize: 12, flexShrink: 0 }}>USD / month</span>
              <button
                className="primary"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => onSaveBudget(provider.name)}
              >Set Budget</button>
            </div>
          </div>

          {/* ── Models & pricing ── */}
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
      `}</style>
    </div>
  );
}

export function SettingsPanel({ providers, onRefresh, showToast }) {
  const [keys,    setKeys]    = useState({});
  const [budgets, setBudgets] = useState({});
  const api = window.aiQueue;

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
    const usd = parseFloat(budgets[providerName]) || 0;
    await api.setBudget(providerName, usd);
    showToast(`Budget set to $${usd}/mo for ${providerName}`, 'success');
  }

  const configured = providers.filter(p => p.configured).length;

  return (
    <div>
      <div className="panel-title">Settings</div>
      <div className="panel-sub">
        {configured} of {providers.length} providers configured — click any provider to expand
      </div>

      {/* Quick-start tip */}
      {configured === 0 && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(124,106,247,0.08)', border: '1px solid rgba(124,106,247,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--accent)' }}>Getting started:</strong> Groq and Gemini both have
          permanent free tiers with no credit card required — great for testing.
          Click either one below, get a free API key in under 2 minutes, and paste it in.
        </div>
      )}

      {providers.map(p => (
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
          showToast={showToast}
        />
      ))}
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
